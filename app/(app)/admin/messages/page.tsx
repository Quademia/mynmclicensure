// app/(app)/admin/messages/page.tsx — the admin's Messages (slice 12b's
// page on 08.2's rules).
//
// The server half: the gate, every course (the thread names, the course
// card, New Thread's course picker) and the first, unfiltered thread list
// — handed to the client half. Bulk Send's pickers went with it
// (2026-10-17).

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { getAllCourses } from '@/lib/catalogue/queries';
import { EMPTY_ADMIN_FILTERS, getAdminThreads } from '@/lib/messaging/admin-queries';
import { AdminMessagesClient } from './messages-client';
import '@/styles/admin-messages.css';

export const metadata: Metadata = {
  title: 'Messages | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function AdminMessagesPage() {
  const { supabase } = await requireAdmin();

  const [courses, threads] = await Promise.all([getAllCourses(supabase), getAdminThreads(supabase, EMPTY_ADMIN_FILTERS)]);

  return (
    <AdminMessagesClient
      courses={courses.map((c) => ({ course_id: c.course_id, title: c.title }))}
      initialThreads={threads}
    />
  );
}
