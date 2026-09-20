// lib/attempts/runner-load.ts
//
// The runner's preflight, transcribed from legacy runner/instant.html
// and runner/timed.html runPreflightAndLoad() — the ten checks in their
// order, with their titles and messages — but run on the server by the
// runner's page before anything is sent to the browser (legacy ran them
// in the browser behind a "Checking your access…" loader). The outcome is
// one of three: an error screen, a redirect (the wrong runner for the
// attempt's mode, a completed attempt opened without ?review=1, an
// in-progress one opened with it), or the loaded attempt with its items
// and the two config values.
//
// Server-only (it reads config and the bank); not a Server Action.

import { getConfig } from '@/lib/catalogue/queries';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import type { AuthGateResult } from '@/lib/access';
import { getAttemptById, readAttemptItems } from './queries';
import {
  RUNNER_QUESTIONS_PER_PAGE_DEFAULT,
  type Attempt,
  type AttemptItem,
  type AttemptMode,
} from './types';

export type RunnerLoad =
  | { kind: 'error'; title: string; message: string }
  | { kind: 'redirect'; to: string }
  | {
      kind: 'ok';
      attempt: Attempt;
      items: AttemptItem[];
      questionsPerPage: number;
      reviewMode: boolean;
      previewMode: boolean;
    };

export function runnerPath(mode: AttemptMode, attemptId: string, review = false): string {
  return `/runner/${mode}?attempt_id=${encodeURIComponent(attemptId)}${review ? '&review=1' : ''}`;
}

export async function loadRunner(
  gate: AuthGateResult,
  mode: AttemptMode,
  params: { attemptId: string; review: boolean; preview: boolean },
): Promise<RunnerLoad> {
  const { supabase, profile } = gate;
  const words = mode === 'instant'
    ? { back: 'Please start a quiz from the Fixed Quizzes page.', reviewMsg: 'This attempt cannot be reviewed yet as it has not been completed.' }
    : { back: 'Please start a quiz from the Fixed Quizzes page.', reviewMsg: 'This attempt cannot be reviewed yet.' };

  // CHECK 2 — URL params
  const attemptId = params.attemptId.trim();
  if (!attemptId) {
    return { kind: 'error', title: 'Missing Quiz', message: `No attempt ID was provided. ${words.back}` };
  }

  // CHECK 9 — Preview mode (admin only)
  const previewMode = params.preview;
  if (previewMode && (profile.role ?? '').toUpperCase() !== 'ADMIN') {
    return { kind: 'error', title: 'Access Denied', message: 'Preview mode is for administrators only.' };
  }

  // CHECK 8 — Review mode
  const reviewMode = params.review;

  // CHECK 3 — Attempt exists
  let attempt = await getAttemptById(supabase, attemptId);
  if (!attempt) {
    return {
      kind: 'error',
      title: 'Quiz Not Found',
      message: mode === 'instant' ? 'This quiz attempt could not be found. It may have been deleted.' : 'This quiz attempt could not be found.',
    };
  }

  // CHECK 4 — Ownership (skipped in preview: an admin viewing any attempt)
  if (!previewMode && attempt.user_id !== profile.user_id) {
    return { kind: 'error', title: 'Access Denied', message: 'This quiz attempt does not belong to your account.' };
  }

  // CHECK 5 — Course access
  if (!previewMode) {
    const access = await getStudentCourseAccess(supabase, profile.user_id);
    if (!access[attempt.course_id]) {
      return { kind: 'error', title: 'No Course Access', message: 'You do not have an active subscription for this course.' };
    }
  }

  // 03 Q5 — an exam left open past its deadline is closed on this open,
  // by the server's clock (the function refuses while time is left), so
  // a closed tab is finished the next time the student comes back; the
  // status checks below then send them to the review.
  if (attempt.mode === 'timed' && attempt.status === 'in_progress' && attempt.started_utc && attempt.duration_min) {
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
      const { data: fresh } = await svc.from('attempts').select('*').eq('attempt_id', attemptId).maybeSingle();
      if (fresh) attempt = fresh as Attempt;
    }
  }

  // CHECK 6 — Mode match: the other runner
  if (attempt.mode !== mode) {
    return { kind: 'redirect', to: runnerPath(attempt.mode === 'timed' ? 'timed' : 'instant', attemptId, reviewMode) };
  }

  // CHECK 7 — Attempt status
  if (attempt.status === 'abandoned') {
    return {
      kind: 'error',
      title: 'Attempt Abandoned',
      message: mode === 'instant'
        ? 'This quiz attempt was abandoned. Please start a new attempt from the Fixed Quizzes page.'
        : 'This quiz attempt was abandoned. Please start a new attempt.',
    };
  }
  if (attempt.status === 'completed' && !reviewMode) return { kind: 'redirect', to: runnerPath(mode, attemptId, true) };
  if (attempt.status === 'in_progress' && reviewMode) return { kind: 'redirect', to: runnerPath(mode, attemptId, false) };
  if (reviewMode && attempt.status !== 'completed') {
    return { kind: 'error', title: 'Not Available', message: words.reviewMsg };
  }

  // Config. Since 03 Q5 the runner saves per tap, so
  // runner_autosave_interval_sec is no longer read (the key stays until
  // S13 reviews the registry).
  const config = await getConfig(supabase);
  const questionsPerPage = Number(config.runner_questions_per_page) || RUNNER_QUESTIONS_PER_PAGE_DEFAULT;

  // CHECK 10 — Items exist (in the attempt's order). Since 03 Q4 the
  // attempt's own rows, not the live bank: read with the service role,
  // which is safe here because CHECK 4 above settled ownership (or the
  // caller is an admin in preview).
  const items = await readAttemptItems(createServiceRoleClient(), attempt);
  if (!items.length) {
    return {
      kind: 'error',
      title: 'No Questions',
      message: mode === 'instant'
        ? 'The questions for this quiz could not be loaded. Please contact support.'
        : 'The questions for this quiz could not be loaded.',
    };
  }

  return { kind: 'ok', attempt, items, questionsPerPage, reviewMode, previewMode };
}
