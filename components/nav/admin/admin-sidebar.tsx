// components/nav/admin/admin-sidebar.tsx
//
// The admin sidebar: the admin menu inside the shared drawer. Under A3
// (10-design-system.md DS5) the brand moved to the top bar's wordmark;
// the sidebar keeps the audience as a small label above Dashboard —
// "Admin", the word alone without "Panel" (Sam, 2026-09-22). The Messages
// row's count is the shell's live one (08.5a).

'use client';

import { ADMIN_NAV } from '@/lib/nav/admin';
import { useShell } from '@/components/shell/shell-state';
import { useUnread } from '@/components/shell/unread-live';
import { SidebarNav } from '@/components/nav/shared/sidebar-nav';

export function AdminSidebar() {
  const { closeOnPhone } = useShell();
  const messages = useUnread();
  return (
    <>
      <div className="sidebar-audience">Admin</div>
      <SidebarNav items={ADMIN_NAV} badges={{ messages }} onNavigate={closeOnPhone} />
    </>
  );
}
