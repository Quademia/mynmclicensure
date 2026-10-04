// lib/nav/student.ts
//
// The student sidebar — and the phone's drawer, the same menu — in the
// groups Sam confirmed (00 The menu, 2026-10-04: A): Dashboard, then
// Practise, Progress, Study offline and Help and news, each under a small
// heading with every row visible; Account is the top bar's avatar menu
// (My Profile, Upgrade / Extend; components/shell/top-bar.tsx). The
// names match the phone's tabs; "Practice papers" is Q21's name (the
// page's own title and address follow with Q21). The Telegram row is
// here, hidden until item 17 builds its page.
//
// Each row names its icon (components/shell/icons.tsx).

import type { NavItem, PhoneTab } from './types';

const S = '/student';

// The bottom bar on a phone (Sam, 2026-10-04: A — 00 The menu, 09). The
// drawer below stays the full menu; these are shortcuts into its pages.
// Progress gains Leaderboard with 05 G1b, so its row appears then.
export const STUDENT_PHONE_TABS: PhoneTab[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home', pages: [{ label: 'Dashboard', href: `${S}/dashboard` }] },
  {
    key: 'practise',
    label: 'Practise',
    icon: 'clipboard',
    pages: [
      { label: 'Papers', href: `${S}/fixed-quizzes` },
      { label: 'Mocks', href: `${S}/mock-exams` },
      { label: 'Builder', href: `${S}/quiz-builder` },
    ],
    also: [`${S}/course`],
  },
  {
    key: 'progress',
    label: 'Progress',
    icon: 'chart',
    pages: [{ label: 'History', href: `${S}/learning-history` }],
    also: [`${S}/report`],
  },
  {
    key: 'offline',
    label: 'Offline',
    icon: 'download',
    pages: [
      { label: 'My packs', href: `${S}/offline-packs`, exact: true },
      { label: 'Build', href: `${S}/offline-packs/build` },
    ],
  },
];

export const STUDENT_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home', href: `${S}/dashboard` },

  { key: 'h-practise', label: 'Practise', heading: true },
  { key: 'courses', label: 'My courses', icon: 'book', dynamic: 'courses', children: [] },
  { key: 'fixed-quizzes', label: 'Practice papers', icon: 'clipboard', href: `${S}/fixed-quizzes` },
  { key: 'mock-exams', label: 'Mock exams', icon: 'target', href: `${S}/mock-exams` },
  { key: 'quiz-builder', label: 'Quiz builder', icon: 'wrench', href: `${S}/quiz-builder` },

  { key: 'h-progress', label: 'Progress', heading: true },
  { key: 'learning-history', label: 'Learning history', icon: 'chart', href: `${S}/learning-history` },

  { key: 'h-offline', label: 'Study offline', heading: true },
  { key: 'offline-packs', label: 'My packs', icon: 'download', href: `${S}/offline-packs` },
  { key: 'offline-build', label: 'Build a pack', icon: 'package', href: `${S}/offline-packs/build` },

  { key: 'h-help', label: 'Help and news', heading: true },
  { key: 'announcements', label: 'Announcements', icon: 'megaphone', href: `${S}/announcements` },
  { key: 'messages', label: 'Messages', icon: 'message', href: `${S}/messages`, badge: 'messages' },
  { key: 'portal-guide', label: 'Portal guide', icon: 'help', href: `${S}/portal-guide` },
  { key: 'procedures', label: 'NMC procedures', icon: 'stethoscope', href: `${S}/procedures` },
  { key: 'telegram', label: 'Telegram', icon: 'send', href: `${S}/telegram`, hidden: true },
  {
    // One row, two buttons (Sam, 2026-10-04: 2) — a shorter menu.
    key: 'channels',
    label: 'Our channels',
    inline: [
      {
        key: 'whatsapp-channel',
        label: 'WhatsApp',
        icon: 'phone',
        href: 'https://www.whatsapp.com/channel/0029Vb6ActpBA1ewCfBmAF3O',
        external: true,
      },
      { key: 'telegram-channel', label: 'Telegram', icon: 'send', href: 'https://t.me/QAcademynurseshub', external: true },
    ],
  },
];
