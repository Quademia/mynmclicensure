// lib/quizzes/types.ts
//
// Fixed quizzes and mock exams as the app reads them (slice 5a): one row
// shape for both tables (db/schema.sql) — mock_quizzes adds `visibility`,
// which legacy stored and never set or checked, so it is optional here.
// Column names are the legacy ones. The constant lists are the legacy
// admin pages' <select> options, in their order. Constants live here,
// not in actions.ts — a 'use server' module exports only async functions
// (AGENTS.md).

export const QUIZ_KINDS = ['fixed', 'mock'] as const;
/** Which table: 'fixed' → quizzes, 'mock' → mock_quizzes. */
export type QuizKind = (typeof QUIZ_KINDS)[number];

export const QUIZ_TABLES: Record<QuizKind, string> = {
  fixed: 'quizzes',
  mock: 'mock_quizzes',
};

export const ALLOWED_MODES = ['BOTH', 'INSTANT_ONLY', 'TIMED_ONLY'] as const;
export type AllowedModes = (typeof ALLOWED_MODES)[number];

// legacy formatMode() — the admin table chip and the review pane.
export const MODE_LABELS: Record<AllowedModes, string> = {
  BOTH: 'Both Practice & Exam',
  INSTANT_ONLY: 'Practice only',
  TIMED_ONLY: 'Exam only',
};

// The details form's <select> labels, in legacy's order.
export const MODE_OPTIONS: { value: AllowedModes; label: string }[] = [
  { value: 'BOTH', label: 'Both Practice and Exam' },
  { value: 'INSTANT_ONLY', label: 'Practice only' },
  { value: 'TIMED_ONLY', label: 'Exam only' },
];

export const QUIZ_STATUSES = ['draft', 'active', 'archived'] as const;
export type QuizStatus = (typeof QUIZ_STATUSES)[number];

export const MOCK_VISIBILITIES = ['ALL', 'PAID', 'TRIAL'] as const;
export type MockVisibility = (typeof MOCK_VISIBILITIES)[number];

export type Quiz = {
  quiz_id: string;
  course_id: string;
  title: string;
  item_ids: string[];
  n: number;
  allowed_modes: AllowedModes;
  shuffle: boolean;
  /** null = one minute per question (legacy's fallback, everywhere). */
  time_limit_sec: number | null;
  published: boolean;
  publish_at: string | null;
  unpublish_at: string | null;
  status: QuizStatus;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** mock_quizzes only. */
  visibility?: MockVisibility;
};

// The columns legacy's paginated admin list selected (getAllQuizzesPaginated)
// — the row shape of the fixed-quiz table until the quiz is opened.
export type QuizListRow = Pick<
  Quiz,
  'quiz_id' | 'course_id' | 'title' | 'status' | 'published' | 'allowed_modes' | 'n' | 'created_at'
>;

// The availability state machine's four answers (legacy getQuizAvailability).
export const AVAILABILITIES = ['HIDDEN', 'UPCOMING', 'CLOSED', 'ACTIVE'] as const;
export type Availability = (typeof AVAILABILITIES)[number];

// What the quiz Server Actions return.
export type ActionResult = { ok: true } | { ok: false; error: string };

// What the paginated fixed-quiz list returns (legacy { quizzes, total }).
export type QuizPage = { quizzes: QuizListRow[]; total: number };

// What saveQuiz() takes: the details form plus the picked ids, as legacy's
// saveQuiz() read them off the page. Dates are the raw datetime-local
// strings ("YYYY-MM-DDTHH:MM") or null — saved with no timezone, as
// legacy saved them (rebuild.md §12, slice 5: Ghana time, which is UTC).
export type SaveQuizInput = {
  kind: QuizKind;
  isEdit: boolean;
  quizId: string;
  courseId: string;
  title: string;
  allowedModes: AllowedModes;
  status: QuizStatus;
  published: boolean;
  shuffle: boolean;
  timeLimitSec: string;
  publishAt: string;
  unpublishAt: string;
  notes: string;
  itemIds: string[];
};
