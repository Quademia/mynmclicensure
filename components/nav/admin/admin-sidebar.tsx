// components/nav/admin/admin-sidebar.tsx
//
// The admin sidebar: the shared drawer with the admin menu and the
// "Admin Panel" header, as legacy.

'use client';

import { ADMIN_NAV } from '@/lib/nav/admin';
import { MobileDrawer } from '@/components/shell/mobile/mobile-drawer';
import { SidebarNav } from '@/components/nav/shared/sidebar-nav';

export function AdminSidebar({ badges }: { badges: Record<string, number> }) {
  return (
    <MobileDrawer
      header={
        <>
          <h2>Quademia</h2>
          <p>Admin Panel</p>
        </>
      }
      renderNav={(close) => <SidebarNav items={ADMIN_NAV} badges={badges} onNavigate={close} />}
    />
  );
}
