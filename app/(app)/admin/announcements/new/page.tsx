// app/(app)/admin/announcements/new/page.tsx — a new notice on its own page
// (08.18; Sam, 2026-10-19). The gate, then what the editor's pickers offer;
// the page itself is notice-editor.tsx. Saving it the first time moves to
// the notice's own address.

import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAllAnnouncements, getEditorChoices } from '@/lib/announcements/queries';
import { NoticeEditor } from '../notice-editor';
import '@/styles/admin-announcements.css';

export const metadata: Metadata = {
  title: 'New announcement | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function NewAnnouncementPage() {
  const { supabase } = await requireAdmin();
  const service = createServiceRoleClient();
  const [choices, rows] = await Promise.all([getEditorChoices(supabase, service), getAllAnnouncements(service)]);
  const usedBy: Record<string, number> = {};
  for (const a of rows) usedBy[a.kind] = (usedBy[a.kind] ?? 0) + 1;

  return <NoticeEditor notice={null} display={null} seen={null} initialUsers={[]} choices={choices} usedBy={usedBy} />;
}
