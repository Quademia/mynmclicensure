// components/nav/student/student-sidebar.tsx
//
// The student sidebar: the student menu inside the shared drawer. Under
// A3 (10-design-system.md DS5) the brand block moved to the top bar's
// wordmark and the My Account block into the avatar menu, so each is in
// one place, not both; the sidebar keeps the audience as a small label
// above Dashboard — "Student", the word alone without "Panel" (Sam,
// 2026-09-22). The menu is in its groups, each heading folding its rows
// away on this device (00 The menu, Sam 2026-10-04: A, b); the
// student-menu class carries the tighter spacing on a computer
// (styles/shell.css) — the admin's sidebar keeps its own.

'use client';

import { STUDENT_NAV } from '@/lib/nav/student';
import { useShell } from '@/components/shell/shell-state';
import { SidebarNav, type SidebarCourse } from '@/components/nav/shared/sidebar-nav';

export function StudentSidebar({
  courses,
  badges,
  folded,
}: {
  courses: SidebarCourse[];
  badges: Record<string, number>;
  /** The groups folded away on this device (the cookie, read by the layout). */
  folded: string[];
}) {
  const { closeOnPhone } = useShell();
  return (
    <div className="student-menu">
      <div className="sidebar-audience">Student</div>
      <SidebarNav
        items={STUDENT_NAV}
        courses={courses}
        badges={badges}
        initialFolded={folded}
        onNavigate={closeOnPhone}
      />
    </div>
  );
}
