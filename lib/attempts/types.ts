// lib/attempts/types.ts
//
// Attempts as the app reads them (slice 6a): the row (db/schema.sql, the
// legacy nineteen columns), the answer record the runners store in
// `answers_json`, the config keys the runner and the builder read with
// the legacy fallbacks (rebuild.md §9 #11: equal to the seed), and what
// the Server Actions return. Constants live here, not in actions.ts — a
// 'use server' module exports only async functions.

import type { QuestionType } from '@/lib/bank/types';

export type AttemptMode = 'instant' | 'timed';
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
export const RUNNER_AUTOSAVE_SEC_DEFAULT = 60;
export const BUILDER_MAX_QUESTIONS_DEFAULT = 50;
export const BUILDER_MINUTES_PER_QUESTION_DEFAULT = 1;

// The builder's light row: legacy getBuilderCourseItems selected only
// what the wizard filters and counts on.
export type BuilderItem = {
  item_id: string;
  subject: string | null;
  maintopic: string | null;
  subtopic: string | null;
  difficulty: string | null;
  question_type: string;
  stem: string;
  rationale: string | null;
};

// What the builder sends with a build (legacy spawnBuilderAttempt meta).
export type BuilderMeta = {
  n: number;
  selection_mode: 'topics' | 'concept';
  maintopics: string[];
  subtopics: string[];
  difficulties: string[];
  question_types: string[];
  concepts: string[];
  concept_query: string;
  display_label: string;
  duration_min_override: number;
};

export type Score = { raw: number; total: number; pct: number };

export type ActionResult = { ok: true } | { ok: false; error: string };

export type SpawnResult = { ok: true; attemptId: string } | { ok: false; error: string };

/** Finish and expire return the score and, the sitting being over, every question's secret half (Q6). */
export type FinishResult = { ok: true; score: Score; secrets: SecretsMap } | { ok: false; error: string };

export type TimedStartResult = { ok: true; startedIso: string } | { ok: false; error: string };

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
>;

/** The four database-side filters (course, status, mode, a label search). */
export type HistoryFilters = { courseId: string; status: string; mode: string; search: string };

export type HistoryPage = { attempts: AttemptListRow[]; total: number };

export const HISTORY_PAGE_SIZE = 20;

/** The dashboard's Recent Quiz Attempts table (legacy's `.limit(5)`). */
export const RECENT_ATTEMPTS_LIMIT = 5;
