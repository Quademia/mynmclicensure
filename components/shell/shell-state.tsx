// components/shell/shell-state.tsx
//
// The one piece of state the A3 shell has (10-design-system.md DS5):
// whether the sidebar is open. Two flags, because the two widths mean
// different things by it. On desktop the sidebar pushes the content
// across and the choice is remembered in the nmc_nav cookie, so the
// server renders the right state first time. On a phone the drawer
// slides over the page, starts closed on every page, and closes on a
// link tap, the backdrop, Escape or a route change. The top bar's
// hamburger toggles whichever applies at the current width; the width
// is read in the handler, never during render (AGENTS.md, the React
// compiler's purity rule).
//
// <ShellFrame> is the provider AND the .dashboard-wrapper element, so
// the open-or-closed classes sit on the one ancestor shell.css keys on:
// `nav-closed` (desktop) and `nav-phone-open` (below 768px).

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { NAV_COOKIE, NAV_COOKIE_MAX_AGE } from './nav-cookie';

const PHONE_MAX = 768;

type ShellState = {
  desktopOpen: boolean;
  phoneOpen: boolean;
  /** The hamburger: the phone drawer below 768px, the desktop sidebar above. */
  toggle: () => void;
  /** The backdrop and Escape. */
  closePhone: () => void;
  /** A link tap in the menu — closes the drawer on a phone, nothing on desktop. */
  closeOnPhone: () => void;
};

const ShellContext = createContext<ShellState | null>(null);

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell() outside <ShellFrame>');
  return ctx;
}

export function ShellFrame({
  initialDesktopOpen,
  children,
}: {
  initialDesktopOpen: boolean;
  children: React.ReactNode;
}) {
  const [desktopOpen, setDesktopOpen] = useState(initialDesktopOpen);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const pathname = usePathname();

  // The phone drawer closes on route change (React's adjust-state-
  // during-render pattern). The desktop state is the student's choice
  // and survives navigation — that is the point of the cookie.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setPhoneOpen(false);
  }

  useEffect(() => {
    if (!phoneOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPhoneOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phoneOpen]);

  function toggle() {
    if (window.innerWidth <= PHONE_MAX) {
      setPhoneOpen((o) => !o);
      return;
    }
    const next = !desktopOpen;
    setDesktopOpen(next);
    document.cookie = `${NAV_COOKIE}=${next ? 'open' : 'closed'}; path=/; max-age=${NAV_COOKIE_MAX_AGE}; samesite=lax`;
  }

  function closePhone() {
    setPhoneOpen(false);
  }

  function closeOnPhone() {
    if (window.innerWidth <= PHONE_MAX) setPhoneOpen(false);
  }

  const cls = ['dashboard-wrapper', desktopOpen ? '' : 'nav-closed', phoneOpen ? 'nav-phone-open' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <ShellContext.Provider value={{ desktopOpen, phoneOpen, toggle, closePhone, closeOnPhone }}>
      <div className={cls}>{children}</div>
    </ShellContext.Provider>
  );
}
