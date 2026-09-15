// app/(app)/admin/payments/page.tsx — legacy admin/payments.html
// (slice 9b).
//
// The server half: the gate, then what legacy's init loaded — every
// product (the filter and the revenue names), the programmes (the
// filter), the five status counts and today's revenue (the stats row),
// the first page of payments, and the revenue summary's rows — handed
// to the client half, which is the page's script. A later page or a
// filter change goes through a Server Action; after a Retry Activation
// the route is refreshed so the counts follow (legacy re-fetched).
//
// The setup link the admin copies is built on this site's own address
// (appOrigin(), AGENTS.md: never a literal, never the browser's guess).

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { getAllProducts, getPrograms } from '@/lib/catalogue/queries';
import { appOrigin } from '@/lib/site/app-origin';
import {
  EMPTY_PAYMENT_FILTERS,
  getPaymentStatusCounts,
  getPaymentsPaginated,
  getRevenueRows,
  getTodayRevenue,
} from '@/lib/payments/admin-queries';
import { PageHeader, displayNameOf } from '@/components/shell/page-header';
import { PaymentsClient } from './payments-client';
import '@/styles/admin-payments.css';

export const metadata: Metadata = {
  title: 'Payments | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function AdminPaymentsPage() {
  const { supabase, profile } = await requireAdmin();

  const [products, programs, counts, today, firstPage, revenueRows] = await Promise.all([
    getAllProducts(supabase),
    getPrograms(supabase),
    getPaymentStatusCounts(supabase),
    getTodayRevenue(supabase),
    getPaymentsPaginated(supabase, EMPTY_PAYMENT_FILTERS, 0),
    getRevenueRows(supabase),
  ]);

  return (
    <>
      <PageHeader title="Payments" subtitle="View and manage all payment records" userName={displayNameOf(profile)} />
      <PaymentsClient
        products={products}
        programs={programs}
        counts={counts}
        today={today}
        firstPage={firstPage}
        revenueRows={revenueRows}
        origin={appOrigin()}
      />
    </>
  );
}
