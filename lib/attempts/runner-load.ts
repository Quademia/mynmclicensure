// lib/attempts/runner-load.ts
//
// The runner's preflight, transcribed from legacy runner/instant.html
// and runner/timed.html runPreflightAndLoad() — the checks in their
// order, with their titles and messages — but run on the server by the
// session page before anything is sent to the browser (legacy ran them
// in the browser behind a "Checking your access…" loader). The outcome is
// an error screen or the loaded attempt with its items, the config value
// and where the sitting's Exit goes.
//
// 03 Q8 (Sam, 2026-09-27): one address per sitting, `/session/<id>`. The
// attempt says its own mode and its own state, so two of legacy's checks
// went with the two pages: CHECK 6 (the other runner for the other mode)
// and the review flag's two bounces — a finished sitting opens as its
// review, an unfinished one as the sitting. The Exit is resolved here,
// from where the sitting came from (links.ts).
//
// Server-only (it reads config and the bank); not a Server Action.

import { getConfig } from '@/lib/catalogue/queries';
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
  type SealedItem,
  type SecretsMap,
} from './types';

// The seal (Q6; D5): the runner receives the rows cut to their public
// half, and a secrets map — empty for a live exam; the questions already
// graded for a live Learning sitting (so Check Answer's feedback survives
// a reload); every question in review and admin preview.
export type RunnerLoad =
  | { kind: 'error'; title: string; message: string; exit: SessionExit }
  | {
      kind: 'ok';
      attempt: Attempt;
      items: SealedItem[];
      secrets: SecretsMap;
      questionsPerPage: number;
      reviewMode: boolean;
      previewMode: boolean;
      exit: SessionExit;
    };

export async function loadRunner(
  gate: AuthGateResult,
  params: { attemptId: string; preview: boolean },
): Promise<RunnerLoad> {
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
      const { data: fresh } = await svc.from('attempts').select('*').eq('attempt_id', attemptId).maybeSingle();
      if (fresh) attempt = fresh as Attempt;
    }
  }

  // CHECK 7 — Attempt status: abandoned is the card; finished is the review.
  if (attempt.status === 'abandoned') {
    return { kind: 'error', title: 'Attempt Abandoned', message: 'This quiz attempt was abandoned. Please start a new attempt.', exit };
  }
  const reviewMode = attempt.status === 'completed';

  // Config. Since 03 Q5 the runner saves per tap, so
  // runner_autosave_interval_sec is no longer read (the key stays until
  // S13 reviews the registry).
  const config = await getConfig(supabase);
  const questionsPerPage = Number(config.runner_questions_per_page) || RUNNER_QUESTIONS_PER_PAGE_DEFAULT;

  // CHECK 10 — Items exist (in the attempt's order). Since 03 Q4 the
  // attempt's own rows, not the live bank: read with the service role,
  // which is safe here because CHECK 4 above settled ownership (or the
  // caller is an admin in preview).
  const rows = await readAttemptItems(createServiceRoleClient(), attempt.attempt_id);
  if (!rows.length) {
    return { kind: 'error', title: 'No Questions', message: 'The questions for this quiz could not be loaded. Please contact support.', exit };
  }

  // The cut. A live sitting gets the public half; the secret half goes
  // only where the rule allows it.
  const unsealAll = reviewMode || previewMode || attempt.status !== 'in_progress';
  const feedbackEach = modeOf(attempt.mode).feedback === 'each';
  const items = rows.map(sealItem);
  const secrets: SecretsMap = {};
  for (const row of rows) {
    if (unsealAll || (feedbackEach && row.graded_utc !== null)) secrets[row.item_id] = secretOf(row);
  }

  return { kind: 'ok', attempt, items, secrets, questionsPerPage, reviewMode, previewMode, exit };
}
