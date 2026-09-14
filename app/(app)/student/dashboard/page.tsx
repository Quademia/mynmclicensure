// app/(app)/student/dashboard/page.tsx — legacy student/dashboard.html,
// the chrome (slice 2b) plus the announcements block (slice 11b). The
// page header is the legacy one: "Dashboard" / "Welcome back,
// {forename}!". The rest of the body — profile nudge, subscription bar,
// course cards, channels, recent attempts — is slice 7e; until then
// the placeholder card stays under the block.

import { requireStudent } from '@/lib/access';
import { getAnnouncementsForStudent, getStudentNoticeStates } from '@/lib/announcements/queries';
import { AnnouncementsStrip } from '@/components/announcements/announcements-strip';
import { PageHeader, displayNameOf } from '@/components/shell/page-header';
import '@/styles/student-dashboard.css';

export const dynamic = 'force-dynamic';

export default async function StudentDashboardPage() {
  const { supabase, profile } = await requireStudent();
  const [announcements, states] = await Promise.all([
    getAnnouncementsForStudent(supabase, profile),
    getStudentNoticeStates(supabase, profile.user_id),
  ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${profile.forename || 'Student'}!`}
        userName={displayNameOf(profile)}
      />
      <div className="sdash">
        <AnnouncementsStrip announcements={announcements} states={states} />
        <div className="card">
          <p>Your dashboard content arrives with slice 7e.</p>
        </div>
      </div>
    </>
  );
}
