// lib/offline-packs/queries.ts
//
// The offline-pack reads, transcribed one for one from legacy
// js/mynmclicensure-api.js: getUsedOfflinePackItemIds,
// getSubscriptionsForOfflineCourse, getOfflinePackAllowance,
// pickOfflinePackItemIds, getOfflinePackForRender. Each takes the
// caller's per-request client and, as legacy, fails open on a read
// error: logged, and an empty result (or a failed allowance) returned.
//
// RLS is the floor, not the filter (AGENTS.md): every read names the
// student in the query.

import type { ServerSupabaseClient } from '@/lib/access';
import { getItemsByIds } from '@/lib/bank/queries';
import type { Item } from '@/lib/bank/types';
import { getConfig } from '@/lib/catalogue/queries';
import type { Allowance, OfflinePack, PickResult } from './types';
import { OFFLINE_PACKS_PER_COURSE_DEFAULT } from './types';

// ── the item ids of the student's earlier active packs for the course ──
// legacy getUsedOfflinePackItemIds; the period start narrows it to the
// current subscription period when the allowance found one.
export async function getUsedOfflinePackItemIds(
  db: ServerSupabaseClient,
  userId: string,
  courseId: string,
  periodStartIso: string | null,
): Promise<Set<string>> {
  const safeUserId = String(userId || '').trim();
  const safeCourseId = String(courseId || '').trim().toUpperCase();
  if (!safeUserId || !safeCourseId) return new Set();

  let query = db
    .from('offline_packs')
    .select('item_ids')
    .eq('user_id', safeUserId)
    .eq('course_id', safeCourseId)
    .eq('status', 'active');
  if (periodStartIso) query = query.gte('created_utc', periodStartIso);

  const { data, error } = await query;
  if (error) {
    console.error('getUsedOfflinePackItemIds:', error);
    return new Set();
  }

  const used = new Set<string>();
  for (const row of (data ?? []) as { item_ids: string[] | null }[]) {
    for (const id of row.item_ids ?? []) {
      const safeId = String(id || '').trim();
      if (safeId) used.add(safeId);
    }
  }
  return used;
}

// ── the non-repeat picker (legacy pickOfflinePackItemIds) ─────────────
// Unused items first (a random subset), then reused ones only for the
// shortfall — the pool recycles only when it is exhausted.
export async function pickOfflinePackItemIds(
  db: ServerSupabaseClient,
  userId: string,
  courseId: string,
  poolItemIds: string[],
  n: number,
  periodStartIso: string | null,
): Promise<PickResult> {
  const pool = [...new Set(poolItemIds.map((id) => String(id || '').trim()).filter(Boolean))];
  const target = Math.max(0, Number(n || 0));
  if (!pool.length || target < 1) return { item_ids: [], unused_selected: 0, reused_selected: 0, pool_size: pool.length };

  const usedSet = await getUsedOfflinePackItemIds(db, userId, courseId, periodStartIso);

  const unusedCandidates: string[] = [];
  const usedCandidates: string[] = [];
  for (const id of pool) (usedSet.has(id) ? usedCandidates : unusedCandidates).push(id);

  const takeUnused = Math.min(target, unusedCandidates.length);
  const needMore = Math.max(0, target - takeUnused);
  const pickedUnused = takeUnused > 0 ? shuffleArray(unusedCandidates).slice(0, takeUnused) : [];
  const pickedUsed = needMore > 0 ? shuffleArray(usedCandidates).slice(0, needMore) : [];

  return {
    item_ids: pickedUnused.concat(pickedUsed),
    unused_selected: pickedUnused.length,
    reused_selected: pickedUsed.length,
    pool_size: pool.length,
  };
}

// legacy shuffleArray (Math.random Fisher–Yates).
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── the student's subscriptions that cover the course ─────────────────
// legacy getSubscriptionsForOfflineCourse — every status, joined to the
// product; filtered by courses_included in code.
type SubRow = {
  subscription_id: string;
  user_id: string;
  product_id: string;
  start_utc: string | null;
  expires_utc: string | null;
  status: string | null;
  source: string | null;
  products: { product_id: string; name: string; kind: string | null; courses_included: string[] | null } | null;
};

async function getSubscriptionsForOfflineCourse(db: ServerSupabaseClient, userId: string, courseId: string): Promise<SubRow[]> {
  const { data, error } = await db
    .from('subscriptions')
    .select('subscription_id, user_id, product_id, start_utc, expires_utc, status, source, products ( product_id, name, kind, courses_included )')
    .eq('user_id', userId);
  if (error) {
    console.error('getSubscriptionsForOfflineCourse:', error);
    return [];
  }
  const cid = String(courseId || '').trim().toUpperCase();
  return ((data ?? []) as unknown as SubRow[]).filter((sub) =>
    (sub.products?.courses_included ?? []).map((v) => String(v || '').trim().toUpperCase()).includes(cid),
  );
}

function isActiveSubscriptionNow(sub: SubRow): boolean {
  if (String(sub.status || '').toUpperCase() !== 'ACTIVE') return false;
  const exp = sub.expires_utc ? new Date(sub.expires_utc).getTime() : NaN;
  if (Number.isNaN(exp)) return false;
  return exp > Date.now();
}

function isTrialProduct(sub: SubRow): boolean {
  return String(sub.products?.kind || '').trim().toUpperCase() === 'TRIAL';
}

// ── the allowance (legacy getOfflinePackAllowance) ────────────────────
// In order: no subscription covers the course → not_subscribed; none
// active → renew_required; only trials → trial_not_allowed; else count
// the active packs since the earliest qualifying subscription started
// against offline_packs_per_course.
export async function getOfflinePackAllowance(db: ServerSupabaseClient, userId: string, courseId: string): Promise<Allowance> {
  const safeCourseId = String(courseId || '').trim().toUpperCase();
  const cfg = await getConfig(db);
  const downloadsPerCourse =
    Number(cfg.offline_packs_per_course) > 0 ? Number(cfg.offline_packs_per_course) : OFFLINE_PACKS_PER_COURSE_DEFAULT;

  const blocked = (reason: Allowance['blocked_reason'], isTrial = false, periodStart: string | null = null): Allowance => ({
    success: false,
    allowed: false,
    blocked_reason: reason,
    course_id: safeCourseId,
    downloads_per_course: downloadsPerCourse,
    used_this_period: 0,
    remaining: 0,
    period_start: periodStart,
    is_trial: isTrial,
  });

  const allCourseSubs = await getSubscriptionsForOfflineCourse(db, userId, safeCourseId);
  if (!allCourseSubs.length) return blocked('not_subscribed');

  const activeCourseSubs = allCourseSubs.filter(isActiveSubscriptionNow);
  if (!activeCourseSubs.length) return blocked('renew_required');

  const qualifyingSubs = activeCourseSubs.filter((sub) => !isTrialProduct(sub));
  if (!qualifyingSubs.length) return blocked('trial_not_allowed', true);

  const periodStartIso =
    qualifyingSubs
      .map((sub) => String(sub.start_utc || '').trim())
      .filter(Boolean)
      .sort()[0] || null;

  let query = db
    .from('offline_packs')
    .select('pack_id, created_utc', { count: 'exact' })
    .eq('user_id', userId)
    .eq('course_id', safeCourseId)
    .eq('status', 'active');
  if (periodStartIso) query = query.gte('created_utc', periodStartIso);

  const { count, error } = await query;
  if (error) {
    console.error('getOfflinePackAllowance:', error);
    return blocked('allowance_check_failed', false, periodStartIso);
  }

  const usedThisPeriod = Number(count || 0);
  const remaining = Math.max(0, downloadsPerCourse - usedThisPeriod);
  return {
    success: true,
    allowed: remaining > 0,
    blocked_reason: null,
    course_id: safeCourseId,
    downloads_per_course: downloadsPerCourse,
    used_this_period: usedThisPeriod,
    remaining,
    period_start: periodStartIso,
    is_trial: false,
  };
}

// ── the renderer's read (legacy getOfflinePackForRender) ──────────────
export type RenderLoad =
  | { ok: true; pack: OfflinePack; items: Item[]; missing_item_ids: string[] }
  | { ok: false; code: 'pack_lookup_failed' | 'pack_not_found' | 'pack_inactive'; message: string };

export async function getOfflinePackForRender(db: ServerSupabaseClient, userId: string, packId: string): Promise<RenderLoad> {
  const { data, error } = await db.from('offline_packs').select('*').eq('pack_id', packId).eq('user_id', userId).maybeSingle();
  if (error) {
    console.error('getOfflinePackForRender:', error);
    return { ok: false, code: 'pack_lookup_failed', message: error.message };
  }
  const pack = data as OfflinePack | null;
  if (!pack) return { ok: false, code: 'pack_not_found', message: 'Offline pack not found.' };
  if (String(pack.status || '').toLowerCase() !== 'active') {
    return { ok: false, code: 'pack_inactive', message: 'This offline pack is not active.' };
  }

  const savedIds = Array.isArray(pack.item_ids) ? pack.item_ids : [];
  const items = await getItemsByIds(db, pack.course_id, savedIds);
  const found = new Set(items.map((it) => String(it.item_id || '').trim()));
  const missing = savedIds.filter((id) => !found.has(String(id || '').trim()));

  return { ok: true, pack, items, missing_item_ids: missing };
}
