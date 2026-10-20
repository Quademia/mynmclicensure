// lib/challenge/queries.ts
//
// The daily challenge's reads (04.25), through the database's own
// functions (04.24) with the service role, for the student the gate names:
// the browser's roles reach none of the challenge's tables. Server-only
// (the service role) — a client component never imports this.

import { getConfig } from '@/lib/catalogue/queries';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ServerSupabaseClient } from '@/lib/access';
import { RUNNER_QUESTIONS_PER_PAGE_DEFAULT, type Attempt, type SealedItem, type SecretsMap } from '@/lib/attempts/types';
import type { QuestionType } from '@/lib/bank/types';
import type { ChallengeCard, ChallengePlay, ChallengePlayStatus, ChallengeSitting, ChallengeToday } from './types';

type Row = Record<string, unknown>;

function str(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v);
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function playFrom(p: unknown): ChallengePlay | null {
  if (!p || typeof p !== 'object') return null;
  const r = p as Row;
  return {
    playId: String(r.play_id),
    challengeId: String(r.challenge_id),
    status: String(r.status) as ChallengePlayStatus,
    startedUtc: String(r.started_utc),
    endsUtc: String(r.ends_utc),
    submittedUtc: str(r.submitted_utc),
    timeTakenS: num(r.time_taken_s),
    right: num(r.right),
    outOf: num(r.out_of),
  };
}

/** challenge_today()'s and start_challenge()'s reply, read. */
export function todayFrom(data: unknown): ChallengeToday | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Row;
  return {
    day: String(d.day),
    programId: str(d.program_id),
    challengeId: str(d.challenge_id),
    courseId: str(d.course_id),
    courseTitle: str(d.course_title),
    questions: num(d.questions) ?? 0,
    minutesPerQuestion: num(d.minutes_per_question) ?? 1,
    play: playFrom(d.play),
  };
}

/** Today's challenge for the student — the paper made if they are the first to open it. Null when the read fails. */
export async function getChallengeToday(userId: string): Promise<ChallengeToday | null> {
  const { data, error } = await createServiceRoleClient().rpc('challenge_today', { p_user_id: userId });
  if (error) {
    console.error('getChallengeToday:', error);
    return null;
  }
  return todayFrom(data);
}

/** "Tuesday 20 October" for a YYYY-MM-DD day (UTC, Ghana's time). */
export function dayLabelOf(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** The start screen's data: today's paper and, for a play going, the seconds left. */
export function challengeCard(today: ChallengeToday): ChallengeCard {
  const play = today.play;
  return {
    courseTitle: today.courseTitle ?? '',
    dayLabel: dayLabelOf(today.day),
    questions: today.questions,
    minutes: Math.round(today.questions * today.minutesPerQuestion * 10) / 10,
    resuming: play !== null,
    secondsLeft: play ? Math.max(0, Math.floor((Date.parse(play.endsUtc) - Date.now()) / 1000)) : null,
  };
}

// challenge_play_lines: the play's lines, or the database's own words.
async function playLines(userId: string, playId: string): Promise<{ ok: true; rows: Row[] } | { ok: false; error: string }> {
  const { data, error } = await createServiceRoleClient().rpc('challenge_play_lines', { p_play_id: playId, p_user_id: userId });
  if (error) {
    const msg = String(error.message || '').trim();
    return { ok: false, error: msg && !/^[a-z_]+:/.test(msg) ? msg : 'Could not open the challenge. Please try again.' };
  }
  const rows = (Array.isArray(data) ? data : []) as Row[];
  return rows.length ? { ok: true, rows } : { ok: false, error: 'Could not open the challenge. Please try again.' };
}

// An ended play's lines carry each answer and explanation (empty before).
function secretsFrom(rows: Row[]): SecretsMap {
  const secrets: SecretsMap = {};
  for (const r of rows) {
    secrets[String(r.item_id)] = {
      correct: String(r.correct ?? ''),
      rationale: str(r.rationale),
      rationale_img: str(r.rationale_img),
      fb_a: str(r.fb_a), fb_b: str(r.fb_b), fb_c: str(r.fb_c),
      fb_d: str(r.fb_d), fb_e: str(r.fb_e), fb_f: str(r.fb_f),
    };
  }
  return secrets;
}

/** An ended play's answers and explanations, for Submit's reply; empty when the read fails. */
export async function readChallengeSecrets(userId: string, playId: string): Promise<SecretsMap> {
  const lines = await playLines(userId, playId);
  return lines.ok ? secretsFrom(lines.rows) : {};
}

/**
 * A play's questions, words from the day's paper (challenge_play_lines):
 * while it is going, the questions and the student's own answers; once it
 * has ended, every answer and explanation too — until the midnight after;
 * then the database refuses, and its words come back as the error.
 */
export async function readChallengeSitting(
  supabase: ServerSupabaseClient,
  userId: string,
  today: ChallengeToday,
): Promise<{ ok: true; sitting: ChallengeSitting } | { ok: false; error: string }> {
  const play = today.play;
  if (!play) return { ok: false, error: 'There is no challenge to open.' };
  const [lines, config] = await Promise.all([playLines(userId, play.playId), getConfig(supabase)]);
  if (!lines.ok) return lines;
  const rows = lines.rows;

  const ended = play.status !== 'playing';
  const items: SealedItem[] = rows.map((r) => ({
    attempt_item_id: Number(r.position),
    attempt_id: play.playId,
    position: Number(r.position),
    item_id: String(r.item_id),
    question_type: String(r.question_type) as QuestionType,
    stem: String(r.stem ?? ''),
    option_a: str(r.option_a), option_b: str(r.option_b), option_c: str(r.option_c),
    option_d: str(r.option_d), option_e: str(r.option_e), option_f: str(r.option_f),
    marks: num(r.marks) ?? 1,
    shuffle_options: r.shuffle_options !== false,
    subject: str(r.subject),
    maintopic: str(r.maintopic),
    subtopic: null,
    difficulty: null,
    chosen: str(r.chosen),
    flagged: r.flagged === true,
    sata_checked: false,
    time_spent_s: num(r.time_spent_s),
    is_correct: typeof r.is_correct === 'boolean' ? r.is_correct : null,
    score_awarded: null,
    answered_utc: str(r.answered_utc),
    graded_utc: null,
    passed_utc: null,
  }));
  const secrets: SecretsMap = ended ? secretsFrom(rows) : {};

  const right = play.right ?? 0;
  const outOf = play.outOf ?? 0;
  // The play in a sitting's shape. `mode` and `source` are placeholders the
  // quiz screen does not read: it takes Challenge mode from its `challenge`.
  const attempt: Attempt = {
    attempt_id: play.playId,
    user_id: userId,
    quiz_id: null,
    course_id: today.courseId ?? '',
    mode: 'UNTIMED_TEST',
    source: 'builder',
    n: items.length,
    seed: null,
    duration_min: (Date.parse(play.endsUtc) - Date.parse(play.startedUtc)) / 60_000,
    status: ended ? 'completed' : 'in_progress',
    score_raw: ended ? right : null,
    score_total: ended ? outOf : null,
    score_pct: ended ? (outOf > 0 ? Math.round((right / outOf) * 100) : 0) : null,
    time_taken_s: play.timeTakenS,
    origin_attempt_id: null,
    display_label: `Today's challenge · ${today.courseTitle ?? ''}`,
    ts_iso: play.startedUtc,
    started_utc: play.startedUtc,
    ended_utc: play.submittedUtc,
  };

  return {
    ok: true,
    sitting: {
      attempt,
      items,
      secrets,
      voided: rows.filter((r) => r.voided === true).map((r) => String(r.item_id)),
      status: play.status,
      questionsPerPage: Number(config.runner_questions_per_page) || RUNNER_QUESTIONS_PER_PAGE_DEFAULT,
    },
  };
}
