// lib/attempts/actions.ts
//
// The attempt writes as Server Actions behind the student gate — legacy
// did these from the browser with direct `db.from('attempts')` calls
// (spawnBuilderAttempt, saveAttemptProgress, finishAttempt in
// js/mynmclicensure-api.js). Each writes as the signed-in student; the
// own-row policies are the floor. Plus the builder's course load, which
// legacy did with two browser reads.
//
// finishAttempt() recomputes the score and every record's correctness
// from the items on the server before saving (rebuild.md §12 slice 6,
// Sam 2026-09-13); the browser's numbers are not written.
//
// The two student list pages' writes (slice 5b) — legacy
// spawnFixedAttempt / spawnMockAttempt (one function here, the kind
// naming the table and the source), retakeAttempt, and the pages' inline
// abandon update — run here too. Start re-reads the quiz and refuses one
// that is not ACTIVE, not in an accessible course or not offering the
// mode; legacy only greyed the button out (invisible to a student, the
// same principle as the server-side score).

'use server';

import { requireStudent } from '@/lib/access';
import { getItemFilterOptions, getItemsByIds } from '@/lib/bank/queries';
import { itemsTableFor } from '@/lib/bank/tables';
import type { ItemFilterOptions } from '@/lib/bank/types';
import { getConfig } from '@/lib/catalogue/queries';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { getQuizAvailability } from '@/lib/quizzes/availability';
import { getQuizById } from '@/lib/quizzes/queries';
import type { QuizKind } from '@/lib/quizzes/types';
import { makeAttemptId } from './ids';
import { getAttemptById, getBuilderCourseItems, getStudentAttemptsPaginated } from './queries';
import { computeScore, recomputeAnswers } from './scoring';
import {
  BUILDER_MAX_QUESTIONS_DEFAULT,
  BUILDER_MINUTES_PER_QUESTION_DEFAULT,
  type ActionResult,
  type AnswerRecord,
  type AttemptMode,
  type BuilderItem,
  type BuilderMeta,
  type FinishResult,
  type HistoryFilters,
  type HistoryPage,
  type SpawnResult,
  type TimedStartResult,
  type Attempt,
} from './types';

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

// ── the builder's course load (legacy handleCourseChange's two reads) ──
export type BuilderCourseLoad =
  | { ok: true; items: BuilderItem[]; options: ItemFilterOptions }
  | { ok: false; error: string };

export async function loadBuilderCourse(courseId: string): Promise<BuilderCourseLoad> {
  const { supabase, profile } = await requireStudent();
  if (!itemsTableFor(courseId)) return fail('Unknown course.');

  const access = await getStudentCourseAccess(supabase, profile.user_id);
  if (!access[courseId]) return fail('You do not have an active subscription for this course.');

  const [options, items] = await Promise.all([
    getItemFilterOptions(supabase, courseId),
    getBuilderCourseItems(supabase, courseId),
  ]);
  return { ok: true, items, options };
}

// ── spawnBuilderAttempt ────────────────────────────────────────────────
// A builder quiz is always fresh — no resume logic. The item ids arrive
// already picked and shuffled by the wizard; the count is capped by the
// config maximum here as well as there.
export async function spawnBuilderAttempt(
  courseId: string,
  itemIds: string[],
  mode: AttemptMode,
  meta: BuilderMeta,
): Promise<SpawnResult> {
  const { supabase, profile } = await requireStudent();
  if (!itemsTableFor(courseId)) return fail('Unknown course.');
  if (mode !== 'instant' && mode !== 'timed') return fail('Unknown mode.');

  const access = await getStudentCourseAccess(supabase, profile.user_id);
  if (!access[courseId]) return fail('You do not have an active subscription for this course.');

  const config = await getConfig(supabase);
  const maxQuestions = Number(config.builder_max_questions) > 0 ? Number(config.builder_max_questions) : BUILDER_MAX_QUESTIONS_DEFAULT;
  const minutesPerQuestion =
    Number(config.builder_minutes_per_question) > 0 ? Number(config.builder_minutes_per_question) : BUILDER_MINUTES_PER_QUESTION_DEFAULT;

  const safeIds = [...new Set(itemIds.map((id) => String(id || '').trim()).filter(Boolean))].slice(0, maxQuestions);
  if (!safeIds.length) return fail('No questions were selected.');

  // The ids must be this course's: a wrong id is dropped, as the
  // runner's getItemsByIds would drop it later.
  const items = await getItemsByIds(supabase, courseId, safeIds);
  const known = new Set(items.map((i) => i.item_id));
  const orderedIds = safeIds.filter((id) => known.has(id));
  if (!orderedIds.length) return fail('No questions were selected.');

  // legacy: 1 minute per question unless the wizard passed an override
  // (it passes ceil(n × builder_minutes_per_question)).
  const override = Number(meta.duration_min_override);
  const durationMin = override > 0 ? override : Math.ceil(orderedIds.length * minutesPerQuestion);

  const attemptId = makeAttemptId();
  const { error } = await supabase.from('attempts').insert({
    attempt_id: attemptId,
    user_id: profile.user_id,
    quiz_id: null,
    course_id: courseId,
    mode,
    source: 'builder',
    item_ids: orderedIds.join(','),
    n: orderedIds.length,
    status: 'in_progress',
    ts_iso: new Date().toISOString(),
    duration_min: durationMin,
    answers_json: JSON.stringify([]),
    display_label: String(meta.display_label || '').trim() || null,
  });
  if (error) return fail(error.message);
  return { ok: true, attemptId };
}

// ── saveAttemptProgress (the instant runner's autosave and exits) ──────
// The student's own row, and only while it is in progress (rebuild.md §9
// #17, fixed 2026-09-14): legacy wrote status = in_progress on every save,
// so an autosave landing a moment after Submit flipped a completed
// attempt back. A late save is refused; the runner is locked by then and
// ignores it.
export async function saveAttemptProgress(attemptId: string, answers: AnswerRecord[]): Promise<ActionResult> {
  const { supabase, profile } = await requireStudent();
  const { data, error } = await supabase
    .from('attempts')
    .update({ answers_json: JSON.stringify(answers), status: 'in_progress' })
    .eq('attempt_id', attemptId)
    .eq('user_id', profile.user_id)
    .eq('status', 'in_progress')
    .select('attempt_id')
    .maybeSingle();
  if (error) return fail(error.message);
  if (!data) return fail('This attempt is no longer in progress.');
  return { ok: true };
}

// ── timed start / progress (6b) ────────────────────────────────────────
// NULL time_taken_s means not started. Stamp once, then read back the
// stored start (another tab may have won the conditional update).
export async function markTimedAttemptStarted(attemptId: string): Promise<TimedStartResult> {
  const { supabase, profile } = await requireStudent();
  const { error } = await supabase.from('attempts')
    .update({ ts_iso: new Date().toISOString(), time_taken_s: 0 })
    .eq('attempt_id', attemptId)
    .eq('user_id', profile.user_id)
    .eq('mode', 'timed')
    .eq('status', 'in_progress')
    .is('time_taken_s', null);
  if (error) return fail(error.message);

  const { data, error: readError } = await supabase.from('attempts')
    .select('ts_iso, time_taken_s')
    .eq('attempt_id', attemptId)
    .eq('user_id', profile.user_id)
    .eq('mode', 'timed')
    .eq('status', 'in_progress')
    .maybeSingle();
  if (readError) return fail(readError.message);
  if (!data?.ts_iso || data.time_taken_s === null) return fail('We could not start your exam properly. Please try again.');
  return { ok: true, startedIso: data.ts_iso };
}

function timedElapsed(attempt: Attempt, questionCount: number): number {
  if (attempt.time_taken_s === null || !attempt.ts_iso) return 0;
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(attempt.ts_iso).getTime()) / 1000));
  return Math.min((attempt.duration_min || questionCount) * 60, elapsed);
}

export async function saveTimedAttemptProgress(attemptId: string, answers: AnswerRecord[]): Promise<ActionResult> {
  const { supabase, profile } = await requireStudent();
  const { data, error: readError } = await supabase.from('attempts').select('*')
    .eq('attempt_id', attemptId).eq('user_id', profile.user_id)
    .eq('mode', 'timed').eq('status', 'in_progress').maybeSingle();
  if (readError) return fail(readError.message);
  if (!data) return fail('This exam is no longer in progress.');
  const attempt = data as Attempt;
  // Leaving the preflight must not accidentally start the clock.
  if (attempt.time_taken_s === null) return { ok: true };
  const { data: saved, error } = await supabase.from('attempts')
    .update({ answers_json: JSON.stringify(answers), time_taken_s: timedElapsed(attempt, attempt.n) })
    .eq('attempt_id', attemptId).eq('user_id', profile.user_id)
    .eq('mode', 'timed').eq('status', 'in_progress')
    .select('attempt_id').maybeSingle();
  if (error) return fail(error.message);
  if (!saved) return fail('This exam is no longer in progress.');
  return { ok: true };
}

// ── finishAttempt (submit) ─────────────────────────────────────────────
// Records the final answers, the score and the time taken; sets
// completed. The score is the server's.
export async function finishAttempt(attemptId: string, answers: AnswerRecord[], timeTakenS: number | null): Promise<FinishResult> {
  const { supabase, profile } = await requireStudent();

  const attempt = await getAttemptById(supabase, attemptId);
  if (!attempt) return fail('Attempt not found.');
  if (attempt.user_id !== profile.user_id) return fail('This quiz attempt does not belong to your account.');
  if (attempt.status !== 'in_progress') return fail('This attempt has already been submitted.');

  const itemIds = (attempt.item_ids || '').split(',').filter(Boolean);
  const items = await getItemsByIds(supabase, attempt.course_id, itemIds);
  if (!items.length) return fail('The questions for this quiz could not be loaded.');

  const recomputed = recomputeAnswers(items, answers);
  const chosen: Record<string, string | string[]> = {};
  for (const a of recomputed) if (a.chosen !== null) chosen[a.item_id] = a.chosen;
  const score = computeScore(items, chosen);

  const { error } = await supabase
    .from('attempts')
    .update({
      answers_json: JSON.stringify(recomputed),
      score_raw: score.raw,
      score_total: score.total,
      score_pct: score.pct,
      time_taken_s: attempt.mode === 'timed' ? timedElapsed(attempt, items.length) : timeTakenS,
      status: 'completed',
    })
    .eq('attempt_id', attemptId)
    .eq('user_id', profile.user_id)
    .eq('status', 'in_progress');
  if (error) return fail(error.message);
  return { ok: true, score };
}

// ── the list pages (5b) ────────────────────────────────────────────────

// legacy secureShuffle: Fisher–Yates driven by crypto.getRandomValues —
// the question order of a shuffled quiz, fixed at spawn.
function secureShuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const rand = (bytes[0] * 16777216 + bytes[1] * 65536 + bytes[2] * 256 + bytes[3]) / 4294967296;
    const j = Math.floor(rand * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// spawnFixedAttempt / spawnMockAttempt: Start and Resume on a quiz card.
// One in-progress slot per quiz per mode per student — an existing one
// is returned (the runner resumes it); otherwise a fresh row, the item
// order shuffled when the quiz says so, the time limit one minute per
// question when the quiz sets none.
export async function spawnQuizAttempt(kind: QuizKind, quizId: string, mode: AttemptMode): Promise<SpawnResult> {
  const { supabase, profile } = await requireStudent();
  if (kind !== 'fixed' && kind !== 'mock') return fail('Unknown quiz kind.');
  if (mode !== 'instant' && mode !== 'timed') return fail('Unknown mode.');

  const quiz = await getQuizById(supabase, kind, quizId);
  if (!quiz) return fail('Could not start quiz. Please try again.');
  if (getQuizAvailability(quiz) !== 'ACTIVE') return fail('This quiz is not open right now.');
  const modeAllowed = mode === 'instant' ? quiz.allowed_modes !== 'TIMED_ONLY' : quiz.allowed_modes !== 'INSTANT_ONLY';
  if (!modeAllowed) return fail('This mode is not available for this quiz.');

  const access = await getStudentCourseAccess(supabase, profile.user_id);
  if (!access[quiz.course_id]) return fail('You do not have an active subscription for this course.');

  // Step 1 — an existing in-progress attempt resumes.
  const { data: existing, error: existingError } = await supabase
    .from('attempts')
    .select('attempt_id')
    .eq('user_id', profile.user_id)
    .eq('quiz_id', quiz.quiz_id)
    .eq('mode', mode)
    .eq('status', 'in_progress')
    .order('ts_iso', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) return fail(existingError.message);
  if (existing?.attempt_id) return { ok: true, attemptId: String(existing.attempt_id) };

  // Steps 2–5 — the order, the id, the time limit, the row.
  let orderedIds = [...(quiz.item_ids || [])];
  if (quiz.shuffle) orderedIds = secureShuffle(orderedIds);
  if (!orderedIds.length) return fail('This quiz has no questions yet.');

  const attemptId = makeAttemptId();
  const timeLimitSec = quiz.time_limit_sec || quiz.n * 60;

  const { error } = await supabase.from('attempts').insert({
    attempt_id: attemptId,
    user_id: profile.user_id,
    quiz_id: quiz.quiz_id,
    course_id: quiz.course_id,
    mode,
    source: kind,
    item_ids: orderedIds.join(','),
    n: orderedIds.length,
    status: 'in_progress',
    ts_iso: new Date().toISOString(),
    duration_min: Math.ceil(timeLimitSec / 60),
    answers_json: JSON.stringify([]),
    display_label: quiz.title,
  });
  if (error) return fail(error.message);
  return { ok: true, attemptId };
}

// retakeAttempt: a fresh attempt on the same questions in the same order,
// linked back through origin_attempt_id. The origin must be the
// student's own and completed.
export async function retakeAttempt(originAttemptId: string): Promise<SpawnResult> {
  const { supabase, profile } = await requireStudent();

  const origin = await getAttemptById(supabase, originAttemptId);
  if (!origin) return fail('Could not create retake. Please try again.');
  if (origin.user_id !== profile.user_id) return fail('This quiz attempt does not belong to your account.');
  if (origin.status !== 'completed') return fail('Only a completed attempt can be retaken.');

  const access = await getStudentCourseAccess(supabase, profile.user_id);
  if (!access[origin.course_id]) return fail('You do not have an active subscription for this course.');

  const attemptId = makeAttemptId();
  const { error } = await supabase.from('attempts').insert({
    attempt_id: attemptId,
    user_id: profile.user_id,
    quiz_id: origin.quiz_id,
    course_id: origin.course_id,
    mode: origin.mode,
    source: 'retake',
    item_ids: origin.item_ids,
    n: origin.n,
    status: 'in_progress',
    ts_iso: new Date().toISOString(),
    duration_min: origin.duration_min,
    answers_json: JSON.stringify([]),
    display_label: origin.display_label,
    origin_attempt_id: origin.attempt_id,
  });
  if (error) return fail(error.message);
  return { ok: true, attemptId };
}

// abandonAttempt: the list pages' inline update — status to abandoned on
// the student's own in-progress attempt. The confirm box is the page's.
export async function abandonAttempt(attemptId: string): Promise<ActionResult> {
  const { supabase, profile } = await requireStudent();
  const { data, error } = await supabase
    .from('attempts')
    .update({ status: 'abandoned' })
    .eq('attempt_id', attemptId)
    .eq('user_id', profile.user_id)
    .eq('status', 'in_progress')
    .select('attempt_id')
    .maybeSingle();
  if (error) return fail(error.message);
  if (!data) return fail('This attempt is no longer in progress.');
  return { ok: true };
}

// ── the learning history page (7a) ─────────────────────────────────────
// Every filter change and every Load more is one page from here; the
// first page is read by the page itself.
export async function loadHistoryPage(filters: HistoryFilters, page: number): Promise<HistoryPage> {
  const { supabase, profile } = await requireStudent();
  const safe: HistoryFilters = {
    courseId: String(filters?.courseId || ''),
    status: String(filters?.status || ''),
    mode: String(filters?.mode || ''),
    search: String(filters?.search || '').trim(),
  };
  return getStudentAttemptsPaginated(supabase, profile.user_id, safe, Math.max(0, Math.floor(Number(page) || 0)));
}
