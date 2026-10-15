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
import { getAnswerHistory, getQuizBuilderRows } from '@/lib/attempts/queries';
import { BUILDER_MIN_QUESTIONS, type KeywordResult, type QuizBuilderLoad } from '@/lib/attempts/types';
import { knownItemIds, searchConceptItemIds } from '@/lib/bank/queries';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getConfig, getCourses } from '@/lib/catalogue/queries';
import { buildOfflineOwnerLabel, buildOfflinePackDefaultName, buildOfflinePackDisplayLabel, maskEmailForOffline, ownerNameOf, safeArray } from './labels';
import { packDoorFor } from './door';
import { checkinDaysOf, getOfflinePackAllowance, getOfflinePackForRender, pickOfflinePackItemIds } from './queries';
import { toPackQuestions } from './questions';
import {
  OFFLINE_MAX_QUESTIONS_DEFAULT,
  type CreatePackInput,
  type CreatePackResult,
  type DeletePackResult,
  type MakePackInput,
  type PhonePackLoad,
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

// ── the pack builder (07.2; Sam, 2026-10-15) ───────────────────────────
// The Quiz Builder's page with a pack's extras (components/builder). Each
// action asks the pack door first (lib/offline-packs/door) — a course held
// now whose package includes packs — so the page can never ask for more
// than it was offered; the database holds the allowance at the make.

const NOT_OPEN = 'Offline packs are not open for this course.';
const NO_LOAD = 'Could not load the questions for this course. Please try again.';

/** A course's pool for a pack: its Practice and Free questions' light rows, each marked seen / got wrong. */
export async function loadPackBuilderCourse(courseId: string): Promise<QuizBuilderLoad> {
  const gate = await requireStudent();
  const door = await packDoorFor(gate, String(courseId || ''));
  if (!door) return { ok: false, error: NOT_OPEN };
  const [rows, history] = await Promise.all([
    getQuizBuilderRows(gate.supabase, door.course_id, false),
    getAnswerHistory(gate.supabase, gate.profile.user_id, door.course_id),
  ]);
  if (!rows || !history) return { ok: false, error: NO_LOAD };
  return { ok: true, items: rows.map((r) => ({ ...r, seen: history.has(r.item_id), wrong: history.get(r.item_id) === true })) };
}

/** The keyword's matching ids in this course's Practice and Free questions. */
export async function searchPackBuilderKeyword(courseId: string, word: string): Promise<KeywordResult> {
  const gate = await requireStudent();
  const door = await packDoorFor(gate, String(courseId || ''));
  if (!door) return { ok: false, error: NOT_OPEN };
  const q = String(word || '').trim().slice(0, 80);
  if (!q) return { ok: true, itemIds: [] };
  return { ok: true, itemIds: await searchConceptItemIds(createServiceRoleClient(), door.course_id, q) };
}

/**
 * Make pack: the questions matching the student's choices (the pool, as
 * the page worked it out), how many, and the name. The questions not in
 * the student's earlier packs come first, at random (pickOfflinePackItemIds);
 * then the pack is made as before (createOfflinePack: the allowance, every
 * id this course's, published and in the practice bank, the watermark).
 */
export async function makeOfflinePack(input: MakePackInput): Promise<CreatePackResult> {
  const gate = await requireStudent();
  const { supabase, profile } = gate;
  const safeCourseId = String(input?.course_id || '').trim().toUpperCase();
  const door = await packDoorFor(gate, safeCourseId);
  if (!door) return { ok: false, reason: 'not_allowed', message: NOT_OPEN, allowance: null };
  if (door.packsLeft === 0) {
    return { ok: false, reason: 'limit_reached', message: 'You have used all your offline packs for this course.', allowance: null };
  }

  const cfg = await getConfig(supabase);
  const maxQuestions = Number(cfg.offline_max_questions) > 0 ? Number(cfg.offline_max_questions) : OFFLINE_MAX_QUESTIONS_DEFAULT;
  const pool = safeArray(input.pool_ids);
  const n = Math.min(maxQuestions, pool.length, Math.max(BUILDER_MIN_QUESTIONS, Math.floor(Number(input.n) || 0)));
  if (pool.length < BUILDER_MIN_QUESTIONS || n < BUILDER_MIN_QUESTIONS) {
    return { ok: false, reason: 'no_items_match', message: `A pack needs at least ${BUILDER_MIN_QUESTIONS} questions.`, allowance: null };
  }

  const allowance = await getOfflinePackAllowance(supabase, profile.user_id, safeCourseId);
  const pick = await pickOfflinePackItemIds(supabase, profile.user_id, safeCourseId, pool, n, allowance.period_start);
  if (!pick.item_ids.length) {
    return { ok: false, reason: 'no_items_match', message: 'No questions were selected.', allowance };
  }

  return createOfflinePack({
    course_id: safeCourseId,
    item_ids: pick.item_ids,
    pack_name: String(input.pack_name || '').trim(),
    selection_mode: input.selection_mode === 'concept' ? 'concept' : 'topics',
    maintopics: safeArray(input.maintopics),
    subtopics: [],
    difficulties: safeArray(input.difficulties),
    question_types: safeArray(input.question_types),
    concepts: [],
    concept_query: String(input.concept_query || '').trim(),
    display_label: '',
  });
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
  if (allowance.remaining !== null && allowance.remaining < 1) {
    return { ok: false, reason: 'limit_reached', message: 'You have reached your offline pack limit for this course.', allowance };
  }

  // Server-side: every id must be one of the course's items, kept in the
  // order the pick gave (a wrong id is dropped, as create_offline_pack
  // would drop it later) — and in the Practice or Free pool (06.8), which
  // is all the builder offered.
  const known = await knownItemIds(supabase, safeCourseId, safeIds);
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

  // The header and one offline_pack_items row per question, the
  // questions copied from the bank in one database function (03 Q4).
  // EXECUTE is revoked from the browser roles: the service role, after
  // the gates above.
  const { error } = await createServiceRoleClient().rpc('create_offline_pack', {
    p_pack_id: packId,
    p_user_id: profile.user_id,
    p_course_id: safeCourseId,
    p_item_ids: orderedIds,
    p_pack_name: packName.slice(0, 120),
    p_selection_mode: metaForLabels.selection_mode,
    p_maintopics: safeArray(input.maintopics),
    p_subtopics: safeArray(input.subtopics),
    p_difficulties: safeArray(input.difficulties),
    p_question_types: safeArray(input.question_types),
    p_concept_query: String(input.concept_query || '').trim() || null,
    p_display_label: displayLabel,
    p_watermark: watermark,
  });
  if (error) {
    console.error('createOfflinePack:', error);
    return { ok: false, reason: 'insert_failed', message: error.message, allowance };
  }

  return { ok: true, pack_id: packId, remaining: allowance.remaining === null ? null : Math.max(0, allowance.remaining - 1) };
}

// ── Save to this phone (07.3; Sam, 2026-10-15) ─────────────────────────
// The pack's questions for the phone's own copy, read as their owner (a
// pack carries its answers by design; no explanation since 07.6), with the
// course's name for the offline screen's headings and Config's check-in
// period. Only the student's own active pack; the phone keeps what comes
// back (lib/offline-packs/phone).
export async function getPackForPhone(packId: string): Promise<PhonePackLoad> {
  const gate = await requireStudent();
  const [load, courses, config] = await Promise.all([
    getOfflinePackForRender(gate.supabase, gate.profile.user_id, String(packId || '').trim()),
    getCourses(gate.supabase),
    getConfig(gate.supabase),
  ]);
  if (!load.ok) {
    return {
      ok: false,
      message: load.code === 'pack_lookup_failed' ? 'Could not load this pack. Please try again.' : 'This pack could not be found.',
    };
  }
  const { pack } = load;
  return {
    ok: true,
    pack: {
      pack_id: pack.pack_id,
      user_id: gate.profile.user_id,
      course_id: pack.course_id,
      course_title: courses.find((c) => c.course_id === pack.course_id)?.title ?? pack.course_id,
      pack_name: pack.pack_name || 'Offline pack',
      question_count: load.items.length,
      created_utc: pack.created_utc,
    },
    questions: toPackQuestions(load.items),
    checkinDays: checkinDaysOf(config),
  };
}

// ── Delete a pack (07.7; Sam, 2026-10-15) ──────────────────────────────
// The student's own active pack is marked deleted: it leaves My packs and
// no longer opens, and its row stays, so it still counts against the
// allowance (pack_allowance counts every pack made). The browser holds no
// write on offline_packs: the service role, scoped to the gate's student.
export async function deleteOfflinePack(packId: string): Promise<DeletePackResult> {
  const { profile } = await requireStudent();
  const safeId = String(packId || '').trim();
  if (!safeId) return { ok: false, message: 'Could not delete this pack.' };
  const { data, error } = await createServiceRoleClient()
    .from('offline_packs')
    .update({ status: 'deleted', updated_utc: new Date().toISOString() })
    .eq('pack_id', safeId)
    .eq('user_id', profile.user_id)
    .eq('status', 'active')
    .select('pack_id');
  if (error) {
    console.error('deleteOfflinePack:', error);
    return { ok: false, message: 'Could not delete this pack. Please try again.' };
  }
  if (!data || !data.length) return { ok: false, message: 'This pack could not be found.' };
  return { ok: true };
}
