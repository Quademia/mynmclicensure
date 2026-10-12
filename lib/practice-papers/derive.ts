// lib/practice-papers/derive.ts
//
// Practice Papers, redesigned (04.7; Sam, 2026-10-12): what the three
// screens say about a paper, worked out from the paper's own row and the
// student's own sittings. Plain TypeScript, no server code and no clock
// of its own beyond what the caller passes in. Nothing here knows a
// paper's size, its time or how many papers a course has — each is read
// from the paper (Sam, 2026-10-12: those numbers can change).

import type { AttemptMode, AttemptWithProgress } from '@/lib/attempts/types';
import type { Availability } from '@/lib/quizzes/types';

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
};

export type PaperState = 'done' | 'in_progress' | 'new';

export type PaperView = PaperRow & {
  /** May this student start it now — the access, not the schedule. */
  open: boolean;
  state: PaperState;
  /** The first sitting finished (completed in the first mode), the earliest. */
  firstSitting: AttemptWithProgress | null;
  /** The newest sitting still going, in any mode. */
  inProgress: AttemptWithProgress | null;
  /** Every sitting not abandoned, newest first. */
  sittings: AttemptWithProgress[];
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

export function paperView(row: PaperRow, access: PaperAccess, attempts: AttemptWithProgress[]): PaperView {
  const mine = attempts.filter((a) => a.quiz_id === row.quiz_id && a.status !== 'abandoned');
  const inProgress = mine.find((a) => a.status === 'in_progress') ?? null; // newest first
  const finished = mine
    .filter((a) => a.status === 'completed' && a.mode === row.first_mode)
    .sort((a, b) => Date.parse(a.ts_iso ?? '') - Date.parse(b.ts_iso ?? ''));
  const firstSitting = finished[0] ?? null;
  const open = access === 'all' || (access === 'trial' && row.in_trial);
  return {
    ...row,
    open,
    state: firstSitting ? 'done' : inProgress ? 'in_progress' : 'new',
    firstSitting,
    inProgress,
    sittings: mine,
  };
}

/** A paper a student can start or resume today. */
export function startable(p: PaperView): boolean {
  return p.open && p.availability === 'ACTIVE';
}

/** The paper to put first: the one in progress, else the first one not yet done. */
export function upNext(papers: PaperView[]): PaperView | null {
  return (
    papers.find((p) => startable(p) && p.inProgress) ??
    papers.find((p) => startable(p) && p.state !== 'done') ??
    null
  );
}

/** The paper to show a score for when nothing can be started (an ended trial, a free account). */
export function scoredPaper(papers: PaperView[]): PaperView | null {
  return papers.find((p) => p.firstSitting) ?? null;
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
    return course.papers.some((p) => p.firstSitting) ? 'Your scores are here' : 'Opens with a package';
  }
  const going = open.find((p) => p.inProgress);
  if (going) return `${shortName(going.title)} in progress`;
  const next = open.find((p) => p.state !== 'done');
  return next ? `Next: ${shortName(next.title)}` : 'All done';
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** The right-hand word of a paper's row. */
export function rowStatus(p: PaperView): string {
  if (p.state === 'done' && p.firstSitting?.score_pct != null) return `${Math.round(p.firstSitting.score_pct)}%`;
  if (p.state === 'in_progress') return 'In progress';
  if (!p.open) return 'Opens with a package';
  if (p.availability === 'UPCOMING') return p.publish_at ? `Opens ${formatDay(p.publish_at)}` : 'Not yet open';
  if (p.availability === 'CLOSED') return 'Closed';
  return 'Not started';
}
