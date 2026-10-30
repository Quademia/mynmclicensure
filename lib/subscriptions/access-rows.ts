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
// planAccessRows() runs the same packing over a receipt that does not
// exist yet — the Grant dialog's preview; planPurchase() the same for the
// checkout's words before Pay.
//
// PREMIUM GOES FIRST (Sam, 2026-10-30, 02 option C). Premium Prep links
// (the product's premium tick) are laid down first, each at the later of
// its floor and the previous Premium link's end; the other links then
// fill the time around them in their order. A Standard link running when
// a Premium one starts is cut there, and the rest of it continues after
// the Premium days: no day lost, the end the same. The rest is a second
// row of the same receipt whose floor_utc is the moment it was cut, so
// the next re-pack keeps it behind the Premium days instead of joining
// it back on; a revoked Premium leaves the pieces end to end. Rows are
// added, never removed, by a re-pack — only an admin's Update joins a
// receipt's pieces back into one row first (rewriteAccessRows).
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

/** One course of a receipt as the chain would place it. */
export type PlannedRow = { course_id: string; start_utc: string; expires_utc: string };

type ProductFacts = { courses: string[]; kind: string; name: string | null; is_premium: boolean };

async function productCoursesAndKind(db: ServiceDb, productId: string): Promise<ProductFacts> {
  const { data, error } = await db
    .from('products')
    .select('kind, name, is_premium, product_courses ( course_id )')
    .eq('product_id', productId)
    .maybeSingle();
  if (error) throw new Error(`course_access: product read failed: ${error.message}`);
  const row = data as { kind: string | null; name: string | null; is_premium: boolean | null; product_courses: { course_id: string }[] | null } | null;
  return {
    courses: (row?.product_courses ?? []).map((r) => r.course_id).sort(),
    kind: String(row?.kind || '').toUpperCase(),
    name: row?.name ?? null,
    is_premium: row?.is_premium === true,
  };
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

// ── the packing itself, pure ──────────────────────────────────────────

export type ChainRow = {
  access_id: number;
  course_id: string;
  start_utc: string;
  expires_utc: string;
  revoked_utc: string | null;
  floor_utc: string | null;
  subscriptions: {
    subscription_id: string;
    status: string;
    created_utc: string;
    requested_start_utc: string | null;
    products: { kind: string | null; name: string | null; is_premium: boolean | null } | null;
  } | null;
};

/**
 * One stretch of a row as the rule places it, in ms. A row cut by
 * Premium days has more than one; `cut` is when a later stretch was cut
 * off (the floor_utc of the row that will hold it), null on the first.
 */
export type Piece = { start: number; end: number; cut: number | null };
export type Placement = { pieces: Piece[]; revoked_utc: string | null };

async function readChainRows(db: ServiceDb, userId: string, courses: string[]): Promise<ChainRow[]> {
  const { data, error } = await db
    .from('course_access')
    .select(
      'access_id, course_id, start_utc, expires_utc, revoked_utc, floor_utc, subscriptions ( subscription_id, status, created_utc, requested_start_utc, products ( kind, name, is_premium ) )',
    )
    .eq('user_id', userId)
    .in('course_id', courses);
  if (error) throw new Error(`course_access: read failed: ${error.message}`);
  return (data ?? []) as unknown as ChainRow[];
}

/** Where every row on these courses belongs under the rule, keyed by access_id. Exported for the proof script only. */
export function packRows(rows: ChainRow[], courses: string[], stamp: string): Map<number, Placement> {
  const placed = new Map<number, Placement>();
  const kindOf = (r: ChainRow) => String(r.subscriptions?.products?.kind || '').toUpperCase();
  const isPremium = (r: ChainRow) => r.subscriptions?.products?.is_premium === true;
  const ms = (iso: string) => new Date(iso).getTime();
  const receiptFloor = (r: ChainRow) => ms(r.subscriptions?.requested_start_utc || r.subscriptions?.created_utc || r.start_utc);
  const floorOf = (r: ChainRow) => (r.floor_utc ? ms(r.floor_utc) : receiptFloor(r));
  const lengthOf = (r: ChainRow) => ms(r.expires_utc) - ms(r.start_utc);
  const byReceipt = (a: ChainRow, b: ChainRow) => (a.subscriptions?.subscription_id || '').localeCompare(b.subscriptions?.subscription_id || '');

  for (const course of courses) {
    const onCourse = rows.filter((r) => r.course_id === course);
    for (const r of onCourse.filter((r) => r.subscriptions?.status === 'REVOKED')) {
      placed.set(r.access_id, { pieces: [{ start: ms(r.start_utc), end: ms(r.expires_utc), cut: null }], revoked_utc: r.revoked_utc ?? stamp });
    }
    for (const r of onCourse.filter((r) => r.subscriptions?.status !== 'REVOKED' && kindOf(r) === 'TRIAL')) {
      const start = floorOf(r);
      placed.set(r.access_id, { pieces: [{ start, end: start + lengthOf(r), cut: null }], revoked_utc: null });
    }
    const chain = onCourse.filter((r) => r.subscriptions?.status !== 'REVOKED' && kindOf(r) !== 'TRIAL');

    // The Premium links first, end to end among themselves.
    const blocks: { start: number; end: number }[] = [];
    let premiumEnd = -Infinity;
    for (const r of chain.filter(isPremium).sort((a, b) => floorOf(a) - floorOf(b) || byReceipt(a, b) || a.access_id - b.access_id)) {
      const start = Math.max(floorOf(r), premiumEnd);
      premiumEnd = start + lengthOf(r);
      blocks.push({ start, end: premiumEnd });
      placed.set(r.access_id, { pieces: [{ start, end: premiumEnd, cut: null }], revoked_utc: null });
    }

    // Then the rest, each receipt's pieces together, filling the time
    // around the Premium days; a link that meets them is cut there.
    let prevEnd = -Infinity;
    const rest = chain
      .filter((r) => !isPremium(r))
      .sort((a, b) => receiptFloor(a) - receiptFloor(b) || byReceipt(a, b) || floorOf(a) - floorOf(b) || a.access_id - b.access_id);
    for (const r of rest) {
      let t = Math.max(floorOf(r), prevEnd);
      let left = lengthOf(r);
      const pieces: Piece[] = [];
      while (left > 0) {
        const inside = blocks.find((b) => t >= b.start && t < b.end);
        if (inside) {
          t = inside.end;
          continue;
        }
        const next = blocks.reduce((soonest, b) => (b.start > t && b.start < soonest ? b.start : soonest), Infinity);
        const take = Math.min(left, next - t);
        pieces.push({ start: t, end: t + take, cut: pieces.length ? pieces[pieces.length - 1].end : null });
        left -= take;
        t += take;
      }
      prevEnd = t;
      placed.set(r.access_id, { pieces, revoked_utc: null });
    }
  }
  return placed;
}

/**
 * The rule, applied. Re-packs the student's chain on each of the
 * courses — a row's first stretch written onto it, any later stretch as
 * a new row of the same receipt — and sets the window of every receipt
 * those rows belong to.
 */
export async function repackAccess(db: ServiceDb, userId: string, courseIds: string[]): Promise<void> {
  const courses = [...new Set(courseIds)];
  if (!courses.length) return;
  const rows = await readChainRows(db, userId, courses);
  const placed = packRows(rows, courses, nowIso());
  const iso = (t: number) => new Date(t).toISOString();
  const same = (a: string | null, b: string | null) => (a === null || b === null ? a === b : new Date(a).getTime() === new Date(b).getTime());

  const added: Record<string, unknown>[] = [];
  for (const r of rows) {
    const next = placed.get(r.access_id);
    if (!next) continue;
    const [first, ...later] = next.pieces;
    const row = { start_utc: iso(first.start), expires_utc: iso(first.end), revoked_utc: next.revoked_utc };
    if (!same(row.start_utc, r.start_utc) || !same(row.expires_utc, r.expires_utc) || !same(row.revoked_utc, r.revoked_utc)) {
      const { error } = await db.from('course_access').update(row).eq('access_id', r.access_id);
      if (error) throw new Error(`course_access: update failed: ${error.message}`);
    }
    for (const p of later) {
      added.push({
        user_id: userId,
        course_id: r.course_id,
        subscription_id: r.subscriptions?.subscription_id,
        start_utc: iso(p.start),
        expires_utc: iso(p.end),
        revoked_utc: null,
        floor_utc: iso(p.cut ?? p.start),
      });
    }
  }
  if (added.length) {
    const { error } = await db.from('course_access').insert(added);
    if (error) throw new Error(`course_access: insert failed: ${error.message}`);
  }

  const receipts = new Set(rows.map((r) => r.subscriptions?.subscription_id).filter((id): id is string => Boolean(id)));
  for (const id of receipts) await setReceiptWindow(db, id);
}

/** The student's rows on a product's courses plus a receipt that does not exist yet, packed. */
async function packWithGhost(
  db: ServiceDb,
  userId: string,
  productId: string,
  durationDays: number,
  requestedStart: string | null,
): Promise<{ facts: ProductFacts; rows: ChainRow[]; placed: Map<number, Placement>; now: number } | null> {
  const facts = await productCoursesAndKind(db, productId);
  if (!facts.courses.length) return null;
  const now = nowIso();
  const floor = requestedStart || now;
  const expires = new Date(new Date(floor).getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const rows = await readChainRows(db, userId, facts.courses);
  const ghost: ChainRow['subscriptions'] = {
    subscription_id: '~planned',
    status: 'ACTIVE',
    created_utc: now,
    requested_start_utc: requestedStart,
    products: { kind: facts.kind, name: facts.name, is_premium: facts.is_premium },
  };
  facts.courses.forEach((course_id, i) => {
    rows.push({ access_id: -(i + 1), course_id, start_utc: floor, expires_utc: expires, revoked_utc: null, floor_utc: null, subscriptions: ghost });
  });
  return { facts, rows, placed: packRows(rows, facts.courses, now), now: new Date(now).getTime() };
}

/**
 * The Grant dialog's preview: where a receipt that does not exist yet
 * would land, by the same packing — each course from its first stretch
 * to its last. requestedStart is the admin's chosen start, or null for
 * "from now". Nothing is written.
 */
export async function planAccessRows(
  db: ServiceDb,
  userId: string,
  productId: string,
  durationDays: number,
  requestedStart: string | null,
): Promise<PlannedRow[]> {
  const packed = await packWithGhost(db, userId, productId, durationDays, requestedStart);
  if (!packed) return [];
  return packed.facts.courses.map((course_id, i) => {
    const pieces = packed.placed.get(-(i + 1))!.pieces;
    return { course_id, start_utc: new Date(pieces[0].start).toISOString(), expires_utc: new Date(pieces[pieces.length - 1].end).toISOString() };
  });
}

/** What a purchase would do to the student's days — the checkout's words before Pay (02, Premium goes first). */
export type PurchasePlan = {
  /** When the new days begin (the earliest of its courses). */
  start_utc: string;
  /** The package whose end it waits for, when it begins later; null when it begins now. */
  waits_for: string | null;
  /** The packages it pauses: when each continues, and the days it still has. */
  pauses: { product_name: string; resumes_utc: string; days_left: number }[];
};

const LATER_MS = 60 * 1000;

export async function planPurchase(db: ServiceDb, userId: string, productId: string, durationDays: number): Promise<PurchasePlan | null> {
  const packed = await packWithGhost(db, userId, productId, durationDays, null);
  if (!packed) return null;
  const { facts, rows, placed, now } = packed;
  const nameOf = (r: ChainRow) => r.subscriptions?.products?.name || 'your package';

  const ghostPieces = facts.courses.map((_, i) => placed.get(-(i + 1))!.pieces);
  const start = Math.min(...ghostPieces.map((p) => p[0].start));

  // A row live now that the new days cut: when its rest continues, and how long it is.
  const byReceipt = new Map<string, { product_name: string; resumes: number; left: number }>();
  for (const r of rows) {
    if (r.access_id < 0 || r.revoked_utc || r.subscriptions?.status === 'REVOKED') continue;
    const live = new Date(r.start_utc).getTime() <= now && now < new Date(r.expires_utc).getTime();
    const pieces = placed.get(r.access_id)?.pieces ?? [];
    if (!live || pieces.length < 2) continue;
    const later = pieces.slice(1);
    const id = r.subscriptions?.subscription_id || String(r.access_id);
    const resumes = later[0].start;
    const left = later.reduce((sum, p) => sum + (p.end - p.start), 0);
    const seen = byReceipt.get(id);
    byReceipt.set(id, { product_name: nameOf(r), resumes: Math.max(resumes, seen?.resumes ?? 0), left: Math.max(left, seen?.left ?? 0) });
  }

  // Beginning later: the package that ends when it begins, on any of its courses.
  let waitsFor: string | null = null;
  if (start > now + LATER_MS) {
    for (const r of rows) {
      if (r.access_id < 0) continue;
      const pieces = placed.get(r.access_id)?.pieces ?? [];
      if (pieces.length && Math.abs(pieces[pieces.length - 1].end - start) < LATER_MS) waitsFor = nameOf(r);
    }
  }

  return {
    start_utc: new Date(start).toISOString(),
    waits_for: waitsFor,
    pauses: [...byReceipt.values()].map((p) => ({
      product_name: p.product_name,
      resumes_utc: new Date(p.resumes).toISOString(),
      days_left: Math.round(p.left / (24 * 60 * 60 * 1000)),
    })),
  };
}

// ── the writers ───────────────────────────────────────────────────────

/**
 * A fresh receipt: one row per course of its product on the receipt's
 * own dates, then the chain re-packed (a queued start comes out of
 * that) and the receipt's window set. Returns the window.
 */
export async function writeAccessRows(db: ServiceDb, receipt: Receipt): Promise<AccessWindow> {
  const { courses } = await productCoursesAndKind(db, receipt.product_id);
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
    const { courses } = await productCoursesAndKind(db, after.product_id);
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

  // A receipt cut by Premium days holds more than one row on a course:
  // join them back into one before the edit (Premium goes first, 02), so
  // a length change lands once; the re-pack cuts it again where it must.
  const ms = (iso: string) => new Date(iso).getTime();
  const joined: typeof rows = [];
  for (const course of touched) {
    const pieces = rows.filter((r) => r.course_id === course).sort((a, b) => ms(a.start_utc) - ms(b.start_utc));
    const keep = pieces[0];
    if (pieces.length > 1) {
      const total = pieces.reduce((sum, r) => sum + ms(r.expires_utc) - ms(r.start_utc), 0);
      keep.expires_utc = new Date(ms(keep.start_utc) + total).toISOString();
      const { error } = await db.from('course_access').update({ expires_utc: keep.expires_utc, floor_utc: null }).eq('access_id', keep.access_id);
      if (error) throw new Error(`course_access: join failed: ${error.message}`);
      const { error: deleteError } = await db
        .from('course_access')
        .delete()
        .in('access_id', pieces.slice(1).map((r) => r.access_id));
      if (deleteError) throw new Error(`course_access: join failed: ${deleteError.message}`);
    }
    joined.push(keep);
  }

  const lengthDelta =
    new Date(after.expires_utc).getTime() - new Date(after.start_utc).getTime() - (new Date(before.expires_utc).getTime() - new Date(before.start_utc).getTime());
  if (lengthDelta !== 0) {
    for (const r of joined) {
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
