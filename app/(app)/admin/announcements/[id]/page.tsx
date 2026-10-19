// app/(app)/admin/announcements/[id]/page.tsx — one notice on its own page
// (08.18; Sam, 2026-10-19): its address works from a link, Back and a
// refresh. The gate, the notice with its words, its state now, Seen out of
// who it reaches today (a live one's line), the names behind its Named
// students, and what the editor's pickers offer. The page itself is
// notice-editor.tsx; it starts afresh when a save changes the notice's
// status or picture (the key), so what it shows is what was saved.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAllAnnouncements, getAnnouncement, getEditorChoices, getEngagementCounts, getReachCounts, getStudentNames } from '@/lib/announcements/queries';
import { computeDisplayStatus } from '@/lib/announcements/scoping';
import { NoticeEditor } from '../notice-editor';
import '@/styles/admin-announcements.css';

export const metadata: Metadata = {
  title: 'Announcement | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function AnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const service = createServiceRoleClient();
  const notice = await getAnnouncement(service, decodeURIComponent(id));
  if (!notice) notFound();

  const [choices, rows, engage, reach, users] = await Promise.all([
    getEditorChoices(supabase, service),
    getAllAnnouncements(service),
    getEngagementCounts(service),
    getReachCounts(service),
    getStudentNames(service, notice.scope_user_ids ?? []),
  ]);
  const usedBy: Record<string, number> = {};
  for (const a of rows) usedBy[a.kind] = (usedBy[a.kind] ?? 0) + 1;
  const display = computeDisplayStatus(notice);
  const seen = { seen: engage[notice.announcement_id]?.seen ?? 0, reach: reach[notice.announcement_id] ?? 0 };

  return (
    <NoticeEditor
      key={`${notice.announcement_id}:${notice.status}:${notice.picture_path ?? ''}`}
      notice={notice}
      display={display}
      seen={seen}
      initialUsers={users}
      choices={choices}
      usedBy={usedBy}
    />
  );
}
