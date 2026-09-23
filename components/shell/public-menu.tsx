// components/shell/public-menu.tsx
//
// The public top bar's phone menu (10-design-system.md DS21, Sam
// 2026-09-23): the hamburger, and the panel it opens with the bar's
// links and Sign in. The only part of the public bar that runs in the
// browser; the bar itself stays a Server Component.
//
// ⚠ NOT THE SHARED DRAWER, on purpose. The signed-in app's menu is the
// shared drawer in components/shell/mobile/; the public bar has this one
// (AGENTS.md UI convention #3, as amended 2026-09-23). They LOOK alike —
// the same navy and link inks, from tokens — and they CLOSE alike: the
// backdrop, a link tap, Escape, a route change. Keep those four in step
// with components/shell/shell-state.tsx.
//
// ⚠ IT OPENS FROM THE RIGHT, the app's from the left (Sam, 2026-09-23):
// the hamburger sits at the right beside Sign in, where a thumb rests on
// a phone held in one hand, and the panel comes out under it. Sam will
// move the app's drawer to the right later (BUILD_LIST, DS21) — until
// then the difference is temporary, not a design.
//
// Portalled to <body> (AGENTS.md: every overlay is), and only after the
// first paint in the browser, so the server's HTML carries the bar and
// no panel.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { PUBLIC_LINKS } from '@/lib/nav/public';
import { IconClose, IconMenu } from './icons';

const PHONE_MAX = 768;

function subscribeNothing(): () => void {
  return () => {};
}

export function PublicMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // true in the browser, false on the server: the portal target exists.
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);

  // Closes on a route change — React's adjust-state-during-render, as
  // shell-state.tsx does it.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    // The hamburger is hidden above the breakpoint, so a panel left open
    // by a widening window would have no way to close.
    function onResize() {
      if (window.innerWidth > PHONE_MAX) setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const panel = (
    <div className={open ? 'pubmenu is-open' : 'pubmenu'}>
      <div className="pubmenu-backdrop" onClick={() => setOpen(false)} />
      {/* `inert` while closed: off-screen links leave the tab order and
          the accessibility tree together. */}
      <nav id="pubmenu-panel" className="pubmenu-panel" aria-label="Menu" inert={!open}>
        {PUBLIC_LINKS.map((l) => (
          // A tap on the page already open changes no route, so it closes here too.
          <Link key={l.href} href={l.href} className="pubmenu-link" onClick={() => setOpen(false)}>
            {l.label}
          </Link>
        ))}
        <Link href="/login" className="btn btn-accent pubmenu-signin" onClick={() => setOpen(false)}>
          Sign in
        </Link>
      </nav>
    </div>
  );

  return (
    <>
      <button
        type="button"
        className="pubbar-burger"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="pubmenu-panel"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <IconClose /> : <IconMenu />}
      </button>
      {mounted ? createPortal(panel, document.body) : null}
    </>
  );
}
