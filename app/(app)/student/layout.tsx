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
//
// The new notices' number (08.9; Sam, 2026-10-18): on the bell on a
// computer, the menu's Announcements row and the menu button's dot on a
// phone; counted by the database beside the Messages count, the shell
// holding it after (components/shell/news-count).
//
// Every page sits in the one column (Sam, 2026-10-30: 1040px, centred,
// the title's line across the whole width): .page-col in shell.css, so no
// page sets a width of its own.

import { requireStudent } from '@/lib/access';
import { AppShell } from '@/components/shell/app-shell';
import { StudentSidebar } from '@/components/nav/student/student-sidebar';
import { displayNameOf } from '@/components/shell/page-header';
import { NotifyRelink } from '@/components/notifications/notify-relink';
import { getUnreadCountForUser } from '@/lib/messaging/badges';
import { getNewNoticeCount } from '@/lib/announcements/badges';
import { STUDENT_PHONE_TABS } from '@/lib/nav/student';
import { PhoneCheckIn } from './phone-check-in';

export const dynamic = 'force-dynamic';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireStudent();
  const [unread, news] = await Promise.all([getUnreadCountForUser(profile.user_id), getNewNoticeCount(supabase)]);

  return (
    <AppShell
      sidebar={<StudentSidebar />}
      unread={{ initial: unread ?? 0, side: 'student', userId: profile.user_id }}
      news={news ?? 0}
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
      {/* the student pages' column (shell.css .page-col; Sam, 2026-10-30) */}
      <div className="page-col">{children}</div>
      <PhoneCheckIn userId={profile.user_id} />
      <NotifyRelink userId={profile.user_id} />
    </AppShell>
  );
}
