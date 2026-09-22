// lib/nav/admin.ts
//
// The admin sidebar, transcribed from legacy
// js/mynmclicensure-admin-sidebar.js in its order. Flat, no dropdowns.
// The emoji legacy wrote into each label left with DS6; each row names
// its icon instead (components/shell/icons.tsx).

import type { NavItem } from './types';

const A = '/admin';

export const ADMIN_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home', href: `${A}/dashboard` },
  { key: 'users', label: 'Users', icon: 'users', href: `${A}/users` },
  { key: 'subscriptions', label: 'Subscriptions', icon: 'card', href: `${A}/subscriptions` },
  { key: 'payments', label: 'Payments', icon: 'banknote', href: `${A}/payments` },
  { key: 'products', label: 'Products', icon: 'package', href: `${A}/products` },
  { key: 'courses', label: 'Courses', icon: 'book', href: `${A}/courses` },
  { key: 'announcements', label: 'Announcements', icon: 'megaphone', href: `${A}/announcements` },
  { key: 'fixed-quizzes', label: 'Fixed Quizzes', icon: 'clipboard', href: `${A}/fixed-quizzes` },
  { key: 'mock-exams', label: 'Mock Exams', icon: 'target', href: `${A}/mock-exams` },
  { key: 'attempts', label: 'Attempts', icon: 'chart', href: `${A}/attempts` },
  { key: 'question-bank', label: 'Question Bank', icon: 'folder', href: `${A}/question-bank` },
  { key: 'messages', label: 'Messages', icon: 'message', href: `${A}/messages`, badge: 'messages' },
  { key: 'config', label: 'Config', icon: 'settings', href: `${A}/config` },
];
