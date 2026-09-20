// lib/attempts/actions.ts
//
// The attempt writes as Server Actions behind the student gate — legacy
// did these from the browser with direct `db.from('attempts')` calls
// (spawnBuilderAttempt, saveAttemptProgress, finishAttempt in
// js/mynmclicensure-api.js). Since 03 Q5 (§8 S7) every write is one
// database function called through the service role after the gate:
// the browser role holds SELECT and nothing else on the attempt tables,
// the function takes the caller's user id and refuses a row that is not
// theirs or an attempt not in progress, and grading happens in SQL —
// the browser never supplies a score. Plus the builder's course load,
// which legacy did with two browser reads.
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
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getItemFilterOptions, getItemsByIds } from '@/lib/bank/queries';
import type { ItemFilterOptions } from '@/lib/bank/types';
import { getConfig } from '@/lib/catalogue/queries';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { startRefusal } from '@/lib/quizzes/availability';
import { getQuizById } from '@/lib/quizzes/queries';
import type { QuizKind } from '@/lib/quizzes/types';
import { makeAttemptId } from './ids';
import { getAttemptById, getBuilderCourseItems, getStudentAttemptsPaginated, readAttemptItems } from './queries';
import { chosenToStored } from './scoring';
import {
  BUILDER_MAX_QUESTIONS_DEFAULT,
  BUILDER_MINUTES_PER_QUESTION_DEFAULT,
  type ActionResult,
  type AnswerPatch,
  type AttemptMode,
  type CheckResult,
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

// ── the one creator (03 Q4) ────────────────────────────────────────────
// The header and one attempt_items row per question, the questions
// copied table to table from question_bank in the given order, in one
// database function. EXECUTE is revoked from the browser roles, so the
// call goes through the service role — after the caller's own gates
// (requireStudent, the course access, the quiz's availability). An id
// the bank no longer has is dropped by the function, as getItemsByIds
// dropped it before; none resolving is a refusal, and no header is left.
type CreateAttemptArgs = {
  attemptId: string;
  userId: string;
  courseId: string;
  itemIds: string[];
  mode: AttemptMode;
  source: 'builder' | 'fixed' | 'mock' | 'retake';
  quizId: string | null;
  durationMin: number | null;
  displayLabel: string | null;
  originAttemptId: string | null;
};

async function createAttemptRows(args: CreateAttemptArgs): Promise<SpawnResult> {
  const { error } = await createServiceRoleClient().rpc('create_attempt', {
    p_attempt_id: args.attemptId,
    p_user_id: args.userId,
    p_course_id: args.courseId,
    p_item_ids: args.itemIds,
    p_mode: args.mode,
    p_source: args.source,
    p_quiz_id: args.quizId,
    p_duration_min: args.durationMin,
    p_display_label: args.displayLabel,
    p_origin_attempt_id: args.originAttemptId,
  });
  if (error) {
    console.error('create_attempt:', error);
    return fail('Could not start this attempt. Please try again.');
  }
  return { ok: true, attemptId: args.attemptId };
}

// ── the builder's course load (legacy handleCourseChange's two reads) ──
export type BuilderCourseLoad =
  | { ok: true; items: BuilderItem[]; options: ItemFilterOptions }
  | { ok: false; error: string };

export async function loadBuilderCourse(courseId: string): Promise<BuilderCourseLoad> {
  const { supabase, profile } = await requireStudent();

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

  return createAttemptRows({
    attemptId: makeAttemptId(),
    userId: profile.user_id,
    courseId,
    itemIds: orderedIds,
    mode,
    source: 'builder',
    quizId: null,
    durationMin,
    displayLabel: String(meta.display_label || '').trim() || null,
    originAttemptId: null,
  });
}

// ── the write door (03 Q5): six functions, one call each ───────────────
// Each function checks the row is the caller's and the attempt is in
// progress, so a late save after Submit is refused there (rebuild.md §9
// #17 holds by the status check); the runner is locked by then and
// ignores it. The functions' own messages are student-facing and are
// passed through.

function rpcError(error: { message?: string } | null, fallback: string): string {
  const msg = String(error?.message || '').trim();
  return msg && !/^[a-z_]+:/.test(msg) ? msg : fallback;
}

// The timed clock's anchor: set once, then the stored value comes back
// (another tab may have won).
export async function startTimedAttempt(attemptId: string): Promise<TimedStartResult> {
  const { profile } = await requireStudent();
  const { data, error } = await createServiceRoleClient().rpc('start_timed_attempt', {
    p_attempt_id: attemptId,
    p_user_id: profile.user_id,
  });
  if (error) return fail(rpcError(error, 'We could not start your exam properly. Please try again.'));
  if (!data) return fail('We could not start your exam properly. Please try again.');
  return { ok: true, startedIso: String(data) };
}

// The runner's save-per-tap: one patch per question, each key optional.
export async function saveAnswers(attemptId: string, rows: AnswerPatch[]): Promise<ActionResult> {
  const { profile } = await requireStudent();
  const safe = (Array.isArray(rows) ? rows : [])
    .filter((r) => r && typeof r.item_id === 'string' && r.item_id)
    .map((r) => {
      const patch: AnswerPatch = { item_id: r.item_id };
      if ('chosen' in r) patch.chosen = chosenToStored(r.chosen);
      if ('flagged' in r) patch.flagged = Boolean(r.flagged);
      if ('sata_checked' in r) patch.sata_checked = Boolean(r.sata_checked);
      if ('time_spent_s' in r) patch.time_spent_s = r.time_spent_s === null ? null : Math.max(0, Math.floor(Number(r.time_spent_s) || 0));
      return patch;
    });
  if (!safe.length) return { ok: true };
  const { error } = await createServiceRoleClient().rpc('save_answers', {
    p_attempt_id: attemptId,
    p_user_id: profile.user_id,
    p_rows: safe,
  });
  if (error) return fail(rpcError(error, 'Could not save your progress.'));
  return { ok: true };
}

// Instant mode's Check Answer: the server writes the answer, grades the
// one row and returns its secret half.
export async function checkAnswer(attemptItemId: number, chosen: string | string[], sataChecked = false): Promise<CheckResult> {
  const { profile } = await requireStudent();
  const { data, error } = await createServiceRoleClient().rpc('check_answer', {
    p_attempt_item_id: attemptItemId,
    p_user_id: profile.user_id,
    p_chosen: chosenToStored(chosen),
    p_sata_checked: Boolean(sataChecked),
  });
  if (error) return fail(rpcError(error, 'Could not check this answer.'));
  const row = (Array.isArray(data) ? data[0] : data) as
    | { is_correct: boolean; score_awarded: number; correct: string; rationale: string | null; rationale_img: string | null;
        fb_a: string | null; fb_b: string | null; fb_c: string | null; fb_d: string | null; fb_e: string | null; fb_f: string | null }
    | undefined;
  if (!row) return fail('Could not check this answer.');
  return {
    ok: true,
    isCorrect: Boolean(row.is_correct),
    scoreAwarded: Number(row.score_awarded) || 0,
    secret: {
      correct: row.correct,
      rationale: row.rationale,
      rationale_img: row.rationale_img,
      fb_a: row.fb_a, fb_b: row.fb_b, fb_c: row.fb_c, fb_d: row.fb_d, fb_e: row.fb_e, fb_f: row.fb_f,
    },
  };
}

type CloseRow = { score_raw: number | string; score_total: number | string; score_pct: number | string };

function scoreOf(data: unknown): { raw: number; total: number; pct: number } | null {
  const row = (Array.isArray(data) ? data[0] : data) as CloseRow | undefined;
  if (!row) return null;
  return { raw: Number(row.score_raw) || 0, total: Number(row.score_total) || 0, pct: Number(row.score_pct) || 0 };
}

// Submit: every row graded from its final answer, the header summed,
// completed. timeTakenS is the browser's stopwatch for an instant
// attempt; an exam's time is the server clock's.
export async function finishAttempt(attemptId: string, timeTakenS: number | null): Promise<FinishResult> {
  const { profile } = await requireStudent();
  const { data, error } = await createServiceRoleClient().rpc('finish_attempt', {
    p_attempt_id: attemptId,
    p_user_id: profile.user_id,
    p_time_taken_s: timeTakenS === null ? null : Math.max(0, Math.floor(Number(timeTakenS) || 0)),
  });
  if (error) return fail(rpcError(error, 'Could not submit this attempt.'));
  const score = scoreOf(data);
  if (!score) return fail('Could not submit this attempt.');
  return { ok: true, score };
}

// The exam's clock ran out: closed at the true deadline. The function
// refuses while the server's clock says time is left.
export async function expireAttempt(attemptId: string): Promise<FinishResult> {
  const { profile } = await requireStudent();
  const { data, error } = await createServiceRoleClient().rpc('expire_attempt', {
    p_attempt_id: attemptId,
    p_user_id: profile.user_id,
  });
  if (error) return fail(rpcError(error, 'Could not submit this exam.'));
  const score = scoreOf(data);
  if (!score) return fail('Could not submit this exam.');
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

  // The full row (item_ids) through the service role — Q1 took the
  // question list out of the browser roles' reach; the availability and
  // access checks below are the gate on what the student may start.
  const quiz = await getQuizById(createServiceRoleClient(), kind, quizId);
  if (!quiz) return fail('Could not start quiz. Please try again.');
  const refusal = startRefusal(quiz, mode);
  if (refusal) return fail(refusal);

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

  const timeLimitSec = quiz.time_limit_sec || quiz.n * 60;

  return createAttemptRows({
    attemptId: makeAttemptId(),
    userId: profile.user_id,
    courseId: quiz.course_id,
    itemIds: orderedIds,
    mode,
    source: kind,
    quizId: quiz.quiz_id,
    durationMin: Math.ceil(timeLimitSec / 60),
    displayLabel: quiz.title,
    originAttemptId: null,
  });
}

// retakeAttempt: a fresh attempt on the same questions in the same order,
// linked back through origin_attempt_id. The origin must be the
// student's own and completed — and, since Q2 (D45 a), the quiz it came
// from must still be startable: the same check Start makes, on the
// server's clock. A builder attempt has no quiz and no schedule. Since
// 03 Q4 the order comes from the origin's own rows, and the new sitting
// copies each question fresh from the live bank (Sam, 2026-09-20): it
// records what it was shown today; the origin keeps what it saw.
export async function retakeAttempt(originAttemptId: string): Promise<SpawnResult> {
  const { supabase, profile } = await requireStudent();

  const origin = await getAttemptById(supabase, originAttemptId);
  if (!origin) return fail('Could not create retake. Please try again.');
  if (origin.user_id !== profile.user_id) return fail('This quiz attempt does not belong to your account.');
  if (origin.status !== 'completed') return fail('Only a completed attempt can be retaken.');

  const access = await getStudentCourseAccess(supabase, profile.user_id);
  if (!access[origin.course_id]) return fail('You do not have an active subscription for this course.');

  const kind = await quizKindOfAttempt(supabase, origin);
  if (kind && origin.quiz_id) {
    const quiz = await getQuizById(createServiceRoleClient(), kind, origin.quiz_id);
    if (!quiz) return fail('This quiz is not open right now.');
    const refusal = startRefusal(quiz, origin.mode);
    if (refusal) return fail(refusal);
  }

  const originItems = await readAttemptItems(createServiceRoleClient(), origin);
  if (!originItems.length) return fail('Could not create retake. Please try again.');

  return createAttemptRows({
    attemptId: makeAttemptId(),
    userId: profile.user_id,
    courseId: origin.course_id,
    itemIds: originItems.map((i) => i.item_id),
    mode: origin.mode,
    source: 'retake',
    quizId: origin.quiz_id,
    durationMin: origin.duration_min,
    displayLabel: origin.display_label,
    originAttemptId: origin.attempt_id,
  });
}

// Which quiz table an attempt's quiz lives in: its own source, or — for
// a retake, whose source is 'retake' — the source of the attempt it was
// taken from, followed back through origin_attempt_id. A builder
// attempt has no quiz: null.
async function quizKindOfAttempt(db: Parameters<typeof getAttemptById>[0], attempt: Attempt): Promise<QuizKind | null> {
  let current: Attempt | null = attempt;
  for (let hops = 0; current && hops < 20; hops++) {
    if (current.source === 'fixed' || current.source === 'mock') return current.source;
    if (current.source !== 'retake' || !current.origin_attempt_id) return null;
    current = await getAttemptById(db, current.origin_attempt_id);
  }
  return null;
}

// abandonAttempt: the list pages' Abandon — status to abandoned on the
// student's own in-progress attempt, the rows kept. The confirm box is
// the page's.
export async function abandonAttempt(attemptId: string): Promise<ActionResult> {
  const { profile } = await requireStudent();
  const { error } = await createServiceRoleClient().rpc('abandon_attempt', {
    p_attempt_id: attemptId,
    p_user_id: profile.user_id,
  });
  if (error) return fail(rpcError(error, 'This attempt is no longer in progress.'));
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
