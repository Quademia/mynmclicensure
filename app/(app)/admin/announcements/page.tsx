// app/(app)/admin/announcements/page.tsx — legacy admin/announcements.html
// (slice 11a).
//
// The server half: the gate, then what legacy's init loaded — every
// announcement newest first, the engagement counts, the programmes,
// the active courses, every product (the picker shows the active ones)
// and the distinct cohorts from `users` — handed to the client half,
// which is the page's script. After a write the client refreshes the
// route, so these props carry the new rows (legacy re-fetched). The
// notices and their counts are read with the service role behind the
// admin gate: the browser holds nothing on either table (A1, A2,
// 2026-10-18).

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAllProducts, getCourses, getPrograms } from '@/lib/catalogue/queries';
import { getAllAnnouncements, getCohorts, getEngagementCounts, getKinds, getReachCounts } from '@/lib/announcements/queries';
import { getAllQuizzes } from '@/lib/quizzes/queries';
import { PageHeader } from '@/components/shell/page-header';
import { AnnouncementsClient } from './announcements-client';
import '@/styles/admin-announcements.css';

export const metadata: Metadata = {
  title: 'Announcements | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function AdminAnnouncementsPage() {
  const { supabase } = await requireAdmin();
  const service = createServiceRoleClient();
  const [announcements, engage, programs, courses, products, cohorts, kinds, reach, mockRows] = await Promise.all([
    getAllAnnouncements(service),
    getEngagementCounts(service),
    getPrograms(supabase),
    getCourses(supabase),
    getAllProducts(supabase),
    getCohorts(supabase),
    getKinds(service),
    getReachCounts(service),
    // the mock exams a notice's button may point to (A4)
    getAllQuizzes(service, 'mock'),
  ]);
  const mocks = mockRows.map((m) => ({ quiz_id: m.quiz_id, title: m.title, course_id: m.course_id, status: m.status }));

  return (
    <>
      {/* legacy: adminName = forename || name || 'Admin' */}
      <PageHeader title="Announcements" subtitle="Create and manage platform announcements" />
      <AnnouncementsClient
        announcements={announcements}
        engage={engage}
        programs={programs}
        courses={courses}
        products={products}
        cohorts={cohorts}
        kinds={kinds}
        reach={reach}
        mocks={mocks}
      />
    </>
  );
}
