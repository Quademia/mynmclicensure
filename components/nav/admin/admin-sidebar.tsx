// components/nav/admin/admin-sidebar.tsx
//
// The admin sidebar: the admin menu inside the shared drawer. Under A3
// (10-design-system.md DS5) the brand moved to the top bar's wordmark;
// the sidebar keeps the audience as a small label above Dashboard —
// "Admin Panel", legacy's words (Sam, 2026-09-22).

'use client';

import { ADMIN_NAV } from '@/lib/nav/admin';
import { useShell } from '@/components/shell/shell-state';
import { SidebarNav } from '@/components/nav/shared/sidebar-nav';

export function AdminSidebar({ badges }: { badges: Record<string, number> }) {
  const { closeOnPhone } = useShell();
  return (
    <>
      <div className="sidebar-audience">Admin Panel</div>
      <SidebarNav items={ADMIN_NAV} badges={badges} onNavigate={closeOnPhone} />
    </>
  );
}
