// components/nav/shared/sidebar-nav.tsx
//
// The menu itself — legacy mynmclicensure-student-sidebar.js and
// -admin-sidebar.js sections A, C and D, rendered from a NavItem[]:
//   - the active link (exact path, as legacy: href === path);
//   - a group's heading, a label above its rows (the student menu's
//     groups, 00 The menu, Sam 2026-10-04: A);
//   - the Messages badge (99+ cap), shown only when the count is > 0.
// There are no dropdowns: every row is a link and every row is visible
// (My courses was the last dropdown, made a plain row 2026-10-12).
// Rendered inside the drawer (components/shell/mobile/mobile-drawer.tsx),
// once, for every width. The My Account toggle legacy ended the student
// menu with (avatar, name, My Profile, Upgrade / Extend) is the top bar's
// avatar menu under A3 (10-design-system.md DS5).

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from '@/lib/nav/types';
import { NavIcon } from '@/components/shell/icons';
import { LinkPending } from '@/components/shell/link-pending';

/** The row's icon (DS6). */
function RowIcon({ item }: { item: NavItem }) {
  return item.icon ? <NavIcon name={item.icon} /> : null;
}

function Badge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  return <span className="sidebar-msg-badge">{count > 99 ? '99+' : String(count)}</span>;
}

export function SidebarNav({
  items,
  badges = {},
  onNavigate,
}: {
  items: NavItem[];
  badges?: Record<string, number>;
  /** Called when a tap leaves the page as it is — the current page's own
   *  link, or an outside one — so the drawer closes itself on a phone. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  function isActive(href?: string): boolean {
    if (!href) return false;
    // 03 Q10 (Sam, 2026-09-30): a sitting's report belongs to Learning History
    if (href === '/student/learning-history' && pathname.startsWith('/student/report/')) return true;
    // 04.8 (Sam, 2026-10-12): a course's page belongs to My courses
    if (href === '/student/courses' && pathname.startsWith('/student/course/')) return true;
    return pathname === href;
  }

  // Sam, 2026-09-28 (b): a tap that changes the page leaves the phone
  // drawer open, the row's spinner turning, until the address changes —
  // the shell closes the drawer then (shell-state.tsx), which is when
  // the loading placeholder takes the page. Closing on the tap itself
  // showed the old page with no sign of the tap on a slow connection.
  function closeIfStaying(href?: string) {
    return () => {
      if (!href || href === pathname) onNavigate?.();
    };
  }

  function renderLink(item: NavItem) {
    const badge = item.badge ? <Badge count={badges[item.badge] ?? 0} /> : null;
    if (item.external) {
      return (
        <a key={item.key} href={item.href} target="_blank" rel="noopener" onClick={onNavigate}>
          <RowIcon item={item} />
          {item.label}
        </a>
      );
    }
    return (
      <Link
        key={item.key}
        href={item.href ?? '#'}
        className={isActive(item.href) ? 'active' : undefined}
        onClick={closeIfStaying(item.href)}
      >
        <RowIcon item={item} />
        {item.label} {badge}
        <LinkPending />
      </Link>
    );
  }

  return (
    <nav className="sidebar-nav">
      {items
        .filter((i) => !i.hidden)
        .map((item) =>
          // A group's heading (00 The menu: A) — a label, not a row.
          item.heading ? (
            <div key={item.key} className="sidebar-heading">
              {item.label}
            </div>
          ) : (
            <div key={item.key} className="sidebar-item">
              {renderLink(item)}
            </div>
          ),
        )}
    </nav>
  );
}
