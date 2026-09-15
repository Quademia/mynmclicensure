// app/(app)/admin/dashboard/page.tsx — legacy admin/dashboard.html, the
// chrome only (slice 2b). Header: "Admin Dashboard" / "Welcome back,
// {forename}!". The four counts and the rest are slice 14.

import { requireAdmin } from '@/lib/access';
import { PageHeader, displayNameOf } from '@/components/shell/page-header';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const { profile } = await requireAdmin();
  return (
    <>
      <PageHeader
        title="Admin Dashboard"
        subtitle={`Welcome back, ${profile.forename || 'Admin'}!`}
        userName={displayNameOf(profile)}
      />
      <div className="card">
        <p>The dashboard counts arrive with slice 14.</p>
      </div>
    </>
  );
}
