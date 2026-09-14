// lib/attempts/types.ts
//
// Attempts as the app reads them (slice 6a): the row (db/schema.sql, the
// legacy nineteen columns), the answer record the runners store in
// `answers_json`, the config keys the runner and the builder read with
// the legacy fallbacks (rebuild.md §9 #11: equal to the seed), and what
// the Server Actions return. Constants live here, not in actions.ts — a
// 'use server' module exports only async functions.

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
  /** comma-joined item ids, in the attempt's order */
  item_ids: string;
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
  /** a JSON string of AnswerRecord[] */
  answers_json: string;
  ts_iso: string | null;
};

// One entry per item in answers_json (legacy buildAnswersJson). MCQ / TF:
// `chosen` is a letter; SATA: an array of letters; unanswered: null.
export type AnswerRecord = {
  item_id: string;
  chosen: string | string[] | null;
  correct: string | string[];
  is_correct: boolean;
  flagged: boolean;
  /** instant mode only: the learner pressed "Check Answer" on a SATA item */
  sata_checked?: boolean;
  time_spent_s: number | null;
};

// The runner's state maps, hydrated from answers_json.
export type ChosenMap = Record<string, string | string[]>;
export type FlagMap = Record<string, boolean>;

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

export type FinishResult = { ok: true; score: Score } | { ok: false; error: string };

export type TimedStartResult = { ok: true; startedIso: string } | { ok: false; error: string };

// The admin details step's attempt-stats box (legacy: Total Attempts,
// Completed, Avg Score) — read by lib/attempts/queries getQuizAttemptStats.
export type QuizAttemptStats = { total: number; completed: number; avgScore: number };
