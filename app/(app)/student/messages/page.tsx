// app/(app)/student/messages/page.tsx — the student's Messages (08.2 step
// 3; Sam, 2026-10-17: drawn as B). The labels are the list, then the
// student's courses, then earlier conversations — each row a tap into its
// conversation, or into an empty one to start. Worded on the server
// (lib/messaging/student-page.ts); the browser half opens a conversation,
// sends and listens for replies.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { loadMessagesPage } from '@/lib/messaging/student-page';
import { MessagesClient } from './messages-client';
import '@/styles/student-messages.css';

export const metadata: Metadata = {
  title: 'Messages | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function StudentMessagesPage() {
  const gate = await requireStudent();
  const data = await loadMessagesPage(gate);
  return (
    <MessagesClient
      student={{ name: gate.profile.forename || gate.profile.name || 'Student', avatarUrl: gate.profile.avatar_url }}
      initial={data}
    />
  );
}
