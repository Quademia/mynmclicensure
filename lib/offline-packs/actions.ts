// lib/offline-packs/actions.ts
//
// The builder's two Server Actions, behind the student gate. Legacy ran
// both steps from the browser (offline-pack-builder.html openOfflineModal
// and createPackFromModal calling the API's getOfflinePackAllowance,
// pickOfflinePackItemIds and createOfflinePack with direct
// `db.from('offline_packs')` calls). Here the allowance check, the pick
// against the student's earlier packs, and the check that every id is
// one of the course's items run on the server (rebuild.md §12 slice 13,
// Sam 2026-09-14 — the same principle as slice 6's score: invisible to
// a student, and a tampered request cannot mint a pack). The words and
// the order of the checks are legacy's.

'use server';

import { requireStudent } from '@/lib/access';
import { getItemsByIds } from '@/lib/bank/queries';
import { getConfig } from '@/lib/catalogue/queries';
import { buildOfflineOwnerLabel, buildOfflinePackDefaultName, buildOfflinePackDisplayLabel, maskEmailForOffline, ownerNameOf, safeArray } from './labels';
import { getOfflinePackAllowance, listOfflinePacks, pickOfflinePackItemIds } from './queries';
import {
  MY_PACKS_PAGE_SIZE,
  OFFLINE_MAX_QUESTIONS_DEFAULT,
  type CreatePackInput,
  type CreatePackResult,
  type OfflinePackPage,
  type PrepareResult,
} from './types';

// legacy makeOfflinePackId: 'PACK_' + Date.now() + '_' + makeSecureId('').slice(0, 8)
function makeOfflinePackId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return 'PACK_' + Date.now() + '_' + hex.slice(0, 8);
}

// ── "Create pack" (legacy openOfflineModal): the allowance, then the pick ──
export async function prepareOfflinePack(courseId: string, poolItemIds: string[], n: number): Promise<PrepareResult> {
  const { supabase, profile } = await requireStudent();
  const safeCourseId = String(courseId || '').trim().toUpperCase();
  if (!safeCourseId) return { ok: false, reason: 'missing_course_id', allowance: null };

  const allowance = await getOfflinePackAllowance(supabase, profile.user_id, safeCourseId);
  if (!allowance.success) return { ok: false, reason: allowance.blocked_reason || 'allowance_check_failed', allowance };
  if (!allowance.allowed) return { ok: false, reason: 'limit_reached', allowance };

  const pool = Array.isArray(poolItemIds) ? poolItemIds : [];
  const pick = await pickOfflinePackItemIds(
    supabase,
    profile.user_id,
    safeCourseId,
    pool,
    Math.min(Number(n || 0), pool.length),
    allowance.period_start,
  );
  return { ok: true, allowance, pick };
}

// ── "Create & Download" (legacy createOfflinePack) ─────────────────────
export async function createOfflinePack(input: CreatePackInput): Promise<CreatePackResult> {
  const { supabase, profile } = await requireStudent();
  const cfg = await getConfig(supabase);
  const maxQuestions = Number(cfg.offline_max_questions) > 0 ? Number(cfg.offline_max_questions) : OFFLINE_MAX_QUESTIONS_DEFAULT;

  const safeCourseId = String(input.course_id || '').trim().toUpperCase();
  const safeIds = safeArray(input.item_ids);

  if (!safeCourseId) {
    return { ok: false, reason: 'missing_course_id', message: 'Course is required.', allowance: null };
  }
  if (!safeIds.length) {
    return { ok: false, reason: 'no_items_match', message: 'No questions were selected.', allowance: null };
  }
  if (safeIds.length > maxQuestions) {
    return {
      ok: false,
      reason: 'question_limit_exceeded',
      message: `This offline pack exceeds the current limit of ${maxQuestions} questions.`,
      allowance: null,
    };
  }

  const allowance = await getOfflinePackAllowance(supabase, profile.user_id, safeCourseId);
  if (!allowance.success) {
    return { ok: false, reason: allowance.blocked_reason || 'not_allowed', message: 'Offline pack access is currently blocked.', allowance };
  }
  if (allowance.remaining < 1) {
    return { ok: false, reason: 'limit_reached', message: 'You have reached your offline pack limit for this course.', allowance };
  }

  // Server-side: every id must be one of the course's items, kept in the
  // order the pick gave (a wrong id is dropped, as the renderer's
  // getItemsByIds would drop it later).
  const items = await getItemsByIds(supabase, safeCourseId, safeIds);
  const known = new Set(items.map((i) => i.item_id));
  const orderedIds = safeIds.filter((id) => known.has(id));
  if (!orderedIds.length) {
    return { ok: false, reason: 'no_items_match', message: 'No questions were selected.', allowance };
  }

  const packId = makeOfflinePackId();
  const ownerName = ownerNameOf(profile);
  const ownerEmailMask = maskEmailForOffline(profile.email);
  const watermark = {
    pack_id: packId,
    user_id: profile.user_id,
    owner_name: ownerName,
    owner_email_mask: ownerEmailMask,
    owner_label: buildOfflineOwnerLabel(ownerName, ownerEmailMask),
  };

  const metaForLabels = {
    n: orderedIds.length,
    selection_mode: input.selection_mode === 'concept' ? ('concept' as const) : ('topics' as const),
    maintopics: input.maintopics || [],
    difficulties: input.difficulties || [],
    concepts: input.concepts || [],
    concept_query: input.concept_query || '',
  };
  const displayLabel = String(input.display_label || '').trim() || buildOfflinePackDisplayLabel(metaForLabels);
  const packName = String(input.pack_name || '').trim() || buildOfflinePackDefaultName(metaForLabels);

  const { error } = await supabase.from('offline_packs').insert({
    pack_id: packId,
    user_id: profile.user_id,
    course_id: safeCourseId,
    pack_name: packName.slice(0, 120),
    selection_mode: metaForLabels.selection_mode,
    maintopics: safeArray(input.maintopics),
    subtopics: safeArray(input.subtopics),
    difficulties: safeArray(input.difficulties),
    question_types: safeArray(input.question_types),
    concept_query: String(input.concept_query || '').trim() || null,
    display_label: displayLabel,
    item_ids: orderedIds,
    question_count: orderedIds.length,
    watermark,
    status: 'active',
  });
  if (error) {
    console.error('createOfflinePack:', error);
    return { ok: false, reason: 'insert_failed', message: error.message, allowance };
  }

  return { ok: true, pack_id: packId, remaining: Math.max(0, (allowance.remaining || 0) - 1) };
}

// ── My Packs' Load More and Refresh (legacy loadNextPage, 13b) ─────────
export async function loadOfflinePacksPage(offset: number): Promise<OfflinePackPage> {
  const { supabase, profile } = await requireStudent();
  return listOfflinePacks(supabase, profile.user_id, MY_PACKS_PAGE_SIZE, Math.max(0, Math.floor(Number(offset) || 0)));
}
