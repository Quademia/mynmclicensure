// components/nav/shared/sidebar-nav.tsx
//
// The menu itself — legacy mynmclicensure-student-sidebar.js and
// -admin-sidebar.js sections A, C and D, rendered from a NavItem[]:
//   - the active link (exact path, as legacy: href === path);
//   - dropdowns (My Courses, Offline Packs, My Account) that toggle on
//     click and open by themselves when a child is the current page;
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

export type SidebarCourse = { course_id: string; title: string };

/** The row's icon (DS6), or nothing for a child row. */
function Icon({ item }: { item: NavItem }) {
  return item.icon ? <NavIcon name={item.icon} /> : null;
}

function Badge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  return <span className="sidebar-msg-badge">{count > 99 ? '99+' : String(count)}</span>;
}

export function SidebarNav({
  items,
  courses = [],
  badges = {},
  onNavigate,
}: {
  items: NavItem[];
  courses?: SidebarCourse[];
  badges?: Record<string, number>;
  /** Called when a link is tapped — the drawer closes itself on a phone. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  function isActive(href?: string): boolean {
    return !!href && pathname === href;
  }

  function childActive(item: NavItem): boolean {
    if (item.dynamic === 'courses') return pathname.startsWith('/student/course/');
    if (item.key === 'offline') return pathname.startsWith('/student/offline-packs');
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
          <Icon item={item} />
          {item.label}
        </a>
      );
    }
    return (
      <Link
        key={item.key}
        href={item.href ?? '#'}
        className={[className, isActive(item.href) ? 'active' : ''].filter(Boolean).join(' ') || undefined}
        onClick={onNavigate}
      >
        <Icon item={item} />
        {item.label} {badge}
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
                onClick={onNavigate}
              >
                {c.title}
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
          <Icon item={item} />
          <span className="sidebar-dropdown-label">{item.label}</span>
          <span className="sidebar-dropdown-arrow">▾</span>
        </div>
        <div className="sidebar-dropdown-menu">{rows}</div>
      </div>
    );
  }

  return (
    <nav className="sidebar-nav">
      {items
        .filter((i) => !i.hidden)
        .map((item) => (
          <div key={item.key} className="sidebar-item">
            {item.children ? renderDropdown(item) : renderLink(item)}
          </div>
        ))}
    </nav>
  );
}
