// lib/courses/queries.ts
//
// What the My courses page and the course page read (04.8, 04.9; Sam,
// 2026-10-12). Nothing new is read: the papers and the access kind come
// from lib/practice-papers, the questions met from student_dashboard(), the
// days from the access map, the news from the announcements reader and
// the builder's door from lib/attempts/builder-door. This file only puts
// them together, once per request.

import type { AuthGateResult } from '@/lib/access';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { getDashboardNumbers } from '@/lib/dashboard/student/queries';
import { getAnnouncementsForStudent } from '@/lib/announcements/queries';
import type { Announcement } from '@/lib/announcements/types';
import { builderDoorFor } from '@/lib/attempts/builder-door';
import { getMockQuizzesForCourse } from '@/lib/quizzes/queries';
import { getQuizAvailability } from '@/lib/quizzes/availability';
import { loadPracticePapers, type PracticePapers } from '@/lib/practice-papers/queries';
import { formatDay, scoredPaper, scoresWord, shortName, upNext, type CourseView, type PaperView } from '@/lib/practice-papers/derive';

export type CourseSummary = {
  course: CourseView;
  /** Days left on the stored end; null with no live grant. */
  days: number | null;
  expires: string | null;
  met: number;
  bank: number;
  papersDone: number;
  /** The paper Up next points at, if any. */
  next: PaperView | null;
  /** The My courses card's last line. */
  carryLine: string;
};

export type MyCourses = {
  courses: CourseSummary[];
  ended: PracticePapers['ended'];
  /** The weakest topic over all the student's courses (the dashboard's). */
  weakest: { course_id: string; topic: string; answered: number; correct: number } | null;
};

function carryLineOf(course: CourseView, next: PaperView | null): string {
  if (next) return next.inProgress ? `Carry on: ${shortName(next.title)}` : `Start ${shortName(next.title)}`;
  const scored = scoredPaper(course.papers);
  if (scored) return scoresWord(scored, 'See your scores');
  if (course.papers.length && course.papers.every((p) => p.state === 'done')) return 'All papers done';
  return 'Opens with a package';
}

export async function loadMyCourses(gate: AuthGateResult): Promise<MyCourses> {
  const { supabase, profile } = gate;
  const [data, access] = await Promise.all([loadPracticePapers(supabase, profile), getStudentCourseAccess(supabase, profile.user_id)]);
  const numbers = await getDashboardNumbers(
    profile.user_id,
    data.courses.map((c) => c.course_id),
    null,
  );
  const metBy = new Map(numbers.courses.map((c) => [c.course_id, c]));
  const courses: CourseSummary[] = data.courses.map((course) => {
    const next = upNext(course.papers);
    const m = metBy.get(course.course_id);
    return {
      course,
      days: access[course.course_id]?.totalDays ?? null,
      expires: access[course.course_id]?.expires ?? null,
      met: m?.met ?? 0,
      bank: m?.bank ?? 0,
      papersDone: course.papers.filter((p) => p.state === 'done').length,
      next,
      carryLine: carryLineOf(course, next),
    };
  });
  return { courses, ended: data.ended, weakest: numbers.weakest };
}

export type CoursePageData = {
  summary: CourseSummary;
  /** The student's other courses, for the tabs. */
  tabs: { course_id: string; title: string }[];
  ended: PracticePapers['ended'];
  /** The row's link: the course's open mock's own page, else the Mock exams page (04.15). */
  mocksLine: { text: string; open: boolean; href: string };
  builderLine: { text: string; open: boolean };
  news: Announcement[];
};

export async function loadCoursePage(gate: AuthGateResult, courseId: string): Promise<CoursePageData | null> {
  const { supabase, profile } = gate;
  const mine = await loadMyCourses(gate);
  const summary = mine.courses.find((c) => c.course.course_id === courseId);
  if (!summary) return null;
  const course = summary.course;

  // The builder's row: the door decides who gets what (04.4).
  const door = course.access === 'none' ? null : await builderDoorFor(gate, courseId);
  let builderLine: CoursePageData['builderLine'];
  const weak = mine.weakest && mine.weakest.course_id === courseId ? mine.weakest : null;
  if (door && door.reason === 'paid') {
    builderLine = {
      text: weak ? `Practise ${weak.topic}, ${Math.round((weak.correct / Math.max(1, weak.answered)) * 100)}%` : 'Build a quiz',
      open: true,
    };
  } else if (door && door.reason === 'trial' && door.quizzesLeft != null && door.quizzesTotal != null) {
    builderLine = { text: `${door.quizzesLeft} of ${door.quizzesTotal} trial quizzes left`, open: true };
  } else {
    builderLine = { text: 'Free questions only', open: true };
  }

  // The mocks' row: included in the package, or a locked line.
  const mocksHref = '/student/mock-exams';
  let mocksLine: CoursePageData['mocksLine'] = { text: 'With Premium Prep', open: false, href: mocksHref };
  if (course.mocksIncluded) {
    const mocks = await getMockQuizzesForCourse(supabase, courseId);
    const now = new Date();
    const open = mocks.find((m) => getQuizAvailability(m, now) === 'ACTIVE');
    const upcoming = mocks.find((m) => getQuizAvailability(m, now) === 'UPCOMING');
    mocksLine = open
      ? { text: `${open.title} is open`, open: true, href: `${mocksHref}/${encodeURIComponent(open.quiz_id)}` }
      : upcoming && upcoming.publish_at
        ? { text: `${upcoming.title} opens ${formatDay(upcoming.publish_at)}`, open: true, href: mocksHref }
        : { text: 'No mocks right now', open: true, href: mocksHref };
  }

  const announcements = await getAnnouncementsForStudent(supabase, profile);
  const news = announcements.filter((a) => (a.scope_courses || []).includes(courseId)).slice(0, 2);

  return {
    summary,
    tabs: mine.courses.map((c) => ({ course_id: c.course.course_id, title: c.course.title })),
    ended: mine.ended,
    mocksLine,
    builderLine,
    news,
  };
}

