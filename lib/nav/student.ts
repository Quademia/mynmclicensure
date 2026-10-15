// lib/nav/student.ts
//
// The student sidebar — and the phone's drawer, the same menu — in the
// groups Sam confirmed (00 The menu, 2026-10-04: A; Home added 2026-10-12):
// Home (Dashboard, My courses), then Practise, Progress, Study offline and Help and news, each under a small
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
  {
    key: 'home',
    label: 'Home',
    icon: 'home',
    pages: [
      { label: 'Dashboard', href: `${S}/dashboard` },
      { label: 'Courses', href: `${S}/courses` },
    ],
    // a course's page has no row of its own, only its way back (Sam, 2026-10-12)
    also: [`${S}/course`],
  },
  {
    key: 'practise',
    label: 'Practise',
    icon: 'clipboard',
    pages: [
      { label: 'Papers', href: `${S}/practice-papers` },
      { label: 'Mocks', href: `${S}/mock-exams` },
      { label: 'Builder', href: `${S}/quiz-builder` },
    ],
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
    // one page since 07.8 (Sam, 2026-10-15): Build a pack is on My packs, per course;
    // the builder and a pack's page sit under it
    pages: [{ label: 'My packs', href: `${S}/offline-packs` }],
  },
];

export const STUDENT_NAV: NavItem[] = [
  { key: 'h-home', label: 'Home', heading: true },
  { key: 'dashboard', label: 'Dashboard', icon: 'home', href: `${S}/dashboard` },
  { key: 'courses', label: 'My courses', icon: 'book', href: `${S}/courses` },

  { key: 'h-practise', label: 'Practise', heading: true },
  { key: 'fixed-quizzes', label: 'Practice papers', icon: 'clipboard', href: `${S}/practice-papers` },
  { key: 'mock-exams', label: 'Mock exams', icon: 'target', href: `${S}/mock-exams` },
  { key: 'quiz-builder', label: 'Quiz builder', icon: 'wrench', href: `${S}/quiz-builder` },

  { key: 'h-progress', label: 'Progress', heading: true },
  { key: 'learning-history', label: 'Learning history', icon: 'chart', href: `${S}/learning-history` },

  { key: 'h-offline', label: 'Study offline', heading: true },
  { key: 'offline-packs', label: 'My packs', icon: 'download', href: `${S}/offline-packs` },

  { key: 'h-help', label: 'Help and news', heading: true },
  { key: 'announcements', label: 'Announcements', icon: 'megaphone', href: `${S}/announcements` },
  { key: 'messages', label: 'Messages', icon: 'message', href: `${S}/messages`, badge: 'messages' },
  { key: 'portal-guide', label: 'Portal guide', icon: 'help', href: `${S}/portal-guide` },
  { key: 'procedures', label: 'NMC procedures', icon: 'stethoscope', href: `${S}/procedures` },
  { key: 'telegram', label: 'Telegram', icon: 'send', href: `${S}/telegram`, hidden: true },
  {
    key: 'whatsapp-channel',
    label: 'WhatsApp channel',
    icon: 'phone',
    href: 'https://www.whatsapp.com/channel/0029Vb6ActpBA1ewCfBmAF3O',
    external: true,
  },
  {
    key: 'telegram-channel',
    label: 'Telegram channel',
    icon: 'send',
    href: 'https://t.me/QAcademynurseshub',
    external: true,
  },
];
