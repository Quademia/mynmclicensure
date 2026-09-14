// lib/announcements/scoping.ts
//
// The pure rules of announcements: legacy filterAnnouncementsForStudent
// (js/mynmclicensure-api.js) — every scope is AND, an empty scope is no
// restriction — plus the course scope that legacy saved and never
// applied (rebuild.md §9 #19, fixed here: a course scope matches a
// student whose course access covers any listed course); legacy
// computeDisplayStatus from admin/announcements.html; and the "highest
// state wins" merge the student page used. No database, no React.

import type { Announcement, DisplayStatus, NoticeState, StudentNoticeMap, StudentScope } from './types';

function nonEmpty(arr: string[] | null | undefined): string[] {
  return Array.isArray(arr) ? arr.filter(Boolean) : [];
}

// legacy's seven checks, in its order, then the course check (§9 #19).
export function announcementMatches(a: Announcement, s: StudentScope): boolean {
  // 1. Audience
  if (a.scope_audience === 'STUDENTS' && s.role !== 'STUDENT') return false;

  // 2. Programme
  const programs = nonEmpty(a.scope_programs);
  if (programs.length && !programs.includes(String(s.program_id || ''))) return false;

  // 3. Level — 'L100,L300'
  if (a.scope_level && a.scope_level.trim() !== '') {
    const allowed = a.scope_level.split(',').map((x) => x.trim());
    if (!allowed.includes(String(s.level || ''))) return false;
  }

  // 4. Cohort
  if (a.scope_cohort && a.scope_cohort.trim() !== '') {
    if (String(s.cohort || '') !== a.scope_cohort.trim()) return false;
  }

  // 5. Subscription kind
  if (a.scope_subscription_kind && a.scope_subscription_kind.trim() !== '') {
    if (s.subscriptionKind !== a.scope_subscription_kind.trim()) return false;
  }

  // 6. Specific products — the student's active product
  const products = nonEmpty(a.scope_product_ids);
  if (products.length && !products.includes(s.activeProductId)) return false;

  // 7. Specific users
  const users = nonEmpty(a.scope_user_ids);
  if (users.length && !users.includes(s.user_id)) return false;

  // 8. Courses (§9 #19) — any listed course the student's access covers
  const courses = nonEmpty(a.scope_courses);
  if (courses.length && !courses.some((c) => s.courseIds.includes(c))) return false;

  return true;
}

export function filterAnnouncementsForStudent(list: Announcement[], scope: StudentScope): Announcement[] {
  return list.filter((a) => announcementMatches(a, scope));
}

// legacy computeDisplayStatus (admin page)
export function computeDisplayStatus(a: Pick<Announcement, 'status' | 'start_at' | 'end_at'>, now: Date = new Date()): DisplayStatus {
  if (a.status === 'archived') return 'archived';
  if (a.status === 'draft') return 'draft';
  if (a.status === 'active') {
    if (a.start_at && new Date(a.start_at) > now) return 'scheduled';
    if (a.end_at && new Date(a.end_at) < now) return 'expired';
    return 'active';
  }
  return a.status as DisplayStatus;
}

// legacy: "if a student both read and clicked, keep the highest state" —
// clicked > read > dismissed. One row per item makes this a formality.
const STATE_PRIORITY: Record<NoticeState, number> = { dismissed: 1, read: 2, clicked: 3 };

export function mergeNoticeStates(rows: { item_id: string; state: string }[]): StudentNoticeMap {
  const map: StudentNoticeMap = {};
  for (const row of rows) {
    const state = row.state as NoticeState;
    if (!(state in STATE_PRIORITY)) continue;
    const existing = map[row.item_id];
    if (!existing || STATE_PRIORITY[state] > STATE_PRIORITY[existing]) map[row.item_id] = state;
  }
  return map;
}
