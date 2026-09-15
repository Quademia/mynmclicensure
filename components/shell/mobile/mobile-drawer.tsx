// components/shell/mobile/mobile-drawer.tsx
//
// The sidebar element and its phone behaviour, in one place — legacy
// section "Mobile hamburger" of both sidebar scripts. ONE <aside>
// for every width: fixed on the left above 768px; below it, hidden
// off-canvas, slid in by the hamburger (☰ ↔ ✕) over a dimmed backdrop,
// closed by the backdrop, by a link tap, or by Escape. This is the
// shared drawer AGENTS.md UI convention #3 names; no surface builds
// its own.

'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export function MobileDrawer({
  header,
  renderNav,
}: {
  /** The .sidebar-logo block. */
  header: React.ReactNode;
  /** The menu, given a close callback for link taps. */
  renderNav: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change (React's adjust-state-during-render pattern).
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
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function closeOnPhone() {
    if (window.innerWidth <= 768) setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="hamburger-btn"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? '✕' : '☰'}
      </button>
      <div className={`sidebar-overlay${open ? ' open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-logo">{header}</div>
        {renderNav(closeOnPhone)}
      </aside>
    </>
  );
}
