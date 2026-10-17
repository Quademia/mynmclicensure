// app/(app)/admin/messages/[user_id]/page.tsx — one student's Messages as
// they see them, from Quademia's side (08.2 step 4; Sam, 2026-10-17): the
// way back, the student's name and one line about them — programme and
// school, the live package and its days, the last paid payment and how
// many are unfinished — and "Next waiting ›" to the longest-waiting other
// student; then the student's labels, courses and earlier conversations,
// the waiting one open at once, with Close and Reopen. "Start a message"
// under any label writes to the student as Quademia. A notification's tap
// arrives as ?thread=… and opens that conversation instead, on a phone too
// (08.5b).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/access';
import { MessagesView } from '@/components/messages/messages-view';
import { AppLink } from '@/components/shell/link-pending';
import { PageHeader } from '@/components/shell/page-header';
import { adminOpenThreadAction, adminSendMessageAction, adminStartForAction, closeThreadAction, reopenThreadAction } from '@/lib/messaging/admin-actions';
import { nextWaitingStudent } from '@/lib/messaging/admin-students';
import { loadAdminStudentPage, type AdminStudentLine } from '@/lib/messaging/page-data';
import { formatMinor } from '@/lib/money/format-minor';
import '@/styles/admin-messages.css';

export const metadata: Metadata = {
  title: 'Messages | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

type Params = Promise<{ user_id: string }>;
type Search = Promise<{ thread?: string }>;

const PAYMENT_WORDS: Record<string, string> = {
  ACTIVATED: 'activated',
  PAID: 'paid, access not given yet',
  INIT: 'started, not finished',
  FAILED: 'failed',
  SETUP_REQUIRED: 'paid, account not set up',
};

function oneLine(l: AdminStudentLine): string[] {
  const bits: string[] = [];
  const where = [l.programme, l.school].filter(Boolean).join(' · ');
  if (where) bits.push(where);
  bits.push(l.package ? `${l.package.name}, ${l.package.days} day${l.package.days === 1 ? '' : 's'} left` : 'No live package');
  if (l.lastPayment) {
    const day = new Date(l.lastPayment.paidUtc).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    bits.push(`last payment ${formatMinor(l.lastPayment.amountMinor, l.lastPayment.currency)}, ${day}, ${PAYMENT_WORDS[l.lastPayment.status] ?? l.lastPayment.status.toLowerCase()}`);
  } else {
    bits.push('no payment yet');
  }
  return bits;
}

export default async function AdminStudentMessagesPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { supabase } = await requireAdmin();
  const userId = decodeURIComponent(String((await params).user_id || '').trim());
  const [page, next, { thread }] = await Promise.all([loadAdminStudentPage(supabase, userId), nextWaitingStudent(userId), searchParams]);
  if (!page) notFound();
  const { line, data, waitingKey } = page;
  const tapped = thread ? [...data.labels, ...data.courses, ...data.earlier].find((r) => r.threadId === thread)?.key ?? null : null;

  return (
    <div className="smsg-page amsg-student">
      <div className="amsg-top">
        <AppLink href="/admin/messages" className="amsg-back">‹ Messages</AppLink>
        {next ? <AppLink href={`/admin/messages/${encodeURIComponent(next)}`} className="amsg-next">Next waiting ›</AppLink> : null}
      </div>
      <PageHeader title={line.name} />
      <p className="amsg-line">
        {oneLine(line).join(' · ')}
        {line.unfinished ? <span className="badge badge-warning amsg-flag">{line.unfinished} payment{line.unfinished === 1 ? '' : 's'} not finished</span> : null}
      </p>
      <MessagesView
        side="admin"
        student={{ name: line.name, avatarUrl: line.avatarUrl }}
        initial={data}
        initialKey={tapped ?? waitingKey}
        openOnPhone={Boolean(tapped)}
        openThread={adminOpenThreadAction}
        sendToThread={adminSendMessageAction}
        sendByLabel={adminStartForAction.bind(null, line.user_id)}
        closeThread={closeThreadAction}
        reopenThread={reopenThreadAction}
      />
    </div>
  );
}
