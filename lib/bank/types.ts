// lib/bank/types.ts
//
// The question bank as the app reads it (slice 4a): one row shape for all
// eleven item tables (db/schema.sql). Column names are the legacy ones.
// The constant lists are the legacy Question Bank page's <select>
// options, in their order. Constants live here, not in actions.ts — a
// 'use server' module exports only async functions (AGENTS.md).

export const QUESTION_TYPES = ['MCQ', 'TF', 'SATA'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

// The legacy page's labels for the type <select> in the edit panel.
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MCQ: 'MCQ (Multiple Choice)',
  TF: 'TF (True / False)',
  SATA: 'SATA (Select All That Apply)',
};

export const DIFFICULTIES = ['Easy', 'Moderate', 'Hard'] as const;

export const OPTION_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;
export type OptionLetter = (typeof OPTION_LETTERS)[number];

// The storage bucket for rationale images (global namespace, hence the
// prefix — AGENTS.md rule #1). Public read; the URL is what the runner
// renders. Legacy's browser-side limit was 2 MB; the bucket carries it too.
export const RATIONALE_IMAGE_BUCKET = 'licensure-gh-rationale-images';
export const RATIONALE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export type Item = {
  item_id: string;
  question_type: QuestionType;
  stem: string;
  option_a: string | null; fb_a: string | null;
  option_b: string | null; fb_b: string | null;
  option_c: string | null; fb_c: string | null;
  option_d: string | null; fb_d: string | null;
  option_e: string | null; fb_e: string | null;
  option_f: string | null; fb_f: string | null;
  /** "b" for MCQ / TF; "a,c,e" for SATA. */
  correct: string;
  rationale: string | null;
  rationale_img: string | null;
  subject: string | null;
  maintopic: string | null;
  subtopic: string | null;
  difficulty: string | null;
  marks: number;
  batch_id: string | null;
  shuffle_options: boolean;
};

// The filters getItemsByFilters() understands — legacy's exact set.
export type ItemFilters = {
  subject?: string;
  maintopic?: string;
  subtopic?: string;
  difficulty?: string;
  question_type?: string;
  batch_id?: string;
  keyword?: string;
};

// getItemFilterOptions() as legacy returned it: sorted, distinct, non-empty.
export type ItemFilterOptions = {
  subjects: string[];
  maintopics: string[];
  subtopics: string[];
  difficulties: string[];
  question_types: string[];
  batch_ids: string[];
};

// The CSV template's columns (legacy CSV_COLUMNS), in their order. Note
// rationale_img is not among them — legacy's importer never set it.
export const CSV_COLUMNS = [
  'item_id', 'question_type', 'stem',
  'option_a', 'fb_a', 'option_b', 'fb_b', 'option_c', 'fb_c',
  'option_d', 'fb_d', 'option_e', 'fb_e', 'option_f', 'fb_f',
  'correct', 'rationale', 'subject', 'maintopic', 'subtopic',
  'difficulty', 'marks', 'batch_id', 'shuffle_options',
] as const;

// What the bank Server Actions return.
export type ActionResult = { ok: true } | { ok: false; error: string };

// What loadCourseItems() returns: the whole course, as legacy loaded it
// (the page filters in the browser), plus the two dropdowns it fills.
export type CourseItemsResult =
  | { ok: true; items: Item[]; maintopics: string[]; batchIds: string[] }
  | { ok: false; error: string };
