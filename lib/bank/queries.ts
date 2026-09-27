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
//
// 08 B4 (2026-09-26): a new row is a draft. The read policy already hides
// drafts from a student's client; the student-side reads here say
// `is_published` as well (belt and braces, and it names the scope in the
// query as AGENTS.md asks). The filter options serve both audiences, so
// they take the choice. Three service-role reads serve the admin's
// writes: the ids any mock names, the live quizzes naming some ids, and
// the tag spellings already in use.

//
// 08 B7 (2026-09-26; D52, AGENTS.md rule 10): a read that takes a whole
// course — or, for the panels, the whole bank — goes through readAll(),
// because the API stops at 1,000 rows and says nothing: RM_PED_OBS_HRN
// holds 1,080 and every such read came back 80 short.

import type { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { readAll, slices } from '@/lib/supabase/read-all';
import { QUIZ_ITEM_TABLES, QUIZ_KINDS, QUIZ_TABLES, type QuizKind } from '@/lib/quizzes/types';
import type { CourseLists, Item, ItemFilterOptions, ItemFilters, ListEntry } from './types';

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
// caller refuses the build. Published rows only (08 B4): a draft id is
// dropped here, as the pool never offered it.
export async function knownItemIds(db: Db, courseId: string, itemIds: string[]): Promise<Set<string>> {
  if (!itemIds || itemIds.length === 0) return new Set();

  const { data, error } = await db
    .from('question_bank')
    .select('item_id')
    .eq('course_id', courseId)
    .eq('is_published', true)
    .in('item_id', itemIds);
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

  // a set-returning function is cut at 1,000 too: "a" matches all 1,080
  // of RM_PED_OBS_HRN (B7)
  const { data, error } = await readAll<{ item_id: string }>((from, to) =>
    db.rpc('search_question_bank_ids', { p_course_id: courseId, p_query: q }).order('item_id').range(from, to),
  );
  if (error) {
    console.error('searchConceptItemIds:', error);
    return [];
  }
  return data.map((r) => r.item_id);
}

// The admin picker's read (and the bank page's "load the course"): every
// filter is an equality; the keyword is an ilike across every text field.
// Whole rows, the key included — service role, behind requireAdmin().
export async function getItemsByFilters(db: ServiceDb, courseId: string, filters: ItemFilters = {}): Promise<Item[]> {
  const build = () => {
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
    return query.order('item_id');
  };

  const { data, error } = await readAll<Item>((from, to) => build().range(from, to));
  if (error) {
    console.error('getItemsByFilters:', error);
    return [];
  }
  return data;
}

// Distinct real values for the dropdowns and chips, from the course's
// rows. Criteria columns only, so either client may ask: the student's
// own (the builders, RLS the gate) and the admin's. The builders ask for
// published rows only, so a draft's new topic is not offered as a chip
// with nothing behind it; the admin page asks for every row, so its
// dropdowns show a draft's topic and batch (08 B4).
export async function getItemFilterOptions(
  db: Db,
  courseId: string,
  { publishedOnly }: { publishedOnly: boolean },
): Promise<ItemFilterOptions> {
  type Row = Pick<Item, 'subject' | 'maintopic' | 'subtopic' | 'difficulty' | 'question_type' | 'batch_id'>;
  const build = () => {
    let query = db
      .from('question_bank')
      .select('subject, maintopic, subtopic, difficulty, question_type, batch_id')
      .eq('course_id', courseId);
    if (publishedOnly) query = query.eq('is_published', true);
    return query.order('item_id');
  };
  const { data: rows, error } = await readAll<Row>((from, to) => build().range(from, to));
  if (error) {
    console.error('getItemFilterOptions:', error);
    return EMPTY_OPTIONS;
  }

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

// ── the admin writes' helpers (08 B4), service role ────────────────────
// A quiz's questions are rows since 03 Q14 (quiz_items, mock_quiz_items),
// which hold no browser grant, so these read through the service role,
// behind requireAdmin() — or, for the draws, after requireStudent() and
// the access check.

/**
 * The questions held back from practice (08 B6): every id named by a
 * mock whose status is draft or active. An archived mock releases its
 * questions; restoring it holds them back again — derived from the mocks'
 * rows, never stored (Sam, 2026-09-26). One definition serves the
 * draws, the fixed-quiz picker and the free tick's refusal. `courseId`
 * narrows to one course's mocks. Null when the rows could not be read —
 * every caller then refuses rather than guesses.
 */
export async function heldBackIds(db: ServiceDb, courseId?: string): Promise<Set<string> | null> {
  const build = () => {
    let query = db.from(QUIZ_TABLES.mock).select('quiz_id').in('status', ['draft', 'active']);
    if (courseId) query = query.eq('course_id', courseId);
    return query.order('quiz_id');
  };
  const mocks = await readAll<{ quiz_id: string }>((from, to) => build().range(from, to));
  if (mocks.error) {
    console.error('heldBackIds:', mocks.error);
    return null;
  }

  const ids = new Set<string>();
  for (const quizIds of slices(mocks.data.map((m) => m.quiz_id))) {
    const { data, error } = await readAll<{ item_id: string }>((from, to) =>
      db.from(QUIZ_ITEM_TABLES.mock).select('item_id').in('quiz_id', quizIds).order('quiz_id').order('item_id').range(from, to),
    );
    if (error) {
      console.error('heldBackIds rows:', error);
      return null;
    }
    for (const r of data) ids.add(r.item_id);
  }
  return ids;
}

/**
 * How many live quizzes — fixed or mock, status active and published —
 * name any of `itemIds` in this course. Each will refuse to start while
 * one of them is a draft. Null when the rows could not be read.
 */
export async function liveQuizzesNaming(db: ServiceDb, courseId: string, itemIds: string[]): Promise<number | null> {
  const wanted = [...new Set(itemIds)];
  let count = 0;
  for (const kind of QUIZ_KINDS) {
    const naming = new Set<string>();
    for (const ids of slices(wanted)) {
      const { data, error } = await readAll<{ quiz_id: string }>((from, to) =>
        db
          .from(QUIZ_ITEM_TABLES[kind])
          .select('quiz_id')
          .eq('course_id', courseId)
          .in('item_id', ids)
          .order('quiz_id')
          .order('item_id')
          .range(from, to),
      );
      if (error) {
        console.error('liveQuizzesNaming:', error);
        return null;
      }
      for (const r of data) naming.add(r.quiz_id);
    }
    for (const quizIds of slices([...naming])) {
      const { count: live, error } = await db
        .from(QUIZ_TABLES[kind])
        .select('quiz_id', { count: 'exact', head: true })
        .in('quiz_id', quizIds)
        .eq('status', 'active')
        .eq('published', true);
      if (error) {
        console.error('liveQuizzesNaming:', error);
        return null;
      }
      count += live ?? 0;
    }
  }
  return count;
}

/**
 * Every quiz and mock — any status — that names this question: the bank's
 * delete is refused while one does (03 Q14, Sam: the key restricts), and
 * the refusal names them. Null when the rows could not be read.
 */
export async function quizzesNaming(
  db: ServiceDb,
  itemId: string,
): Promise<{ kind: QuizKind; quizId: string; title: string }[] | null> {
  const found: { kind: QuizKind; quizId: string; title: string }[] = [];
  for (const kind of QUIZ_KINDS) {
    const { data, error } = await db.from(QUIZ_ITEM_TABLES[kind]).select('quiz_id').eq('item_id', itemId);
    if (error) {
      console.error('quizzesNaming:', error);
      return null;
    }
    const quizIds = ((data ?? []) as { quiz_id: string }[]).map((r) => r.quiz_id);
    if (!quizIds.length) continue;
    const { data: quizzes, error: quizError } = await db
      .from(QUIZ_TABLES[kind])
      .select('quiz_id, title')
      .in('quiz_id', quizIds)
      .order('title');
    if (quizError) {
      console.error('quizzesNaming:', quizError);
      return null;
    }
    for (const q of (quizzes ?? []) as { quiz_id: string; title: string }[]) found.push({ kind, quizId: q.quiz_id, title: q.title });
  }
  return found;
}

// The panels' reads below take the whole bank or a whole course, so each
// goes through readAll() (rule 10); they were the first written that way.

/**
 * Every row that carries a tag, whole bank: the Tags panel counts and
 * rewrites these, and the save snaps a new tag to their spellings. Null
 * when the bank could not be read.
 */
export async function taggedRows(db: ServiceDb): Promise<{ item_id: string; tags: string[] }[] | null> {
  const { data, error } = await readAll<{ item_id: string; tags: string[] | null }>((from, to) =>
    db.from('question_bank').select('item_id, tags').neq('tags', '{}').order('item_id').range(from, to),
  );
  if (error) {
    console.error('taggedRows:', error);
    return null;
  }
  return data.map((r) => ({ item_id: r.item_id, tags: r.tags ?? [] }));
}

/**
 * Every tag in use across the bank, keyed by its lower-case form: the
 * spelling a new tag is snapped to, so "Pain" typed where "pain" is in
 * use becomes "pain" and stays one tag (08 B4). An unreadable bank
 * snaps nothing.
 */
export async function tagSpellingsInUse(db: ServiceDb): Promise<Map<string, string>> {
  const spellings = new Map<string, string>();
  for (const row of (await taggedRows(db)) ?? []) {
    for (const tag of row.tags) {
      const key = tag.toLowerCase();
      if (!spellings.has(key)) spellings.set(key, tag);
    }
  }
  return spellings;
}

/**
 * Which of these ids the bank already holds, in any course, with each
 * one's question type — the importer's two choices apply only to the rows
 * a file creates, and a file may not change a question's type (08 B8). In
 * slices of 200, because the ids ride in the request's address. Null
 * when the bank could not be read.
 */
export async function existingItemTypes(db: ServiceDb, itemIds: string[]): Promise<Map<string, string> | null> {
  const found = new Map<string, string>();
  const ids = [...new Set(itemIds)];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('question_bank').select('item_id, question_type').in('item_id', ids.slice(i, i + 200));
    if (error) {
      console.error('existingItemTypes:', error);
      return null;
    }
    for (const r of (data ?? []) as { item_id: string; question_type: string }[]) found.set(r.item_id, r.question_type);
  }
  return found;
}

/**
 * A course's subject and topic lists (08 B5), sorted as a person reads
 * them. Service role: the lists hold no browser grant (rule 9) — the
 * admin reads them behind requireAdmin(), and no student read uses them.
 * A list is short (GP's subjects are the longest, 149), so no paging.
 * Null when they could not be read.
 */
export async function courseLists(db: ServiceDb, courseId: string): Promise<CourseLists | null> {
  const read = async (table: 'bank_subjects' | 'bank_topics') => {
    const { data, error } = await db.from(table).select('id, name, retired').eq('course_id', courseId);
    if (error) {
      console.error(`courseLists ${table}:`, error);
      return null;
    }
    return ((data ?? []) as ListEntry[]).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  };
  const [subjects, topics] = await Promise.all([read('bank_subjects'), read('bank_topics')]);
  return subjects && topics ? { subjects, topics } : null;
}

/**
 * A course's rows as the Subjects & topics panel counts and moves them:
 * id, subject, topic and tags. Paged — RM_PED_OBS_HRN holds 1,080 rows
 * and a read stops at 1,000. Null when the bank could not be read.
 */
export async function courseWordRows(
  db: ServiceDb,
  courseId: string,
): Promise<{ item_id: string; subject: string | null; maintopic: string | null; tags: string[] }[] | null> {
  const { data, error } = await readAll<{ item_id: string; subject: string | null; maintopic: string | null; tags: string[] | null }>(
    (from, to) =>
      db.from('question_bank').select('item_id, subject, maintopic, tags').eq('course_id', courseId).order('item_id').range(from, to),
  );
  if (error) {
    console.error('courseWordRows:', error);
    return null;
  }
  return data.map((r) => ({ ...r, tags: r.tags ?? [] }));
}

/**
 * The free rows per course, published and draft, for the Free pool
 * panel. Null when the bank could not be read.
 */
export async function freeRowCounts(db: ServiceDb): Promise<Map<string, { free: number; freeDrafts: number }> | null> {
  const { data, error } = await readAll<{ course_id: string; is_published: boolean }>((from, to) =>
    db.from('question_bank').select('course_id, is_published').eq('is_free_sample', true).order('item_id').range(from, to),
  );
  if (error) {
    console.error('freeRowCounts:', error);
    return null;
  }
  const counts = new Map<string, { free: number; freeDrafts: number }>();
  for (const r of data) {
    const c = counts.get(r.course_id) ?? { free: 0, freeDrafts: 0 };
    if (r.is_published) c.free++;
    else c.freeDrafts++;
    counts.set(r.course_id, c);
  }
  return counts;
}
