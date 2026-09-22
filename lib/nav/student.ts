// lib/nav/student.ts
//
// The student sidebar, transcribed from legacy
// js/mynmclicensure-student-sidebar.js in its order. Two legacy rows
// are not here: "Teacher Assess" (MyTeacher's, left with the April
// split) and the My Account block that ended the menu — My Profile and
// Upgrade / Extend are the top bar's avatar menu under A3
// (10-design-system.md DS5; components/shell/top-bar.tsx). The Telegram
// row IS here, hidden until slice 17 builds its page (rebuild.md §9 #10).
//
// The emoji legacy wrote into each label ('🏠 Dashboard') left with DS6;
// each row names its icon instead (components/shell/icons.tsx).

import type { NavItem } from './types';

const S = '/student';

export const STUDENT_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home', href: `${S}/dashboard` },
  { key: 'courses', label: 'My Courses', icon: 'book', dynamic: 'courses', children: [] },
  { key: 'fixed-quizzes', label: 'Fixed Quizzes', icon: 'clipboard', href: `${S}/fixed-quizzes` },
  { key: 'mock-exams', label: 'Mock Exams', icon: 'target', href: `${S}/mock-exams` },
  { key: 'quiz-builder', label: 'Quiz Builder', icon: 'wrench', href: `${S}/quiz-builder` },
  { key: 'learning-history', label: 'Learning History', icon: 'chart', href: `${S}/learning-history` },
  { key: 'announcements', label: 'Announcements', icon: 'megaphone', href: `${S}/announcements` },
  {
    key: 'offline',
    label: 'Offline Packs',
    icon: 'download',
    children: [
      { key: 'offline-packs', label: 'My Packs', href: `${S}/offline-packs` },
      { key: 'offline-build', label: 'Build New Pack', href: `${S}/offline-packs/build` },
    ],
  },
  { key: 'procedures', label: 'NMC Procedures', icon: 'stethoscope', href: `${S}/procedures` },
  { key: 'portal-guide', label: 'Portal Guide', icon: 'help', href: `${S}/portal-guide` },
  { key: 'messages', label: 'Messages', icon: 'message', href: `${S}/messages`, badge: 'messages' },
  { key: 'telegram', label: 'Telegram', icon: 'send', href: `${S}/telegram`, hidden: true },
  {
    key: 'whatsapp-channel',
    label: 'WhatsApp Channel',
    icon: 'phone',
    href: 'https://www.whatsapp.com/channel/0029Vb6ActpBA1ewCfBmAF3O',
    external: true,
  },
  {
    key: 'telegram-channel',
    label: 'Telegram Channel',
    icon: 'send',
    href: 'https://t.me/QAcademynurseshub',
    external: true,
  },
];
