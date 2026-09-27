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
// Four modes in two groups, as MyNclex has them (§8 S21, Sam 2026-09-27:
// four now, not later): Study — Learning and Untimed practice; Exam — Free
// Navigation and Sequential. MyNclex's adaptive test is left out (it needs
// a calibrated engine), and its "Timed practice" too (its pausing clock is
// unbuilt there; with a wall clock it is Free Navigation renamed). The
// stored code is MyNclex's and never shown; the names are words and can
// change without touching the database — MyNclex's own are interim.
//
// No database, no server: the runner, the builder and the list pages all
// read it.

import { ATTEMPT_MODES, type AttemptMode } from './types';

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
  /** Free: any question, in any order. Forward: one at a time, no going back (the database holds it). */
  nav: 'free' | 'forward';
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
  /** The "Don't show this again" key; legacy's two for the modes it had, so a student's choice survives. */
  skipKey: string;
};

// The words the two quiz-like modes share, and the two exam-like ones.
const QUIZ_WORDS = {
  title: 'Study Quiz',
  start: 'Start Quiz',
  resume: 'Resume Attempt',
  starting: '',
  startFailed: '',
  submit: 'Submit Quiz',
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
};

const EXAM_WORDS = {
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
};

export const MODES: Record<AttemptMode, ModeDef> = {
  UNTIMED_LEARNING: {
    code: 'UNTIMED_LEARNING',
    group: 'study',
    groupLabel: 'Study',
    name: 'Learning',
    fullName: 'Study · Learning',
    clock: 'none',
    feedback: 'each',
    nav: 'free',
    brief: "You'll see the correct answer and its rationale straight after each question, and you can move between questions freely. There's no clock.",
    card: 'See the correct answer and its rationale after each question. No clock. Best for learning and revision.',
    words: { ...QUIZ_WORDS, listStart: 'Start Learning', listResume: 'Resume Learning', reviewButton: 'Review Answers' },
    skipKey: 'qa_skip_preflight',
  },
  UNTIMED_TEST: {
    code: 'UNTIMED_TEST',
    group: 'study',
    groupLabel: 'Study',
    name: 'Untimed practice',
    fullName: 'Study · Untimed practice',
    clock: 'none',
    feedback: 'end',
    nav: 'free',
    brief: "Answer in any order and change your answers until you submit. There's no clock; your results and the rationales arrive when you finish.",
    card: 'Answer everything first, then see your results and rationales. No clock. Tests what you know without the pressure of time.',
    words: { ...QUIZ_WORDS, listStart: 'Start Practice', listResume: 'Resume Practice', reviewButton: 'Review Answers & Feedback' },
    skipKey: 'qa_skip_preflight_untimed',
  },
  TIMED_FREE_NAV: {
    code: 'TIMED_FREE_NAV',
    group: 'exam',
    groupLabel: 'Exam',
    name: 'Free Navigation',
    fullName: 'Exam · Free Navigation',
    clock: 'wall',
    feedback: 'end',
    nav: 'free',
    brief: "The clock starts when you begin and keeps running whether you're on the page or not. Answer in any order and change answers until you submit; rationales arrive at the end.",
    card: 'A clock that keeps running. Answer in any order; results and rationales at the end. Simulates the real exam.',
    words: { ...EXAM_WORDS, listStart: 'Start Exam', listResume: 'Resume Exam' },
    skipKey: 'qa_skip_preflight_timed',
  },
  TIMED_SEQUENTIAL: {
    code: 'TIMED_SEQUENTIAL',
    group: 'exam',
    groupLabel: 'Exam',
    name: 'Sequential',
    fullName: 'Exam · Sequential',
    clock: 'wall',
    feedback: 'end',
    nav: 'forward',
    brief: "The clock starts when you begin and keeps running whether you're on the page or not. Questions come one at a time: answer each one to move on, and you cannot go back to it. Rationales arrive at the end.",
    card: 'One question at a time with no going back, and a clock that keeps running. The closest to the real exam.',
    words: {
      ...EXAM_WORDS,
      listStart: 'Start Sequential Exam',
      listResume: 'Resume Sequential Exam',
      flaggedEmptySub: '',
      exitText: 'The timer will keep running. Your answers so far are saved and you can resume from your learning history — at the question you reached, and the clock does not stop.',
    },
    skipKey: 'qa_skip_preflight_sequential',
  },
};

/** Every mode in the order they are offered: Study's, then Exam's. */
export const MODE_ORDER: AttemptMode[] = [...ATTEMPT_MODES];

/** The two groups, as headings, in their order. */
export const MODE_GROUPS: { group: ModeGroup; label: string }[] = [
  { group: 'study', label: 'Study' },
  { group: 'exam', label: 'Exam' },
];

/** Legacy's two words, as a browser may still hold them (the builder's remembered setups). */
const LEGACY_CODES: Record<string, AttemptMode> = { instant: 'UNTIMED_LEARNING', timed: 'TIMED_FREE_NAV' };

/** A stored or remembered code as one of the four; an unknown one reads as Learning. */
export function normaliseMode(code: string | null | undefined): AttemptMode {
  const c = String(code ?? '');
  if ((ATTEMPT_MODES as readonly string[]).includes(c)) return c as AttemptMode;
  return Object.prototype.hasOwnProperty.call(LEGACY_CODES, c) ? LEGACY_CODES[c] : 'UNTIMED_LEARNING';
}

/** A code's row (the database's CHECK allows only the four). */
export function modeOf(code: string | null | undefined): ModeDef {
  return MODES[normaliseMode(code)];
}

/** A list of codes in the table's order, each once, unknown ones dropped. */
export function orderModes(codes: readonly string[] | null | undefined): AttemptMode[] {
  const set = new Set((codes ?? []).map((c) => String(c)));
  return MODE_ORDER.filter((m) => set.has(m));
}

/** A quiz's allowed modes in words: "Study · Learning, Exam · Free Navigation". */
export function modesLabel(codes: readonly string[] | null | undefined): string {
  const list = orderModes(codes);
  return list.length ? list.map((m) => MODES[m].fullName).join(', ') : '—';
}

/** The start screen's line for a sitting: the brief, and the minutes when the mode has a clock. */
export function preflightBrief(mode: ModeDef, durationMin: number | null): string {
  if (mode.clock === 'none' || !durationMin || durationMin <= 0) return mode.brief;
  return `${mode.brief} You have about ${durationMin} minute${durationMin === 1 ? '' : 's'}.`;
}
