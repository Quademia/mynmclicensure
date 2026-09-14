// app/(app)/admin/announcements/page.tsx — legacy admin/announcements.html
// (slice 11a).
//
// The server half: the gate, then what legacy's init loaded — every
// announcement newest first, the engagement counts, the programmes,
// the active courses, every product (the picker shows the active ones)
// and the distinct cohorts from `users` — handed to the client half,
// which is the page's script. After a write the client refreshes the
// route, so these props carry the new rows (legacy re-fetched).

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { getAllProducts, getCourses, getPrograms } from '@/lib/catalogue/queries';
import { getAllAnnouncements, getCohorts, getEngagementCounts } from '@/lib/announcements/queries';
import { PageHeader } from '@/components/shell/page-header';
import { AnnouncementsClient } from './announcements-client';
import '@/styles/admin-announcements.css';

export const metadata: Metadata = {
  title: 'Announcements | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function AdminAnnouncementsPage() {
  const { supabase, profile } = await requireAdmin();
  const [announcements, engage, programs, courses, products, cohorts] = await Promise.all([
    getAllAnnouncements(supabase),
    getEngagementCounts(supabase),
    getPrograms(supabase),
    getCourses(supabase),
    getAllProducts(supabase),
    getCohorts(supabase),
  ]);

  return (
    <>
      {/* legacy: adminName = forename || name || 'Admin' */}
      <PageHeader title="Announcements" subtitle="Create and manage platform announcements" userName={profile.forename || profile.name || 'Admin'} />
      <AnnouncementsClient
        announcements={announcements}
        engage={engage}
        programs={programs}
        courses={courses}
        products={products}
        cohorts={cohorts}
      />
    </>
  );
}
