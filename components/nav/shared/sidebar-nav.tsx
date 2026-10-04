// components/nav/shared/sidebar-nav.tsx
//
// The menu itself — legacy mynmclicensure-student-sidebar.js and
// -admin-sidebar.js sections A, C and D, rendered from a NavItem[]:
//   - the active link (exact path, as legacy: href === path);
//   - a group's heading, a label above its rows (the student menu's
//     groups, 00 The menu, Sam 2026-10-04: A);
//   - dropdowns (My courses; the admin's) that toggle on click and open
//     by themselves when a child is the current page;
//   - the My Courses rows from the student's course access ("No courses
//     found" when empty);
//   - the Messages badge (99+ cap), shown only when the count is > 0.
// Rendered inside the drawer (components/shell/mobile/mobile-drawer.tsx),
// once, for every width. The My Account toggle legacy ended the student
// menu with (avatar, name, My Profile, Upgrade / Extend) is the top bar's
// avatar menu under A3 (10-design-system.md DS5).

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { NavItem } from '@/lib/nav/types';
import { NavIcon } from '@/components/shell/icons';
import { LinkPending } from '@/components/shell/link-pending';
import { MENU_FOLD_COOKIE, NAV_COOKIE_MAX_AGE } from '@/components/shell/nav-cookie';

export type SidebarCourse = { course_id: string; title: string };

/** The row's icon (DS6), or nothing for a child row. */
function RowIcon({ item }: { item: NavItem }) {
  return item.icon ? <NavIcon name={item.icon} /> : null;
}

/** The folded groups to this device's cookie (outside the component: the
 *  React compiler's lint refuses a write to `document` inside one). */
function saveFolded(keys: string[]) {
  document.cookie = `${MENU_FOLD_COOKIE}=${keys.join('.')}; path=/; max-age=${NAV_COOKIE_MAX_AGE}; samesite=lax`;
}

function Badge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  return <span className="sidebar-msg-badge">{count > 99 ? '99+' : String(count)}</span>;
}

export function SidebarNav({
  items,
  courses = [],
  badges = {},
  initialFolded = [],
  onNavigate,
}: {
  items: NavItem[];
  courses?: SidebarCourse[];
  badges?: Record<string, number>;
  /** The groups folded away on this device — the cookie, read on the server. */
  initialFolded?: string[];
  /** Called when a tap leaves the page as it is — the current page's own
   *  link, or an outside one — so the drawer closes itself on a phone. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  // A group's heading folds it away (Sam, 2026-10-04: b — every group
  // open until the student folds one; kept in a cookie on this device).
  // A folded group holding the current page shows open, so the lit row
  // is never hidden — until the student folds it here (closedHere).
  const [folded, setFolded] = useState<string[]>(initialFolded);
  const [closedHere, setClosedHere] = useState<string[]>([]);

  function isActive(href?: string): boolean {
    if (!href) return false;
    // 03 Q10 (Sam, 2026-09-30): a sitting's report belongs to Learning History
    if (href === '/student/learning-history' && pathname.startsWith('/student/report/')) return true;
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

  function childActive(item: NavItem): boolean {
    if (item.dynamic === 'courses') return pathname.startsWith('/student/course/');
    return (item.children ?? []).some((c) => isActive(c.href));
  }

  function isOpen(item: NavItem): boolean {
    const t = toggled[item.key];
    if (t !== undefined) return t;
    return childActive(item);
  }

  function toggle(key: string, current: boolean) {
    setToggled((s) => ({ ...s, [key]: !current }));
  }

  function rowActive(item: NavItem): boolean {
    return item.children ? childActive(item) : isActive(item.href);
  }

  function groupOpen(key: string, rows: NavItem[]): boolean {
    return !folded.includes(key) || (rows.some(rowActive) && !closedHere.includes(key));
  }

  function toggleGroup(key: string, open: boolean) {
    const next = open ? [...folded.filter((k) => k !== key), key] : folded.filter((k) => k !== key);
    setFolded(next);
    setClosedHere((s) => (open ? [...s.filter((k) => k !== key), key] : s.filter((k) => k !== key)));
    saveFolded(next);
  }

  function renderInline(item: NavItem) {
    return (
      <div key={item.key} className="sidebar-inline" role="group" aria-label={item.label}>
        {(item.inline ?? []).map((link) => (
          <a
            key={link.key}
            href={link.href}
            target="_blank"
            rel="noopener"
            className="sidebar-inline-link"
            onClick={onNavigate}
          >
            <RowIcon item={link} />
            {link.label}
          </a>
        ))}
      </div>
    );
  }

  function renderRow(item: NavItem) {
    return (
      <div key={item.key} className="sidebar-item">
        {item.inline ? renderInline(item) : item.children ? renderDropdown(item) : renderLink(item)}
      </div>
    );
  }

  function renderLink(item: NavItem, className?: string) {
    const badge = item.badge ? <Badge count={badges[item.badge] ?? 0} /> : null;
    if (item.external) {
      return (
        <a
          key={item.key}
          href={item.href}
          target="_blank"
          rel="noopener"
          className={className}
          onClick={onNavigate}
        >
          <RowIcon item={item} />
          {item.label}
        </a>
      );
    }
    return (
      <Link
        key={item.key}
        href={item.href ?? '#'}
        className={[className, isActive(item.href) ? 'active' : ''].filter(Boolean).join(' ') || undefined}
        onClick={closeIfStaying(item.href)}
      >
        <RowIcon item={item} />
        {item.label} {badge}
        <LinkPending />
      </Link>
    );
  }

  function renderDropdown(item: NavItem) {
    const open = isOpen(item);
    const active = childActive(item);

    let rows: React.ReactNode;
    if (item.dynamic === 'courses') {
      rows =
        courses.length === 0 ? (
          <span className="sidebar-dropdown-loading">No courses found</span>
        ) : (
          courses.map((c) => {
            const href = `/student/course/${c.course_id}`;
            return (
              <Link
                key={c.course_id}
                href={href}
                className={pathname === href ? 'active' : undefined}
                onClick={closeIfStaying(href)}
              >
                {c.title}
                <LinkPending />
              </Link>
            );
          })
        );
    } else {
      rows = (item.children ?? []).map((c) => renderLink(c));
    }

    return (
      <div key={item.key} className={`sidebar-dropdown${open ? ' open' : ''}`}>
        <div
          className={`sidebar-dropdown-toggle${active ? ' active' : ''}`}
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onClick={() => toggle(item.key, open)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggle(item.key, open);
            }
          }}
        >
          <RowIcon item={item} />
          <span className="sidebar-dropdown-label">{item.label}</span>
          <span className="sidebar-dropdown-arrow">▾</span>
        </div>
        <div className="sidebar-dropdown-menu">{rows}</div>
      </div>
    );
  }

  // The rows before the first heading stand alone (Dashboard); each
  // heading gathers the rows after it, up to the next (00 The menu: A).
  const groups: { heading?: NavItem; rows: NavItem[] }[] = [{ rows: [] }];
  for (const item of items.filter((i) => !i.hidden)) {
    if (item.heading) groups.push({ heading: item, rows: [] });
    else groups[groups.length - 1].rows.push(item);
  }

  return (
    <nav className="sidebar-nav">
      {groups.map((g) => {
        if (!g.heading) return g.rows.map(renderRow);
        const key = g.heading.key;
        const open = groupOpen(key, g.rows);
        return (
          <div key={key} className={`sidebar-group${open ? '' : ' folded'}`}>
            <button
              type="button"
              className="sidebar-heading"
              aria-expanded={open}
              onClick={() => toggleGroup(key, open)}
            >
              {g.heading.label}
              <span className="sidebar-heading-arrow" aria-hidden="true">
                ▾
              </span>
            </button>
            <div className="sidebar-group-rows">{g.rows.map(renderRow)}</div>
          </div>
        );
      })}
    </nav>
  );
}
