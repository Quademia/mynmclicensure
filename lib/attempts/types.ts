// lib/attempts/types.ts
//
// Attempts as the app reads them (slice 6a): the row (db/schema.sql, the
// legacy nineteen columns), the answer record the runners store in
// `answers_json`, the config keys the runner and the builder read with
// the legacy fallbacks (rebuild.md §9 #11: equal to the seed), and what
// the Server Actions return. Constants live here, not in actions.ts — a
// 'use server' module exports only async functions.

import type { QuestionType } from '@/lib/bank/types';

// The four modes (§8 S21, 03 Q8; Sam 2026-09-27), MyNclex's stored codes:
// Study — Learning, Untimed practice; Exam — Free Navigation, Sequential.
// Their names and behaviour live in ./modes. Legacy's `instant` is
// UNTIMED_LEARNING and `timed` TIMED_FREE_NAV.
export const ATTEMPT_MODES = ['UNTIMED_LEARNING', 'UNTIMED_TEST', 'TIMED_FREE_NAV', 'TIMED_SEQUENTIAL'] as const;
export type AttemptMode = (typeof ATTEMPT_MODES)[number];
export type AttemptSource = 'fixed' | 'builder' | 'retake' | 'mock';
export type AttemptStatus = 'in_progress' | 'completed' | 'abandoned';

export type Attempt = {
  attempt_id: string;
  user_id: string;
  quiz_id: string | null;
  course_id: string;
  mode: AttemptMode;
  source: AttemptSource;
  n: number;
  seed: string | null;
  duration_min: number | null;
  status: AttemptStatus;
  score_raw: number | null;
  score_total: number | null;
  score_pct: number | null;
  time_taken_s: number | null;
  origin_attempt_id: string | null;
  display_label: string | null;
  /** when the attempt was created */
  ts_iso: string | null;
  /** the timed clock's anchor, set once by the start function (03 Q5 writes it) */
  started_utc: string | null;
  /** finish, expiry (the true deadline) or abandon (03 Q5 writes it) */
  ended_utc: string | null;
  /**
   * 04.12, from student_attempts() only (a student's own read): the
   * paper's or mock's results date, and whether it has yet to come. While
   * `held`, the three scores come back empty. An admin's read of the
   * table carries neither.
   */
  results_at?: string | null;
  held?: boolean;
  /**
   * 04.13, from student_attempts() only: the paper's or mock's review
   * setting ('always' | 'until' | 'never'), its closing date, and whether
   * it is closed now — then the score and summary stay, the answers do not.
   */
  review?: string | null;
  review_closes_at?: string | null;
  review_closed?: boolean;
  /**
   * 04.14, from student_attempts() only: the paper's or mock's close
   * (unpublish_at). A sitting going past it with no clock running is
   * finished there (closeDue, lib/quizzes/results-date).
   */
  closes_at?: string | null;
};

// One row of attempt_items (03 Q4): the question as the bank served it
// the day the attempt was created — copied table to table, never
// updated — plus the answer group the server writes (Q5). The row is
// split in two types by the seal (Q6; D5):
//
//   SealedItem  — the public half and the answer group. What a LIVE
//                 runner receives. The type has no `correct`, so runner
//                 code cannot read the key off a question: the key
//                 arrives only through the secrets map the server fills.
//   SecretHalf  — the key, the rationale and the per-option feedback.
//                 Sent for one question at a time in instant mode (the
//                 check_answer reply, and on resume the rows already
//                 graded), for none of them in a live exam, and for all
//                 of them in review. Revoked from the browser role at the
//                 grant, so a console query is refused by the database.
//   AttemptItem — the whole row, server-side only (readAttemptItems with
//                 the service role after an ownership check).
//
// lib/attempts/seal.ts holds the two column lists — the one place the
// row is cut.
export type SecretHalf = {
  /** "b" for MCQ / TF; "a,c,e" for SATA */
  correct: string;
  rationale: string | null;
  rationale_img: string | null;
  fb_a: string | null; fb_b: string | null; fb_c: string | null;
  fb_d: string | null; fb_e: string | null; fb_f: string | null;
};

export type SealedItem = {
  attempt_item_id: number;
  attempt_id: string;
  position: number;
  item_id: string;
  question_type: QuestionType;
  stem: string;
  option_a: string | null; option_b: string | null; option_c: string | null;
  option_d: string | null; option_e: string | null; option_f: string | null;
  marks: number;
  shuffle_options: boolean;
  subject: string | null;
  maintopic: string | null;
  subtopic: string | null;
  difficulty: string | null;
  /** a letter, or a comma list for SATA (the `correct` convention); null = unanswered */
  chosen: string | null;
  flagged: boolean;
  sata_checked: boolean;
  time_spent_s: number | null;
  /** the server's grade: at Check Answer in instant mode, at finish otherwise */
  is_correct: boolean | null;
  score_awarded: number | null;
  answered_utc: string | null;
  graded_utc: string | null;
  /** Sequential only (§8 S21): when the student moved past it; null = not yet */
  passed_utc: string | null;
};

export type AttemptItem = SealedItem & SecretHalf;

/** The secret halves the runner holds, by item id. */
export type SecretsMap = Record<string, SecretHalf>;

// What the runner sends save_answers() (03 Q5): one patch per question,
// every key but item_id optional — an absent key leaves that column
// alone. `chosen` is the stored convention: a letter, or a comma list for
// SATA; null clears it.
export type AnswerPatch = {
  item_id: string;
  chosen?: string | null;
  flagged?: boolean;
  sata_checked?: boolean;
  time_spent_s?: number | null;
};

// 03 Q11 (Sam, 2026-09-29): time per question (lib/attempts/question-clock).
/** One unbroken stretch on a question counts at most this — a screen left on. */
export const QUESTION_STRETCH_CAP_S = 10 * 60;
/** A question's saved total is kept at or under this; the save refuses more. */
export const TIME_SPENT_MAX_S = 3 * 60 * 60;

// The runner's state maps, hydrated from the attempt's rows. MCQ / TF:
// a letter; SATA: an array of letters.
export type ChosenMap = Record<string, string | string[]>;
export type FlagMap = Record<string, boolean>;

/** An attempt with the count of its answered rows (the quiz cards' "N of M answered"). */
export type AttemptWithProgress = Attempt & { answered_count: number };

/** The admin Attempts page's detail modal. */
export type AttemptDetail = Attempt & { answered_count: number };

// check_answer()'s reply: the grade for the one row and its secret half
// (Q6 renders the feedback from this; Q5 records it).
export type CheckResult =
  | { ok: true; isCorrect: boolean; scoreAwarded: number; secret: SecretHalf }
  | { ok: false; error: string };

// The config keys with the legacy fallbacks (equal to seed_data.sql).
export const RUNNER_QUESTIONS_PER_PAGE_DEFAULT = 1;
export const BUILDER_MAX_QUESTIONS_DEFAULT = 50;
export const BUILDER_MINUTES_PER_QUESTION_DEFAULT = 1;

// How long both builders wait after the last keystroke before asking the
// server for the concept keyword's ids (08 B2). Before B2 the match ran
// in the browser on every keystroke, over text that is no longer there.
export const CONCEPT_SEARCH_DELAY_MS = 300;

// The builder's light row: legacy getBuilderCourseItems selected only
// what the wizard filters and counts on. Since 08 B2 that is the
// criteria and nothing else — the stem and the rationale are gone, so
// no wizard code can filter on question text by accident; the concept
// keyword goes to the server and comes back as ids.
export type BuilderItem = {
  item_id: string;
  subject: string | null;
  maintopic: string | null;
  subtopic: string | null;
  difficulty: string | null;
  question_type: string;
};

// ── the Quiz Builder (04.4; Sam, 2026-10-11) ───────────────────────────
// The offline pack builder keeps BuilderItem and today's steps until its
// own redesign; the quiz builder reads these.

/** A quiz needs at least this many questions (04.1; Sam, 2026-09-30, ruled 2026-10-11). */
export const BUILDER_MIN_QUESTIONS = 5;

/** What a course is open for in the builder: the whole bank, or its free questions only (03). */
export type BuilderPool = 'all' | 'free';

/**
 * Why: a grant with no count (a package, Free Full Access); a trial with
 * quizzes left; a trial whose quizzes are used (the free questions, Sam
 * 2026-10-11: b); no grant at all — the free account's floor.
 */
export type BuilderReason = 'paid' | 'trial' | 'trial-used' | 'free';

/** One course the door opens, decided on the server (lib/attempts/builder-door.ts). */
export type BuilderDoorCourse = {
  course_id: string;
  title: string;
  pool: BuilderPool;
  reason: BuilderReason;
  /** A trial's builder quizzes: left and in all; null without a count. */
  quizzesLeft: number | null;
  quizzesTotal: number | null;
  /** The questions this pool holds — published, not held back by a mock. */
  total: number;
};

/** The quiz builder's light row: what it counts and filters on, and what the student did with it. */
export type QuizBuilderItem = {
  item_id: string;
  maintopic: string | null;
  difficulty: string | null;
  question_type: string;
  /** Answered before, in any sitting. */
  seen: boolean;
  /** The latest answer to it was wrong ("Got wrong before"). */
  wrong: boolean;
};

export type QuizBuilderLoad = { ok: true; items: QuizBuilderItem[] } | { ok: false; error: string };
export type KeywordResult = { ok: true; itemIds: string[] } | { ok: false; error: string };

export type Score = { raw: number; total: number; pct: number };

export type ActionResult = { ok: true } | { ok: false; error: string };

export type SpawnResult = { ok: true; attemptId: string } | { ok: false; error: string };

/**
 * Finish and expire return the score and, the sitting being over, every
 * question's secret half (Q6) — unless the paper's results are held
 * (04.12): then the date and what was saved, and neither score nor secret.
 */
export type FinishResult =
  | {
      ok: true;
      held: false;
      score: Score;
      secrets: SecretsMap;
      /** the stored time taken (03 Q18's pop-up) */
      timeTakenS: number | null;
      /**
       * 04.13: the paper's review is closed — the score and the counts (the
       * runner cannot count without the key), no secret half, and the line.
       */
      reviewClosed: { line: string; correct: number; wrong: number; unanswered: number } | null;
    }
  | {
      ok: true;
      held: true;
      resultsAt: string;
      answered: number;
      total: number;
      timeTakenS: number | null;
      /** 04.13: false when the paper's review is Not allowed — the answers never come. */
      answers: boolean;
    }
  | { ok: false; error: string };

/** Sequential's move (§8 S21): the position now current, or null when every question is passed. */
export type AdvanceResult = { ok: true; nextPosition: number | null } | { ok: false; error: string };

// The admin details step's attempt-stats box — read by
// lib/attempts/queries getQuizAttemptStats. Legacy showed Total,
// Completed, Avg Score over every row with the quiz id; since Q2 (D45 e)
// the rows are the quiz's own table's, and first sittings, retakes and
// abandons are shown apart. `total` is every row on the quiz.
export type QuizAttemptStats = {
  total: number;
  firstSittings: number;
  retakes: number;
  abandoned: number;
  completed: number;
  avgScore: number;
};

// ── the learning history page (7a) ─────────────────────────────────────
// legacy getStudentAttemptsPaginated selected the card-visible columns
// only — no item_ids, no answers_json.
export type AttemptListRow = Pick<
  Attempt,
  | 'attempt_id'
  | 'user_id'
  | 'quiz_id'
  | 'course_id'
  | 'mode'
  | 'source'
  | 'status'
  | 'n'
  | 'score_raw'
  | 'score_total'
  | 'score_pct'
  | 'time_taken_s'
  | 'display_label'
  | 'ts_iso'
  | 'results_at'
  | 'held'
  | 'review'
  | 'review_closes_at'
  | 'review_closed'
>;

/** The four database-side filters (course, status, mode, a label search). */
export type HistoryFilters = { courseId: string; status: string; mode: string; search: string };

export type HistoryPage = { attempts: AttemptListRow[]; total: number };

export const HISTORY_PAGE_SIZE = 20;

/** The dashboard's Recent Quiz Attempts table (legacy's `.limit(5)`). */
export const RECENT_ATTEMPTS_LIMIT = 5;
