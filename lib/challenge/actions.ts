// lib/challenge/actions.ts
//
// The daily challenge's writes (04.25) as Server Actions behind the
// student gate, each one call to the database's own function (04.24) with
// the service role and the gate's student: the function refuses a play
// that is not theirs, one already ended, or a save past the time. Its
// messages are written for the student and pass through.

'use server';

import { requireStudent } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { chosenToStored } from '@/lib/attempts/scoring';
import { TIME_SPENT_MAX_S, type ActionResult, type AnswerPatch } from '@/lib/attempts/types';
import { getChallengeRanks } from '@/lib/leaderboards/queries';
import { readChallengeSecrets, readChallengeSitting, todayFrom } from './queries';
import type { ChallengeFinishResult, ChallengeStartResult } from './types';

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

// A function's own sentence is for the student; a diagnostic prefixed with
// a name becomes the general words (as lib/attempts/actions.ts).
function rpcError(error: { message?: string } | null, fallback: string): string {
  const msg = String(error?.message || '').trim();
  return msg && !/^[a-z_]+:/.test(msg) ? msg : fallback;
}

// Start on the start screen: one play a day — a play going is resumed —
// the time limit fixed by the server, then the questions: the first moment
// they reach the browser.
export async function startChallenge(): Promise<ChallengeStartResult> {
  const { supabase, profile } = await requireStudent();
  const { data, error } = await createServiceRoleClient().rpc('start_challenge', { p_user_id: profile.user_id });
  if (error) return fail(rpcError(error, 'Could not start the challenge. Please try again.'));
  const today = todayFrom(data);
  if (!today?.play) return fail('Could not start the challenge. Please try again.');
  return readChallengeSitting(supabase, profile.user_id, today);
}

// The quiz screen's save-per-tap, as saveAnswers takes it: one patch per
// question, each key optional. No Check Answer: the challenge shows its
// answers after Submit.
export async function saveChallengeAnswers(playId: string, rows: AnswerPatch[]): Promise<ActionResult> {
  const { profile } = await requireStudent();
  const safe = (Array.isArray(rows) ? rows : [])
    .filter((r) => r && typeof r.item_id === 'string' && r.item_id)
    .map((r) => {
      const patch: AnswerPatch = { item_id: r.item_id };
      if ('chosen' in r) patch.chosen = chosenToStored(r.chosen);
      if ('flagged' in r) patch.flagged = Boolean(r.flagged);
      if ('time_spent_s' in r) patch.time_spent_s = r.time_spent_s === null ? null : Math.min(TIME_SPENT_MAX_S, Math.max(0, Math.floor(Number(r.time_spent_s) || 0)));
      return patch;
    });
  if (!safe.length) return { ok: true };
  const { error } = await createServiceRoleClient().rpc('save_challenge_answers', {
    p_play_id: String(playId || ''),
    p_user_id: profile.user_id,
    p_rows: safe,
  });
  if (error) return fail(rpcError(error, 'Could not save your answers.'));
  return { ok: true };
}

// Submit, or the clock running out: marked against the paper, timed by the
// server (past the limit it closes as time up). The play being over, the
// reply carries every question's answer and explanation, so the answers
// show without a reload, and today's and this week's places for the
// results (05 G1b) — no second trip from the phone.
export async function submitChallenge(playId: string): Promise<ChallengeFinishResult> {
  const { profile } = await requireStudent();
  const { data, error } = await createServiceRoleClient().rpc('submit_challenge', {
    p_play_id: String(playId || ''),
    p_user_id: profile.user_id,
  });
  if (error) return fail(rpcError(error, 'Could not submit the challenge.'));
  const r = (data ?? {}) as { right?: number; out_of?: number; time_taken_s?: number | null };
  const raw = Number(r.right) || 0;
  const total = Number(r.out_of) || 0;
  // the answers, read back through the function the page reads them by,
  // beside the places
  const [secrets, ranks] = await Promise.all([
    readChallengeSecrets(profile.user_id, String(playId || '')),
    getChallengeRanks(profile.user_id, Boolean(profile.school_id)),
  ]);

  return {
    ok: true,
    held: false,
    score: { raw, total, pct: total > 0 ? Math.round((raw / total) * 100) : 0 },
    secrets,
    timeTakenS: r.time_taken_s === null || r.time_taken_s === undefined ? null : Number(r.time_taken_s),
    reviewClosed: null,
    ranks,
  };
}
