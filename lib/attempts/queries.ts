// lib/attempts/queries.ts
//
// The attempt reads, transcribed one for one from legacy
// js/mynmclicensure-api.js and the runners: getAttemptById,
// getStudentAttempts, getBuilderCourseItems. Each takes the caller's
// per-request client and, as legacy, fails open: an error is logged and
// an empty result returned.
//
// RLS is the floor, not the filter (AGENTS.md): the student reads name
// their user; the runner's ownership check is in lib/attempts/runner-load.

import type { ServerSupabaseClient } from '@/lib/access';
import type { createServiceRoleClient } from '@/lib/supabase/server';
import { HISTORY_PAGE_SIZE, RECENT_ATTEMPTS_LIMIT, type Attempt, type AttemptItem, type AttemptListRow, type BuilderItem, type HistoryFilters, type HistoryPage, type QuizAttemptStats } from './types';

type ServiceDb = ReturnType<typeof createServiceRoleClient>;

// The attempt's own questions (03 Q4): attempt_items in position order,
// each row as the bank served it when the attempt was created. Read
// with the SERVICE ROLE after the caller's ownership check — the secret
// half is revoked from the browser role at the grant, and both callers
// (the runner's loader, the finish path) need it. Empty on an error.
export async function readAttemptItems(db: ServiceDb, attempt: Pick<Attempt, 'attempt_id' | 'course_id'>): Promise<AttemptItem[]> {
  const { data, error } = await db
    .from('attempt_items')
    .select('*')
    .eq('attempt_id', attempt.attempt_id)
    .order('position', { ascending: true });
  if (error) {
    console.error('readAttemptItems:', error);
    return [];
  }
  return ((data ?? []) as Omit<AttemptItem, 'course_id' | 'batch_id'>[]).map((row) => ({
    ...row,
    course_id: attempt.course_id,
    batch_id: null,
  }));
}

// The admin details step's attempt-stats box (legacy openEditQuiz's
// inline read on both admin quiz pages). Since Q2 (D45 e) the read is
// keyed by the quiz's table as well as its id — a fixed quiz and a mock
// exam are separate tables with independent ids — and first sittings
// (source = the kind), retakes (source = 'retake') and abandons are
// counted apart. The mean score is over the completed rows, rounded.
export async function getQuizAttemptStats(db: ServerSupabaseClient, kind: 'fixed' | 'mock', quizId: string): Promise<QuizAttemptStats> {
  const empty: QuizAttemptStats = { total: 0, firstSittings: 0, retakes: 0, abandoned: 0, completed: 0, avgScore: 0 };
  const { data, error } = await db
    .from('attempts')
    .select('attempt_id, source, status, score_pct')
    .eq('quiz_id', quizId)
    .in('source', [kind, 'retake']);
  if (error) {
    console.error('getQuizAttemptStats:', error);
    return empty;
  }
  const rows = (data ?? []) as { source: string; status: string; score_pct: number | null }[];
  const completedRows = rows.filter((a) => a.status === 'completed');
  const completed = completedRows.length;
  const avgScore = completed > 0 ? Math.round(completedRows.reduce((s, a) => s + (a.score_pct || 0), 0) / completed) : 0;
  return {
    total: rows.length,
    firstSittings: rows.filter((a) => a.source === kind).length,
    retakes: rows.filter((a) => a.source === 'retake').length,
    abandoned: rows.filter((a) => a.status === 'abandoned').length,
    completed,
    avgScore,
  };
}

export async function getAttemptById(db: ServerSupabaseClient, attemptId: string): Promise<Attempt | null> {
  const { data, error } = await db.from('attempts').select('*').eq('attempt_id', attemptId).maybeSingle();
  if (error) {
    console.error('getAttemptById:', error);
    return null;
  }
  return (data as Attempt | null) ?? null;
}

/** A student's attempts, newest first; one course when asked (the list pages, 5b). */
export async function getStudentAttempts(
  db: ServerSupabaseClient,
  userId: string,
  courseId: string | null = null,
): Promise<Attempt[]> {
  let query = db.from('attempts').select('*').eq('user_id', userId).order('ts_iso', { ascending: false });
  if (courseId) query = query.eq('course_id', courseId);
  const { data, error } = await query;
  if (error) {
    console.error('getStudentAttempts:', error);
    return [];
  }
  return (data ?? []) as Attempt[];
}

// The builder's whole-course read: the light columns the wizard filters
// and counts on, by item id. (The SELECT policy through user_has_course()
// returns nothing for a course the student cannot access.)
export async function getBuilderCourseItems(db: ServerSupabaseClient, courseId: string): Promise<BuilderItem[]> {
  const { data, error } = await db
    .from('question_bank')
    .select('item_id, subject, maintopic, subtopic, difficulty, question_type, stem, rationale')
    .eq('course_id', courseId)
    .order('item_id');
  if (error) {
    console.error('getBuilderCourseItems:', error);
    return [];
  }
  return (data ?? []) as BuilderItem[];
}

// getStudentAttemptsPaginated: the learning history page's read (7a) —
// the card columns only, newest first, one page of `pageSize`, with the
// exact total for the "Showing N of M" line and the Load more button.
// Course, status, mode and the label search are the database's; the
// source filter and the sort order stay in the browser, as legacy.
export async function getStudentAttemptsPaginated(
  db: ServerSupabaseClient,
  userId: string,
  filters: HistoryFilters,
  page = 0,
  pageSize = HISTORY_PAGE_SIZE,
): Promise<HistoryPage> {
  let query = db
    .from('attempts')
    .select(
      'attempt_id, user_id, quiz_id, course_id, mode, source, status, n, score_raw, score_total, score_pct, time_taken_s, display_label, ts_iso',
      { count: 'exact' },
    )
    .eq('user_id', userId)
    .order('ts_iso', { ascending: false });

  if (filters.courseId) query = query.eq('course_id', filters.courseId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.mode) query = query.eq('mode', filters.mode);
  if (filters.search) query = query.ilike('display_label', `%${filters.search}%`);

  query = query.range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('getStudentAttemptsPaginated:', error);
    return { attempts: [], total: 0 };
  }
  return { attempts: (data ?? []) as AttemptListRow[], total: count ?? 0 };
}

// ── the dashboard's Recent Quiz Attempts (legacy loadRecentAttempts) ────
// The five newest attempts, whatever their status. Legacy read `*` with
// `.limit(5)`; the columns are narrowed to the list row's, which is every
// column the table renders.
export async function getRecentAttempts(
  db: ServerSupabaseClient,
  userId: string,
  limit = RECENT_ATTEMPTS_LIMIT,
): Promise<AttemptListRow[]> {
  const { data, error } = await db
    .from('attempts')
    .select('attempt_id, user_id, quiz_id, course_id, mode, source, status, n, score_raw, score_total, score_pct, time_taken_s, display_label, ts_iso')
    .eq('user_id', userId)
    .order('ts_iso', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('getRecentAttempts:', error);
    return [];
  }
  return (data ?? []) as AttemptListRow[];
}
