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
import { getItemsByIds } from '@/lib/bank/queries';
import type { Item } from '@/lib/bank/types';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import type { AuthGateResult } from '@/lib/access';
import { getAttemptById } from './queries';
import {
  RUNNER_AUTOSAVE_SEC_DEFAULT,
  RUNNER_QUESTIONS_PER_PAGE_DEFAULT,
  type Attempt,
  type AttemptMode,
} from './types';

export type RunnerLoad =
  | { kind: 'error'; title: string; message: string }
  | { kind: 'redirect'; to: string }
  | {
      kind: 'ok';
      attempt: Attempt;
      items: Item[];
      questionsPerPage: number;
      autosaveMs: number;
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
  const attempt = await getAttemptById(supabase, attemptId);
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

  // Config
  const config = await getConfig(supabase);
  const questionsPerPage = Number(config.runner_questions_per_page) || RUNNER_QUESTIONS_PER_PAGE_DEFAULT;
  const autosaveMs = (Number(config.runner_autosave_interval_sec) || RUNNER_AUTOSAVE_SEC_DEFAULT) * 1000;

  // CHECK 10 — Items exist (in the attempt's order)
  const itemIds = (attempt.item_ids || '').split(',').filter(Boolean);
  const items = await getItemsByIds(supabase, attempt.course_id, itemIds);
  if (!items.length) {
    return {
      kind: 'error',
      title: 'No Questions',
      message: mode === 'instant'
        ? 'The questions for this quiz could not be loaded. Please contact support.'
        : 'The questions for this quiz could not be loaded.',
    };
  }

  return { kind: 'ok', attempt, items, questionsPerPage, autosaveMs, reviewMode, previewMode };
}
