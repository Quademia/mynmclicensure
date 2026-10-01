// lib/attempts/report.ts — the attempt report (03 Q10, Sam 2026-09-30).
//
// One finished sitting read back as a debrief: how it went, where the
// student slipped — the same sitting cut by topic, difficulty, subject
// and question type, weakest first — what to practise next, and every
// question by its number. MyNclex's shape (lib/practice/report/derive
// there), cut to what this product's questions carry.
//
// Sam's rulings: its own page (not the pop-up, not the review's head);
// a view is offered when the sitting has two or more values on it,
// decided from the sitting's own questions — nothing here knows which
// course is tagged how, so a course tagged later shows its view with no
// change here (Sam: the empty columns on dev are not forever); advice
// only from a topic with at least MIN_QUESTIONS_TO_JUDGE questions (a
// fixed quiz is 100–180 questions, so most topics reach it).
//
// Two halves: the read, one request for the sitting's rows with the
// columns the sums need and no question text (a 180-question sitting is
// a few KB on a phone); and the sums, plain functions with no server or
// browser, checked from a script with made-up rows. The page computes
// everything on the server and hands the client plain numbers.

import type { ServerSupabaseClient } from '@/lib/access';

/** A topic needs this many questions in the sitting before it is judged or advised on. */
export const MIN_QUESTIONS_TO_JUDGE = 3;
/** The rows a view shows before "Show all". */
export const ROWS_SHOWN_FIRST = 8;
/** The weakest topics offered as things to practise. */
export const FIX_LIST_TOPICS = 3;
/** The questions named as taking longest. */
export const SLOWEST_SHOWN = 3;

/** What a question with no value on a view is listed as (08 B5's word). */
export const NOT_SET = 'Not set';

/** One question of the sitting, as the report reads it. */
export type ReportRow = {
  position: number;
  question_type: string;
  subject: string | null;
  maintopic: string | null;
  difficulty: string | null;
  chosen: string | null;
  is_correct: boolean | null;
  time_spent_s: number | null;
};

const REPORT_COLUMNS = 'position, question_type, subject, maintopic, difficulty, chosen, is_correct, time_spent_s';

/**
 * The sitting's rows in order, on the student's own client: the policy
 * lets a student read their own sittings' rows, and every column named is
 * in the browser role's grant. One attempt's rows (AGENTS.md rule 10's
 * exemption). null on an error.
 */
export async function readReportRows(db: ServerSupabaseClient, attemptId: string): Promise<ReportRow[] | null> {
  const { data, error } = await db
    .from('attempt_items')
    .select(REPORT_COLUMNS)
    .eq('attempt_id', attemptId)
    .order('position', { ascending: true });
  if (error) {
    console.error('readReportRows:', error);
    return null;
  }
  return (data ?? []) as ReportRow[];
}

// ── the sums ─────────────────────────────────────────────────────────

export type Outcome = 'correct' | 'wrong' | 'unanswered';

/** A question's outcome: no answer is unanswered; otherwise the server's grade from the finish. */
export function outcomeOf(row: ReportRow): Outcome {
  if (!String(row.chosen ?? '').trim()) return 'unanswered';
  return row.is_correct === true ? 'correct' : 'wrong';
}

export type OutcomeCounts = { correct: number; wrong: number; unanswered: number; total: number };

export function outcomeCounts(rows: readonly ReportRow[]): OutcomeCounts {
  const counts: OutcomeCounts = { correct: 0, wrong: 0, unanswered: 0, total: rows.length };
  for (const row of rows) counts[outcomeOf(row)]++;
  return counts;
}

export type ViewKey = 'maintopic' | 'difficulty' | 'subject' | 'question_type';

/** The views in the order their tabs show; `plural` names the rows in "Show all 31 topics". */
export const REPORT_VIEWS: readonly { key: ViewKey; label: string; plural: string }[] = [
  { key: 'maintopic', label: 'Topic', plural: 'topics' },
  { key: 'difficulty', label: 'Difficulty', plural: 'levels' },
  { key: 'subject', label: 'Subject', plural: 'subjects' },
  { key: 'question_type', label: 'Question type', plural: 'types' },
];

export type BreakdownRow = {
  value: string;
  correct: number;
  total: number;
  /** correct / total, rounded */
  pct: number;
  /** enough questions to judge (MIN_QUESTIONS_TO_JUDGE) */
  judged: boolean;
  /** the questions with no value on this view */
  notSet: boolean;
};

export type Breakdown = { key: ViewKey; label: string; plural: string; rows: BreakdownRow[] };

function valueOf(row: ReportRow, key: ViewKey): string {
  return String(row[key] ?? '').trim();
}

// Weakest first; at the same percentage the topic with more questions,
// the surer signal; then by name so the order never shuffles.
function weakestFirst(a: BreakdownRow, b: BreakdownRow): number {
  return a.pct - b.pct || b.total - a.total || a.value.localeCompare(b.value);
}

/**
 * The sitting cut by one view: the questions judged first, weakest
 * first; then those too few to judge, in the same order; the questions
 * with no value last, as "Not set".
 */
export function breakdownBy(rows: readonly ReportRow[], key: ViewKey): BreakdownRow[] {
  const groups = new Map<string, { correct: number; total: number }>();
  for (const row of rows) {
    const value = valueOf(row, key);
    const g = groups.get(value) ?? { correct: 0, total: 0 };
    g.total++;
    if (outcomeOf(row) === 'correct') g.correct++;
    groups.set(value, g);
  }
  const all: BreakdownRow[] = [...groups].map(([value, g]) => ({
    value: value || NOT_SET,
    correct: g.correct,
    total: g.total,
    pct: Math.round((g.correct / g.total) * 100),
    judged: g.total >= MIN_QUESTIONS_TO_JUDGE,
    notSet: !value,
  }));
  const set = all.filter((r) => !r.notSet);
  return [
    ...set.filter((r) => r.judged).sort(weakestFirst),
    ...set.filter((r) => !r.judged).sort(weakestFirst),
    ...all.filter((r) => r.notSet),
  ];
}

/**
 * The views this sitting has something to say on: two or more real
 * values. A sitting all from one course's subject-less questions, or all
 * multiple choice, has no Subject or Question type tab — until its
 * questions carry them.
 */
export function offeredBreakdowns(rows: readonly ReportRow[]): Breakdown[] {
  return REPORT_VIEWS.map((v) => ({ ...v, rows: breakdownBy(rows, v.key) })).filter(
    (b) => b.rows.filter((r) => !r.notSet).length >= 2,
  );
}

export type FixTopic = { topic: string; correct: number; total: number };

/**
 * What to practise next: the weakest topics with enough questions to
 * judge and something missed, at most FIX_LIST_TOPICS. Computed whether
 * or not the Topic view is offered — a sitting all from one topic can
 * still say "practise this". Empty when nothing qualifies; the page says
 * why rather than inventing advice.
 */
export function fixTopics(rows: readonly ReportRow[]): FixTopic[] {
  return breakdownBy(rows, 'maintopic')
    .filter((r) => r.judged && !r.notSet && r.pct < 100)
    .slice(0, FIX_LIST_TOPICS)
    .map((r) => ({ topic: r.value, correct: r.correct, total: r.total }));
}

/** Whether any topic in the sitting had enough questions to judge (the empty fix list's reason). */
export function anyTopicJudged(rows: readonly ReportRow[]): boolean {
  return breakdownBy(rows, 'maintopic').some((r) => r.judged && !r.notSet);
}

export type TimeFacts = {
  /** the engaged seconds the questions hold, summed */
  engagedS: number;
  /** engaged seconds per answered question, rounded; null with nothing answered */
  paceS: number | null;
  /** the questions that took longest, longest first; `number` is the question's number in the sitting (Q14) */
  slowest: { number: number; seconds: number }[];
};

/**
 * Time on the questions (03 Q11). null when the sitting recorded none —
 * every sitting before 2026-09-29 — so the page leaves time per question
 * out rather than showing "0 s" for a whole quiz.
 */
export function timeFacts(rows: readonly ReportRow[]): TimeFacts | null {
  // The rows arrive in the sitting's order, so a row's place is its
  // number — the runner's "Q14", and what ?q= opens in the review.
  const timed = rows
    .map((r, i) => ({ number: i + 1, seconds: r.time_spent_s ?? 0 }))
    .filter((t) => t.seconds > 0);
  if (!timed.length) return null;
  const engagedS = timed.reduce((s, t) => s + t.seconds, 0);
  const answered = rows.filter((r) => outcomeOf(r) !== 'unanswered').length;
  const slowest = [...timed].sort((a, b) => b.seconds - a.seconds || a.number - b.number).slice(0, SLOWEST_SHOWN);
  return { engagedS, paceS: answered ? Math.round(engagedS / answered) : null, slowest };
}

/** 252 → "4 min 12 s"; 58 → "58 s"; 3780 → "1 h 3 min"; null → "—". The results pop-up's words. */
export function formatSeconds(s: number | null): string {
  if (s === null || !Number.isFinite(s) || s < 0) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h) return `${h} h ${m} min`;
  if (m) return sec ? `${m} min ${sec} s` : `${m} min`;
  return `${sec} s`;
}
