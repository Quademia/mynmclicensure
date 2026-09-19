// app/(app)/admin/layout.tsx
//
// The admin chrome: the gate, then the shell with the admin sidebar.
// The Messages badge is legacy getUnreadCountForAdmin — the distinct
// threads holding a message not yet read by admin (slice 12b).

import { requireAdmin } from '@/lib/access';
import { AppShell } from '@/components/shell/app-shell';
import { AdminSidebar } from '@/components/nav/admin/admin-sidebar';
import { getUnreadCountForAdmin } from '@/lib/messaging/admin-queries';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await requireAdmin();
  const unread = await getUnreadCountForAdmin(supabase);

  return <AppShell sidebar={<AdminSidebar badges={{ messages: unread }} />}>{children}</AppShell>;
}
