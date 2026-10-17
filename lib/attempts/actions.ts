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

import { requireStudent, type ServerSupabaseClient } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { knownItemIds, searchConceptItemIds } from '@/lib/bank/queries';
import { getConfig } from '@/lib/catalogue/queries';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { startRefusal } from '@/lib/quizzes/availability';
import { reviewClosedLine } from '@/lib/quizzes/results-date';
import { getQuizById } from '@/lib/quizzes/queries';
import type { QuizKind } from '@/lib/quizzes/types';
import { builderDoorFor } from './builder-door';
import { isFreeSitting } from './free-sitting';
import { makeAttemptId } from './ids';
import { modeOf } from './modes';
import {
  getAnswerHistory,
  getOwnAttempt,
  getQuizBuilderRows,
  originSource,
  readAttemptItems,
} from './queries';
import { openSession, type SessionOpen } from './runner-load';
import { chosenToStored } from './scoring';
import { secretsOf } from './seal';
import {
  ATTEMPT_MODES,
  BUILDER_MAX_QUESTIONS_DEFAULT,
  BUILDER_MIN_QUESTIONS,
  BUILDER_MINUTES_PER_QUESTION_DEFAULT,
  ENDED_REVIEW_LINE,
  PACKAGES_HREF,
  TIME_SPENT_MAX_S,
  type ActionResult,
  type AdvanceResult,
  type AnswerPatch,
  type AttemptMode,
  type CheckResult,
  type FinishResult,
  type KeywordResult,
  type QuizBuilderLoad,
  type SpawnResult,
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
//
// Since 08 B4 the function refuses an id that is a draft — a fixed quiz,
// a mock or a retake naming a question unpublished since — with "This
// quiz has a question that is not published". That sentence is for the
// student, so it passes through as the six write doors' messages do
// (rpcError); a function's own diagnostic, prefixed with its name, still
// becomes the general words.
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
    return fail(rpcError(error, 'Could not start this attempt. Please try again.'));
  }
  return { ok: true, attemptId: args.attemptId };
}

const HELD_BACK_UNREADABLE = 'Could not load the questions for this course. Please try again.';

// ── the Quiz Builder (04.4; Sam, 2026-10-11) ───────────────────────────
// Three doors, each asking the builder's door (lib/attempts/builder-door)
// for this course first — the whole bank, the free questions, or nothing
// — so the page can never ask for more than it was offered. The database
// holds the same rules at Start (create_attempt). The pack builder has
// its own three (lib/offline-packs/actions, 07.2).

const NOT_OPEN = 'This course is not open to you in the quiz builder.';

/** A course's pool: its Practice and Free questions' light rows (Free alone on the free door), each marked seen / got wrong. */
export async function loadQuizBuilderCourse(courseId: string): Promise<QuizBuilderLoad> {
  const gate = await requireStudent();
  const door = await builderDoorFor(gate, String(courseId || ''));
  if (!door) return fail(NOT_OPEN);

  const [rows, history] = await Promise.all([
    getQuizBuilderRows(gate.supabase, door.course_id, door.pool === 'free'),
    getAnswerHistory(gate.supabase, gate.profile.user_id, door.course_id),
  ]);
  if (!rows || !history) return fail(HELD_BACK_UNREADABLE);

  return {
    ok: true,
    items: rows.map((r) => ({ ...r, seen: history.has(r.item_id), wrong: history.get(r.item_id) === true })),
  };
}

/** The keyword's matching ids in this course's pool — from the start of a word, the free set alone on the free pool. */
export async function searchQuizBuilderKeyword(courseId: string, word: string): Promise<KeywordResult> {
  const gate = await requireStudent();
  const door = await builderDoorFor(gate, String(courseId || ''));
  if (!door) return fail(NOT_OPEN);

  const q = String(word || '').trim().slice(0, 80);
  if (!q) return { ok: true, itemIds: [] };

  const ids = await searchConceptItemIds(createServiceRoleClient(), door.course_id, q, door.pool === 'free');
  return { ok: true, itemIds: ids };
}

/**
 * Start: the chosen ids (picked and shuffled on the page), the mode and
 * the quiz's name. Checked again here — the course open, the mode open on
 * its pool, 5 to the builder's limit, each id this course's, published,
 * in the Practice or Free pool and, on the free door, Free — then the database's own
 * rules. Its refusal reaches the student in its own words ("You have used
 * all the Quiz Builder quizzes in your package."), not "could not build".
 */
export async function startQuizBuilderQuiz(courseId: string, itemIds: string[], mode: AttemptMode, label: string): Promise<SpawnResult> {
  const gate = await requireStudent();
  const { supabase, profile } = gate;
  if (!(ATTEMPT_MODES as readonly string[]).includes(mode)) return fail('Unknown mode.');

  const door = await builderDoorFor(gate, String(courseId || ''));
  if (!door) return fail(NOT_OPEN);
  if (door.pool === 'free' && modeOf(mode).group === 'exam') return fail('The exam modes open with a package.');

  const config = await getConfig(supabase);
  const maxQuestions = Number(config.builder_max_questions) > 0 ? Number(config.builder_max_questions) : BUILDER_MAX_QUESTIONS_DEFAULT;
  const minutesPerQuestion =
    Number(config.builder_minutes_per_question) > 0 ? Number(config.builder_minutes_per_question) : BUILDER_MINUTES_PER_QUESTION_DEFAULT;

  const safeIds = [...new Set((itemIds || []).map((id) => String(id || '').trim()).filter(Boolean))].slice(0, maxQuestions);

  // The ids must be this course's, published and in the Practice or Free
  // pool (06.8) — for a student on the free door the cookie client reads
  // the Free rows only, so a paid id drops here too.
  const known = await knownItemIds(supabase, door.course_id, safeIds);
  const orderedIds = safeIds.filter((id) => known.has(id));
  if (orderedIds.length < BUILDER_MIN_QUESTIONS) return fail(`A quiz needs at least ${BUILDER_MIN_QUESTIONS} questions.`);

  return createAttemptRows({
    attemptId: makeAttemptId(),
    userId: profile.user_id,
    courseId: door.course_id,
    itemIds: orderedIds,
    mode,
    source: 'builder',
    quizId: null,
    durationMin: Math.ceil(orderedIds.length * minutesPerQuestion),
    displayLabel: String(label || '').trim().slice(0, 140) || null,
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

// Start or Resume on the start card (03 Q17): the session page's checks
// again, an exam's clock started once (the function returns the stored
// start when another tab won), then the questions — the first moment
// they reach the browser. Admin preview reads any sitting and starts no
// clock.
export async function enterSession(attemptId: string, preview = false): Promise<SessionOpen> {
  const gate = await requireStudent();
  return openSession(gate, { attemptId: String(attemptId || ''), preview: Boolean(preview) });
}

// Sequential's move (§8 S21): the server stamps the current question as
// passed — only when it has an answer, and not after the deadline — and
// says which position is now current (null: every question passed). The
// runner flushes the current answer first; save_answers then refuses any
// row but the new current one.
export async function advanceAttempt(attemptId: string): Promise<AdvanceResult> {
  const { profile } = await requireStudent();
  const { data, error } = await createServiceRoleClient().rpc('advance_attempt', {
    p_attempt_id: attemptId,
    p_user_id: profile.user_id,
  });
  if (error) return fail(rpcError(error, 'Could not move to the next question.'));
  return { ok: true, nextPosition: data === null || data === undefined ? null : Number(data) };
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
      // 03 Q11: the runner's running total, kept between 0 and 3 hours
      if ('time_spent_s' in r) patch.time_spent_s = r.time_spent_s === null ? null : Math.min(TIME_SPENT_MAX_S, Math.max(0, Math.floor(Number(r.time_spent_s) || 0)));
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
// attempt; an exam's time is the server clock's. The sitting being over,
// the reply carries every question's secret half for the review (Q6) —
// unless its results are held (04.12, closedResult).
export async function finishAttempt(attemptId: string, timeTakenS: number | null): Promise<FinishResult> {
  const { supabase, profile } = await requireStudent();
  const svc = createServiceRoleClient();
  const { data, error } = await svc.rpc('finish_attempt', {
    p_attempt_id: attemptId,
    p_user_id: profile.user_id,
    p_time_taken_s: timeTakenS === null ? null : Math.max(0, Math.floor(Number(timeTakenS) || 0)),
  });
  if (error) return fail(rpcError(error, 'Could not submit this attempt.'));
  const score = scoreOf(data);
  if (!score) return fail('Could not submit this attempt.');
  return closedResult(svc, supabase, profile.user_id, attemptId, score);
}

// What a closed sitting's reply carries (04.12). The sitting is read back
// through student_attempts(), which decides whether its results are held:
// held, the reply is the date and what was saved — no score, no secret
// half; otherwise the score, every secret half for the review (Q6) and the
// time the close wrote (03 Q18: the server clock's for an exam, the
// stopwatch's otherwise) — but with the review closed (04.13), or the
// student's access ended (03 F2), the score and the counts and no secret
// half. The read is tried twice — the sitting is closed
// by now, and a reply of failure would leave the runner live — and a read
// that fails both times gives nothing away.
async function closedResult(
  svc: ReturnType<typeof createServiceRoleClient>,
  supabase: ServerSupabaseClient,
  userId: string,
  attemptId: string,
  score: { raw: number; total: number; pct: number },
): Promise<FinishResult> {
  const [first, rows] = await Promise.all([getOwnAttempt(userId, attemptId), readAttemptItems(svc, attemptId)]);
  const own = first ?? (await getOwnAttempt(userId, attemptId));
  if (!own) return fail('Your answers were submitted. Open the sitting again from Learning History.');
  const timeTakenS = own.time_taken_s === null || own.time_taken_s === undefined ? null : Number(own.time_taken_s);
  if (own.held && own.results_at) {
    return {
      ok: true,
      held: true,
      resultsAt: own.results_at,
      answers: own.review !== 'never',
      answered: rows.filter(answered).length,
      total: rows.length,
      timeTakenS,
    };
  }
  // 04.13: the review closed (or not allowed) — the score, no secret half
  if (own.review_closed) {
    const noun = (await quizKindOfAttempt(own)) === 'mock' ? 'mock' : 'paper';
    return {
      ok: true,
      held: false,
      score,
      secrets: {},
      timeTakenS,
      reviewClosed: {
        line: reviewClosedLine(own.review, own.review_closes_at, noun),
        correct: rows.filter((r) => answered(r) && r.is_correct === true).length,
        wrong: rows.filter((r) => answered(r) && r.is_correct !== true).length,
        unanswered: rows.filter((r) => !answered(r)).length,
      },
    };
  }
  // 03 F2: the student's access has ended — the score and the counts, no
  // secret half, the lock's line and the way to a package (a free sitting
  // stays open)
  const access = await getStudentCourseAccess(supabase, userId);
  if (!access[own.course_id] && !(await isFreeSitting(own))) {
    return {
      ok: true,
      held: false,
      score,
      secrets: {},
      timeTakenS,
      reviewClosed: {
        line: ENDED_REVIEW_LINE,
        correct: rows.filter((r) => answered(r) && r.is_correct === true).length,
        wrong: rows.filter((r) => answered(r) && r.is_correct !== true).length,
        unanswered: rows.filter((r) => !answered(r)).length,
        packageHref: PACKAGES_HREF,
      },
    };
  }
  return { ok: true, held: false, score, secrets: secretsOf(rows), timeTakenS, reviewClosed: null };
}

/** A row with an answer saved (the runner's own test). */
function answered(r: { chosen: string | null }): boolean {
  return r.chosen !== null && String(r.chosen).trim() !== '';
}

// The exam's clock ran out: closed at the true deadline. The function
// refuses while the server's clock says time is left.
export async function expireAttempt(attemptId: string): Promise<FinishResult> {
  const { supabase, profile } = await requireStudent();
  const svc = createServiceRoleClient();
  const { data, error } = await svc.rpc('expire_attempt', {
    p_attempt_id: attemptId,
    p_user_id: profile.user_id,
  });
  if (error) return fail(rpcError(error, 'Could not submit this exam.'));
  const score = scoreOf(data);
  if (!score) return fail('Could not submit this exam.');
  return closedResult(svc, supabase, profile.user_id, attemptId, score);
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
  if (!(ATTEMPT_MODES as readonly string[]).includes(mode)) return fail('Unknown mode.');

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

  const origin = await getOwnAttempt(profile.user_id, originAttemptId);
  if (!origin) return fail('Could not create retake. Please try again.');
  if (origin.user_id !== profile.user_id) return fail('This quiz attempt does not belong to your account.');
  if (origin.status !== 'completed') return fail('Only a completed attempt can be retaken.');

  // A free sitting retakes on the free set (03, 04.4); the database copies
  // the questions afresh and refuses any no longer free.
  const access = await getStudentCourseAccess(supabase, profile.user_id);
  if (!access[origin.course_id] && !(await isFreeSitting(origin))) {
    return fail('You do not have an active subscription for this course.');
  }

  const kind = await quizKindOfAttempt(origin);
  if (kind && origin.quiz_id) {
    const quiz = await getQuizById(createServiceRoleClient(), kind, origin.quiz_id);
    if (!quiz) return fail('This quiz is not open right now.');
    const refusal = startRefusal(quiz, origin.mode);
    if (refusal) return fail(refusal);
  }

  const originItems = await readAttemptItems(createServiceRoleClient(), origin.attempt_id);
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

// Which quiz table an attempt's quiz lives in: where the sitting came
// from (a retake followed back to its origin — queries.ts, since 03 Q8
// the runner's Exit reads it too). A builder attempt has no quiz: null.
async function quizKindOfAttempt(attempt: Attempt): Promise<QuizKind | null> {
  const source = await originSource(attempt, (id) => getOwnAttempt(attempt.user_id, id));
  return source === 'fixed' || source === 'mock' ? source : null;
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
