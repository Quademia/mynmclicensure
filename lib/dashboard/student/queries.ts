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

/**
 * The student's own receipts with their package's name and kind — the
 * top card's input. One student's rows (AGENTS.md rule 10's exemption);
 * the owner reads them under RLS, so the cookie client serves.
 */
export async function getStudentReceipts(db: ServerSupabaseClient, userId: string): Promise<DashReceipt[]> {
  const { data, error } = await db
    .from('subscriptions')
    .select('subscription_id, product_id, start_utc, expires_utc, status, products ( name, kind )')
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
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    subscription_id: r.subscription_id,
    product_id: r.product_id,
    product_name: r.products?.name || r.product_id,
    kind: (r.products?.kind?.toUpperCase() as ReceiptKind) || 'PAID',
    start_utc: r.start_utc,
    expires_utc: r.expires_utc,
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
