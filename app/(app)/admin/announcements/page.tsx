// app/(app)/admin/announcements/page.tsx — the admin's announcements list
// (08.17; Sam, 2026-10-19 — layout A, mocked up and approved 2026-10-20).
//
// The server half: the gate, then every notice without its words, the
// marks counted per notice, each notice's reach today and the kinds (their
// icons, and the Kinds panel) — all with the service role behind the admin
// gate (the browser holds nothing on these tables, A1, A2). Each notice's
// state now is worked out here, once, so the page's tabs agree with it.
// A notice opens on its own page (08.18).

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAllAnnouncements, getEngagementCounts, getKinds, getReachCounts } from '@/lib/announcements/queries';
import { computeDisplayStatus } from '@/lib/announcements/scoping';
import { PageHeader } from '@/components/shell/page-header';
import { AnnouncementsClient } from './announcements-client';
import '@/styles/admin-announcements.css';

export const metadata: Metadata = {
  title: 'Announcements | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function AdminAnnouncementsPage() {
  await requireAdmin();
  const service = createServiceRoleClient();
  const [rows, engage, reach, kinds] = await Promise.all([
    getAllAnnouncements(service),
    getEngagementCounts(service),
    getReachCounts(service),
    getKinds(service),
  ]);
  const now = new Date();
  const notices = rows.map((a) => ({ ...a, display: computeDisplayStatus(a, now) }));

  return (
    <>
      <PageHeader title="Announcements" />
      <AnnouncementsClient notices={notices} engage={engage} reach={reach} kinds={kinds} />
    </>
  );
}
