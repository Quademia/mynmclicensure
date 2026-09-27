// lib/attempts/modes.ts
//
// The mode table (03 Q8, Sam 2026-09-27): what each mode of a sitting is
// called and how it behaves, in one place — MyNclex's shape
// (lib/practice/runner/mode-brief.ts and builder/filter-config.ts there).
// The runner asks this table three questions — is there a clock, when
// does feedback show, can the student move freely — instead of asking
// "instant or timed?", and every page names a mode from here. Before Q8
// the names were spelt in seven places ("Practice Quiz", "Instant
// feedback", "Instant", "Practice only"…).
//
// Modes sit in two groups, Study and Exam, as MyNclex's do. The stored
// code is fixed and never shown; the names are words and can change
// without touching the database. Today the codes are legacy's two,
// `instant` (Learning) and `timed` (Free Navigation); §8 S21 brings
// MyNclex's four codes and the other two modes, Untimed practice and
// Sequential.
//
// No database, no server: the runner, the builder and the list pages all
// read it.

import type { AttemptMode } from './types';

export type ModeGroup = 'study' | 'exam';

export type ModeDef = {
  /** The stored code (attempts.mode). */
  code: AttemptMode;
  group: ModeGroup;
  /** "Study" / "Exam" — the heading the mode sits under. */
  groupLabel: string;
  /** The mode's own name: "Learning", "Free Navigation". */
  name: string;
  /** Where a mode is named in full: "Study · Learning". */
  fullName: string;
  /** A wall clock runs from the server-stamped start, whether the student is there or not. */
  clock: 'none' | 'wall';
  /** When the answer and its rationale show: straight after each question, or at the end. */
  feedback: 'each' | 'end';
  /** How the student moves: freely (Sequential's forward-only comes with S21). */
  nav: 'free';
  /** The start screen's "what happens" line; a clocked mode adds its minutes. */
  brief: string;
  /** The Quiz Builder's card. */
  card: string;
  /** The runner's words, and the quiz lists' two buttons (listStart, listResume). */
  words: {
    listStart: string;
    listResume: string;
    title: string;
    start: string;
    resume: string;
    starting: string;
    startFailed: string;
    submit: string;
    reviewButton: string;
    reviewBanner: string;
    flaggedEmptySub: string;
    exitTitle: string;
    exitText: string;
    preflightNew: string;
    preflightResume: string;
    resumed: string;
    reviewingLog: string;
    submittedLog: string;
    savedLog: string;
  };
  /** The "Don't show this again" key; legacy's two, so a student's choice survives. */
  skipKey: string;
};

export const MODES: Record<AttemptMode, ModeDef> = {
  instant: {
    code: 'instant',
    group: 'study',
    groupLabel: 'Study',
    name: 'Learning',
    fullName: 'Study · Learning',
    clock: 'none',
    feedback: 'each',
    nav: 'free',
    brief: "You'll see the correct answer and its rationale straight after each question, and you can move between questions freely. There's no clock.",
    card: 'See the correct answer and its rationale after each question. No clock. Best for learning and revision.',
    words: {
      listStart: 'Start Learning',
      listResume: 'Resume Learning',
      title: 'Study Quiz',
      start: 'Start Quiz',
      resume: 'Resume Attempt',
      starting: '',
      startFailed: '',
      submit: 'Submit Quiz',
      reviewButton: 'Review Answers',
      reviewBanner: 'Review Mode — Answers are read-only. You are reviewing a completed attempt.',
      flaggedEmptySub: 'Flag questions during the quiz, then switch back here to review only those questions.',
      exitTitle: 'Leave this quiz?',
      exitText: 'Your progress will be saved and you can resume later from your learning history.',
      preflightNew: 'Review the quiz details then click Start Quiz when ready.',
      preflightResume: 'You have an in-progress attempt. Click Resume Attempt when ready.',
      resumed: 'Resuming your in-progress attempt. Your saved answers have been restored.',
      reviewingLog: 'Reviewing your completed attempt. All answers and feedback are shown read-only.',
      submittedLog: 'Quiz submitted. Review your answers below.',
      savedLog: 'Progress saved. You can resume from your learning history.',
    },
    skipKey: 'qa_skip_preflight',
  },
  timed: {
    code: 'timed',
    group: 'exam',
    groupLabel: 'Exam',
    name: 'Free Navigation',
    fullName: 'Exam · Free Navigation',
    clock: 'wall',
    feedback: 'end',
    nav: 'free',
    brief: "The clock starts when you begin and keeps running whether you're on the page or not. Answer in any order and change answers until you submit; rationales arrive at the end.",
    card: 'A clock that keeps running. Answer in any order; results and rationales at the end. Simulates the real exam.',
    words: {
      listStart: 'Start Exam',
      listResume: 'Resume Exam',
      title: 'Exam Quiz',
      start: 'Start Exam',
      resume: 'Resume Exam',
      starting: 'Starting your exam…',
      startFailed: 'We could not start your exam properly. Please try again.',
      submit: 'Submit Exam',
      reviewButton: 'Review Answers & Feedback',
      reviewBanner: 'Review Mode — Answers are read-only. You are reviewing a completed exam attempt.',
      flaggedEmptySub: 'Flag questions during the exam, then switch back here to review only those questions.',
      exitTitle: 'Leave this exam?',
      exitText: 'The timer will keep running. Your progress will be saved and you can resume from your learning history — but the clock does not stop.',
      preflightNew: 'Read the exam details carefully then click Start Exam when ready.',
      preflightResume: 'You have an in-progress exam. Click Resume Exam when ready.',
      resumed: 'Resuming your in-progress exam. Your saved answers have been restored.',
      reviewingLog: 'Reviewing your completed exam. All answers and feedback are shown read-only.',
      submittedLog: 'Exam submitted. Review your answers below.',
      savedLog: 'Progress saved.',
    },
    skipKey: 'qa_skip_preflight_timed',
  },
};

/** Every mode in the order they are offered: Study's, then Exam's. */
export const MODE_ORDER: AttemptMode[] = ['instant', 'timed'];

/** The two groups, as headings, in their order. */
export const MODE_GROUPS: { group: ModeGroup; label: string }[] = [
  { group: 'study', label: 'Study' },
  { group: 'exam', label: 'Exam' },
];

/** A stored code's row; an unknown code reads as Learning (the database's CHECK allows only the codes above). */
export function modeOf(code: string | null | undefined): ModeDef {
  return MODES[code as AttemptMode] ?? MODES.instant;
}

/** The start screen's line for a sitting: the brief, and the minutes when the mode has a clock. */
export function preflightBrief(mode: ModeDef, durationMin: number | null): string {
  if (mode.clock === 'none' || !durationMin || durationMin <= 0) return mode.brief;
  return `${mode.brief} You have about ${durationMin} minute${durationMin === 1 ? '' : 's'}.`;
}
