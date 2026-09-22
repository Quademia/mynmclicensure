// components/nav/student/student-sidebar.tsx
//
// The student sidebar: the student menu inside the shared drawer. Under
// A3 (10-design-system.md DS5) the brand block moved to the top bar's
// wordmark and the My Account block into the avatar menu, so each is in
// one place, not both; the sidebar keeps the audience as a small label
// above Dashboard — "Student Panel" (Sam, 2026-09-22) — and ends at
// Telegram Channel.

'use client';

import { STUDENT_NAV } from '@/lib/nav/student';
import { useShell } from '@/components/shell/shell-state';
import { SidebarNav, type SidebarCourse } from '@/components/nav/shared/sidebar-nav';

export function StudentSidebar({ courses, badges }: { courses: SidebarCourse[]; badges: Record<string, number> }) {
  const { closeOnPhone } = useShell();
  return (
    <>
      <div className="sidebar-audience">Student Panel</div>
      <SidebarNav items={STUDENT_NAV} courses={courses} badges={badges} onNavigate={closeOnPhone} />
    </>
  );
}
