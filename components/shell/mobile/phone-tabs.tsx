// components/shell/mobile/phone-tabs.tsx
//
// The student's navigation on a phone (Sam, 2026-10-04: A; 00 The menu,
// 09): a bar of four tabs fixed to the bottom that never change, and on
// a group's pages a row of tabs at the top for its other pages (Practise:
// Papers · Mocks · Builder; Offline: My packs · Build). A row of one is
// not drawn. Each tab opens the group's first page; which sub-tab was
// last used is not remembered. The drawer stays the full menu, so
// nothing is only here. MyNclex's bottom bar is the pattern, copied, not
// shared (AGENTS.md rule 2).
//
// Both render on every width and hide above 768px in
// styles/phone-tabs.css, so the server's paint is already right on a
// phone and a computer keeps its sidebar unchanged. A tapped tab
// breathes while its page is on its way (LinkPending — a tap is never
// silent, UI convention #6).

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/shell/icons';
import { LinkPending } from '@/components/shell/link-pending';
import type { PhoneTab, PhoneTabPage } from '@/lib/nav/types';
import '@/styles/phone-tabs.css';

function onPage(path: string, page: PhoneTabPage): boolean {
  return page.exact ? path === page.href : path === page.href || path.startsWith(`${page.href}/`);
}

function onAlso(path: string, href: string): boolean {
  return path === href || path.startsWith(`${href}/`);
}

/** The tab that owns this address, or none (Messages, Profile, …). */
function tabFor(tabs: PhoneTab[], path: string): PhoneTab | undefined {
  return tabs.find((t) => t.pages.some((p) => onPage(path, p)) || (t.also ?? []).some((h) => onAlso(path, h)));
}

export function PhoneTabBar({ tabs }: { tabs: PhoneTab[] }) {
  const path = usePathname() ?? '';
  const current = tabFor(tabs, path);
  return (
    <nav className="phone-tabbar" aria-label="Main">
      {tabs.map((tab) => {
        const active = tab === current;
        return (
          <Link
            key={tab.key}
            href={tab.pages[0].href}
            className={active ? 'phone-tab is-active' : 'phone-tab'}
            aria-current={active ? 'page' : undefined}
          >
            <span className="phone-tab-ico">
              <Icon name={tab.icon} size={22} />
            </span>
            <span className="phone-tab-label">{tab.label}</span>
            <LinkPending />
          </Link>
        );
      })}
    </nav>
  );
}

export function PhoneSubTabs({ tabs }: { tabs: PhoneTab[] }) {
  const path = usePathname() ?? '';
  const group = tabs.find((t) => t.pages.length > 1 && t.pages.some((p) => onPage(path, p)));
  if (!group) return null;
  return (
    <nav className="phone-subtabs" aria-label={group.label}>
      {group.pages.map((page) => {
        const active = onPage(path, page);
        return (
          <Link
            key={page.href}
            href={page.href}
            className={active ? 'phone-subtab is-active' : 'phone-subtab'}
            aria-current={active ? 'page' : undefined}
          >
            {page.label}
            <LinkPending />
          </Link>
        );
      })}
    </nav>
  );
}
