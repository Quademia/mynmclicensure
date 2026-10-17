// lib/history/types.ts — Learning History (05.5, 05 Q12; Sam, 2026-10-17).
//
// What the page receives: each row already worded on the server — its
// name, course, mode, day, the one thing on its right, where a tap goes
// and what its three dots offer — so the browser formats nothing and a
// Load more page arrives in the same shape as the first.

/** A sitting's kind, for the figures and the words: a retake is its original's. */
export type HistoryKind = 'paper' | 'mock' | 'builder';

/** One line of a row's menu (the three dots). */
export type HistoryMenuLine =
  | { kind: 'resume'; href: string }
  | { kind: 'abandon'; sittingsAllowed: number | null }
  | { kind: 'report'; href: string }
  | { kind: 'review'; href: string }
  | { kind: 'retake' }
  /** Told in grey, not tapped: "Review closed on 4 November", "No sittings left". */
  | { kind: 'note'; text: string; icon: 'lock' | 'hourglass' }
  /** Needs a package: a lock and the way to one (03, an ended student). */
  | { kind: 'locked'; label: string };

/** The one thing on a row's right. */
export type HistoryRight =
  | { kind: 'score'; pct: number }
  | { kind: 'resume' }
  | { kind: 'held'; text: string }
  | { kind: 'abandoned' };

export type HistoryRow = {
  attemptId: string;
  name: string;
  courseTitle: string;
  modeName: string;
  /** "Today", "Yesterday", "14 Oct", "14 Oct 2025" — in Ghana's time (UTC). */
  day: string;
  right: HistoryRight;
  /** Where a tap on the row goes: the report, or the sitting to resume; null opens nothing. */
  href: string | null;
  menu: HistoryMenuLine[];
};

export type HistoryChunk = { rows: HistoryRow[]; total: number };

/** The figures over the whole history, or one course's (student_history_figures). */
export type HistoryFigures = {
  sittings: number;
  averagePct: number | null;
  bestPct: number | null;
  papers: number;
  mocks: number;
  builder: number;
  free: number;
};

export type HistoryCourse = { course_id: string; title: string };
