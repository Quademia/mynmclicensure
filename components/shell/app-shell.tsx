// components/shell/app-shell.tsx
//
// The frame every authenticated page sits in, as A3 (10-design-system.md
// DS5, Sam 2026-09-22): the top bar across the whole width, the navy
// sidebar beneath it on the left, <main class="main-content"> on the
// right. Server Component. Each audience layout passes its own menu and
// its own top-bar data (AGENTS.md folder convention #6); the shell knows
// nothing about audiences.
//
// The one server-side read is the nmc_nav cookie: whether the student
// closed the desktop sidebar. Reading it here means the first paint is
// already open or closed, so the page does not jump on load.
//
// No footer: no legacy page has one.

import { cookies } from 'next/headers';
import { ShellFrame } from './shell-state';
import { TopBar, type TopBarProps } from './top-bar';
import { MobileDrawer } from './mobile/mobile-drawer';
import { NAV_COOKIE } from './nav-cookie';

export async function AppShell({
  sidebar,
  topBar,
  children,
}: {
  /** The menu — a <SidebarNav> inside the audience's wrapper. */
  sidebar: React.ReactNode;
  topBar: TopBarProps;
  children: React.ReactNode;
}) {
  const jar = await cookies();
  const initialDesktopOpen = jar.get(NAV_COOKIE)?.value !== 'closed';

  return (
    <ShellFrame initialDesktopOpen={initialDesktopOpen}>
      <TopBar {...topBar} />
      <MobileDrawer>{sidebar}</MobileDrawer>
      <main className="main-content">{children}</main>
    </ShellFrame>
  );
}
