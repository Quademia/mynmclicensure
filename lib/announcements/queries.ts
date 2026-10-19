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
import { getAllProducts, getCourses, getPrograms } from '@/lib/catalogue/queries';
import { getAllQuizzes } from '@/lib/quizzes/queries';
import { readAll } from '@/lib/supabase/read-all';
import { ANNOUNCEMENT_ROW_COLUMNS, type Announcement, type AnnouncementKind, type AnnouncementRow, type EngageMap, type ReachMap, type StudentAnnouncement } from './types';

type ServiceClient = ReturnType<typeof import('@/lib/supabase/server').createServiceRoleClient>;

// ── admin ──────────────────────────────────────────────────────────────
// The list (08.17): every notice without its words, which only the
// editor page reads.
export async function getAllAnnouncements(db: ServiceClient): Promise<AnnouncementRow[]> {
  const { data, error } = await readAll<AnnouncementRow>((from, to) =>
    db.from('announcements').select(ANNOUNCEMENT_ROW_COLUMNS).order('created_at', { ascending: false }).order('announcement_id').range(from, to),
  );
  if (error) {
    console.error('getAllAnnouncements:', error);
    return [];
  }
  return data;
}

// What the editor page's pickers offer (08.18): the programmes, the courses,
// the packages (the active ones offered), the cohorts, the kinds, and the
// mock exams a Button may open (A4).
export async function getEditorChoices(supabase: ServerSupabaseClient, service: ServiceClient) {
  const [programs, courses, products, cohorts, kinds, mockRows] = await Promise.all([
    getPrograms(supabase),
    getCourses(supabase),
    getAllProducts(supabase),
    getCohorts(supabase),
    getKinds(service),
    getAllQuizzes(service, 'mock'),
  ]);
  const mocks = mockRows.map((m) => ({ quiz_id: m.quiz_id, title: m.title, course_id: m.course_id, status: m.status }));
  return { programs, courses, products: products.filter((p) => p.status === 'active'), cohorts, kinds, mocks };
}
export type EditorChoices = Awaited<ReturnType<typeof getEditorChoices>>;

// The names behind a notice's Named students, for its chips (08.18).
export async function getStudentNames(service: ServiceClient, ids: string[]): Promise<{ user_id: string; name: string }[]> {
  if (!ids.length) return [];
  const { data, error } = await service.from('users').select('user_id, forename, surname, name, email').in('user_id', ids.slice(0, 500));
  if (error) {
    console.error('getStudentNames:', error);
    return ids.map((id) => ({ user_id: id, name: id }));
  }
  type U = { user_id: string; forename: string | null; surname: string | null; name: string | null; email: string | null };
  const byId = new Map((data as U[]).map((u) => [u.user_id, [u.forename, u.surname].filter(Boolean).join(' ').trim() || u.name || u.email || u.user_id]));
  return ids.map((id) => ({ user_id: id, name: byId.get(id) ?? id }));
}

// One notice, words and all, for its editor page (08.18); null when there is none.
export async function getAnnouncement(db: ServiceClient, id: string): Promise<Announcement | null> {
  const { data, error } = await db.from('announcements').select('*').eq('announcement_id', id).maybeSingle();
  if (error) {
    console.error('getAnnouncement:', error);
    return null;
  }
  return (data as Announcement | null) ?? null;
}

// The admin's kinds (08.13), in their order — a short list, read whole.
export async function getKinds(db: ServiceClient): Promise<AnnouncementKind[]> {
  const { data, error } = await db.from('announcement_kinds').select('name, icon, position, active').order('position').order('name');
  if (error) {
    console.error('getKinds:', error);
    return [];
  }
  return (data ?? []) as AnnouncementKind[];
}

export async function getEngagementCounts(db: ServiceClient): Promise<EngageMap> {
  type Row = { announcement_id: string; seen: number | string; tapped: number | string; dismissed: number | string; confirmed: number | string };
  const { data, error } = await readAll<Row>((from, to) => db.rpc('announcement_marks_counts').range(from, to));
  if (error) {
    console.error('getEngagementCounts:', error);
    return {};
  }
  const map: EngageMap = {};
  for (const row of data) {
    map[row.announcement_id] = { seen: Number(row.seen), tapped: Number(row.tapped), dismissed: Number(row.dismissed), confirmed: Number(row.confirmed) };
  }
  return map;
}

// Each notice's reach today (08.11): the active students its scopes match,
// counted in the database, one row a notice.
export async function getReachCounts(db: ServiceClient): Promise<ReachMap> {
  type Row = { announcement_id: string; reaches: number | string };
  const { data, error } = await readAll<Row>((from, to) => db.rpc('announcement_reach_counts').range(from, to));
  if (error) {
    console.error('getReachCounts:', error);
    return {};
  }
  return Object.fromEntries(data.map((r) => [r.announcement_id, Number(r.reaches)]));
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
