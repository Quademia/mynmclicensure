// lib/announcements/app-pages.ts
//
// The pages a notice's button may point to inside the app (A4; Sam,
// 2026-10-18: "a button pointing inside the app picked from a list"): the
// student's own pages, each course's page and practice papers, each mock
// exam. An in-app address is a path ("/student/mock-exams"), so the same
// notice works on the dev site and the live one, and it opens inside the
// app (announcement-body.tsx), not as a new page load. No database, no
// React.

export type AppPage = { label: string; href: string };
export type AppPageGroup = { group: string; items: AppPage[] };

const S = '/student';

export const STUDENT_PAGES: AppPage[] = [
  { label: 'Dashboard', href: `${S}/dashboard` },
  { label: 'My courses', href: `${S}/courses` },
  { label: 'Practice papers', href: `${S}/practice-papers` },
  { label: 'Mock exams', href: `${S}/mock-exams` },
  { label: 'Quiz builder', href: `${S}/quiz-builder` },
  { label: 'Learning history', href: `${S}/learning-history` },
  { label: 'Leaderboards', href: `${S}/leaderboards` },
  { label: 'My packs', href: `${S}/offline-packs` },
  { label: 'Announcements', href: `${S}/announcements` },
  { label: 'Messages', href: `${S}/messages` },
  { label: 'Packages (upgrade or extend)', href: `${S}/upgrade` },
  { label: 'My profile', href: `${S}/profile` },
  { label: 'Portal guide', href: `${S}/portal-guide` },
  { label: 'NMC procedures', href: `${S}/procedures` },
];

export function appPageGroups(
  courses: { course_id: string; title: string }[],
  mocks: { quiz_id: string; title: string; course_id?: string | null; status?: string | null }[],
): AppPageGroup[] {
  const courseTitle = new Map(courses.map((c) => [c.course_id, c.title]));
  const groups: AppPageGroup[] = [{ group: 'Pages', items: STUDENT_PAGES }];
  if (courses.length) {
    groups.push({ group: 'A course', items: courses.map((c) => ({ label: c.title, href: `${S}/course/${encodeURIComponent(c.course_id)}` })) });
    groups.push({ group: "A course's practice papers", items: courses.map((c) => ({ label: `Practice papers · ${c.title}`, href: `${S}/practice-papers/${encodeURIComponent(c.course_id)}` })) });
  }
  const liveMocks = mocks.filter((m) => (m.status || '').toLowerCase() !== 'archived');
  if (liveMocks.length) {
    // several mocks share a name ("Mock 1"): the course tells them apart
    groups.push({
      group: 'A mock exam',
      items: liveMocks.map((m) => {
        const course = m.course_id ? courseTitle.get(m.course_id) : null;
        return { label: course ? `${m.title} · ${course}` : m.title, href: `${S}/mock-exams/${encodeURIComponent(m.quiz_id)}` };
      }),
    });
  }
  return groups;
}

/** An address a notice's link may keep: the web, email, or a path inside the app. */
export function isSafeHref(href: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(href) || /^\/(?!\/)/.test(href);
}

/** A path inside the app (opened by the app's own router). */
export function isAppPath(href: string): boolean {
  return /^\/(?!\/)/.test(href);
}
