// app/(app)/student/dashboard/page.tsx — legacy student/dashboard.html,
// the chrome only (slice 2b). The page header is the legacy one:
// "Dashboard" / "Welcome back, {forename}!". The body — profile nudge,
// course cards, channels, announcements strip, recent attempts — is
// slice 7.

import { requireStudent } from '@/lib/access';
import { PageHeader, displayNameOf } from '@/components/shell/page-header';

export const dynamic = 'force-dynamic';

export default async function StudentDashboardPage() {
  const { profile } = await requireStudent();
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${profile.forename || 'Student'}!`}
        userName={displayNameOf(profile)}
      />
      <div className="card">
        <p>Your dashboard content arrives with slice 7.</p>
      </div>
    </>
  );
}
