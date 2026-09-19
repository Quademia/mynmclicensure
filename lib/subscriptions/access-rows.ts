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
 * An edited receipt (admin Update): its rows take the receipt's dates
 * and its status (ACTIVE clears revoked_utc — an admin correction;
 * anything else stamps it once). A queued row is put on the receipt's
 * dates by this — the admin asked for those dates; editing a row on its
 * own is C3b. The course set is kept (ruling 1, bought means kept)
 * unless the product itself changed, in which case the old product's
 * rows go and the new product's are written. A receipt with no rows yet
 * (the Paystack replay guard, or one written before C2) gets them.
 */
export async function syncAccessRows(db: ServiceDb, receipt: Receipt, productChanged: boolean): Promise<void> {
  if (productChanged) {
    const { error } = await db.from('course_access').delete().eq('subscription_id', receipt.subscription_id);
    if (error) throw new Error(`course_access: delete failed: ${error.message}`);
    await writeAccessRows(db, receipt);
    return;
  }

  const { data: existing, error: readError } = await db
    .from('course_access')
    .select('access_id')
    .eq('subscription_id', receipt.subscription_id)
    .limit(1);
  if (readError) throw new Error(`course_access: read failed: ${readError.message}`);
  if (!existing?.length) {
    await writeAccessRows(db, receipt);
    return;
  }

  const dates = { start_utc: receipt.start_utc, expires_utc: receipt.expires_utc };
  if (receipt.status === 'ACTIVE') {
    const { error } = await db.from('course_access').update({ ...dates, revoked_utc: null }).eq('subscription_id', receipt.subscription_id);
    if (error) throw new Error(`course_access: update failed: ${error.message}`);
    return;
  }
  const { error: datesError } = await db.from('course_access').update(dates).eq('subscription_id', receipt.subscription_id);
  if (datesError) throw new Error(`course_access: update failed: ${datesError.message}`);
  await revokeAccessRows(db, receipt.subscription_id);
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
