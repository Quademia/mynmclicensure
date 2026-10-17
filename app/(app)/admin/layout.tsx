// app/(app)/admin/layout.tsx
//
// The admin chrome: the gate, then the shell with the admin sidebar.
// The Messages badge: open threads whose last message is the student's,
// unread by Quademia — one count in the database (08.2).

import { requireAdmin } from '@/lib/access';
import { AppShell } from '@/components/shell/app-shell';
import { AdminSidebar } from '@/components/nav/admin/admin-sidebar';
import { displayNameOf } from '@/components/shell/page-header';
import { getUnreadCountForAdmin } from '@/lib/messaging/badges';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();
  const unread = await getUnreadCountForAdmin();

  // The same A3 bar as the student's (10-design-system.md DS5): the same
  // wordmark — which side you are on is the sidebar's label, "Admin
  // Panel" (Sam, 2026-09-22) — the admin unread count on the envelope,
  // the bell to the admin Announcements page, and an avatar menu of just
  // the name and Sign out — an admin has no profile page and no upgrade.
  return (
    <AppShell
      sidebar={<AdminSidebar badges={{ messages: unread }} />}
      topBar={{
        product: 'MyNMCLicensure',
        messagesHref: '/admin/messages',
        announcementsHref: '/admin/announcements',
        unread,
        user: { name: displayNameOf(profile), email: profile.email, avatarUrl: profile.avatar_url },
        menuLinks: [],
      }}
    >
      {children}
    </AppShell>
  );
}
