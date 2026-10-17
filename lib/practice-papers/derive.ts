// lib/practice-papers/derive.ts
//
// Practice Papers, redesigned (04.7; Sam, 2026-10-12): what the three
// screens say about a paper, worked out from the paper's own row and the
// student's own sittings. Plain TypeScript, no server code and no clock
// of its own beyond what the caller passes in. Nothing here knows a
// paper's size, its time or how many papers a course has — each is read
// from the paper (Sam, 2026-10-12: those numbers can change).
//
// Results on a date (04.12; Sam, 2026-10-15): while a paper's results are
// held, a sitting of it shows its date where the score was — "Results on
// 30 Oct" in a row, the whole date on a card — and no report, and only the
// first sitting's mode is offered. The date is written only through
// lib/quizzes/results-date, in Ghana's time.
//
// The review (04.13; Sam, 2026-10-15): a paper's `review` — Always, Until a
// date, or Not allowed — read live. While it is closed the score, the
// summary and the report stay; Learning is not offered (it shows each
// answer) and a Learning sitting going is not resumed; the other ways stay.
// The card says "Review open until …" while it is open with a date, and
// what a closed one says — but nothing while the results are held, whose
// line is enough.

import type { AttemptMode, AttemptWithProgress } from '@/lib/attempts/types';
import type { Availability } from '@/lib/quizzes/types';
import { closeDue, formatResultsAt, formatResultsShort, resultsHeld, reviewClosed, reviewLine, type ReviewSetting } from '@/lib/quizzes/results-date';

/**
 * The courses a student's pages list — My courses, Practice Papers, and
 * Messages' course picker (08.2): the ones they hold, else their
 * programme's (Sam, 2026-10-11; 2026-10-17 for the picker).
 */
export function studentCourseList<C extends { course_id: string; program_scope?: string[] | null }>(
  all: C[],
  held: Record<string, unknown>,
  programId: string | null,
): C[] {
  const mine = all.filter((c) => held[c.course_id]);
  return mine.length ? mine : all.filter((c) => Boolean(programId) && (c.program_scope ?? []).includes(programId as string));
}

/** What a student's courses let them do with papers. `all` a package; `trial` only the trial paper; `none` nothing live. */
export type PaperAccess = 'all' | 'trial' | 'none';

/** The paper's own row, as the page reads it. */
export type PaperRow = {
  quiz_id: string;
  course_id: string;
  title: string;
  n: number;
  allowed_modes: AttemptMode[];
  first_mode: AttemptMode;
  time_limit_sec: number | null;
  availability: Exclude<Availability, 'HIDDEN'>;
  publish_at: string | null;
  /** The trial paper (03): open to a trial student. */
  in_trial: boolean;
  /** How many sittings a student may make; null = no limit (04.10). */
  sittings_allowed: number | null;
  /** When its results come out; null = Immediately (04.12). */
  results_at: string | null;
  /** The review: Always, Until review_closes_at, or Not allowed (04.13). */
  review: ReviewSetting;
  review_closes_at: string | null;
};

export type PaperState = 'done' | 'in_progress' | 'new';

export type PaperView = PaperRow & {
  /** May this student start it now — the access, not the schedule. */
  open: boolean;
  /** Its results date has not come (04.12): no score shows, and only the first mode is sat. */
  held: boolean;
  /** Its review is closed (04.13): Learning shuts; the score and the summary stay. */
  reviewClosed: boolean;
  /** The card's line about the review (04.13): "Review open until …", or
   *  what a closed one says; null with Always, and while the results are
   *  held (their line is enough). */
  reviewNote: string | null;
  state: PaperState;
  /** The first sitting finished (completed in the first mode), the earliest. */
  firstSitting: AttemptWithProgress | null;
  /** The newest sitting still going, in any mode. */
  inProgress: AttemptWithProgress | null;
  /** Every sitting not abandoned, newest first. */
  sittings: AttemptWithProgress[];
  /** Sittings left under the paper's limit — every sitting started counts,
   *  abandoned too, as the database counts them (04.10); null = no limit. */
  sittingsLeft: number | null;
};

export type CourseView = {
  course_id: string;
  title: string;
  access: PaperAccess;
  /** The package of this course includes mock exams (02.10). */
  mocksIncluded: boolean;
  /** Days left on the stored end, and that end; null with no live grant. */
  days: number | null;
  expires: string | null;
  papers: PaperView[];
};

/** "Practice Paper 3" reads "Paper 3" where the course is already named. */
export function shortName(title: string): string {
  return title.replace(/^Practice\s+/i, '');
}

/** Titles in the order a student counts them: Paper 2 before Paper 10. */
export function byTitle<T extends { title: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.title.localeCompare(b.title, 'en', { numeric: true }));
}

/** A paper's time: its limit, else a minute a question (04, Modes). */
export function paperMinutes(n: number, timeLimitSec: number | null): number {
  return Math.max(1, Math.round((timeLimitSec && timeLimitSec > 0 ? timeLimitSec : n * 60) / 60));
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hours = h ? `${h} hour${h === 1 ? '' : 's'}` : '';
  const mins = m ? `${m} minute${m === 1 ? '' : 's'}` : '';
  return [hours, mins].filter(Boolean).join(' ');
}

export function paperView(
  row: PaperRow,
  access: PaperAccess,
  attempts: AttemptWithProgress[],
  now: Date,
  noun: 'paper' | 'mock' = 'paper',
): PaperView {
  const started = attempts.filter((a) => a.quiz_id === row.quiz_id);
  const mine = started.filter((a) => a.status !== 'abandoned');
  const inProgress = mine.find((a) => a.status === 'in_progress') ?? null; // newest first
  const finished = mine
    .filter((a) => a.status === 'completed' && a.mode === row.first_mode)
    .sort((a, b) => Date.parse(a.ts_iso ?? '') - Date.parse(b.ts_iso ?? ''));
  const firstSitting = finished[0] ?? null;
  const open = access === 'all' || (access === 'trial' && row.in_trial);
  const held = resultsHeld(row.results_at, now);
  return {
    ...row,
    open,
    held,
    reviewClosed: reviewClosed(row.review, row.review_closes_at, now),
    reviewNote: held ? null : reviewLine(row.review, row.review_closes_at, noun, now),
    state: firstSitting ? 'done' : inProgress ? 'in_progress' : 'new',
    firstSitting,
    inProgress,
    sittings: mine,
    sittingsLeft: row.sittings_allowed == null ? null : Math.max(0, row.sittings_allowed - started.length),
  };
}

/** "You can sit this paper 2 times" (before the first), "1 of 2 sittings
 *  left", "You have used your 2 sittings of this paper"; null with no limit. */
export function sittingsLine(p: PaperView, noun: 'paper' | 'mock' = 'paper'): string | null {
  const allowed = p.sittings_allowed;
  if (allowed == null || p.sittingsLeft == null) return null;
  const times = allowed === 1 ? 'once' : `${allowed} times`;
  if (p.sittingsLeft === allowed) return `You can sit this ${noun} ${times}.`;
  if (p.sittingsLeft === 0) {
    return p.inProgress
      ? `Your last sitting of this ${noun} is in progress.`
      : `You have used your ${allowed === 1 ? 'sitting' : `${allowed} sittings`} of this ${noun}.`;
  }
  return `${p.sittingsLeft} of ${allowed} sittings left.`;
}

/** 04.12: the date a sitting's results come out, while they are held; null once they show. */
export function heldUntil(a: Pick<AttemptWithProgress, 'held' | 'results_at'> | null | undefined): string | null {
  return a?.held && a.results_at ? a.results_at : null;
}

/** A finished sitting's word in a row: its score, or "Results on 30 Oct" while held; null with neither. */
export function scoreWord(a: AttemptWithProgress): string | null {
  const until = heldUntil(a);
  if (until) return `Results on ${formatResultsShort(until)}`;
  return a.score_pct != null ? `${Math.round(a.score_pct)}%` : null;
}

/** A card's line while the paper's results are held: "Results on Friday 30 October at 6:00 pm."; null otherwise. */
export function resultsLine(p: PaperView): string | null {
  return p.held && p.results_at ? `Results on ${formatResultsAt(p.results_at)}.` : null;
}

/** "The other ways open when results come out on …" — where the page says
 *  the other ways open after the first sitting; null unless held. */
export function otherWaysLine(p: PaperView): string | null {
  return p.held && p.results_at ? `The other ways open when results come out on ${formatResultsAt(p.results_at)}.` : null;
}

/** 04.13: Learning, while the paper's review is closed — it shows each
 *  answer, so it is not offered and not resumed; the other modes stay. */
export function learningShut(p: Pick<PaperView, 'reviewClosed'>, mode: AttemptMode): boolean {
  return p.reviewClosed && mode === 'UNTIMED_LEARNING';
}

/** The ways other than the first mode a student may take now: the paper's
 *  modes, less Learning while the review is closed (04.13). Empty = the
 *  paper has no other ways. */
export function otherModes(p: PaperView): AttemptMode[] {
  return p.allowed_modes.filter((m) => m !== p.first_mode && !learningShut(p, m));
}

/** While a paper's results are held only its first mode is sat (04.12): a
 *  sitting going in another mode cannot be resumed until the date — it can
 *  still be abandoned. Likewise a Learning sitting while the review is
 *  closed (04.13). */
export function resumable(p: PaperView, a: AttemptWithProgress): boolean {
  return (!p.held || a.mode === p.first_mode) && !learningShut(p, a.mode);
}

/** A paper a student can start or resume today. */
export function startable(p: PaperView): boolean {
  return p.open && p.availability === 'ACTIVE';
}

/** The paper to put first: the one in progress, else the first one not yet done. */
export function upNext(papers: PaperView[]): PaperView | null {
  return (
    papers.find((p) => startable(p) && p.inProgress && resumable(p, p.inProgress)) ??
    papers.find((p) => startable(p) && p.state !== 'done') ??
    null
  );
}

/** The paper to show a score for when nothing can be started (an ended trial, a free account):
 *  one whose score shows before one whose results are held (04.12). */
export function scoredPaper(papers: PaperView[]): PaperView | null {
  return papers.find((p) => p.firstSitting && !heldUntil(p.firstSitting)) ?? papers.find((p) => p.firstSitting) ?? null;
}

/** A line pointing at a scored paper's scores ("Your scores are here"), or its "Results on 30 Oct" while held. */
export function scoresWord(p: PaperView, words: string): string {
  const until = heldUntil(p.firstSitting);
  return until ? `Results on ${formatResultsShort(until)}` : words;
}

export type Segment = 'done' | 'going' | 'todo';

export function segments(papers: PaperView[]): Segment[] {
  return papers.map((p) => (p.state === 'done' ? 'done' : p.state === 'in_progress' ? 'going' : 'todo'));
}

/** The course row's one line. */
export function courseLine(course: CourseView): string {
  const open = course.papers.filter(startable);
  if (!course.papers.length) return 'No papers yet';
  if (!open.length) {
    const scored = scoredPaper(course.papers);
    return scored ? scoresWord(scored, 'Your scores are here') : 'Opens with a package';
  }
  const going = open.find((p) => p.inProgress);
  if (going) return `${shortName(going.title)} in progress`;
  const next = open.find((p) => p.state !== 'done');
  return next ? `Next: ${shortName(next.title)}` : 'All done';
}

/** 04.14: a sitting going after its paper or mock closed — the card's line
 *  and its one way in, straight to the sitting. An exam whose own clock
 *  still runs is resumed; any other is finished at the close when opened
 *  ("See your score"); with nothing answered it will be Abandoned, so the
 *  line alone. */
export function closedGoingWay(
  a: AttemptWithProgress,
  noun: 'paper' | 'mock',
  now: Date = new Date(),
): { line: string | null; label: string | null } {
  if (a.mode.startsWith('TIMED_') && a.started_utc) {
    const end = new Date(a.started_utc).getTime() + (a.duration_min ?? 0) * 60_000;
    if (end > now.getTime()) return { line: `This ${noun} has closed. Your sitting runs to the end of its time.`, label: 'Resume' };
    return { line: null, label: 'See your score' };
  }
  const day = a.closes_at ? ` on ${formatDay(a.closes_at)}` : '';
  if (!a.answered_count) {
    return { line: `This ${noun} closed${day} before you answered any question, so this sitting won't be scored.`, label: null };
  }
  return {
    line: `This ${noun} closed${day}, so this sitting is finished on what you answered.`,
    label: a.held ? 'See your sitting' : 'See your score',
  };
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** The right-hand word of a paper's row. Done is the first sitting's status,
 *  not its score: a held one shows its date (04.12). */
export function rowStatus(p: PaperView): string {
  if (p.state === 'done') return (p.firstSitting && scoreWord(p.firstSitting)) ?? 'Finished';
  // 04.14: a sitting due to be finished at the paper's close is not going on
  if (p.state === 'in_progress') return p.inProgress && closeDue(p.inProgress) ? 'Closed' : 'In progress';
  if (!p.open) return 'Opens with a package';
  if (p.availability === 'UPCOMING') return p.publish_at ? `Opens ${formatDay(p.publish_at)}` : 'Not yet open';
  if (p.availability === 'CLOSED') return 'Closed';
  return 'Not started';
}
