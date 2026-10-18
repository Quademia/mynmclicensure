// components/nav/student/student-sidebar.tsx
//
// The student sidebar: the student menu inside the shared drawer. Under
// A3 (10-design-system.md DS5) the brand block moved to the top bar's
// wordmark and the My Account block into the avatar menu, so each is in
// one place, not both; the sidebar keeps the audience as a small label
// above Home — "Student", the word alone without "Panel" (Sam,
// 2026-09-22) — and ends at Telegram Channel. The Messages row's count is
// the shell's live one (08.5a); the Announcements row's, the new notices
// (08.9).

'use client';

import { STUDENT_NAV } from '@/lib/nav/student';
import { useShell } from '@/components/shell/shell-state';
import { useUnread } from '@/components/shell/unread-live';
import { useNewsCount } from '@/components/shell/news-count';
import { SidebarNav } from '@/components/nav/shared/sidebar-nav';

export function StudentSidebar() {
  const { closeOnPhone } = useShell();
  const messages = useUnread();
  const announcements = useNewsCount().count;
  return (
    <>
      <div className="sidebar-audience">Student</div>
      <SidebarNav items={STUDENT_NAV} badges={{ messages, announcements }} onNavigate={closeOnPhone} />
    </>
  );
}
