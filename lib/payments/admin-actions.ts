// lib/payments/admin-actions.ts
//
// The admin Payments page's one Server Action (slice 9b): a filter
// change or Load More re-reads a page of payments behind the admin
// gate, as legacy's loadPayments() re-queried from the browser. Retry
// Activation calls the public verify action directly (legacy called the
// same Worker route), and Copy Setup Link needs nothing from the server.

'use server';

import { requireAdmin } from '@/lib/access';
import { getPaymentsPaginated, type PaymentFilters, type PaymentsPage } from './admin-queries';

export async function listPaymentsAction(filters: PaymentFilters, page: number): Promise<PaymentsPage> {
  const { supabase } = await requireAdmin();
  return getPaymentsPaginated(supabase, filters, Math.max(0, Number(page) || 0));
}
