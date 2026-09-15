// lib/payments/admin-queries.ts
//
// The admin Payments page's reads (slice 9b), transcribed from legacy
// js/mynmclicensure-api.js (getPaymentsPaginated, getPaymentStatusCounts)
// and admin/payments.html (loadStats' today query, renderRevenue's
// query). Each takes the admin gate's client — the ADMIN SELECT policy
// is the floor — and, as legacy, fails open: an error is logged and an
// empty result returned.
//
// One shape change under the standing S4 tick: `payments.user_id` and
// `product_id` are keys now, so the student and the product join in
// the same select; legacy fetched the page's users in a second call
// because no key existed. Same columns, same rows.

import type { ServerSupabaseClient } from '@/lib/access';
import type { Payment, PaymentStatus } from './types';

export type PaymentFilters = {
  search: string;
  status: string;
  productId: string;
  /** Applied in the browser over the joined student, as legacy did. */
  programId: string;
  dateFrom: string;
  dateTo: string;
};

export const EMPTY_PAYMENT_FILTERS: PaymentFilters = { search: '', status: '', productId: '', programId: '', dateFrom: '', dateTo: '' };

export const PAYMENTS_PAGE_SIZE = 50;

export type PaymentListRow = Payment & {
  users: { user_id: string; name: string | null; forename: string | null; surname: string | null; email: string; program_id: string | null } | null;
  products: { name: string } | null;
};

export type PaymentsPage = { payments: PaymentListRow[]; total: number };

export type PaymentStatusCounts = Record<PaymentStatus, number>;

export type RevenueRow = { product_id: string; amount_minor_paid: number | null; currency: string };

// ── getPaymentsPaginated ───────────────────────────────────────────────
// Latest paid first (unpaid rows last); reference or email search;
// status, product and paid-date bounds on the server; 50 a page.
export async function getPaymentsPaginated(
  db: ServerSupabaseClient,
  filters: PaymentFilters,
  page: number,
  pageSize = PAYMENTS_PAGE_SIZE,
): Promise<PaymentsPage> {
  let query = db
    .from('payments')
    .select('*, users ( user_id, name, forename, surname, email, program_id ), products ( name )', { count: 'exact' })
    .order('paid_utc', { ascending: false, nullsFirst: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.productId) query = query.eq('product_id', filters.productId);
  if (filters.dateFrom) query = query.gte('paid_utc', filters.dateFrom);
  if (filters.dateTo) query = query.lte('paid_utc', filters.dateTo);

  const term = String(filters.search || '').trim();
  if (term) {
    const like = `%${term}%`;
    query = query.or(`reference.ilike.${like},email.ilike.${like}`);
  }

  const from = page * pageSize;
  const { data, count, error } = await query.range(from, from + pageSize - 1);
  if (error) {
    console.error('getPaymentsPaginated:', error);
    return { payments: [], total: 0 };
  }
  return { payments: (data ?? []) as unknown as PaymentListRow[], total: count || 0 };
}

// ── getPaymentStatusCounts ─────────────────────────────────────────────
// Five head counts, one per status; a failed one counts 0.
export async function getPaymentStatusCounts(db: ServerSupabaseClient): Promise<PaymentStatusCounts> {
  const statuses: PaymentStatus[] = ['ACTIVATED', 'PAID', 'SETUP_REQUIRED', 'FAILED', 'INIT'];
  const results = await Promise.all(
    statuses.map(async (s) => {
      const { count, error } = await db.from('payments').select('*', { count: 'exact', head: true }).eq('status', s);
      if (error) {
        console.error(`getPaymentStatusCounts(${s}):`, error);
        return 0;
      }
      return count || 0;
    }),
  );
  const counts = {} as PaymentStatusCounts;
  statuses.forEach((s, i) => {
    counts[s] = results[i];
  });
  return counts;
}

// ── today's revenue (legacy loadStats) ─────────────────────────────────
// ACTIVATED rows paid today (the UTC date, as legacy's substring of an
// ISO string), summed; the last row's currency wins, GHS by default.
export async function getTodayRevenue(db: ServerSupabaseClient): Promise<{ minor: number; currency: string }> {
  const todayStr = new Date().toISOString().substring(0, 10);
  const { data, error } = await db
    .from('payments')
    .select('amount_minor_paid, currency')
    .eq('status', 'ACTIVATED')
    .gte('paid_utc', `${todayStr}T00:00:00`)
    .lte('paid_utc', `${todayStr}T23:59:59`);
  if (error) {
    console.error('getTodayRevenue:', error);
    return { minor: 0, currency: 'GHS' };
  }
  let minor = 0;
  let currency = 'GHS';
  for (const r of data ?? []) {
    minor += Number(r.amount_minor_paid || 0);
    if (r.currency) currency = r.currency as string;
  }
  return { minor, currency };
}

// ── the revenue summary's rows (legacy renderRevenue) ──────────────────
// Every ACTIVATED row with an amount; grouped by product in the page.
export async function getRevenueRows(db: ServerSupabaseClient): Promise<RevenueRow[]> {
  const { data, error } = await db
    .from('payments')
    .select('product_id, amount_minor_paid, currency')
    .eq('status', 'ACTIVATED')
    .gt('amount_minor_paid', 0);
  if (error) {
    console.error('getRevenueRows:', error);
    return [];
  }
  return (data ?? []) as RevenueRow[];
}
