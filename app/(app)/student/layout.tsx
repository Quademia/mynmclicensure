// app/(app)/student/layout.tsx
//
// The student chrome (AGENTS.md folder convention #6): the gate, then
// the shell with the student sidebar. The gate is cached per request
// (lib/access/internal.ts), so a page calling requireStudent() again
// costs nothing.
//
// Empty by slice: the My Courses rows come from course access (slices
// 3 + 8) and the Messages badge from slice 12. Both are wired here and
// read nothing yet.

import { requireStudent } from '@/lib/access';
import { AppShell } from '@/components/shell/app-shell';
import { StudentSidebar } from '@/components/nav/student/student-sidebar';
import { displayNameOf } from '@/components/shell/page-header';

export const dynamic = 'force-dynamic';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStudent();

  return (
    <AppShell
      sidebar={
        <StudentSidebar
          user={{ label: displayNameOf(profile) || 'My Account', avatarUrl: profile.avatar_url }}
          courses={[]}
          badges={{}}
        />
      }
    >
      {children}
    </AppShell>
  );
}
