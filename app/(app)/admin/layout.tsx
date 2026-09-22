// app/(app)/admin/layout.tsx
//
// The admin chrome: the gate, then the shell with the admin sidebar.
// The Messages badge is legacy getUnreadCountForAdmin — the distinct
// threads holding a message not yet read by admin (slice 12b).

import { requireAdmin } from '@/lib/access';
import { AppShell } from '@/components/shell/app-shell';
import { AdminSidebar } from '@/components/nav/admin/admin-sidebar';
import { displayNameOf } from '@/components/shell/page-header';
import { getUnreadCountForAdmin } from '@/lib/messaging/admin-queries';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireAdmin();
  const unread = await getUnreadCountForAdmin(supabase);

  // The same A3 bar as the student's (10-design-system.md DS5): "Admin
  // Panel" as the product line, the admin unread count on the envelope,
  // the bell to the admin Announcements page, and an avatar menu of just
  // the name and Sign out — an admin has no profile page and no upgrade.
  return (
    <AppShell
      sidebar={<AdminSidebar badges={{ messages: unread }} />}
      topBar={{
        product: 'Admin Panel',
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
