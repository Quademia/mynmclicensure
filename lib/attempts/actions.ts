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
// Not here yet, by slice: spawnFixedAttempt / spawnMockAttempt,
// retakeAttempt and abandon (5b).

'use server';

import { requireStudent } from '@/lib/access';
import { getItemFilterOptions, getItemsByIds } from '@/lib/bank/queries';
import { itemsTableFor } from '@/lib/bank/tables';
import type { ItemFilterOptions } from '@/lib/bank/types';
import { getConfig } from '@/lib/catalogue/queries';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { makeAttemptId } from './ids';
import { getAttemptById, getBuilderCourseItems } from './queries';
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
export async function saveAttemptProgress(attemptId: string, answers: AnswerRecord[]): Promise<ActionResult> {
  const { supabase } = await requireStudent();
  const { error } = await supabase
    .from('attempts')
    .update({ answers_json: JSON.stringify(answers), status: 'in_progress' })
    .eq('attempt_id', attemptId);
  if (error) return fail(error.message);
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
