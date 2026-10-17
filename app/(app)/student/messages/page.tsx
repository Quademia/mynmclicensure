// app/(app)/student/messages/page.tsx — the student's Messages (08.2 step
// 3; Sam, 2026-10-17: drawn as B). The labels are the list, then the
// student's courses, then earlier conversations — each row a tap into its
// conversation, or into an empty one to start. Worded on the server
// (lib/messaging/page-data.ts); the view is the one the admin's page uses
// for a student too (components/messages/messages-view.tsx), with the
// student's actions.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { MessagesView } from '@/components/messages/messages-view';
import { PageHeader } from '@/components/shell/page-header';
import { openThreadAction, sendByLabelAction, sendMessageAction } from '@/lib/messaging/actions';
import { loadMessagesPage } from '@/lib/messaging/page-data';

export const metadata: Metadata = {
  title: 'Messages | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function StudentMessagesPage() {
  const gate = await requireStudent();
  const data = await loadMessagesPage(gate);
  return (
    <div className="smsg-page">
      <PageHeader title="Messages" />
      <MessagesView
        side="student"
        student={{ name: gate.profile.forename || gate.profile.name || 'Student', avatarUrl: gate.profile.avatar_url }}
        initial={data}
        openThread={openThreadAction}
        sendToThread={sendMessageAction}
        sendByLabel={sendByLabelAction}
      />
    </div>
  );
}
