// app/(app)/student/offline-packs/page.tsx — legacy student/my-offline-packs.html
// (slice 13b).
//
// The server half: the gate, then what legacy's initPage loaded — the
// first page of the student's packs (twenty-four, newest first, with
// the exact total) — handed to the client half, which is the page's
// script. Load More and Refresh go through a Server Action. The
// search / course / status / sort filters and the summary counts work
// over the loaded rows in the browser, as legacy's did.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { listOfflinePacks } from '@/lib/offline-packs/queries';
import { MY_PACKS_PAGE_SIZE } from '@/lib/offline-packs/types';
import { PageHeader } from '@/components/shell/page-header';
import { MyPacksClient } from './my-packs-client';
import '@/styles/student-offline-packs.css';

export const metadata: Metadata = {
  title: 'My Offline Packs | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function MyPacksPage() {
  const { supabase, profile } = await requireStudent();
  const firstPage = await listOfflinePacks(supabase, profile.user_id, MY_PACKS_PAGE_SIZE, 0);

  return (
    <>
      <PageHeader title="My Offline Packs" subtitle="Open, review, and re-download the packs you already created." />
      <MyPacksClient initialPage={firstPage} />
    </>
  );
}
