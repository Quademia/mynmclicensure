// lib/announcements/scoping.ts
//
// The one pure rule of announcements left in TypeScript: legacy
// computeDisplayStatus from admin/announcements.html. Who sees which
// notice is decided in the database since A1 (2026-10-18:
// announcements_for_user() checks every scope, 08.1's held courses
// included); what a student's marks mean on screen is in display.ts
// (isNew). No database, no React.

import type { DisplayStatus } from './types';

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
