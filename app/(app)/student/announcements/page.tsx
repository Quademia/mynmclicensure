// app/(app)/student/announcements/page.tsx — legacy student/announcements.html
// (slice 11b).
//
// The server half: the gate, then one read — announcements_for_me(), the
// student's notices with every scope checked in the database and their
// own marks (A1, A2, 2026-10-18) — read as one state per notice and
// handed to the client half, which is the page's script (the tabs, the
// cards, Mark as Read, Dismiss) until its redesign (08.7).

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getAnnouncementsForStudent } from '@/lib/announcements/queries';
import { noticeStates } from '@/lib/announcements/scoping';
import { AnnouncementsClient } from './announcements-client';
import '@/styles/student-announcements.css';

export const metadata: Metadata = {
  title: 'Announcements | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function StudentAnnouncementsPage() {
  const { supabase } = await requireStudent();
  const announcements = await getAnnouncementsForStudent(supabase);

  // The page header is rendered by the client half so its subtitle count
  // follows Mark as Read and Dismiss (legacy updated #pageSubtitle in place).
  return <AnnouncementsClient announcements={announcements} initialStates={noticeStates(announcements)} />;
}
