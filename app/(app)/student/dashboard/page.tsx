// app/(app)/student/dashboard/page.tsx — the student dashboard, redesigned
// (D2b; 11-pages.md Dashboard; Sam, 2026-10-04). Built from the plan, not
// from the legacy page, which it replaces.
//
// Where sign-in lands, for every status (A). Top to bottom: the top card
// (the student's next step — a trial's or a package's days and Carry on;
// on the floor the recap and the free practice card), with today's
// challenge as one slim line under the title above it (04.26; Sam
// 2026-10-20: C) → the streak and questions mastered (05 G1a) → the
// weakest topic → my courses → recent sittings; the news moved up (08.8;
// Sam, 2026-10-18 — C): "New from Quademia" under the welcome, only while
// something is new, and the Must-see notices popping up until confirmed
// (08.16, one after another). The profile
// nudge above all while the phone or school is missing, then, on a phone,
// the line on how to install the app (07.3; components/install-app) until
// the student closes it or the app is on the home screen. Off the page
// (Sam, 2026-10-04): the channels card, the Quiz Builder and NMC
// Procedures cards, the Portal Guide bubble.
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
import { getAnnouncementsForStudent } from '@/lib/announcements/queries';
import { firstLine, isNew, longWhen, noticeTime } from '@/lib/announcements/display';
import { getDashboardNumbers, getStudentReceipts } from '@/lib/dashboard/student/queries';
import { getChallengeToday } from '@/lib/challenge/queries';
import { getBoardPlace } from '@/lib/leaderboards/queries';
import { lastSevenDayLetters, topCardFor } from '@/lib/dashboard/student/status';
import { PageHeader } from '@/components/shell/page-header';
import { NewFromQuademia } from '@/components/announcements/new-from-quademia';
import { MustSee } from '@/components/announcements/must-see';
import { InstallAppLine } from '@/components/install-app/install-app';
import { ProfileNudge } from './profile-nudge';
import { ChallengeLine } from './challenge-line';
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

  // today's challenge and the student's play (04.26) — the paper made by the first to open it;
  // once played, this week's place for the line beneath it (05 G1b), read beside the rest
  const challengeRead = getChallengeToday(profile.user_id);
  const placeRead = challengeRead.then((t) =>
    t?.play && t.play.status !== 'playing' ? getBoardPlace(profile.user_id, 'week', Boolean(profile.school_id)) : null,
  );
  const [accessMap, courses, receipts, attempts, announcements, challenge, place] = await Promise.all([
    getStudentCourseAccess(supabase, profile.user_id),
    getCourses(supabase),
    getStudentReceipts(supabase, profile.user_id),
    getRecentAttempts(profile.user_id),
    // the notices and the student's marks in one read (A1, A2)
    getAnnouncementsForStudent(supabase),
    challengeRead,
    placeRead,
  ]);
  // The Must-see notices not yet confirmed pop up, one after another
  // (08.16); the card holds the other new ones.
  const mustSee = announcements.filter((a) => a.must_see && !a.confirmed_at && !a.dismissed_at);
  const popping = new Set(mustSee.map((a) => a.announcement_id));
  const newsItems = announcements
    .filter((a) => isNew(a) && !popping.has(a.announcement_id))
    .map((a) => ({ ...a, line: firstLine(a) }));
  const mustSeeDates = Object.fromEntries(mustSee.map((a) => [a.announcement_id, longWhen(noticeTime(a))]));

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
  const hasSchool = Boolean(profile.school_id);

  return (
    <div className="sdash sd">
      {/* every page's title row, the welcome as its title (Sam, 2026-10-18): the menu and the
          phone's tab already say Dashboard; a line beneath is for later */}
      <PageHeader title={`Welcome back${profile.forename ? `, ${profile.forename}` : ''}`} />

      <ChallengeLine today={challenge} place={place} />
      <NewFromQuademia items={newsItems} />
      {mustSee.length ? <MustSee notices={mustSee} dateOf={mustSeeDates} userId={profile.user_id} /> : null}

      {hasPhone && hasSchool ? null : <ProfileNudge />}
      <InstallAppLine closeFor={profile.user_id} />

      <div className="sd-grid">
        <div className="sd-main">
          <TopCardView card={card} carry={numbers.carry_on} recap={numbers.recap} titleOf={titleOf} />
          <StreakCard streak={numbers.streak} letters={lastSevenDayLetters()} answered={numbers.answered} mastered={numbers.mastered} />
          {numbers.weakest ? <WeakestCard weakest={numbers.weakest} courseTitle={titleOf(numbers.weakest.course_id)} /> : null}
          <CoursesCard rows={rows} met={numbers.courses} locked={onFloor} />
        </div>
        <div className="sd-side">
          <RecentCard attempts={attempts} titleOf={titleOf} />
        </div>
      </div>
    </div>
  );
}
