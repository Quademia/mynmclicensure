// components/shell/mobile/mobile-drawer.tsx
//
// The sidebar element and its backdrop — ONE <aside> for every width.
// Under A3 (10-design-system.md DS5) it sits beneath the 56px top bar:
// above 768px it is pinned open and pushes the content across, or is
// closed and off-canvas when the student closed it; below 768px it is
// the phone drawer, slid in over a dimmed backdrop and closed by the
// backdrop, a link tap, Escape or a route change. The open-or-closed
// state and the hamburger live in the shell frame (../shell-state.tsx)
// and the top bar; the classes shell.css keys on sit on the wrapper.
// This is the shared drawer AGENTS.md UI convention #3 names; no
// surface builds its own.

'use client';

import { useShell } from '@/components/shell/shell-state';

export function MobileDrawer({ children }: { children: React.ReactNode }) {
  const { closePhone } = useShell();
  return (
    <>
      <div className="sidebar-overlay" onClick={closePhone} />
      <aside className="sidebar">{children}</aside>
    </>
  );
}
