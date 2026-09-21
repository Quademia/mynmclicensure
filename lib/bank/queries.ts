// lib/bank/queries.ts
//
// The question-bank reads, transcribed one for one from legacy
// js/mynmclicensure-api.js: getItemsByIds, getItemsByFilters,
// getItemFilterOptions. Each takes the caller's client and, as legacy,
// fails open: an error is logged and an empty result returned.
//
// One table since 08 B1 (2026-09-19): question_bank, filtered by
// course_id. The eleven per-course tables and the helper that chose one
// (lib/bank/tables.ts) are gone; a course with no rows reads as empty.
//
// Since 08 B2 (2026-09-21) the answer half — correct, rationale,
// rationale_img and the six feedbacks — is not readable by the browser
// roles at all, and the admin's own cookie client is one of them. So the
// reads split by client type, and the type says which is which:
//   ServiceDb (service role, behind requireAdmin() or requireStudent()
//     plus the access check) — the whole row, and the concept search.
//   Db (the caller's cookie client, RLS the gate) — the public columns
//     only: the filter options and the "does this course have these
//     ids" check.
// A read that needs the key cannot be handed a student's client by
// accident; the compiler refuses it.

import type { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import type { Item, ItemFilterOptions, ItemFilters } from './types';

type Db = Awaited<ReturnType<typeof createClient>>;
export type ServiceDb = ReturnType<typeof createServiceRoleClient>;

const EMPTY_OPTIONS: ItemFilterOptions = {
  subjects: [],
  maintopics: [],
  subtopics: [],
  difficulties: [],
  question_types: [],
  batch_ids: [],
};

/** The admin writes' guard: the course must exist (the key on question_bank is the floor). */
export async function courseExists(db: Db, courseId: string): Promise<boolean> {
  const { data, error } = await db.from('courses').select('course_id').eq('course_id', courseId).maybeSingle();
  if (error) {
    console.error('courseExists:', error);
    return false;
  }
  return Boolean(data);
}

// The builders' id check: of the ids the browser sent, which are really
// this course's? Ids only — before B2 this was getItemsByIds returning
// whole rows, of which both callers used nothing but item_id. RLS is the
// gate: a course the student cannot reach returns the empty set, and the
// caller refuses the build.
export async function knownItemIds(db: Db, courseId: string, itemIds: string[]): Promise<Set<string>> {
  if (!itemIds || itemIds.length === 0) return new Set();

  const { data, error } = await db.from('question_bank').select('item_id').eq('course_id', courseId).in('item_id', itemIds);
  if (error) {
    console.error('knownItemIds:', error);
    return new Set();
  }
  return new Set((data ?? []).map((r) => (r as { item_id: string }).item_id));
}

// The builders' concept keyword (08 B2; D9). The wizard has always
// matched subtopic, main topic, stem and rationale; the last two are no
// longer in the browser, so the match runs in the database and only item
// ids come back — never a stem. search_question_bank_ids() takes the
// keyword as a bound parameter and tests it as a plain case-insensitive
// substring, which is what String.includes() did over the same rows.
// Service role: it reads the rationale. The caller's gate is
// requireStudent() plus the course-access check.
export async function searchConceptItemIds(db: ServiceDb, courseId: string, query: string): Promise<string[]> {
  const q = String(query || '').trim();
  if (!q) return [];

  const { data, error } = await db.rpc('search_question_bank_ids', { p_course_id: courseId, p_query: q });
  if (error) {
    console.error('searchConceptItemIds:', error);
    return [];
  }
  return (data ?? []).map((r: { item_id: string }) => r.item_id);
}

// The admin picker's read (and the bank page's "load the course"): every
// filter is an equality; the keyword is an ilike across every text field.
// Whole rows, the key included — service role, behind requireAdmin().
export async function getItemsByFilters(db: ServiceDb, courseId: string, filters: ItemFilters = {}): Promise<Item[]> {
  let query = db.from('question_bank').select('*').eq('course_id', courseId);
  if (filters.subject) query = query.eq('subject', filters.subject);
  if (filters.maintopic) query = query.eq('maintopic', filters.maintopic);
  if (filters.subtopic) query = query.eq('subtopic', filters.subtopic);
  if (filters.difficulty) query = query.eq('difficulty', filters.difficulty);
  if (filters.question_type) query = query.eq('question_type', filters.question_type);
  if (filters.batch_id) query = query.eq('batch_id', filters.batch_id);

  if (filters.keyword) {
    const kw = filters.keyword.trim();
    query = query.or(
      `stem.ilike.%${kw}%,` +
        `option_a.ilike.%${kw}%,option_b.ilike.%${kw}%,` +
        `option_c.ilike.%${kw}%,option_d.ilike.%${kw}%,` +
        `option_e.ilike.%${kw}%,option_f.ilike.%${kw}%,` +
        `rationale.ilike.%${kw}%,` +
        `maintopic.ilike.%${kw}%,subtopic.ilike.%${kw}%,` +
        `subject.ilike.%${kw}%`,
    );
  }

  const { data, error } = await query.order('item_id');
  if (error) {
    console.error('getItemsByFilters:', error);
    return [];
  }
  return (data ?? []) as Item[];
}

// Distinct real values for the dropdowns and chips, from the course's
// rows. Criteria columns only, so either client may ask: the student's
// own (the builders, RLS the gate) and the admin's.
export async function getItemFilterOptions(db: Db, courseId: string): Promise<ItemFilterOptions> {
  const { data, error } = await db
    .from('question_bank')
    .select('subject, maintopic, subtopic, difficulty, question_type, batch_id')
    .eq('course_id', courseId);
  if (error) {
    console.error('getItemFilterOptions:', error);
    return EMPTY_OPTIONS;
  }

  type Row = Pick<Item, 'subject' | 'maintopic' | 'subtopic' | 'difficulty' | 'question_type' | 'batch_id'>;
  const rows = (data ?? []) as Row[];
  const unique = (values: (string | null)[]) =>
    [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))].sort();

  return {
    subjects: unique(rows.map((r) => r.subject)),
    maintopics: unique(rows.map((r) => r.maintopic)),
    subtopics: unique(rows.map((r) => r.subtopic)),
    difficulties: unique(rows.map((r) => r.difficulty)),
    question_types: unique(rows.map((r) => r.question_type)),
    batch_ids: unique(rows.map((r) => r.batch_id)),
  };
}
