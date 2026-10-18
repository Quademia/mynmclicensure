// lib/announcements/scoping.ts
//
// The pure rules of announcements left in TypeScript: legacy
// computeDisplayStatus from admin/announcements.html, and the student's
// marks read as the one state today's pages show. Who sees which notice
// is decided in the database since A1 (2026-10-18:
// announcements_for_user() checks every scope, 08.1's held courses
// included). No database, no React.

import type { DisplayStatus, NoticeState, StudentAnnouncement, StudentNoticeMap } from './types';

// legacy computeDisplayStatus (admin page)
export function computeDisplayStatus(a: { status: string; start_at: string | null; end_at: string | null }, now: Date = new Date()): DisplayStatus {
  if (a.status === 'archived') return 'archived';
  if (a.status === 'draft') return 'draft';
  if (a.status === 'active') {
    if (a.start_at && new Date(a.start_at) > now) return 'scheduled';
    if (a.end_at && new Date(a.end_at) < now) return 'expired';
    return 'active';
  }
  return a.status as DisplayStatus;
}

// The marks as one state until the redesign (08.7): dismissed, else
// tapped, else seen; a notice with none is new.
export function noticeStateOf(a: Pick<StudentAnnouncement, 'seen_at' | 'tapped_at' | 'dismissed_at'>): NoticeState | null {
  if (a.dismissed_at) return 'dismissed';
  if (a.tapped_at) return 'clicked';
  if (a.seen_at) return 'read';
  return null;
}

export function noticeStates(list: StudentAnnouncement[]): StudentNoticeMap {
  const map: StudentNoticeMap = {};
  for (const a of list) {
    const state = noticeStateOf(a);
    if (state) map[a.announcement_id] = state;
  }
  return map;
}
