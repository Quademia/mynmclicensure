// lib/announcements/queries.ts
//
// The announcement reads. The admin page's: every notice newest first and
// the marks counted per notice in the database (announcement_marks_counts),
// both with the service role, which the caller passes behind requireAdmin()
// — the browser holds nothing on either table since A1 (2026-10-18); and
// the distinct cohorts from `users`. The student's: one call to
// announcements_for_me(), which checks every scope in the database and
// returns only this student's notices, in order (pinned, priority,
// newest), with their own marks — one read for a page, the course page's
// with its course.
//
// Each fails open, as legacy did: an error is logged and an empty result
// returned.
//
// D52 (AGENTS.md rule 10): the admin page's reads take every notice, so
// each goes through readAll(); a student's own notices are exempt.

import type { ServerSupabaseClient } from '@/lib/access';
import { readAll } from '@/lib/supabase/read-all';
import type { Announcement, EngageMap, StudentAnnouncement } from './types';

type ServiceClient = ReturnType<typeof import('@/lib/supabase/server').createServiceRoleClient>;

// ── admin ──────────────────────────────────────────────────────────────
export async function getAllAnnouncements(db: ServiceClient): Promise<Announcement[]> {
  const { data, error } = await readAll<Announcement>((from, to) =>
    db.from('announcements').select('*').order('created_at', { ascending: false }).order('announcement_id').range(from, to),
  );
  if (error) {
    console.error('getAllAnnouncements:', error);
    return [];
  }
  return data;
}

export async function getEngagementCounts(db: ServiceClient): Promise<EngageMap> {
  type Row = { announcement_id: string; seen: number | string; tapped: number | string; dismissed: number | string };
  const { data, error } = await readAll<Row>((from, to) => db.rpc('announcement_marks_counts').range(from, to));
  if (error) {
    console.error('getEngagementCounts:', error);
    return {};
  }
  const map: EngageMap = {};
  for (const row of data) {
    map[row.announcement_id] = { seen: Number(row.seen), tapped: Number(row.tapped), dismissed: Number(row.dismissed) };
  }
  return map;
}

// legacy: `select cohort from users where cohort is not null`, deduped and sorted
export async function getCohorts(db: ServerSupabaseClient): Promise<string[]> {
  const { data, error } = await readAll<{ cohort: string | null }>((from, to) =>
    db.from('users').select('cohort').not('cohort', 'is', null).order('user_id').range(from, to),
  );
  if (error) {
    console.error('getCohorts:', error);
    return [];
  }
  return [...new Set(data.map((u) => u.cohort).filter((c): c is string => Boolean(c)))].sort();
}

// ── student ────────────────────────────────────────────────────────────
// The signed-in student's notices with their marks; with a course, only
// that course's news (the course page). A POST, so a mark written earlier
// in the same render is seen (AGENTS.md: an .rpc() is a POST).
export async function getAnnouncementsForStudent(db: ServerSupabaseClient, courseId?: string): Promise<StudentAnnouncement[]> {
  const { data, error } = await db.rpc('announcements_for_me', courseId ? { p_course_id: courseId } : {});
  if (error) {
    console.error('getAnnouncementsForStudent:', error);
    return [];
  }
  return (data ?? []) as StudentAnnouncement[];
}
