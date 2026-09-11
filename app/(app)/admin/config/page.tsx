// app/(app)/admin/config/page.tsx — legacy admin/config.html.
//
// The server half: the gate, then the config rows by key, handed to the
// client half, which is the page's script.

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { getConfigRows } from '@/lib/catalogue/queries';
import { PageHeader, displayNameOf } from '@/components/shell/page-header';
import { ConfigClient } from './config-client';
import '@/styles/admin-catalogue.css';

export const metadata: Metadata = {
  title: 'Config | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function AdminConfigPage() {
  const { supabase, profile } = await requireAdmin();
  const rows = await getConfigRows(supabase);

  return (
    <>
      <PageHeader
        title="Platform Config"
        subtitle="Manage platform-wide settings and feature controls"
        userName={displayNameOf(profile)}
      />
      <ConfigClient rows={rows} />
    </>
  );
}
