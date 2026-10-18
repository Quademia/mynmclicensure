// app/(app)/student/announcements/page.tsx — the Announcements page,
// redesigned (08.7; Sam, 2026-10-18, drawn on the app's own styles at
// 375px and 1280px; 08-help-and-news.md, 11-pages.md).
//
// The server half: the gate, then one read — announcements_for_me(), the
// student's notices with every scope checked in the database and their
// own marks (A1, A2) — with each notice's time words and first line
// worked out here, and the notice the address names (?id=, from the
// dashboard or a device notice), handed to the client half, which is the
// page. Nothing here reads the database from the browser.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getAnnouncementsForStudent } from '@/lib/announcements/queries';
import { firstLine, longWhen, noticeTime, shortWhen } from '@/lib/announcements/display';
import { AnnouncementsClient, type NoticeItem } from './announcements-client';
import '@/styles/student-announcements.css';

export const metadata: Metadata = {
  title: 'Announcements | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function StudentAnnouncementsPage({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  const { supabase } = await requireStudent();
  const [list, params] = await Promise.all([getAnnouncementsForStudent(supabase), searchParams]);

  const items: NoticeItem[] = list.map((a) => ({
    ...a,
    when: shortWhen(noticeTime(a)),
    date: longWhen(noticeTime(a)),
    line: firstLine(a),
  }));
  const asked = typeof params.id === 'string' ? params.id : null;
  const openId = asked && items.some((a) => a.announcement_id === asked) ? asked : null;

  return <AnnouncementsClient items={items} openId={openId} />;
}
