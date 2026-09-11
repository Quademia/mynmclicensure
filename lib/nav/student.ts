// lib/nav/student.ts
//
// The student sidebar, transcribed from legacy
// js/mynmclicensure-student-sidebar.js in its order. Two legacy rows
// are not here: "Teacher Assess" (MyTeacher's, left with the April
// split) and nothing else — the Telegram row IS here, hidden until
// slice 17 builds its page (rebuild.md §9 #10).

import type { NavItem } from './types';

const S = '/student';

export const STUDENT_NAV: NavItem[] = [
  { key: 'dashboard', label: '🏠 Dashboard', href: `${S}/dashboard` },
  { key: 'courses', label: '📚 My Courses', dynamic: 'courses', children: [] },
  { key: 'fixed-quizzes', label: '📝 Fixed Quizzes', href: `${S}/fixed-quizzes` },
  { key: 'mock-exams', label: '🎯 Mock Exams', href: `${S}/mock-exams` },
  { key: 'quiz-builder', label: '🔧 Quiz Builder', href: `${S}/quiz-builder` },
  { key: 'learning-history', label: '📊 Learning History', href: `${S}/learning-history` },
  { key: 'announcements', label: '📢 Announcements', href: `${S}/announcements` },
  {
    key: 'offline',
    label: '📥 Offline Packs',
    children: [
      { key: 'offline-packs', label: 'My Packs', href: `${S}/offline-packs` },
      { key: 'offline-build', label: 'Build New Pack', href: `${S}/offline-packs/build` },
    ],
  },
  { key: 'procedures', label: '🩺 NMC Procedures', href: `${S}/procedures` },
  { key: 'portal-guide', label: '❓ Portal Guide', href: `${S}/portal-guide` },
  { key: 'messages', label: '💬 Messages', href: `${S}/messages`, badge: 'messages' },
  { key: 'telegram', label: '✈️ Telegram', href: `${S}/telegram`, hidden: true },
  {
    key: 'whatsapp-channel',
    label: '📲 WhatsApp Channel',
    href: 'https://www.whatsapp.com/channel/0029Vb6ActpBA1ewCfBmAF3O',
    external: true,
  },
  {
    key: 'telegram-channel',
    label: '📣 Telegram Channel',
    href: 'https://t.me/QAcademynurseshub',
    external: true,
  },
  {
    key: 'account',
    label: 'My Account',
    account: true,
    dividerAbove: true,
    children: [
      { key: 'profile', label: '👤 My Profile', href: `${S}/profile` },
      { key: 'upgrade', label: '💳 Upgrade / Extend', href: `${S}/upgrade` },
    ],
  },
];
