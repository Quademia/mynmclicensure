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
//
// D52 (2026-09-26; AGENTS.md rule 10): the reads that can pass the API's
// 1,000-row cap — a quiz's sittings across students, a student's whole
// attempt list, a whole course for the builders — go through readAll().

import type { ServerSupabaseClient } from '@/lib/access';
import { readAll, slices } from '@/lib/supabase/read-all';
import type { createServiceRoleClient } from '@/lib/supabase/server';
import { HISTORY_PAGE_SIZE, RECENT_ATTEMPTS_LIMIT, type Attempt, type AttemptItem, type AttemptListRow, type AttemptWithProgress, type BuilderItem, type HistoryFilters, type HistoryPage, type QuizAttemptStats } from './types';

type ServiceDb = ReturnType<typeof createServiceRoleClient>;

// The attempt's own questions (03 Q4): attempt_items in position order,
// each row as the bank served it when the attempt was created, the
// secret half included. Read with the SERVICE ROLE after the caller's
// ownership check — the secret half is revoked from the browser role at
// the grant. The loader seals the rows before they reach the runner
// (lib/attempts/seal.ts). Empty on an error.
export async function readAttemptItems(db: ServiceDb, attemptId: string): Promise<AttemptItem[]> {
  const { data, error } = await db
    .from('attempt_items')
    .select('*')
    .eq('attempt_id', attemptId)
    .order('position', { ascending: true });
  if (error) {
    console.error('readAttemptItems:', error);
    return [];
  }
  return (data ?? []) as AttemptItem[];
}

// The admin details step's attempt-stats box (legacy openEditQuiz's
// inline read on both admin quiz pages). Since Q2 (D45 e) the read is
// keyed by the quiz's table as well as its id — a fixed quiz and a mock
// exam are separate tables with independent ids — and first sittings
// (source = the kind), retakes (source = 'retake') and abandons are
// counted apart. The mean score is over the completed rows, rounded.
export async function getQuizAttemptStats(db: ServerSupabaseClient, kind: 'fixed' | 'mock', quizId: string): Promise<QuizAttemptStats> {
  const empty: QuizAttemptStats = { total: 0, firstSittings: 0, retakes: 0, abandoned: 0, completed: 0, avgScore: 0 };
  const { data: rows, error } = await readAll<{ source: string; status: string; score_pct: number | null }>((from, to) =>
    db
      .from('attempts')
      .select('attempt_id, source, status, score_pct')
      .eq('quiz_id', quizId)
      .in('source', [kind, 'retake'])
      .order('attempt_id')
      .range(from, to),
  );
  if (error) {
    console.error('getQuizAttemptStats:', error);
    return empty;
  }
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

/**
 * Where a sitting came from: its own source, or — for a retake, whose
 * source is 'retake' — the source of the sitting it retakes, followed back
 * through origin_attempt_id. Null when the chain breaks. The runner's Exit
 * (03 Q8) and the retake's check on its quiz both read it.
 */
export async function originSource(db: ServerSupabaseClient, attempt: Attempt): Promise<'builder' | 'fixed' | 'mock' | null> {
  let current: Attempt | null = attempt;
  for (let hops = 0; current && hops < 20; hops++) {
    if (current.source === 'builder' || current.source === 'fixed' || current.source === 'mock') return current.source;
    if (current.source !== 'retake' || !current.origin_attempt_id) return null;
    current = await getAttemptById(db, current.origin_attempt_id);
  }
  return null;
}

/** A student's attempts, newest first; one course when asked (the list
 * pages, 5b). Since 03 Q5 each in-progress attempt carries the count of
 * its answered rows for the card's "N of M answered" (legacy counted the
 * answers_json records); a second read, the student's own rows. */
export async function getStudentAttempts(
  db: ServerSupabaseClient,
  userId: string,
  courseId: string | null = null,
): Promise<AttemptWithProgress[]> {
  const build = () => {
    let query = db.from('attempts').select('*').eq('user_id', userId);
    if (courseId) query = query.eq('course_id', courseId);
    return query.order('ts_iso', { ascending: false }).order('attempt_id');
  };
  const { data: attempts, error } = await readAll<Attempt>((from, to) => build().range(from, to));
  if (error) {
    console.error('getStudentAttempts:', error);
    return [];
  }

  const open = attempts.filter((a) => a.status === 'in_progress').map((a) => a.attempt_id);
  const counts: Record<string, number> = {};
  for (const ids of slices(open)) {
    const { data: rows, error: rowsError } = await readAll<{ attempt_id: string }>((from, to) =>
      db
        .from('attempt_items')
        .select('attempt_id')
        .in('attempt_id', ids)
        .not('chosen', 'is', null)
        .order('attempt_item_id')
        .range(from, to),
    );
    if (rowsError) console.error('getStudentAttempts rows:', rowsError);
    for (const r of rows ?? []) counts[r.attempt_id] = (counts[r.attempt_id] ?? 0) + 1;
  }
  return attempts.map((a) => ({ ...a, answered_count: counts[a.attempt_id] ?? 0 }));
}

// The builder's whole-course read: the light columns the wizard filters
// and counts on, by item id. (The SELECT policy through user_has_course()
// returns nothing for a course the student cannot access.)
//
// The stem and the rationale left this list in 08 B2 (2026-09-21; D9):
// the wizard matched the concept keyword against them in the browser,
// which meant shipping a whole course's question text to filter on it.
// The keyword is now searchConceptItemIds() on the server and the
// browser keeps the criteria columns alone. The rationale is not
// readable by this client any more in any case.
//
// Published rows only (08 B4): the policy already hides a draft from
// this client; the filter names the scope in the query as well.
//
// 08 B7: a whole course, so readAll() — RM_PED_OBS_HRN's 1,080 came back
// as 1,000, and since B6 the chips are built from these same rows.
export async function getBuilderCourseItems(db: ServerSupabaseClient, courseId: string): Promise<BuilderItem[]> {
  const { data, error } = await readAll<BuilderItem>((from, to) =>
    db
      .from('question_bank')
      .select('item_id, subject, maintopic, subtopic, difficulty, question_type')
      .eq('course_id', courseId)
      .eq('is_published', true)
      .order('item_id')
      .range(from, to),
  );
  if (error) {
    console.error('getBuilderCourseItems:', error);
    return [];
  }
  return data;
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
