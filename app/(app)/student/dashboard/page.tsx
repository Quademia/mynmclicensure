// app/(app)/student/dashboard/page.tsx — the student dashboard, redesigned
// (D2b; 11-pages.md Dashboard; Sam, 2026-10-04). Built from the plan, not
// from the legacy page, which it replaces.
//
// Where sign-in lands, for every status (A). Top to bottom: the top card
// (the student's next step — a trial's or a package's days and Carry on;
// on the floor the recap and the free practice card) → today's challenge
// (when 04 G2 lands) → the streak and questions mastered (05 G1a) → the
// weakest topic → my courses → news → recent sittings; the profile nudge
// above all while the phone or school is missing. Off the page (Sam,
// 2026-10-04): the channels card, the Quiz Builder and NMC Procedures
// cards, the Portal Guide bubble.
//
// Reads: the readers that already exist, side by side (access and courses
// shared with the layout's menu — one read a request); then
// student_dashboard(), server only, for the numbers nothing else counts —
// it needs the course list and the recap's window from the first reads.
// Nothing here reads the database from the browser.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getCourses } from '@/lib/catalogue/queries';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { getRecentAttempts } from '@/lib/attempts/queries';
import { getAnnouncementsForStudent, getStudentNoticeStates } from '@/lib/announcements/queries';
import { getDashboardNumbers, getStudentReceipts } from '@/lib/dashboard/student/queries';
import { lastSevenDayLetters, topCardFor } from '@/lib/dashboard/student/status';
import { AnnouncementsStrip } from '@/components/announcements/announcements-strip';
import { ProfileNudge } from './profile-nudge';
import { TopCardView } from './top-card';
import { StreakCard } from './streak-card';
import { WeakestCard } from './weakest-card';
import { CoursesCard, type CourseRow } from './courses-card';
import { RecentCard } from './recent-card';
import '@/styles/student-dashboard.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Dashboard | MyNMCLicensure' };

export default async function StudentDashboardPage() {
  const { supabase, profile } = await requireStudent();

  const [accessMap, courses, receipts, attempts, announcements, states] = await Promise.all([
    getStudentCourseAccess(supabase, profile.user_id),
    getCourses(supabase),
    getStudentReceipts(supabase, profile.user_id),
    getRecentAttempts(supabase, profile.user_id),
    getAnnouncementsForStudent(supabase, profile),
    getStudentNoticeStates(supabase, profile.user_id),
  ]);

  const card = topCardFor(receipts);
  const onFloor = card.kind === 'floor' || card.kind === 'future';

  // Held courses with their days left; on the floor, the programme's
  // courses, locked (Sam, 2026-10-04).
  const rows: CourseRow[] = onFloor
    ? courses
        .filter((c) => Boolean(profile.program_id) && (c.program_scope || []).includes(profile.program_id as string))
        .map((c) => ({ course_id: c.course_id, title: c.title, daysLeft: null }))
    : courses
        .filter((c) => accessMap[c.course_id])
        .map((c) => ({ course_id: c.course_id, title: c.title, daysLeft: accessMap[c.course_id].totalDays }));

  const recapWindow =
    card.kind === 'floor' && card.ended && card.recapFull ? { from: card.ended.start_utc, to: card.ended.expires_utc } : null;

  const numbers = await getDashboardNumbers(
    profile.user_id,
    rows.map((r) => r.course_id),
    recapWindow,
  );

  const titles = new Map(courses.map((c) => [c.course_id, c.title]));
  const titleOf = (courseId: string) => titles.get(courseId) ?? courseId;

  const hasPhone = Boolean(profile.phone_number && profile.phone_number.trim());
  const hasSchool = Boolean(profile.school_id || (profile.school_other && profile.school_other.trim()));

  return (
    <div className="sdash sd">
      <h1 className="sd-hello">Welcome back{profile.forename ? `, ${profile.forename}` : ''}</h1>

      {hasPhone && hasSchool ? null : <ProfileNudge />}

      <div className="sd-grid">
        <div className="sd-main">
          <TopCardView card={card} carry={numbers.carry_on} recap={numbers.recap} titleOf={titleOf} />
          <StreakCard streak={numbers.streak} letters={lastSevenDayLetters()} answered={numbers.answered} mastered={numbers.mastered} />
          {numbers.weakest ? <WeakestCard weakest={numbers.weakest} courseTitle={titleOf(numbers.weakest.course_id)} /> : null}
          <CoursesCard rows={rows} met={numbers.courses} locked={onFloor} />
        </div>
        <div className="sd-side">
          <AnnouncementsStrip announcements={announcements} states={states} />
          <RecentCard attempts={attempts} titleOf={titleOf} />
        </div>
      </div>
    </div>
  );
}
