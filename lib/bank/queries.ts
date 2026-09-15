// lib/bank/queries.ts
//
// The question-bank reads, transcribed one for one from legacy
// js/mynmclicensure-api.js: getItemsByIds, getItemsByFilters,
// getItemFilterOptions. Each takes the caller's per-request client and,
// as legacy, fails open: an error is logged and an empty result returned.
//
// Used by: the admin Question Bank page (4a); the fixed-quiz and
// mock-exam item pickers (slice 5); the runners and attempt review
// (slice 6). RLS is the floor (the SELECT policy goes through
// user_has_course()); every read here still names its table.

import type { createClient } from '@/lib/supabase/server';
import { itemsTableFor } from './tables';
import type { Item, ItemFilterOptions, ItemFilters } from './types';

type Db = Awaited<ReturnType<typeof createClient>>;

const EMPTY_OPTIONS: ItemFilterOptions = {
  subjects: [],
  maintopics: [],
  subtopics: [],
  difficulties: [],
  question_types: [],
  batch_ids: [],
};

// The runner's read: just the ids it needs, returned in the SAME ORDER as
// asked. Supabase does not guarantee order with .in(), so legacy sorted
// by hand to match the quiz's item_ids; so does this.
export async function getItemsByIds(db: Db, courseId: string, itemIds: string[]): Promise<Item[]> {
  if (!itemIds || itemIds.length === 0) return [];
  const table = itemsTableFor(courseId);
  if (!table) return [];

  const { data, error } = await db.from(table).select('*').in('item_id', itemIds);
  if (error) {
    console.error('getItemsByIds:', error);
    return [];
  }

  const byId = new Map<string, Item>();
  for (const row of (data ?? []) as Item[]) byId.set(row.item_id, row);
  return itemIds.map((id) => byId.get(id)).filter((x): x is Item => Boolean(x));
}

// The admin picker's read (and the bank page's "load the course"): every
// filter is an equality; the keyword is an ilike across every text field.
export async function getItemsByFilters(db: Db, courseId: string, filters: ItemFilters = {}): Promise<Item[]> {
  const table = itemsTableFor(courseId);
  if (!table) return [];

  let query = db.from(table).select('*');
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

// Distinct real values for the dropdowns and chips, from the course's rows.
export async function getItemFilterOptions(db: Db, courseId: string): Promise<ItemFilterOptions> {
  const table = itemsTableFor(courseId);
  if (!table) return EMPTY_OPTIONS;

  const { data, error } = await db
    .from(table)
    .select('subject, maintopic, subtopic, difficulty, question_type, batch_id');
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
