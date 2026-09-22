// app/(app)/student/announcements/page.tsx — legacy student/announcements.html
// (slice 11b).
//
// The server half: the gate, then what legacy's loadAnnouncements did
// in the browser — the active in-schedule announcements filtered to
// this student's scope (lib/announcements/queries, the AND rules on
// the server) and the student's notice rows merged to one state per
// announcement — handed to the client half, which is the page's
// script (the tabs, the cards, Mark as Read, Dismiss).

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getAnnouncementsForStudent, getStudentNoticeStates } from '@/lib/announcements/queries';
import { AnnouncementsClient } from './announcements-client';
import '@/styles/student-announcements.css';

export const metadata: Metadata = {
  title: 'Announcements | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function StudentAnnouncementsPage() {
  const { supabase, profile } = await requireStudent();
  const [announcements, states] = await Promise.all([
    getAnnouncementsForStudent(supabase, profile),
    getStudentNoticeStates(supabase, profile.user_id),
  ]);

  // The page header is rendered by the client half so its subtitle count
  // follows Mark as Read and Dismiss (legacy updated #pageSubtitle in place).
  return <AnnouncementsClient announcements={announcements} initialStates={states} />;
}
