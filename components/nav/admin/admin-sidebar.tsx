// components/nav/admin/admin-sidebar.tsx
//
// The admin sidebar: the admin menu inside the shared drawer. Under A3
// (10-design-system.md DS5) the "Admin Panel" header moved to the top
// bar's wordmark, so the sidebar starts at Dashboard.

'use client';

import { ADMIN_NAV } from '@/lib/nav/admin';
import { useShell } from '@/components/shell/shell-state';
import { SidebarNav } from '@/components/nav/shared/sidebar-nav';

export function AdminSidebar({ badges }: { badges: Record<string, number> }) {
  const { closeOnPhone } = useShell();
  return <SidebarNav items={ADMIN_NAV} badges={badges} onNavigate={closeOnPhone} />;
}
