// lib/subscriptions/access-rows.ts
//
// The entitlement rows (02 C2, rebuild.md §8 S8): one course_access row
// per course of a receipt's product, carrying the receipt's dates. The
// receipt (the subscriptions row) is written first by its own path; each
// path then calls one of these with the service role — there is no
// browser write path on course_access (the migration revoked it).
//
// The queued start (C3a, ruling 3 ON — Sam, 2026-09-19, no switch): for
// each course of a paid or free receipt, the student's latest live end
// on that course from a non-trial receipt; when it is later than the
// receipt's start, the new row starts there and keeps the receipt's
// length, so days already held are never lost. A trial carries nothing
// forward and its own rows never queue (ruling 2): trial rows run on
// the receipt's dates. The receipt keeps the purchase dates; the rows
// are the access. A receipt that is not ACTIVE gets revoked_utc
// stamped, so the rows say what the status says — the gate reads rows
// only.
//
// Server only.

import type { createServiceRoleClient } from '@/lib/supabase/server';
import { nowIso } from './dates';

type ServiceDb = ReturnType<typeof createServiceRoleClient>;

export type Receipt = {
  subscription_id: string;
  user_id: string;
  product_id: string;
  start_utc: string;
  expires_utc: string;
  status: string;
};

async function productCoursesAndKind(db: ServiceDb, productId: string): Promise<{ courses: string[]; kind: string }> {
  const { data, error } = await db.from('products').select('kind, product_courses ( course_id )').eq('product_id', productId).maybeSingle();
  if (error) throw new Error(`course_access: product read failed: ${error.message}`);
  const row = data as { kind: string | null; product_courses: { course_id: string }[] | null } | null;
  return {
    courses: (row?.product_courses ?? []).map((r) => r.course_id),
    kind: String(row?.kind || '').toUpperCase(),
  };
}

/**
 * The student's latest live end per course from non-trial receipts —
 * what a new row queues behind. Rows ending before `fromIso` cannot
 * push anything, so they are left out.
 */
async function latestLiveEnds(db: ServiceDb, userId: string, courses: string[], fromIso: string): Promise<Record<string, string>> {
  const { data, error } = await db
    .from('course_access')
    .select('course_id, expires_utc, subscriptions ( products ( kind ) )')
    .eq('user_id', userId)
    .in('course_id', courses)
    .is('revoked_utc', null)
    .gt('expires_utc', fromIso);
  if (error) throw new Error(`course_access: read failed: ${error.message}`);
  type Row = { course_id: string; expires_utc: string; subscriptions: { products: { kind: string | null } | null } | null };
  const ends: Record<string, string> = {};
  for (const r of (data ?? []) as unknown as Row[]) {
    if (String(r.subscriptions?.products?.kind || '').toUpperCase() === 'TRIAL') continue;
    if (!ends[r.course_id] || r.expires_utc > ends[r.course_id]) ends[r.course_id] = r.expires_utc;
  }
  return ends;
}

/** A fresh receipt: one row per course of its product, queued behind the course's current end. */
export async function writeAccessRows(db: ServiceDb, receipt: Receipt): Promise<void> {
  const { courses, kind } = await productCoursesAndKind(db, receipt.product_id);
  if (!courses.length) return;
  const revoked = receipt.status === 'ACTIVE' ? null : nowIso();
  const lengthMs = new Date(receipt.expires_utc).getTime() - new Date(receipt.start_utc).getTime();
  const ends = kind === 'TRIAL' || revoked ? {} : await latestLiveEnds(db, receipt.user_id, courses, receipt.start_utc);

  const rows = courses.map((course_id) => {
    const queuedBehind = ends[course_id];
    const start = queuedBehind && queuedBehind > receipt.start_utc ? queuedBehind : receipt.start_utc;
    const expires = start === receipt.start_utc ? receipt.expires_utc : new Date(new Date(start).getTime() + lengthMs).toISOString();
    return {
      user_id: receipt.user_id,
      course_id,
      subscription_id: receipt.subscription_id,
      start_utc: start,
      expires_utc: expires,
      revoked_utc: revoked,
    };
  });
  const { error } = await db.from('course_access').insert(rows);
  if (error) throw new Error(`course_access: insert failed: ${error.message}`);
}

/**
 * A receipt that may already have rows (the Paystack replay guard, or
 * one written before C2): write them only when none exist, so a retry
 * heals a missing set without moving one that is there.
 */
export async function ensureAccessRows(db: ServiceDb, receipt: Receipt): Promise<void> {
  const { data: existing, error } = await db
    .from('course_access')
    .select('access_id')
    .eq('subscription_id', receipt.subscription_id)
    .limit(1);
  if (error) throw new Error(`course_access: read failed: ${error.message}`);
  if (!existing?.length) await writeAccessRows(db, receipt);
}

/**
 * An edited receipt (admin Update): its rows are written again through
 * the same rule as a fresh grant — the receipt's own rows go first, so
 * the new ones queue behind the student's OTHER receipts, never behind
 * themselves. The receipt's product, dates and status all flow through
 * writeAccessRows; nothing on a row is set by hand (C3b, Sam,
 * 2026-09-19: rows are written by rule, the admin edits receipts).
 */
export async function rewriteAccessRows(db: ServiceDb, receipt: Receipt): Promise<void> {
  const { error } = await db.from('course_access').delete().eq('subscription_id', receipt.subscription_id);
  if (error) throw new Error(`course_access: delete failed: ${error.message}`);
  await writeAccessRows(db, receipt);
}

/** Revoke: stamp the receipt's live rows once; rows already stamped keep their date. */
export async function revokeAccessRows(db: ServiceDb, subscriptionId: string): Promise<void> {
  const { error } = await db
    .from('course_access')
    .update({ revoked_utc: nowIso() })
    .eq('subscription_id', subscriptionId)
    .is('revoked_utc', null);
  if (error) throw new Error(`course_access: revoke failed: ${error.message}`);
}
