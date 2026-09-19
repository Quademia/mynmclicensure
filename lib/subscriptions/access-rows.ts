// lib/subscriptions/access-rows.ts
//
// The entitlement rows (02 C2, C3a, C3b; rebuild.md §8 S8): one
// course_access row per course of a receipt's product. The receipt (the
// subscriptions row) is written first by its own path; each path then
// calls one of these with the service role — there is no browser write
// path on course_access (the migration revoked it).
//
// THE CHAIN (Sam, 2026-09-19, option 2). For one student and one course,
// the paid and free receipts form a chain ordered by their earliest
// allowed start — the "floor": the admin's requested start when Grant
// named one, else the moment the receipt was made (created_utc). Each
// link starts at the later of its floor and the previous link's end,
// and keeps its own length. repackAccess() recomputes the chain after
// every write, so a revoke pulls the links behind it forward, an
// extension pushes them back, and no student ever loses a paid day
// whatever order an admin did things in. Trials sit outside the chain
// (ruling 2): a trial row runs from its floor and pushes nothing.
// A REVOKED receipt's rows are stamped and leave the chain; ACTIVE and
// EXPIRED receipts are links (an EXPIRED one has already run out).
//
// THE RECEIPT'S WINDOW. After every write the receipt's start_utc is its
// earliest row start and its expires_utc its latest row end (Sam,
// 2026-09-19: the subscription row is the paper trail, so its dates must
// summarise its rows). created_utc keeps when it was made.
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

/** A receipt's window: the earliest row start and the latest row end. */
export type AccessWindow = { start_utc: string; expires_utc: string };

async function productCourses(db: ServiceDb, productId: string): Promise<string[]> {
  const { data, error } = await db.from('product_courses').select('course_id').eq('product_id', productId);
  if (error) throw new Error(`course_access: product_courses read failed: ${error.message}`);
  return (data ?? []).map((r) => r.course_id as string);
}

async function setReceiptWindow(db: ServiceDb, subscriptionId: string): Promise<AccessWindow | null> {
  const { data, error } = await db.from('course_access').select('start_utc, expires_utc').eq('subscription_id', subscriptionId);
  if (error) throw new Error(`course_access: read failed: ${error.message}`);
  const rows = (data ?? []) as AccessWindow[];
  if (!rows.length) return null;
  const window = {
    start_utc: rows.map((r) => r.start_utc).sort()[0],
    expires_utc: rows.map((r) => r.expires_utc).sort().at(-1)!,
  };
  const { error: updateError } = await db.from('subscriptions').update(window).eq('subscription_id', subscriptionId);
  if (updateError) throw new Error(`subscriptions: window update failed: ${updateError.message}`);
  return window;
}

type ChainRow = {
  access_id: number;
  course_id: string;
  start_utc: string;
  expires_utc: string;
  revoked_utc: string | null;
  subscriptions: {
    subscription_id: string;
    status: string;
    created_utc: string;
    requested_start_utc: string | null;
    products: { kind: string | null } | null;
  } | null;
};

/**
 * The rule. Re-packs the student's chain on each of the courses and
 * sets the window of every receipt those rows belong to.
 */
export async function repackAccess(db: ServiceDb, userId: string, courseIds: string[]): Promise<void> {
  const courses = [...new Set(courseIds)];
  if (!courses.length) return;
  const { data, error } = await db
    .from('course_access')
    .select('access_id, course_id, start_utc, expires_utc, revoked_utc, subscriptions ( subscription_id, status, created_utc, requested_start_utc, products ( kind ) )')
    .eq('user_id', userId)
    .in('course_id', courses);
  if (error) throw new Error(`course_access: read failed: ${error.message}`);
  const rows = (data ?? []) as unknown as ChainRow[];

  const stamp = nowIso();
  const updates: { access_id: number; start_utc: string; expires_utc: string; revoked_utc: string | null }[] = [];
  const floorOf = (r: ChainRow) => new Date(r.subscriptions?.requested_start_utc || r.subscriptions?.created_utc || r.start_utc).getTime();

  for (const course of courses) {
    const onCourse = rows.filter((r) => r.course_id === course);
    const revoked = onCourse.filter((r) => r.subscriptions?.status === 'REVOKED');
    const trials = onCourse.filter((r) => r.subscriptions?.status !== 'REVOKED' && String(r.subscriptions?.products?.kind || '').toUpperCase() === 'TRIAL');
    const chain = onCourse
      .filter((r) => r.subscriptions?.status !== 'REVOKED' && String(r.subscriptions?.products?.kind || '').toUpperCase() !== 'TRIAL')
      .sort((a, b) => floorOf(a) - floorOf(b) || (a.subscriptions?.subscription_id || '').localeCompare(b.subscriptions?.subscription_id || ''));

    for (const r of revoked) {
      if (!r.revoked_utc) updates.push({ access_id: r.access_id, start_utc: r.start_utc, expires_utc: r.expires_utc, revoked_utc: stamp });
    }
    for (const r of trials) {
      const start = floorOf(r);
      const end = start + (new Date(r.expires_utc).getTime() - new Date(r.start_utc).getTime());
      const next = { start_utc: new Date(start).toISOString(), expires_utc: new Date(end).toISOString(), revoked_utc: null };
      if (next.start_utc !== r.start_utc || next.expires_utc !== r.expires_utc || r.revoked_utc) updates.push({ access_id: r.access_id, ...next });
    }
    let prevEnd = -Infinity;
    for (const r of chain) {
      const length = new Date(r.expires_utc).getTime() - new Date(r.start_utc).getTime();
      const start = Math.max(floorOf(r), prevEnd);
      const end = start + length;
      prevEnd = end;
      const next = { start_utc: new Date(start).toISOString(), expires_utc: new Date(end).toISOString(), revoked_utc: null };
      if (next.start_utc !== r.start_utc || next.expires_utc !== r.expires_utc || r.revoked_utc) updates.push({ access_id: r.access_id, ...next });
    }
  }

  for (const u of updates) {
    const { access_id, ...fields } = u;
    const { error: updateError } = await db.from('course_access').update(fields).eq('access_id', access_id);
    if (updateError) throw new Error(`course_access: update failed: ${updateError.message}`);
  }

  const receipts = new Set(rows.map((r) => r.subscriptions?.subscription_id).filter((id): id is string => Boolean(id)));
  for (const id of receipts) await setReceiptWindow(db, id);
}

/**
 * A fresh receipt: one row per course of its product on the receipt's
 * own dates, then the chain re-packed (a queued start comes out of
 * that) and the receipt's window set. Returns the window.
 */
export async function writeAccessRows(db: ServiceDb, receipt: Receipt): Promise<AccessWindow> {
  const courses = await productCourses(db, receipt.product_id);
  if (!courses.length) return { start_utc: receipt.start_utc, expires_utc: receipt.expires_utc };
  const { error } = await db.from('course_access').insert(
    courses.map((course_id) => ({
      user_id: receipt.user_id,
      course_id,
      subscription_id: receipt.subscription_id,
      start_utc: receipt.start_utc,
      expires_utc: receipt.expires_utc,
      revoked_utc: receipt.status === 'REVOKED' ? nowIso() : null,
    })),
  );
  if (error) throw new Error(`course_access: insert failed: ${error.message}`);
  await repackAccess(db, receipt.user_id, courses);
  return (await setReceiptWindow(db, receipt.subscription_id)) ?? { start_utc: receipt.start_utc, expires_utc: receipt.expires_utc };
}

/** A receipt that may already have rows (the Paystack replay guard): write them only when none exist. */
export async function ensureAccessRows(db: ServiceDb, receipt: Receipt): Promise<void> {
  const { data, error } = await db.from('course_access').select('access_id').eq('subscription_id', receipt.subscription_id).limit(1);
  if (error) throw new Error(`course_access: read failed: ${error.message}`);
  if (!data?.length) await writeAccessRows(db, receipt);
}

/**
 * An edited receipt (admin Update). A changed start is the admin's
 * requested start — the receipt's new floor. A changed window length
 * changes every row's length by the same amount. A changed product
 * replaces the rows. Then the chain is re-packed on every course the
 * receipt touched before or after, and the windows follow. The status
 * flows through the re-pack (REVOKED stamps, ACTIVE or EXPIRED clears).
 */
export async function rewriteAccessRows(db: ServiceDb, before: Receipt, after: Receipt): Promise<void> {
  if (after.start_utc !== before.start_utc) {
    const { error } = await db.from('subscriptions').update({ requested_start_utc: after.start_utc }).eq('subscription_id', after.subscription_id);
    if (error) throw new Error(`subscriptions: requested start update failed: ${error.message}`);
  }

  const { data: current, error: readError } = await db
    .from('course_access')
    .select('access_id, course_id, start_utc, expires_utc')
    .eq('subscription_id', after.subscription_id);
  if (readError) throw new Error(`course_access: read failed: ${readError.message}`);
  const rows = (current ?? []) as { access_id: number; course_id: string; start_utc: string; expires_utc: string }[];
  const touched = new Set(rows.map((r) => r.course_id));

  if (after.product_id !== before.product_id || !rows.length) {
    if (rows.length) {
      const { error } = await db.from('course_access').delete().eq('subscription_id', after.subscription_id);
      if (error) throw new Error(`course_access: delete failed: ${error.message}`);
    }
    const courses = await productCourses(db, after.product_id);
    if (courses.length) {
      const { error } = await db.from('course_access').insert(
        courses.map((course_id) => ({
          user_id: after.user_id,
          course_id,
          subscription_id: after.subscription_id,
          start_utc: after.start_utc,
          expires_utc: after.expires_utc,
          revoked_utc: null,
        })),
      );
      if (error) throw new Error(`course_access: insert failed: ${error.message}`);
      for (const c of courses) touched.add(c);
    }
    await repackAccess(db, after.user_id, [...touched]);
    return;
  }

  const lengthDelta =
    new Date(after.expires_utc).getTime() - new Date(after.start_utc).getTime() - (new Date(before.expires_utc).getTime() - new Date(before.start_utc).getTime());
  if (lengthDelta !== 0) {
    for (const r of rows) {
      let expires = new Date(new Date(r.expires_utc).getTime() + lengthDelta);
      const start = new Date(r.start_utc);
      if (expires <= start) expires = new Date(start.getTime() + 1000); // the CHECK: an end never before its start
      const { error } = await db.from('course_access').update({ expires_utc: expires.toISOString() }).eq('access_id', r.access_id);
      if (error) throw new Error(`course_access: update failed: ${error.message}`);
    }
  }
  await repackAccess(db, after.user_id, [...touched]);
}

/** Revoke: the receipt's rows are stamped and leave the chain; the links behind them move up. */
export async function revokeAccessRows(db: ServiceDb, subscriptionId: string): Promise<void> {
  const { data, error } = await db.from('course_access').select('user_id, course_id').eq('subscription_id', subscriptionId);
  if (error) throw new Error(`course_access: read failed: ${error.message}`);
  const rows = (data ?? []) as { user_id: string; course_id: string }[];
  if (!rows.length) return;
  const { error: stampError } = await db
    .from('course_access')
    .update({ revoked_utc: nowIso() })
    .eq('subscription_id', subscriptionId)
    .is('revoked_utc', null);
  if (stampError) throw new Error(`course_access: revoke failed: ${stampError.message}`);
  await repackAccess(db, rows[0].user_id, rows.map((r) => r.course_id));
}
