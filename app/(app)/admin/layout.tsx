// app/(app)/admin/layout.tsx
//
// The admin chrome: the gate, then the shell with the admin sidebar.
// The Messages badge (slice 12) is wired and reads nothing yet.

import { requireAdmin } from '@/lib/access';
import { AppShell } from '@/components/shell/app-shell';
import { AdminSidebar } from '@/components/nav/admin/admin-sidebar';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return <AppShell sidebar={<AdminSidebar badges={{}} />}>{children}</AppShell>;
}
