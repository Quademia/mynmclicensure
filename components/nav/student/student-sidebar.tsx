// components/nav/student/student-sidebar.tsx
//
// The student sidebar: the shared drawer with the student menu and the
// student header. Legacy showed the QAcademy logo image and "QAcademy";
// the brand is Quademia and the product has no logo of its own
// (AGENTS.md UI convention #5), so the header is the two names.

'use client';

import { STUDENT_NAV } from '@/lib/nav/student';
import { MobileDrawer } from '@/components/shell/mobile/mobile-drawer';
import { SidebarNav, type SidebarCourse, type SidebarUser } from '@/components/nav/shared/sidebar-nav';

export function StudentSidebar({
  user,
  courses,
  badges,
}: {
  user: SidebarUser;
  courses: SidebarCourse[];
  badges: Record<string, number>;
}) {
  return (
    <MobileDrawer
      header={
        <>
          <h2>Quademia</h2>
          <p>MyNMCLicensure</p>
        </>
      }
      renderNav={(close) => (
        <SidebarNav items={STUDENT_NAV} user={user} courses={courses} badges={badges} onNavigate={close} />
      )}
    />
  );
}
