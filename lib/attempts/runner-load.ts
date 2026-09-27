// lib/attempts/runner-load.ts
//
// The runner's preflight, transcribed from legacy runner/instant.html
// and runner/timed.html runPreflightAndLoad() — the checks in their
// order, with their titles and messages — but run on the server by the
// session page before anything is sent to the browser (legacy ran them
// in the browser behind a "Checking your access…" loader).
//
// 03 Q8 (Sam, 2026-09-27): one address per sitting, `/session/<id>`. The
// attempt says its own mode and its own state, so two of legacy's checks
// went with the two pages: CHECK 6 (the other runner for the other mode)
// and the review flag's two bounces — a finished sitting opens as its
// review, an unfinished one as the sitting. The Exit is resolved here,
// from where the sitting came from (links.ts).
//
// 03 Q17 (Sam, 2026-09-27): a live sitting's page carries the start card's
// data only — no question, no secret. The questions come with Start or
// Resume (openSession, called by enterSession in actions.ts), after an
// exam's clock has started, so the paper is never in the browser before
// the clock runs. The card shows on every open (Sam: Option 2). Both
// entries run the same checks (checkSession).
//
// Server-only (it reads config and the bank); not a Server Action.

import { getConfig } from '@/lib/catalogue/queries';
import { startRefusal } from '@/lib/quizzes/availability';
import { getQuizById } from '@/lib/quizzes/queries';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import type { AuthGateResult } from '@/lib/access';
import { SESSION_EXITS, type SessionExit } from './links';
import { modeOf } from './modes';
import { getAttemptById, originSource, readAttemptItems } from './queries';
import { sealItem, secretOf } from './seal';
import {
  RUNNER_QUESTIONS_PER_PAGE_DEFAULT,
  type Attempt,
  type AttemptMode,
  type SealedItem,
  type SecretsMap,
} from './types';

/** What the start card shows (Q17) — nothing of the questions but their count. */
export type StartCard = {
  attemptId: string;
  mode: AttemptMode;
  displayLabel: string | null;
  count: number;
  durationMin: number | null;
  /** Start or Resume: an exam once its clock started; any other once something is answered or flagged. */
  resuming: boolean;
  /** A started exam's seconds left on the server's clock; null otherwise. */
  secondsLeft: number | null;
};

/** The questions a sitting is played or reviewed with. */
export type SessionPlay = {
  attempt: Attempt;
  items: SealedItem[];
  secrets: SecretsMap;
  questionsPerPage: number;
  /** 03 Q18: the results pop-up offers Retake — the rule retakeAttempt holds (the quiz open, the mode allowed). */
  retakeAllowed: boolean;
};

type SessionError = { kind: 'error'; title: string; message: string; exit: SessionExit };

// The seal (Q6; D5): the runner receives the rows cut to their public
// half, and a secrets map — empty for a live exam; the questions already
// graded for a live Learning sitting (so Check Answer's feedback survives
// a reload); every question in review and admin preview.
export type RunnerLoad =
  | SessionError
  | { kind: 'start'; card: StartCard; previewMode: boolean; exit: SessionExit }
  | ({ kind: 'review'; previewMode: boolean; exit: SessionExit } & SessionPlay);

/** What Start or Resume gets back (Q17): the questions, or a sitting that has closed meanwhile. */
export type SessionOpen =
  | SessionError
  | { kind: 'review' }
  | ({ kind: 'play' } & SessionPlay);

// The checks both entries run, in legacy's order, and the lazy close of
// an exam left past its deadline. On success the attempt as it now
// stands, its home, and whether this is the admin's preview.
async function checkSession(
  gate: AuthGateResult,
  params: { attemptId: string; preview: boolean },
): Promise<SessionError | { kind: 'ok'; attempt: Attempt; exit: SessionExit; previewMode: boolean }> {
  const { supabase, profile } = gate;
  // Until the attempt is read, legacy's destination.
  const fallback = SESSION_EXITS.fixed;

  // CHECK 2 — the attempt id
  const attemptId = params.attemptId.trim();
  if (!attemptId) {
    return { kind: 'error', title: 'Missing Quiz', message: 'No attempt ID was provided. Please start a quiz from the Fixed Quizzes page.', exit: fallback };
  }

  // CHECK 9 — Preview mode (admin only)
  const previewMode = params.preview;
  if (previewMode && (profile.role ?? '').toUpperCase() !== 'ADMIN') {
    return { kind: 'error', title: 'Access Denied', message: 'Preview mode is for administrators only.', exit: fallback };
  }

  // CHECK 3 — Attempt exists
  let attempt = await getAttemptById(supabase, attemptId);
  if (!attempt) {
    return { kind: 'error', title: 'Quiz Not Found', message: 'This quiz attempt could not be found. It may have been deleted.', exit: fallback };
  }

  // CHECK 4 — Ownership (skipped in preview: an admin viewing any attempt)
  if (!previewMode && attempt.user_id !== profile.user_id) {
    return { kind: 'error', title: 'Access Denied', message: 'This quiz attempt does not belong to your account.', exit: fallback };
  }

  // The sitting's home, now that it is known to be theirs (03 Q8).
  const exit = SESSION_EXITS[(await originSource(supabase, attempt)) ?? 'fixed'];

  // CHECK 5 — Course access
  if (!previewMode) {
    const access = await getStudentCourseAccess(supabase, profile.user_id);
    if (!access[attempt.course_id]) {
      return { kind: 'error', title: 'No Course Access', message: 'You do not have an active subscription for this course.', exit };
    }
  }

  // 03 Q5 — an exam left open past its deadline is closed on this open,
  // by the server's clock (the function refuses while time is left), so
  // a closed tab is finished the next time the student comes back; the
  // status then opens the review.
  if (modeOf(attempt.mode).clock !== 'none' && attempt.status === 'in_progress' && attempt.started_utc && attempt.duration_min) {
    const deadline = new Date(attempt.started_utc).getTime() + attempt.duration_min * 60_000;
    if (Date.now() >= deadline) {
      const svc = createServiceRoleClient();
      const { error } = await svc.rpc('expire_attempt', {
        p_attempt_id: attempt.attempt_id,
        p_user_id: attempt.user_id,
      });
      if (error) console.error('expire_attempt:', error);
      // Re-read through the service role, not the cookie client: Next
      // memoises an identical fetch within one render, so the same read
      // as CHECK 3 would hand back the stale in-progress row.
      attempt = (await readAttemptFresh(attemptId)) ?? attempt;
    }
  }

  // CHECK 7 — Attempt status: abandoned is the card.
  if (attempt.status === 'abandoned') {
    return { kind: 'error', title: 'Attempt Abandoned', message: 'This quiz attempt was abandoned. Please start a new attempt.', exit };
  }
  return { kind: 'ok', attempt, exit, previewMode };
}

async function readAttemptFresh(attemptId: string): Promise<Attempt | null> {
  const { data } = await createServiceRoleClient().from('attempts').select('*').eq('attempt_id', attemptId).maybeSingle();
  return (data as Attempt | null) ?? null;
}

// The questions and the secrets the seal allows, and the config value.
// CHECK 10 — items exist (in the attempt's order). Since 03 Q4 the
// attempt's own rows, not the live bank: read with the service role,
// which is safe here because checkSession settled ownership (or the
// caller is an admin in preview).
async function sessionPlay(gate: AuthGateResult, attempt: Attempt, previewMode: boolean): Promise<SessionError | SessionPlay> {
  // Since 03 Q5 the runner saves per tap, so runner_autosave_interval_sec
  // is no longer read (the key stays until S13 reviews the registry).
  const config = await getConfig(gate.supabase);
  const questionsPerPage = Number(config.runner_questions_per_page) || RUNNER_QUESTIONS_PER_PAGE_DEFAULT;

  const rows = await readAttemptItems(createServiceRoleClient(), attempt.attempt_id);
  if (!rows.length) {
    return {
      kind: 'error',
      title: 'No Questions',
      message: 'The questions for this quiz could not be loaded. Please contact support.',
      exit: SESSION_EXITS[(await originSource(gate.supabase, attempt)) ?? 'fixed'],
    };
  }

  // The cut. A live sitting gets the public half; the secret half goes
  // only where the rule allows it.
  const unsealAll = previewMode || attempt.status !== 'in_progress';
  const feedbackEach = modeOf(attempt.mode).feedback === 'each';
  const items = rows.map(sealItem);
  const secrets: SecretsMap = {};
  for (const row of rows) {
    if (unsealAll || (feedbackEach && row.graded_utc !== null)) secrets[row.item_id] = secretOf(row);
  }
  const retakeAllowed = previewMode ? false : await retakeOpen(gate, attempt);
  return { attempt, items, secrets, questionsPerPage, retakeAllowed };
}

// 03 Q18: would retakeAttempt take this sitting once it is finished? A
// builder sitting always (it has no quiz); a fixed quiz's or a mock's
// while the quiz is open and still offers the mode — startRefusal, the
// check Start and Retake share. The server checks again on the press.
async function retakeOpen(gate: AuthGateResult, attempt: Attempt): Promise<boolean> {
  const source = await originSource(gate.supabase, attempt);
  if (source === 'builder') return true;
  if ((source !== 'fixed' && source !== 'mock') || !attempt.quiz_id) return false;
  const quiz = await getQuizById(createServiceRoleClient(), source, attempt.quiz_id);
  if (!quiz) return false;
  return startRefusal(quiz, attempt.mode) === null;
}

/**
 * The session page (03 Q8, Q17): an error card; a finished sitting's
 * review, questions and all; or, for a live one, the start card's data
 * and nothing more.
 */
export async function loadRunner(
  gate: AuthGateResult,
  params: { attemptId: string; preview: boolean },
): Promise<RunnerLoad> {
  const checked = await checkSession(gate, params);
  if (checked.kind === 'error') return checked;
  const { attempt, exit, previewMode } = checked;

  if (attempt.status === 'completed') {
    const play = await sessionPlay(gate, attempt, previewMode);
    if ('kind' in play) return play;
    return { kind: 'review', previewMode, exit, ...play };
  }

  // A live sitting: the card's data only. The count and the progress are
  // read as columns of the attempt's own rows — no stem, no option.
  const { data } = await createServiceRoleClient()
    .from('attempt_items')
    .select('chosen, flagged')
    .eq('attempt_id', attempt.attempt_id);
  const rows = (data ?? []) as { chosen: string | null; flagged: boolean }[];
  if (!rows.length) {
    return { kind: 'error', title: 'No Questions', message: 'The questions for this quiz could not be loaded. Please contact support.', exit };
  }
  const clocked = modeOf(attempt.mode).clock !== 'none';
  const started = clocked && attempt.started_utc !== null;
  const secondsLeft = started && attempt.duration_min
    ? Math.max(0, Math.floor((new Date(attempt.started_utc as string).getTime() + attempt.duration_min * 60_000 - Date.now()) / 1000))
    : null;
  return {
    kind: 'start',
    previewMode,
    exit,
    card: {
      attemptId: attempt.attempt_id,
      mode: attempt.mode,
      displayLabel: attempt.display_label,
      count: rows.length,
      durationMin: attempt.duration_min,
      resuming: clocked ? started : rows.some((r) => r.chosen !== null || r.flagged),
      secondsLeft,
    },
  };
}

/**
 * Start or Resume (Q17): the checks again, an exam's clock started once
 * (not in the admin's preview), then the questions. A sitting that closed
 * meanwhile — finished in another tab, or past its deadline — says so, and
 * the page opens its review.
 */
export async function openSession(
  gate: AuthGateResult,
  params: { attemptId: string; preview: boolean },
): Promise<SessionOpen> {
  const checked = await checkSession(gate, params);
  if (checked.kind === 'error') return checked;
  let { attempt } = checked;
  const { previewMode, exit } = checked;
  if (attempt.status !== 'in_progress') return { kind: 'review' };

  if (modeOf(attempt.mode).clock !== 'none' && !previewMode && attempt.started_utc === null) {
    const { error } = await createServiceRoleClient().rpc('start_timed_attempt', {
      p_attempt_id: attempt.attempt_id,
      p_user_id: attempt.user_id,
    });
    if (error) {
      return { kind: 'error', title: 'Could Not Start Exam', message: 'We could not start your exam properly. Please try again.', exit };
    }
    attempt = (await readAttemptFresh(attempt.attempt_id)) ?? attempt;
  }

  const play = await sessionPlay(gate, attempt, previewMode);
  if ('kind' in play) return play;
  return { kind: 'play', ...play };
}
