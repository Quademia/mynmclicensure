// app/(app)/admin/subscriptions/page.tsx — legacy admin/subscriptions.html.
//
// The server half: the gate, then the three lists the page loaded on
// init — every subscription with its student and product joined (legacy
// loadData), every product, archived included (the filter and the Edit
// dialog; the Grant dialog shows the active ones), and the programmes
// (the filter) — handed to the client half, which is the page's script.
// After a write the client refreshes the route, so these props carry the
// new rows (legacy re-fetched).

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { getAllProducts, getPrograms } from '@/lib/catalogue/queries';
import { getAllSubscriptions } from '@/lib/subscriptions/queries';
import { PageHeader, displayNameOf } from '@/components/shell/page-header';
import { SubscriptionsClient } from './subscriptions-client';
import '@/styles/admin-subscriptions.css';
import '@/styles/admin-grant-dialog.css';

export const metadata: Metadata = {
  title: 'Subscriptions | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function AdminSubscriptionsPage() {
  const { supabase, profile } = await requireAdmin();
  const [subscriptions, products, programs] = await Promise.all([
    getAllSubscriptions(supabase),
    getAllProducts(supabase),
    getPrograms(supabase),
  ]);

  return (
    <>
      <PageHeader title="Subscriptions" subtitle="Manage all student subscriptions" userName={displayNameOf(profile)} />
      <SubscriptionsClient subscriptions={subscriptions} products={products} programs={programs} />
    </>
  );
}
