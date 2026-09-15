// lib/nav/admin.ts
//
// The admin sidebar, transcribed from legacy
// js/mynmclicensure-admin-sidebar.js in its order. Flat, no dropdowns.

import type { NavItem } from './types';

const A = '/admin';

export const ADMIN_NAV: NavItem[] = [
  { key: 'dashboard', label: '🏠 Dashboard', href: `${A}/dashboard` },
  { key: 'users', label: '👥 Users', href: `${A}/users` },
  { key: 'subscriptions', label: '💳 Subscriptions', href: `${A}/subscriptions` },
  { key: 'payments', label: '💰 Payments', href: `${A}/payments` },
  { key: 'products', label: '📦 Products', href: `${A}/products` },
  { key: 'courses', label: '📚 Courses', href: `${A}/courses` },
  { key: 'announcements', label: '📢 Announcements', href: `${A}/announcements` },
  { key: 'fixed-quizzes', label: '📝 Fixed Quizzes', href: `${A}/fixed-quizzes` },
  { key: 'mock-exams', label: '🎯 Mock Exams', href: `${A}/mock-exams` },
  { key: 'attempts', label: '📊 Attempts', href: `${A}/attempts` },
  { key: 'question-bank', label: '🗂️ Question Bank', href: `${A}/question-bank` },
  { key: 'messages', label: '💬 Messages', href: `${A}/messages`, badge: 'messages' },
  { key: 'config', label: '⚙️ Config', href: `${A}/config` },
];
