// lib/subscriptions/access-rows.ts
//
// The entitlement rows (02 C2, rebuild.md §8 S8): one course_access row
// per course of a receipt's product, carrying the receipt's dates. The
// receipt (the subscriptions row) is written first by its own path; each
// path then calls one of these with the service role — there is no
// browser write path on course_access (the migration revoked it).
//
// Stacking is OFF (ruling 3): a row carries its receipt's start and
// expiry as they are. Queuing a row behind the course's current end is
// C3. A receipt that is not ACTIVE gets revoked_utc stamped, so the rows
// say what the status says — the gate reads rows only.
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

async function productCourses(db: ServiceDb, productId: string): Promise<string[]> {
  const { data, error } = await db.from('product_courses').select('course_id').eq('product_id', productId);
  if (error) throw new Error(`course_access: product_courses read failed: ${error.message}`);
  return (data ?? []).map((r) => r.course_id as string);
}

/** A fresh receipt: one row per course of its product, the receipt's dates. */
export async function writeAccessRows(db: ServiceDb, receipt: Receipt): Promise<void> {
  const courses = await productCourses(db, receipt.product_id);
  if (!courses.length) return;
  const revoked = receipt.status === 'ACTIVE' ? null : nowIso();
  const rows = courses.map((course_id) => ({
    user_id: receipt.user_id,
    course_id,
    subscription_id: receipt.subscription_id,
    start_utc: receipt.start_utc,
    expires_utc: receipt.expires_utc,
    revoked_utc: revoked,
  }));
  const { error } = await db.from('course_access').insert(rows);
  if (error) throw new Error(`course_access: insert failed: ${error.message}`);
}

/**
 * An edited or extended receipt: its rows take the receipt's dates and
 * its status (ACTIVE clears revoked_utc — an admin correction; anything
 * else stamps it once). The course set is kept (ruling 1, bought means
 * kept) unless the product itself changed, in which case the old
 * product's rows go and the new product's are written. A receipt with no
 * rows yet (written before C2) gets them.
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
