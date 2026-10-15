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
//
// 04.12 (2026-10-15): the browser's roles no longer read the three score
// columns of `attempts`, so a student's own sittings are read through the
// database's student_attempts() with the service role, after the caller's
// gate: it returns the row with the score empty while the paper's results
// are held, the date, and `held` — the one place the hold is decided. The
// admin's reads (getAttemptById, getQuizAttemptStats) take the service
// role and see every score.

import type { ServerSupabaseClient } from '@/lib/access';
import { readAll, slices } from '@/lib/supabase/read-all';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { HISTORY_PAGE_SIZE, RECENT_ATTEMPTS_LIMIT, type Attempt, type AttemptItem, type AttemptListRow, type AttemptWithProgress, type BuilderItem, type HistoryFilters, type HistoryPage, type QuizAttemptStats } from './types';

type ServiceDb = ReturnType<typeof createServiceRoleClient>;

/** A list row's columns, from student_attempts() (04.12: with the date and held). */
const LIST_COLUMNS =
  'attempt_id, user_id, quiz_id, course_id, mode, source, status, n, score_raw, score_total, score_pct, time_taken_s, display_label, ts_iso, results_at, held, review, review_closes_at, review_closed';

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
// The service role (04.12): the admin sees every score, held or not.
export async function getQuizAttemptStats(db: ServiceDb, kind: 'fixed' | 'mock', quizId: string): Promise<QuizAttemptStats> {
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

// Any sitting, whoever's, the score as stored: the admin's reads and the
// admin's preview, with the service role behind requireAdmin (04.12).
export async function getAttemptById(db: ServiceDb, attemptId: string): Promise<Attempt | null> {
  const { data, error } = await db.from('attempts').select('*').eq('attempt_id', attemptId).maybeSingle();
  if (error) {
    console.error('getAttemptById:', error);
    return null;
  }
  return (data as Attempt | null) ?? null;
}

// A student's own sitting (04.12): through student_attempts(), so the
// score is empty while held and a sitting that is not theirs is not found.
// The caller has passed the student gate; `userId` is the gate's. A POST on
// purpose: never memoised, so a read after a write (the runner's re-reads)
// sees the write.
export async function getOwnAttempt(userId: string, attemptId: string): Promise<Attempt | null> {
  if (!attemptId) return null;
  const { data, error } = await createServiceRoleClient().rpc('student_attempts', {
    p_user_id: userId,
    p_attempt_ids: [attemptId],
  });
  if (error) {
    console.error('getOwnAttempt:', error);
    return null;
  }
  return ((data as Attempt[] | null) ?? [])[0] ?? null;
}

/**
 * Where a sitting came from: its own source, or — for a retake, whose
 * source is 'retake' — the source of the sitting it retakes, followed back
 * through origin_attempt_id with `read` (a student's getOwnAttempt, an
 * admin's getAttemptById). Null when the chain breaks. The runner's Exit
 * (03 Q8) and the retake's check on its quiz both read it.
 */
export async function originSource(
  attempt: Attempt,
  read: (attemptId: string) => Promise<Attempt | null>,
): Promise<'builder' | 'fixed' | 'mock' | null> {
  let current: Attempt | null = attempt;
  for (let hops = 0; current && hops < 20; hops++) {
    if (current.source === 'builder' || current.source === 'fixed' || current.source === 'mock') return current.source;
    if (current.source !== 'retake' || !current.origin_attempt_id) return null;
    current = await read(current.origin_attempt_id);
  }
  return null;
}

/** A student's attempts, newest first; one course when asked (the list
 * pages, 5b). Since 03 Q5 each in-progress attempt carries the count of
 * its answered rows for the card's "N of M answered" (legacy counted the
 * answers_json records); a second read, the student's own rows. Through
 * student_attempts() (04.12), so a held sitting's score is empty and it
 * carries `held` and `results_at`. */
export async function getStudentAttempts(userId: string, courseId: string | null = null): Promise<AttemptWithProgress[]> {
  const db = createServiceRoleClient();
  // A GET (the function is stable): retried on a dropped connection, as a
  // table read is. No null in a GET's arguments — it would arrive as 'null'.
  const { data: attempts, error } = await readAll<Attempt>((from, to) =>
    db
      .rpc('student_attempts', courseId ? { p_user_id: userId, p_course_id: courseId } : { p_user_id: userId }, { get: true })
      .order('ts_iso', { ascending: false })
      .order('attempt_id')
      .range(from, to),
  );
  if (error) {
    console.error('getStudentAttempts:', error);
    return [];
  }

  // The ids are the student's own, from the read above.
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

// The Quiz Builder's pool (04.4): the light columns it counts and
// filters on, a whole course (readAll, rule 10), published rows only —
// and with `freeOnly` the free set's rows alone (03), named in the query
// although a student without the course reads no other rows anyway (RLS
// is the floor, not the filter). Null on an error, so the page can say so.
export async function getQuizBuilderRows(
  db: ServerSupabaseClient,
  courseId: string,
  freeOnly: boolean,
): Promise<{ item_id: string; maintopic: string | null; difficulty: string | null; question_type: string }[] | null> {
  type Row = { item_id: string; maintopic: string | null; difficulty: string | null; question_type: string };
  const { data, error } = await readAll<Row>((from, to) => {
    let q = db.from('question_bank').select('item_id, maintopic, difficulty, question_type').eq('course_id', courseId).eq('is_published', true);
    if (freeOnly) q = q.eq('is_free_sample', true);
    return q.order('item_id').range(from, to);
  });
  if (error) {
    console.error('getQuizBuilderRows:', courseId, error);
    return null;
  }
  return data;
}

// "New to me" and "Got wrong before" (04.4; Sam, 2026-10-11): every
// question this student has answered in a course, and whether the
// latest answer was wrong — no table of its own, read from their own
// sittings. One student's rows, but a busy student passes 1,000 answers
// in a course, so readAll() on the row's own key (rule 10). An answer
// not yet graded (an unsubmitted Untimed sitting) counts as seen, never
// as wrong. Null on an error.
export async function getAnswerHistory(db: ServerSupabaseClient, userId: string, courseId: string): Promise<Map<string, boolean> | null> {
  type Row = { item_id: string; is_correct: boolean | null; answered_utc: string };
  const { data, error } = await readAll<Row>((from, to) =>
    db
      .from('attempt_items')
      .select('item_id, is_correct, answered_utc, attempts!inner ( user_id, course_id )')
      .eq('attempts.user_id', userId)
      .eq('attempts.course_id', courseId)
      .not('answered_utc', 'is', null)
      .order('attempt_item_id')
      .range(from, to),
  );
  if (error) {
    console.error('getAnswerHistory:', userId, courseId, error);
    return null;
  }
  // item → [when, wrong] of its latest answer
  const latest = new Map<string, [number, boolean]>();
  for (const r of data) {
    const at = Date.parse(r.answered_utc);
    const before = latest.get(r.item_id);
    if (!before || at >= before[0]) latest.set(r.item_id, [at, r.is_correct === false]);
  }
  return new Map([...latest].map(([id, [, wrong]]) => [id, wrong]));
}

// getStudentAttemptsPaginated: the learning history page's read (7a) —
// the card columns only, newest first, one page of `pageSize`, with the
// exact total for the "Showing N of M" line and the Load more button.
// Course, status, mode and the label search are the database's; the
// source filter and the sort order stay in the browser, as legacy.
// Through student_attempts() (04.12): a held sitting's score is empty.
export async function getStudentAttemptsPaginated(
  userId: string,
  filters: HistoryFilters,
  page = 0,
  pageSize = HISTORY_PAGE_SIZE,
): Promise<HistoryPage> {
  let query = createServiceRoleClient()
    .rpc('student_attempts', { p_user_id: userId }, { get: true, count: 'exact' })
    .select(LIST_COLUMNS)
    .order('ts_iso', { ascending: false })
    .order('attempt_id');

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
// column the table renders. Through student_attempts() (04.12).
export async function getRecentAttempts(userId: string, limit = RECENT_ATTEMPTS_LIMIT): Promise<AttemptListRow[]> {
  const { data, error } = await createServiceRoleClient()
    .rpc('student_attempts', { p_user_id: userId }, { get: true })
    .select(LIST_COLUMNS)
    .order('ts_iso', { ascending: false })
    .order('attempt_id')
    .limit(limit);

  if (error) {
    console.error('getRecentAttempts:', error);
    return [];
  }
  return (data ?? []) as AttemptListRow[];
}
