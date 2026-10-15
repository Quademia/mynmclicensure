// app/(app)/student/layout.tsx
//
// The student chrome (AGENTS.md folder convention #6): the gate, then
// the shell with the student sidebar. The gate is cached per request
// (lib/access/internal.ts), so a page calling requireStudent() again
// costs nothing.
//
// The Messages badge is legacy getUnreadCountForUser — the
// student's open threads holding a message not yet read (slice 12a);
// under A3 the same count sits on the top bar's envelope, so a closed
// sidebar cannot hide a reply (10-design-system.md DS5).

import { requireStudent } from '@/lib/access';
import { AppShell } from '@/components/shell/app-shell';
import { StudentSidebar } from '@/components/nav/student/student-sidebar';
import { displayNameOf } from '@/components/shell/page-header';
import { getUnreadCountForUser } from '@/lib/messaging/queries';
import { STUDENT_PHONE_TABS } from '@/lib/nav/student';
import { PhoneCheckIn } from './phone-check-in';

export const dynamic = 'force-dynamic';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireStudent();
  const unread = await getUnreadCountForUser(supabase, profile.user_id);

  return (
    <AppShell
      sidebar={<StudentSidebar badges={{ messages: unread }} />}
      phoneTabs={STUDENT_PHONE_TABS}
      topBar={{
        product: 'MyNMCLicensure',
        installRow: true,
        messagesHref: '/student/messages',
        announcementsHref: '/student/announcements',
        unread,
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
