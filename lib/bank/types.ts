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

// The taxonomy level (08 B4, §8 S17): Bloom's six, MyNclex's list in
// meaning, Ghana's spelling on screen and in the data ("Analyse"). The
// table's CHECK holds the same six; null means not yet classified.
export const BLOOM_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyse', 'Evaluate', 'Create'] as const;

export const OPTION_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;
export type OptionLetter = (typeof OPTION_LETTERS)[number];

// The storage bucket for rationale images (global namespace, hence the
// prefix — AGENTS.md rule #1). Public read; the URL is what the runner
// renders. Legacy's browser-side limit was 2 MB; the bucket carries it too.
export const RATIONALE_IMAGE_BUCKET = 'licensure-gh-rationale-images';
export const RATIONALE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export type Item = {
  item_id: string;
  /** The course the question belongs to — the one table's key to courses (08 B1). */
  course_id: string;
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
  // ── 08 B4 (§8 S17) ──
  /** One of BLOOM_LEVELS, or null. */
  bloom_level: string | null;
  /** A new row is a draft; only a published row reaches a student. */
  is_published: boolean;
  /** The free-pool mark. It gates nothing until 09 F1 builds its doors. */
  is_free_sample: boolean;
  /** Where the question came from — internal, never shown to a student. */
  question_ref: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  /** Moves by one each time a published row's content changes. */
  version: number;
  /** The U_ id of the admin who last wrote the row — the history's "who". */
  updated_by: string | null;
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
// B4 added the last three: the level, the source and the tags — the tags
// in one cell separated by semicolons, since commas are the file's own
// separator (ruled 2026-09-26). The two switches are not columns: they
// are choices made per file (08 B4).
export const CSV_COLUMNS = [
  'item_id', 'question_type', 'stem',
  'option_a', 'fb_a', 'option_b', 'fb_b', 'option_c', 'fb_c',
  'option_d', 'fb_d', 'option_e', 'fb_e', 'option_f', 'fb_f',
  'correct', 'rationale', 'subject', 'maintopic', 'subtopic',
  'difficulty', 'marks', 'batch_id', 'shuffle_options',
  'bloom_level', 'question_ref', 'tags',
] as const;

/**
 * One way to write a tag list, wherever tags arrive — the editor's field,
 * a CSV cell, a panel rename: trimmed, empties dropped, and two spellings
 * that differ only in case kept once (the first spelling wins). A tag
 * typed twice in different case is one tag (08 B4).
 */
export function normaliseTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = String(raw ?? '').trim().replace(/\s+/g, ' ');
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

// What the bank Server Actions return.
export type ActionResult = { ok: true } | { ok: false; error: string };

// What setPublished() returns: how many rows changed, and — for an
// unpublish — how many live quizzes now name a draft and will refuse to
// start until it is published again.
export type PublishResult =
  | { ok: true; changed: number; blockedQuizzes: number }
  | { ok: false; error: string };

// countQuizzesNaming(): the live fixed quizzes and mocks whose question
// lists name any of the given ids — what Unpublish asks about first.
export type QuizUseResult = { ok: true; count: number } | { ok: false; error: string };

// The import's two choices per file (08 B4), applied to the rows the
// file CREATES; a row already in the bank keeps its own switches.
export type ImportChoices = { publishNew: boolean; freeNew: boolean };

// What importItems() returns (slice 4b): legacy's two counts, plus the
// batch errors legacy sent to the browser console; since 08 B4 the
// successes split into rows created and rows updated.
export type ImportResult =
  | { ok: true; successCount: number; failCount: number; errors: string[]; created: number; updated: number }
  | { ok: false; error: string };

// ── the two panels (08 B4) ──
/** One tag in use, as the Tags panel lists it: whole bank, every course. */
export type TagCount = { tag: string; count: number };
export type TagListResult = { ok: true; tags: TagCount[] } | { ok: false; error: string };
/** A rename, merge or delete: how many questions it changed. */
export type TagChangeResult = { ok: true; changed: number } | { ok: false; error: string };

/** A course's free rows: published (in the pool) and drafts marked free (not yet). */
export type FreePoolCourse = { courseId: string; title: string; archived: boolean; free: number; freeDrafts: number };
export type FreePoolProgramme = { programId: string; name: string; free: number; courses: FreePoolCourse[] };
export type FreePoolResult =
  | { ok: true; programmes: FreePoolProgramme[]; totalFree: number }
  | { ok: false; error: string };

// What loadCourseItems() returns: the whole course, as legacy loaded it
// (the page filters in the browser), plus the two dropdowns it fills and
// (08 B4) every tag in use across the bank, for the editor's suggestions.
export type CourseItemsResult =
  | { ok: true; items: Item[]; maintopics: string[]; batchIds: string[]; tagsInUse: string[] }
  | { ok: false; error: string };
