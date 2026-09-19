// app/(app)/admin/messages/page.tsx — legacy admin/messages.html
// (slice 12b).
//
// The server half: the gate, then what legacy's boot loaded — every
// course (the labels, the course card, the Bulk Send course picker and
// thread course), the programmes (the Bulk Send picker), the distinct
// levels and cohorts (two more pickers), and the first, unfiltered
// thread list — handed to the client half, which is the page's script.

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { getAllCourses, getPrograms } from '@/lib/catalogue/queries';
import { EMPTY_ADMIN_FILTERS, getAdminThreads, getDistinctLevelsAndCohorts } from '@/lib/messaging/admin-queries';
import { AdminMessagesClient } from './messages-client';
import '@/styles/admin-messages.css';

export const metadata: Metadata = {
  title: 'Messages | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function AdminMessagesPage() {
  const { supabase } = await requireAdmin();

  const [courses, programs, pickers, threads] = await Promise.all([
    getAllCourses(supabase),
    getPrograms(supabase),
    getDistinctLevelsAndCohorts(supabase),
    getAdminThreads(supabase, EMPTY_ADMIN_FILTERS),
  ]);

  return (
    <AdminMessagesClient
      courses={courses.map((c) => ({ course_id: c.course_id, title: c.title }))}
      programs={programs.map((p) => p.program_id)}
      levels={pickers.levels}
      cohorts={pickers.cohorts}
      initialThreads={threads}
    />
  );
}
