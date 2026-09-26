// components/shell/top-bar.tsx
//
// The A3 top bar (10-design-system.md DS5, Sam 2026-09-22): a 56px
// white bar on every authenticated page, at every width. Left to
// right: the hamburger, the wordmark (DS21, 2026-09-23: the one both
// bars draw, `wordmark.tsx` — the painted Q, QUADEMIA small on top and
// "MyNMCLicensure" bold beneath since 2026-09-26), then at the right the
// envelope carrying the unread messages count, the bell as a link to
// Announcements (plain until announcements have an unread state, doc 05
// A2), and the avatar, which opens the account menu: the person's name
// and email, the audience's links (My Profile, Upgrade / Extend for a
// student; none for an admin), and Sign out.
//
// Below 768px the envelope and the bell are hidden (shell.css; Sam,
// 2026-09-26): the bar keeps the hamburger, the wordmark and the avatar,
// the drawer's Messages row carries the count, and a teal dot on the
// hamburger says there is something unread behind the menu. The dot is
// in the markup at every width and shown by the phone rules only.
//
// The name and Sign out used to sit in PageHeader's right half on 23
// pages; the My Account block used to end the student sidebar. Both
// live here now and nowhere else. Sign out stays a form POST to
// /logout, so no link prefetch can ever sign someone out.

'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useShell } from './shell-state';
import { IconBell, IconClose, IconEnvelope, IconMenu } from './icons';
import { NameCircle } from './name-circle';
import { Wordmark } from './wordmark';

export type TopBarLink = { label: string; href: string; accent?: boolean };

export type TopBarProps = {
  /** The product line beside the brand: "MyNMCLicensure" on both sides. */
  product: string;
  messagesHref: string;
  announcementsHref: string;
  /** Unread messages — the same count the sidebar's Messages row shows. */
  unread: number;
  user: { name: string; email: string; avatarUrl: string | null };
  /** The menu rows between the name and Sign out. */
  menuLinks: TopBarLink[];
};

export function TopBar({ product, messagesHref, announcementsHref, unread, user, menuLinks }: TopBarProps) {
  const { toggle } = useShell();
  const [menuOpen, setMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // The menu closes on route change (adjust-state-during-render).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar-btn topbar-toggle"
        aria-label={unread > 0 ? `Menu, ${unread} unread ${unread === 1 ? 'message' : 'messages'}` : 'Menu'}
        onClick={toggle}
      >
        <IconMenu className="topbar-ico-menu" />
        <IconClose className="topbar-ico-close" />
        {unread > 0 ? <span className="topbar-dot" /> : null}
      </button>

      <div className="topbar-brand">
        <Wordmark product={product} />
      </div>

      <div className="topbar-spacer" />

      <Link href={messagesHref} className="topbar-btn topbar-messages" aria-label={unread > 0 ? `Messages, ${unread} unread` : 'Messages'}>
        <IconEnvelope />
        {unread > 0 ? <span className="topbar-count">{unread > 99 ? '99+' : String(unread)}</span> : null}
      </Link>

      <Link href={announcementsHref} className="topbar-btn topbar-announcements" aria-label="Announcements">
        <IconBell />
      </Link>

      <div className="topbar-account" ref={accountRef}>
        <button
          type="button"
          className={`topbar-btn topbar-avatar-btn${menuOpen ? ' pressed' : ''}`}
          aria-label="Account menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <NameCircle name={user.name} avatarUrl={user.avatarUrl} size="md" className="topbar-avatar" />
        </button>

        {menuOpen ? (
          <div className="topbar-menu" role="menu">
            <div className="topbar-menu-who">
              <b>{user.name}</b>
              <span>{user.email}</span>
            </div>
            {menuLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                role="menuitem"
                className={l.accent ? 'accent' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            {menuLinks.length > 0 ? <hr /> : null}
            <form method="post" action="/logout">
              <button type="submit" role="menuitem" className="topbar-menu-out">
                Sign out
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </header>
  );
}
