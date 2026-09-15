// app/(app)/student/layout.tsx
//
// The student chrome (AGENTS.md folder convention #6): the gate, then
// the shell with the student sidebar. The gate is cached per request
// (lib/access/internal.ts), so a page calling requireStudent() again
// costs nothing.
//
// The My Courses rows are the active courses the student's subscriptions
// cover (legacy populateCourseDropdown(courseAccessMap, allCourses) —
// slice 8). The Messages badge is slice 12 and reads nothing yet.

import { requireStudent } from '@/lib/access';
import { AppShell } from '@/components/shell/app-shell';
import { StudentSidebar } from '@/components/nav/student/student-sidebar';
import { displayNameOf } from '@/components/shell/page-header';
import { getCourses } from '@/lib/catalogue/queries';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';

export const dynamic = 'force-dynamic';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireStudent();
  const [access, allCourses] = await Promise.all([
    getStudentCourseAccess(supabase, profile.user_id),
    getCourses(supabase),
  ]);
  const courses = allCourses
    .filter((c) => Boolean(access[c.course_id]))
    .map((c) => ({ course_id: c.course_id, title: c.title }));

  return (
    <AppShell
      sidebar={
        <StudentSidebar
          user={{ label: displayNameOf(profile) || 'My Account', avatarUrl: profile.avatar_url }}
          courses={courses}
          badges={{}}
        />
      }
    >
      {children}
    </AppShell>
  );
}
