// app/(app)/student/layout.tsx
//
// The student chrome (AGENTS.md folder convention #6): the gate, then
// the shell with the student sidebar. The gate is cached per request
// (lib/access/internal.ts), so a page calling requireStudent() again
// costs nothing.
//
// The Messages badge: the student's open threads whose last message is
// an unread reply — one count in the database (08.2, msg_unread_count);
// under A3 the same count sits on the top bar's envelope, so a closed
// sidebar cannot hide a reply (10-design-system.md DS5). Drawn first
// here; the shell keeps it fresh (08.5a, components/shell/unread-live).

import { requireStudent } from '@/lib/access';
import { AppShell } from '@/components/shell/app-shell';
import { StudentSidebar } from '@/components/nav/student/student-sidebar';
import { displayNameOf } from '@/components/shell/page-header';
import { getUnreadCountForUser } from '@/lib/messaging/badges';
import { STUDENT_PHONE_TABS } from '@/lib/nav/student';
import { PhoneCheckIn } from './phone-check-in';

export const dynamic = 'force-dynamic';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStudent();
  const unread = (await getUnreadCountForUser(profile.user_id)) ?? 0;

  return (
    <AppShell
      sidebar={<StudentSidebar />}
      unread={{ initial: unread, side: 'student', userId: profile.user_id }}
      phoneTabs={STUDENT_PHONE_TABS}
      topBar={{
        product: 'MyNMCLicensure',
        installRow: true,
        messagesHref: '/student/messages',
        announcementsHref: '/student/announcements',
        user: { name: displayNameOf(profile), email: profile.email, avatarUrl: profile.avatar_url },
        menuLinks: [
          { label: 'My Profile', href: '/student/profile' },
          { label: 'Upgrade / Extend', href: '/student/upgrade', accent: true },
        ],
      }}
    >
      {children}
      <PhoneCheckIn userId={profile.user_id} />
    </AppShell>
  );
}
