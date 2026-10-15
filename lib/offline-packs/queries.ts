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
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Allowance, OfflinePack, OfflinePackItem, OfflinePackListRow, OfflinePackPage, PickResult } from './types';

// ── the item ids of the student's earlier active packs for the course ──
// legacy getUsedOfflinePackItemIds; the period start narrows it to the
// current subscription period when the allowance found one. Since 03 Q4
// the ids come from the packs' own rows (offline_pack_items), two reads:
// the packs, then their rows.
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
    .select('pack_id')
    .eq('user_id', safeUserId)
    .eq('course_id', safeCourseId)
    .eq('status', 'active');
  if (periodStartIso) query = query.gte('created_utc', periodStartIso);

  const { data: packs, error } = await query;
  if (error) {
    console.error('getUsedOfflinePackItemIds:', error);
    return new Set();
  }
  const packIds = (packs ?? []).map((p) => String((p as { pack_id: string }).pack_id || '').trim()).filter(Boolean);
  if (!packIds.length) return new Set();

  const { data: rows, error: rowsError } = await db.from('offline_pack_items').select('item_id').in('pack_id', packIds);
  if (rowsError) {
    console.error('getUsedOfflinePackItemIds rows:', rowsError);
    return new Set();
  }

  const used = new Set<string>();
  for (const row of (rows ?? []) as { item_id: string | null }[]) {
    const safeId = String(row.item_id || '').trim();
    if (safeId) used.add(safeId);
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

// ── the allowance (07.1) ──────────────────────────────────────────────
// The package's packs per course, from the database's one rule —
// pack_allowance(), which create_offline_pack asks too: the course's live
// grants and the best of them (unlimited if any has no count, else the one
// with the most left). Every pack made since that grant began counts,
// deleted ones too (07.7). Service role: the function is server only; the
// caller has passed the student gate and `userId` is the gate's.
export async function getOfflinePackAllowance(_db: ServerSupabaseClient, userId: string, courseId: string): Promise<Allowance> {
  const safeCourseId = String(courseId || '').trim().toUpperCase();
  const blocked = (reason: Allowance['blocked_reason'], limit: number | null = null): Allowance => ({
    success: false,
    allowed: false,
    blocked_reason: reason,
    course_id: safeCourseId,
    downloads_per_course: limit,
    used_this_period: 0,
    remaining: 0,
    period_start: null,
    is_trial: false,
  });

  type Row = { granted: boolean; allowed: number | null; used: number; packs_left: number | null; since: string | null };
  const { data, error } = await createServiceRoleClient().rpc('pack_allowance', { p_user_id: userId, p_course_id: safeCourseId });
  if (error) {
    console.error('getOfflinePackAllowance:', error);
    return blocked('allowance_check_failed');
  }
  const row = ((Array.isArray(data) ? data[0] : data) ?? null) as Row | null;
  if (!row || !row.granted) return blocked('not_subscribed');
  if (row.allowed === 0) return blocked('not_included', 0);

  const remaining = row.packs_left === null ? null : Math.max(0, Number(row.packs_left));
  return {
    success: true,
    allowed: remaining === null || remaining > 0,
    blocked_reason: null,
    course_id: safeCourseId,
    downloads_per_course: row.allowed === null ? null : Number(row.allowed),
    used_this_period: Number(row.used || 0),
    remaining,
    period_start: row.since,
    is_trial: false,
  };
}

// ── the renderer's read (legacy getOfflinePackForRender) ──────────────
// Since 03 Q4 the questions are the pack's own rows, in position order,
// read as the owner (the student holds SELECT on the row's 27 columns —
// a pack carries its key by design). A pack can no longer lose a
// question, so the "missing count" of the pointer-list days is gone.
//
// The columns are NAMED, not `*`: since 08 B4 (2026-09-26) the student's
// SELECT on offline_pack_items is a column list (the three snapshot
// columns B4 added — bloom_level, tags, version — are not in it until a
// student surface reads them), and PostgREST passes `*` to Postgres as
// a literal `*`, which needs SELECT on every column it expands to. The
// migration's reviewer caught this before the apply; with `*` the page
// failed with "permission denied" from the apply until this change.
export type RenderLoad =
  | { ok: true; pack: OfflinePack; items: OfflinePackItem[] }
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

  const { data: rows, error: rowsError } = await db
    .from('offline_pack_items')
    .select(
      'pack_item_id, pack_id, position, item_id, question_type, stem, ' +
        'option_a, option_b, option_c, option_d, option_e, option_f, marks, shuffle_options, ' +
        'correct, ' +
        'subject, maintopic, subtopic, difficulty',
    )
    .eq('pack_id', pack.pack_id)
    .order('position', { ascending: true });
  if (rowsError) {
    console.error('getOfflinePackForRender rows:', rowsError);
    return { ok: false, code: 'pack_lookup_failed', message: rowsError.message };
  }
  // the column list is a built string, so the client's type parser gives
  // up on it; the shape is the 27 columns above, cast through unknown
  const items = ((rows ?? []) as unknown as Omit<OfflinePackItem, 'course_id' | 'batch_id'>[]).map((row) => ({
    ...row,
    course_id: pack.course_id,
    batch_id: null,
  }));

  return { ok: true, pack, items };
}

// ── My Packs' read (legacy listOfflinePacks) ───────────────────────────
// The student's packs, every status, newest first, one page of `limit`
// from `offset`, with the exact total; the course titles joined by a
// second read, the id standing in when a course is gone. The card's
// columns only (7a's precedent) — legacy selected `*`.
export async function listOfflinePacks(db: ServerSupabaseClient, userId: string, limit: number, offset: number): Promise<OfflinePackPage> {
  const safeLimit = Math.max(1, Math.min(Number(limit || 100), 200));
  const safeOffset = Math.max(0, Number(offset || 0));

  const { data, error, count } = await db
    .from('offline_packs')
    .select('pack_id, course_id, pack_name, display_label, question_count, status, created_utc', { count: 'exact' })
    .eq('user_id', userId)
    .neq('status', 'deleted')
    .order('created_utc', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);
  if (error) {
    console.error('listOfflinePacks:', error);
    return { ok: false, message: error.message };
  }

  type Row = Omit<OfflinePackListRow, 'course_title'>;
  const rows = (data ?? []) as Row[];
  const courseIds = [...new Set(rows.map((r) => String(r.course_id || '').trim()).filter(Boolean))];

  const titles: Record<string, string> = {};
  if (courseIds.length) {
    const { data: courses } = await db.from('courses').select('course_id, title').in('course_id', courseIds);
    for (const c of (courses ?? []) as { course_id: string; title: string }[]) {
      titles[String(c.course_id || '').trim().toUpperCase()] = String(c.title || '').trim();
    }
  }

  const items: OfflinePackListRow[] = rows.map((row) => {
    const cid = String(row.course_id || '').trim().toUpperCase();
    return { ...row, course_title: titles[cid] || cid };
  });

  return { ok: true, total: Number(count ?? items.length), items };
}
