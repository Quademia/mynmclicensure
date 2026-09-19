// app/(app)/admin/users/page.tsx — legacy admin/users.html (slice 14a).
//
// The server half: the gate, then what legacy's init loaded — the
// programmes (the filter), the ACTIVE products (the Assign form's list,
// with legacy's price-or-Free label), the first page of users — and
// the `?user_id=` the Payments page's "View Student" and the
// dashboard's "View" pass, which opens the drawer on arrival (§9 #23:
// legacy put the id in the address and never read it). Legacy's school
// map is not loaded: the drawer's read joins the school on its key.

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { getPrograms, getProducts } from '@/lib/catalogue/queries';
import { getUsersPaginated } from '@/lib/users/queries';
import { EMPTY_USER_FILTERS } from '@/lib/users/types';
import { PageHeader, displayNameOf } from '@/components/shell/page-header';
import { UsersClient } from './users-client';
import '@/styles/admin-users.css';
import '@/styles/admin-grant-dialog.css';

export const metadata: Metadata = {
  title: 'Users | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ user_id?: string }> }) {
  const { supabase, profile } = await requireAdmin();
  const { user_id } = await searchParams;

  const [programs, products, firstPage] = await Promise.all([
    getPrograms(supabase),
    getProducts(supabase),
    getUsersPaginated(supabase, EMPTY_USER_FILTERS, 0),
  ]);

  return (
    <>
      <PageHeader title="Users" subtitle="Search, view and manage all platform users" userName={displayNameOf(profile)} />
      <UsersClient programs={programs} products={products} firstPage={firstPage} openUserId={String(user_id || '').trim()} />
    </>
  );
}
