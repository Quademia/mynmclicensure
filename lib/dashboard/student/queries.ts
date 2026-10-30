// lib/dashboard/student/queries.ts
//
// The redesigned dashboard's two reads of its own (D2b). Everything else
// on the page comes from the readers that already exist — access, courses,
// recent sittings, news — so no rule is written twice (Sam, 2026-10-04).
// Both fail open, as the app's other readers do: an error is logged and an
// empty answer returned, so a slow or failed read costs a card, not the
// page.

import type { ServerSupabaseClient } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { EMPTY_NUMBERS, type DashNumbers, type DashReceipt, type ReceiptKind } from './types';

type Stretch = { start_utc: string; expires_utc: string; revoked_utc: string | null };

function nowMs(): number {
  return Date.now();
}

/**
 * A receipt's dates as the top card reads them. A receipt's own window is
 * its first row's start to its last row's end, and a Standard paused by
 * Premium days (02, Premium goes first) has a gap inside it: read as one
 * window it would look live through the pause. So: from the start of the
 * stretch running now, or else the next one, to the last end — a paused
 * receipt reads as coming, the dashboard's "Then … until …". A receipt
 * with no rows keeps its own dates.
 */
function windowNow(own: { start_utc: string; expires_utc: string }, rows: Stretch[]): { start_utc: string; expires_utc: string } {
  const ms = (iso: string) => new Date(iso).getTime();
  const kept = rows.filter((r) => !r.revoked_utc).sort((a, b) => ms(a.start_utc) - ms(b.start_utc));
  if (!kept.length) return own;
  const now = nowMs();
  const end = kept.reduce((last, r) => (ms(r.expires_utc) > ms(last) ? r.expires_utc : last), kept[0].expires_utc);
  const running = kept.find((r) => ms(r.start_utc) <= now && now < ms(r.expires_utc));
  const next = kept.find((r) => ms(r.start_utc) > now);
  return { start_utc: (running ?? next ?? kept[0]).start_utc, expires_utc: end };
}

/**
 * The student's own receipts with their package's name and kind — the
 * top card's input — each with its access rows, in the same request.
 * One student's rows (AGENTS.md rule 10's exemption); the owner reads
 * them under RLS, so the cookie client serves.
 */
export async function getStudentReceipts(db: ServerSupabaseClient, userId: string): Promise<DashReceipt[]> {
  const { data, error } = await db
    .from('subscriptions')
    .select('subscription_id, product_id, start_utc, expires_utc, status, products ( name, kind ), course_access ( start_utc, expires_utc, revoked_utc )')
    .eq('user_id', userId);
  if (error) {
    console.error('getStudentReceipts:', userId, error);
    return [];
  }
  type Row = {
    subscription_id: string;
    product_id: string;
    start_utc: string;
    expires_utc: string;
    status: string;
    products: { name: string | null; kind: string | null } | null;
    course_access: Stretch[] | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    subscription_id: r.subscription_id,
    product_id: r.product_id,
    product_name: r.products?.name || r.product_id,
    kind: (r.products?.kind?.toUpperCase() as ReceiptKind) || 'PAID',
    ...windowNow(r, r.course_access ?? []),
    status: String(r.status || '').toUpperCase(),
  }));
}

/**
 * The numbers nothing else counts — student_dashboard(), server only (the
 * browser's roles cannot call it). The student is the signed-in one, from
 * the page's gate; `courseIds` are the courses the page lists, in order;
 * `recap` the ended trial's or package's window, when the page shows one.
 */
export async function getDashboardNumbers(
  userId: string,
  courseIds: string[],
  recap: { from: string; to: string } | null,
): Promise<DashNumbers> {
  const { data, error } = await createServiceRoleClient().rpc('student_dashboard', {
    p_user_id: userId,
    p_course_ids: courseIds,
    p_recap_from: recap?.from ?? null,
    p_recap_to: recap?.to ?? null,
  });
  if (error || !data) {
    console.error('getDashboardNumbers:', userId, error);
    return EMPTY_NUMBERS;
  }
  return { ...EMPTY_NUMBERS, ...(data as Partial<DashNumbers>) };
}
