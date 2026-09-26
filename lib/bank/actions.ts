// lib/bank/actions.ts
//
// The Question Bank page's writes and its "load a course" read as Server
// Actions behind the admin gate — legacy admin/question-bank.html did all
// of this from the browser with direct `db.from(...)` calls. Each action
// repeats the page's own validation, in its order, with its words. A
// Supabase error comes back as its own message, as the legacy page showed
// it. The row types and constants live in ./types.
//
// Since 08 B2 (2026-09-21) every one of these goes through the service
// role, after requireAdmin(). The page reads and writes the answer half —
// correct, the rationale and the six feedbacks — and an admin's cookie
// client is `authenticated`, the role that half was taken away from; the
// write grants went with it, so the table has no browser write path at
// all. The gate is requireAdmin() and the course named in each statement,
// not RLS (AGENTS.md: RLS is the floor, not the filter).
//
// Since 08 B4 (2026-09-26) every write stamps `updated_by` with the
// admin's id: the history trigger cannot see who is acting under the
// service role, so the actor travels on the row. The save carries the
// level, the two switches, the source and the tags; Publish / Unpublish
// is its own action; the free mark is refused on a question a mock names.

'use server';

import { requireAdmin } from '@/lib/access';
import { getAllCourses, getPrograms } from '@/lib/catalogue/queries';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkCourseWords, checkListColumns, findOnList, rowToPayload, type CsvRow } from './csv';
import { uploadRationaleImage } from './images';
import {
  courseLists,
  courseWordRows,
  existingItemIds,
  freeRowCounts,
  getItemFilterOptions,
  getItemsByFilters,
  liveQuizzesNaming,
  heldBackIds,
  taggedRows,
  tagSpellingsInUse,
  type ServiceDb,
} from './queries';
import { courseExists } from './queries';
import {
  BLOOM_LEVELS,
  DIFFICULTIES,
  OPTION_LETTERS,
  QUESTION_TYPES,
  RATIONALE_IMAGE_MAX_BYTES,
  normaliseTags,
  type ActionResult,
  type CourseItemsResult,
  type FreePoolCourse,
  type FreePoolProgramme,
  type FreePoolResult,
  type ImportChoices,
  type ImportResult,
  type ListChangeResult,
  type ListEntry,
  type ListKind,
  type ListPanelResult,
  type PublishResult,
  type QuestionType,
  type QuizUseResult,
  type TagChangeResult,
  type TagListResult,
} from './types';

function fail(error: string): ActionResult {
  return { ok: false, error };
}

// The free mark's refusal, in one place: the tick and (08 B4's second
// session) the importer's "import as free" say the same thing.
const FREE_IN_MOCK = 'This question is in a mock exam and cannot be free.';

/** Tags as typed, trimmed and de-duplicated, each in the spelling the bank already uses. */
function snapTags(tags: readonly string[], inUse: Map<string, string>): string[] {
  return normaliseTags(tags.map((t) => inUse.get(String(t).trim().replace(/\s+/g, ' ').toLowerCase()) ?? t));
}

// ── onCourseChange: the whole course plus the two dropdowns ────────────
// Drafts included: the admin sees every row, and the dropdowns must show
// a draft's topic and batch (08 B4). The tags in use come from the whole
// bank, so the editor suggests the spelling another course already uses.
export async function loadCourseItems(courseId: string): Promise<CourseItemsResult> {
  const { supabase } = await requireAdmin();
  if (!courseId.trim()) return { ok: false, error: 'Unknown course.' };

  const svc = createServiceRoleClient();
  const [items, options, tags, lists] = await Promise.all([
    getItemsByFilters(svc, courseId, {}),
    getItemFilterOptions(supabase, courseId, { publishedOnly: false }),
    tagSpellingsInUse(svc),
    courseLists(svc, courseId),
  ]);
  if (!lists) return { ok: false, error: "Could not read this course's subject and topic lists." };
  return {
    ok: true,
    items,
    maintopics: options.maintopics,
    batchIds: options.batch_ids,
    tagsInUse: [...tags.values()].sort((a, b) => a.localeCompare(b)),
    lists,
  };
}

// ── saveQuestion ───────────────────────────────────────────────────────
// `image` carries the new file under "file" when one was picked; the
// existing URL (or '') travels in input.rationaleImg, as legacy kept
// currentImgUrl beside currentImgFile.
export type SaveQuestionInput = {
  courseId: string;
  isNew: boolean;
  itemId: string;
  questionType: QuestionType;
  stem: string;
  options: Record<string, string>;   // option_a … option_f, keyed by letter
  feedback: Record<string, string>;  // fb_a … fb_f, keyed by letter
  /** MCQ / TF: one letter. SATA: the checked letters. */
  correct: string[];
  rationale: string;
  rationaleImg: string;
  subject: string;
  maintopic: string;
  subtopic: string;
  difficulty: string;
  marks: string;
  batchId: string;
  shuffleOptions: boolean;
  // ── 08 B4 ──
  bloomLevel: string;
  isPublished: boolean;
  isFreeSample: boolean;
  questionRef: string;
  tags: string[];
};

export async function saveQuestion(input: SaveQuestionInput, image: FormData | null): Promise<ActionResult> {
  const { supabase, profile } = await requireAdmin();
  const courseId = String(input.courseId || '').trim().toUpperCase();
  if (!(await courseExists(supabase, courseId))) return fail('Unknown course.');

  const itemId = input.itemId.trim();
  const stem = input.stem.trim();
  if (!itemId) return fail('Question ID is required.');
  if (!stem) return fail('Question stem is required.');

  // The three lists, before the table's CHECKs say it in Postgres's words.
  if (!(QUESTION_TYPES as readonly string[]).includes(input.questionType)) return fail('Please choose a question type.');
  const difficulty = String(input.difficulty || '');
  if (difficulty && !(DIFFICULTIES as readonly string[]).includes(difficulty)) return fail('Please choose a difficulty from the list.');
  const bloomLevel = String(input.bloomLevel || '');
  if (bloomLevel && !(BLOOM_LEVELS as readonly string[]).includes(bloomLevel)) return fail('Please choose a level from the list.');

  let correct: string;
  if (input.questionType === 'SATA') {
    const checked = input.correct.map((c) => c.trim().toLowerCase()).filter(Boolean);
    if (!checked.length) return fail('Select at least one correct option for SATA.');
    correct = checked.join(',');
  } else {
    correct = (input.correct[0] || 'a').trim().toLowerCase();
  }

  const db = createServiceRoleClient();

  // 08 B5: the subject and topic must be on the course's lists, or Not
  // set. A retired word is kept only on a question that already carries
  // it. The database's keys hold the same rule; this says it in words.
  const lists = await courseLists(db, courseId);
  if (!lists) return fail("Could not read this course's subject and topic lists. Please try again.");
  let stored: { subject: string | null; maintopic: string | null } | null = null;
  if (!input.isNew) {
    const { data } = await db.from('question_bank').select('subject, maintopic').eq('item_id', itemId).maybeSingle();
    stored = (data as typeof stored) ?? null;
  }
  const words: Record<'subject' | 'maintopic', string | null> = { subject: null, maintopic: null };
  for (const [col, list, noun] of [
    ['subject', lists.subjects, 'Subject'],
    ['maintopic', lists.topics, 'Topic'],
  ] as const) {
    const typed = String(input[col] || '').trim();
    if (!typed) continue;
    const entry = findOnList(list, typed);
    if (!entry) return fail(`${noun} "${typed}" is not on this course's list.`);
    if (entry.retired && stored?.[col] !== entry.name) return fail(`${noun} "${entry.name}" is retired on this course's list.`);
    words[col] = entry.name;
  }

  // A mock's questions are never free (08 §3 item 4). A TypeScript check
  // here and in saveQuiz holds the rule from both sides until 03 Q14's
  // link table lets SQL hold it.
  if (input.isFreeSample) {
    const reserved = await heldBackIds(db);
    if (!reserved) return fail('Could not check the mock exams. Please try again.');
    if (reserved.has(itemId)) return fail(FREE_IN_MOCK);
  }

  // The image first, as legacy: a failed upload stops the save.
  let imgUrl: string | null = input.rationaleImg || null;
  const file = image?.get('file');
  if (file instanceof File && file.size > 0) {
    if (file.size > RATIONALE_IMAGE_MAX_BYTES) return fail('Image must be under 2MB.');
    imgUrl = await uploadRationaleImage(itemId, file);
    if (!imgUrl) return fail('Image upload failed. Please try again.');
  }

  const payload: Record<string, unknown> = {
    item_id: itemId,
    course_id: courseId,
    question_type: input.questionType,
    stem,
    correct,
    rationale: input.rationale.trim() || null,
    rationale_img: imgUrl,
    subject: words.subject,
    maintopic: words.maintopic,
    subtopic: input.subtopic.trim() || null,
    difficulty: difficulty || null,
    marks: parseFloat(input.marks) || 1,
    batch_id: input.batchId.trim() || null,
    shuffle_options: input.shuffleOptions,
    bloom_level: bloomLevel || null,
    is_published: Boolean(input.isPublished),
    is_free_sample: Boolean(input.isFreeSample),
    question_ref: String(input.questionRef || '').trim() || null,
    tags: snapTags(Array.isArray(input.tags) ? input.tags : [], await tagSpellingsInUse(db)),
    updated_by: profile.user_id,
  };
  for (const letter of OPTION_LETTERS) {
    payload[`option_${letter}`] = (input.options[letter] || '').trim() || null;
    payload[`fb_${letter}`] = (input.feedback[letter] || '').trim() || null;
  }

  // item_id is the primary key, so the id alone is the whole scope —
  // one row, or none. (The payload carries course_id, so an admin who
  // edits an item under another course moves it there, as before B2.)
  const { error } = input.isNew
    ? await db.from('question_bank').insert(payload)
    : await db.from('question_bank').update(payload).eq('item_id', itemId);
  if (error) return fail('Save failed: ' + error.message);

  return { ok: true };
}

// ── Publish / Unpublish (08 B4) ────────────────────────────────────────
// Before an unpublish the page asks how many live quizzes name the rows
// (a fixed quiz or mock that is active and published): each will refuse
// to start until the question is published again, and the admin is told
// so in the app's dialog before the switch flips.
export async function countQuizzesNaming(courseId: string, itemIds: string[]): Promise<QuizUseResult> {
  await requireAdmin();
  const course = String(courseId || '').trim().toUpperCase();
  const ids = [...new Set(itemIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!course || !ids.length) return { ok: true, count: 0 };
  const count = await liveQuizzesNaming(createServiceRoleClient(), course, ids);
  if (count === null) return { ok: false, error: 'Could not check which quizzes use this question.' };
  return { ok: true, count };
}

// One row, or every row the page is showing ("Publish all shown"). The
// flip is a label change: it writes no history and keeps the version
// (ruled 2026-09-26). Rows already in the wanted state are left alone,
// so `changed` is what really moved. In slices of 200 ids, because the
// ids ride in the request's address.
const PUBLISH_SLICE = 200;

export async function setPublished(courseId: string, itemIds: string[], published: boolean): Promise<PublishResult> {
  const { supabase, profile } = await requireAdmin();
  const course = String(courseId || '').trim().toUpperCase();
  if (!(await courseExists(supabase, course))) return { ok: false, error: 'Unknown course.' };
  const ids = [...new Set(itemIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return { ok: false, error: 'No questions were selected.' };

  const db = createServiceRoleClient();
  let changed = 0;
  for (let i = 0; i < ids.length; i += PUBLISH_SLICE) {
    const { data, error } = await db
      .from('question_bank')
      .update({ is_published: published, updated_by: profile.user_id })
      .eq('course_id', course)
      .eq('is_published', !published)
      .in('item_id', ids.slice(i, i + PUBLISH_SLICE))
      .select('item_id');
    if (error) {
      const verb = published ? 'Publish' : 'Unpublish';
      return { ok: false, error: `${verb} failed: ${error.message}` + (changed ? ` (${changed} changed before the failure)` : '') };
    }
    changed += (data ?? []).length;
  }

  const blocked = published ? 0 : ((await liveQuizzesNaming(db, course, ids)) ?? 0);
  return { ok: true, changed, blockedQuizzes: blocked };
}

// ── runCsvImport (slice 4b) ────────────────────────────────────────────
// The rows arrive already read and checked in the browser (lib/bank/csv,
// the report the admin saw); the same rules run again here on what was
// sent, then legacy's upsert on item_id in batches of 50. A batch that
// fails counts its rows as failed and carries the message back — legacy
// wrote it to the browser console, which a Server Action cannot reach.
//
// 08 B4: the importer stamps `updated_by` like the save, so a published
// row whose content a file changes gets a history row naming who. The
// file's two choices — publish now or keep as drafts, free or not — go
// on the rows the file CREATES only. A row that exists keeps its own
// switches, so a re-import of a live course file cannot unpublish a
// question or make one free; "Publish all shown" is the door for
// publishing existing drafts. "Import as free" is refused row by row for
// an id a mock names, with the tick's words.
//
// New and existing rows go in separate batches: a batch's columns are
// the union of its rows' keys, so one new row's switches in a batch
// would hand every existing row in it a switch too.
const IMPORT_BATCH = 50;

export async function importItems(
  courseIdIn: string,
  rows: CsvRow[],
  choices: ImportChoices = { publishNew: false, freeNew: false },
): Promise<ImportResult> {
  const { supabase, profile } = await requireAdmin();
  const courseId = String(courseIdIn || '').trim().toUpperCase();
  if (!(await courseExists(supabase, courseId))) return { ok: false, error: 'Unknown course.' };
  const publishNew = Boolean(choices?.publishNew);
  const freeNew = Boolean(choices?.freeNew);

  const db = createServiceRoleClient();
  const [inUse, reserved, lists] = await Promise.all([
    tagSpellingsInUse(db),
    freeNew ? heldBackIds(db) : Promise.resolve(new Set<string>()),
    courseLists(db, courseId),
  ]);
  if (!reserved) return { ok: false, error: 'Could not check the mock exams. Please try again.' };
  if (!lists) return { ok: false, error: "Could not read this course's subject and topic lists. Please try again." };

  // Every row lands in the one table under the page's course (08 B1).
  let failCount = 0;
  const errors: string[] = [];
  const payloads: Record<string, unknown>[] = [];
  for (const r of rows) {
    if (!(r.stem && r.correct && (r.option_a || r.option_b))) continue;
    const row: CsvRow = { ...r, item_id: r.item_id || `${courseId.replace(/_/g, '')}_${Date.now()}` };
    const offList = checkListColumns(row) ?? checkCourseWords(row, courseId, lists);
    if (offList) {
      failCount++;
      errors.push(`${row.item_id}: ${offList}`);
      continue;
    }
    const payload: Record<string, unknown> = { ...rowToPayload(row), course_id: courseId, updated_by: profile.user_id };
    if (Array.isArray(payload.tags)) {
      const tags = snapTags(payload.tags as string[], inUse);
      // a spelling first seen in this file is the one its later rows take
      for (const t of tags) if (!inUse.has(t.toLowerCase())) inUse.set(t.toLowerCase(), t);
      payload.tags = tags;
    }
    payloads.push(payload);
  }
  if (!payloads.length) return { ok: true, successCount: 0, failCount, errors, created: 0, updated: 0 };

  const existing = await existingItemIds(db, payloads.map((p) => String(p.item_id)));
  if (!existing) return { ok: false, error: 'Could not read the question bank. Please try again.' };

  const creates: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  for (const p of payloads) {
    const id = String(p.item_id);
    if (existing.has(id)) {
      updates.push(p);
    } else if (freeNew && reserved.has(id)) {
      failCount++;
      errors.push(`${id}: ${FREE_IN_MOCK}`);
    } else {
      creates.push({ ...p, is_published: publishNew, is_free_sample: freeNew });
    }
  }

  let created = 0;
  let updated = 0;
  for (const [group, isNew] of [[creates, true], [updates, false]] as const) {
    for (let i = 0; i < group.length; i += IMPORT_BATCH) {
      const batch = group.slice(i, i + IMPORT_BATCH);
      const { error } = await db.from('question_bank').upsert(batch, { onConflict: 'item_id' });
      if (error) {
        failCount += batch.length;
        errors.push(error.message);
        console.error('CSV import batch error:', error);
      } else if (isNew) {
        created += batch.length;
      } else {
        updated += batch.length;
      }
    }
  }
  return { ok: true, successCount: created + updated, failCount, errors: [...new Set(errors)], created, updated };
}

// ── The Tags panel (08 B4): whole bank ─────────────────────────────────
// Tags are one list across every course (Sam, 2026-09-26): the save
// already snaps a tag to the spelling in use anywhere in the bank, and a
// tag is a label a student will meet across courses. A rename changes
// the tag on every question carrying it; a merge is a rename onto a tag
// already in use; a delete takes it off every question. Each is a label
// change — no history row, no new version — stamped with the admin.
// Rows are rewritten in groups that end up with the same tag list, so a
// tag on a thousand questions is a handful of statements, not a thousand.

const TAG_SEPARATORS = /[;,]/;

/** Trimmed, inner spaces collapsed — the one shape a tag is stored in. */
function tidyTag(tag: string): string {
  return String(tag ?? '').trim().replace(/\s+/g, ' ');
}

export async function loadTagCounts(): Promise<TagListResult> {
  await requireAdmin();
  const rows = await taggedRows(createServiceRoleClient());
  if (!rows) return { ok: false, error: 'Could not read the tags. Please try again.' };
  const counts = new Map<string, number>();
  for (const row of rows) for (const tag of row.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  const tags = [...counts].map(([tag, count]) => ({ tag, count }));
  tags.sort((a, b) => a.tag.localeCompare(b.tag, undefined, { sensitivity: 'base' }));
  return { ok: true, tags };
}

/**
 * Rewrites every tagged row through `change` and saves the rows that
 * came out different, grouped by their new list.
 */
async function rewriteTags(actor: string, change: (tags: string[]) => string[]): Promise<TagChangeResult> {
  const db = createServiceRoleClient();
  const rows = await taggedRows(db);
  if (!rows) return { ok: false, error: 'Could not read the tags. Please try again.' };

  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const next = normaliseTags(change(row.tags));
    if (JSON.stringify(next) === JSON.stringify(row.tags)) continue;
    const key = JSON.stringify(next);
    groups.set(key, [...(groups.get(key) ?? []), row.item_id]);
  }

  let changed = 0;
  for (const [key, ids] of groups) {
    for (let i = 0; i < ids.length; i += PUBLISH_SLICE) {
      const slice = ids.slice(i, i + PUBLISH_SLICE);
      const { error } = await db
        .from('question_bank')
        .update({ tags: JSON.parse(key) as string[], updated_by: actor })
        .in('item_id', slice);
      if (error) {
        return { ok: false, error: `Could not update the tags: ${error.message}` + (changed ? ` (${changed} questions changed before the failure)` : '') };
      }
      changed += slice.length;
    }
  }
  return { ok: true, changed };
}

// Rename, and merge: `from` becomes `to` on every question. When `to` is
// already in use under another spelling it takes that spelling, so the
// two become one tag; a case-only rename ("pain" → "Pain") changes the
// spelling everywhere.
export async function renameTag(fromIn: string, toIn: string): Promise<TagChangeResult> {
  const { profile } = await requireAdmin();
  const from = tidyTag(fromIn);
  let to = tidyTag(toIn);
  if (!from) return { ok: false, error: 'Choose a tag first.' };
  if (!to) return { ok: false, error: 'Please enter the new name.' };
  if (TAG_SEPARATORS.test(to)) return { ok: false, error: 'A tag cannot contain a comma or a semicolon.' };
  if (to.toLowerCase() !== from.toLowerCase()) {
    const inUse = await tagSpellingsInUse(createServiceRoleClient());
    to = inUse.get(to.toLowerCase()) ?? to;
  } else if (to === from) {
    return { ok: true, changed: 0 };
  }
  const key = from.toLowerCase();
  return rewriteTags(profile.user_id, (tags) => tags.map((t) => (t.toLowerCase() === key ? to : t)));
}

export async function deleteTag(tagIn: string): Promise<TagChangeResult> {
  const { profile } = await requireAdmin();
  const key = tidyTag(tagIn).toLowerCase();
  if (!key) return { ok: false, error: 'Choose a tag first.' };
  return rewriteTags(profile.user_id, (tags) => tags.filter((t) => t.toLowerCase() !== key));
}

// ── The Free pool panel (08 B4) ────────────────────────────────────────
// The free rows per programme, from the courses' program_scope. A course
// in several programmes counts under each — General Paper is in all
// five — so the programme figures overlap and do not add up; the panel
// says so. `free` counts published rows only (a draft is in no pool);
// drafts marked free are shown beside it.
export async function loadFreePool(): Promise<FreePoolResult> {
  const { supabase } = await requireAdmin();
  const [programs, courses, counts] = await Promise.all([
    getPrograms(supabase),
    getAllCourses(supabase),
    freeRowCounts(createServiceRoleClient()),
  ]);
  if (!counts) return { ok: false, error: 'Could not count the free questions. Please try again.' };

  const courseRow = (c: (typeof courses)[number]): FreePoolCourse => ({
    courseId: c.course_id,
    title: c.title,
    archived: c.status === 'archived',
    free: counts.get(c.course_id)?.free ?? 0,
    freeDrafts: counts.get(c.course_id)?.freeDrafts ?? 0,
  });

  const programmes: FreePoolProgramme[] = programs.map((p) => {
    const inScope = courses.filter((c) => (c.program_scope ?? []).includes(p.program_id)).map(courseRow);
    return {
      programId: p.program_id,
      name: p.program_name,
      free: inScope.reduce((n, c) => n + c.free, 0),
      courses: inScope,
    };
  });
  const totalFree = [...counts.values()].reduce((n, c) => n + c.free, 0);
  return { ok: true, programmes, totalFree };
}

// ── confirmDelete ──────────────────────────────────────────────────────
// 08 B4: two statements. The first stamps who is deleting (a label-only
// change, so it writes no history); the second deletes, and the trigger
// copies the row to history marked deleted, naming that admin.
export async function deleteQuestion(courseId: string, itemId: string): Promise<ActionResult> {
  const { profile } = await requireAdmin();
  const course = String(courseId || '').trim().toUpperCase();
  if (!course) return fail('Unknown course.');

  const db = createServiceRoleClient();
  const { error: stampError } = await db
    .from('question_bank')
    .update({ updated_by: profile.user_id })
    .eq('item_id', itemId)
    .eq('course_id', course);
  if (stampError) return fail('Delete failed: ' + stampError.message);

  const { error } = await db.from('question_bank').delete().eq('item_id', itemId).eq('course_id', course);
  if (error) return fail('Delete failed: ' + error.message);
  return { ok: true };
}

// ── The Subjects & topics panel (08 B5) ────────────────────────────────
// A course's two lists and the questions on them. The database's keys
// carry a rename to every question (on update cascade) and refuse a
// delete while a question uses the word; these actions say the same
// things in words first, and stamp `updated_by` on the questions they
// move. Every move is a label change: no history row, no new version.
// Service role behind requireAdmin() — the lists hold no browser grant.

const LIST_TABLE: Record<ListKind, 'bank_subjects' | 'bank_topics'> = { subject: 'bank_subjects', topic: 'bank_topics' };
const LIST_COLUMN: Record<ListKind, 'subject' | 'maintopic'> = { subject: 'subject', topic: 'maintopic' };
const LIST_NOUN: Record<ListKind, string> = { subject: 'subject', topic: 'topic' };

/** A word as a list stores it: trimmed, runs of spaces made one. */
function tidyWord(word: string): string {
  return String(word ?? '').trim().replace(/\s+/g, ' ');
}

function listKindOk(kind: string): kind is ListKind {
  return kind === 'subject' || kind === 'topic';
}

async function readEntry(db: ServiceDb, kind: ListKind, courseId: string, id: number) {
  const { data, error } = await db.from(LIST_TABLE[kind]).select('id, name, retired').eq('course_id', courseId).eq('id', id).maybeSingle();
  if (error) console.error('readEntry:', error);
  return (data as ListEntry | null) ?? null;
}

/** Stamps who moved the questions now carrying `word` (a label change). */
async function stampWord(db: ServiceDb, kind: ListKind, courseId: string, word: string, actor: string) {
  const { error } = await db.from('question_bank').update({ updated_by: actor }).eq('course_id', courseId).eq(LIST_COLUMN[kind], word);
  if (error) console.error('stampWord:', error);
}

export async function loadListPanel(courseIdIn: string): Promise<ListPanelResult> {
  await requireAdmin();
  const courseId = String(courseIdIn || '').trim().toUpperCase();
  if (!courseId) return { ok: false, error: 'Please select a course first.' };
  const db = createServiceRoleClient();
  const [lists, rows] = await Promise.all([courseLists(db, courseId), courseWordRows(db, courseId)]);
  if (!lists || !rows) return { ok: false, error: "Could not read this course's lists. Please try again." };

  const tally = (col: 'subject' | 'maintopic') => {
    const m = new Map<string, number>();
    for (const r of rows) if (r[col]) m.set(r[col] as string, (m.get(r[col] as string) ?? 0) + 1);
    return m;
  };
  const subjectCounts = tally('subject');
  const topicCounts = tally('maintopic');
  return {
    ok: true,
    subjects: lists.subjects.map((e) => ({ ...e, count: subjectCounts.get(e.name) ?? 0 })),
    topics: lists.topics.map((e) => ({ ...e, count: topicCounts.get(e.name) ?? 0 })),
    notSet: { subject: rows.filter((r) => !r.subject).length, topic: rows.filter((r) => !r.maintopic).length },
    questions: rows.length,
  };
}

export async function addListEntry(kind: ListKind, courseIdIn: string, nameIn: string): Promise<ListChangeResult> {
  const { supabase } = await requireAdmin();
  if (!listKindOk(kind)) return { ok: false, error: 'Unknown list.' };
  const courseId = String(courseIdIn || '').trim().toUpperCase();
  if (!(await courseExists(supabase, courseId))) return { ok: false, error: 'Unknown course.' };
  const name = tidyWord(nameIn);
  if (!name) return { ok: false, error: `Please enter the ${LIST_NOUN[kind]}.` };

  const db = createServiceRoleClient();
  const lists = await courseLists(db, courseId);
  if (!lists) return { ok: false, error: "Could not read this course's lists. Please try again." };
  const twin = findOnList(kind === 'subject' ? lists.subjects : lists.topics, name);
  if (twin) return { ok: false, error: `“${twin.name}” is already on the list${twin.retired ? ' (retired — restore it instead)' : ''}.` };

  const { error } = await db.from(LIST_TABLE[kind]).insert({ course_id: courseId, name });
  if (error) return { ok: false, error: `Could not add it: ${error.message}` };
  return { ok: true, changed: 0 };
}

// A rename changes the list row; the key carries the new word to every
// question. Onto a word already on the list it would be a merge — the
// panel asks and calls mergeListEntries instead, so here it is refused.
export async function renameListEntry(kind: ListKind, courseIdIn: string, id: number, nameIn: string): Promise<ListChangeResult> {
  const { profile } = await requireAdmin();
  if (!listKindOk(kind)) return { ok: false, error: 'Unknown list.' };
  const courseId = String(courseIdIn || '').trim().toUpperCase();
  const name = tidyWord(nameIn);
  if (!name) return { ok: false, error: 'Please enter the new name.' };

  const db = createServiceRoleClient();
  const entry = await readEntry(db, kind, courseId, id);
  if (!entry) return { ok: false, error: 'That entry is no longer on the list.' };
  if (entry.name === name) return { ok: true, changed: 0 };
  const lists = await courseLists(db, courseId);
  if (!lists) return { ok: false, error: "Could not read this course's lists. Please try again." };
  const twin = findOnList(kind === 'subject' ? lists.subjects : lists.topics, name);
  if (twin && twin.id !== entry.id) return { ok: false, error: `“${twin.name}” is already on the list — merge into it instead.` };

  const { count } = await db
    .from('question_bank')
    .select('item_id', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .eq(LIST_COLUMN[kind], entry.name);
  const { error } = await db.from(LIST_TABLE[kind]).update({ name }).eq('id', entry.id);
  if (error) return { ok: false, error: `Could not rename it: ${error.message}` };
  await stampWord(db, kind, courseId, name, profile.user_id);
  return { ok: true, changed: count ?? 0 };
}

// Every question on `from` moves to `into`; the emptied entry is deleted.
export async function mergeListEntries(kind: ListKind, courseIdIn: string, fromId: number, intoId: number): Promise<ListChangeResult> {
  const { profile } = await requireAdmin();
  if (!listKindOk(kind)) return { ok: false, error: 'Unknown list.' };
  const courseId = String(courseIdIn || '').trim().toUpperCase();
  if (fromId === intoId) return { ok: false, error: 'Choose a different entry to merge into.' };

  const db = createServiceRoleClient();
  const [from, into] = await Promise.all([readEntry(db, kind, courseId, fromId), readEntry(db, kind, courseId, intoId)]);
  if (!from || !into) return { ok: false, error: 'That entry is no longer on the list.' };

  const { data, error } = await db
    .from('question_bank')
    .update({ [LIST_COLUMN[kind]]: into.name, updated_by: profile.user_id })
    .eq('course_id', courseId)
    .eq(LIST_COLUMN[kind], from.name)
    .select('item_id');
  if (error) return { ok: false, error: `Could not merge: ${error.message}` };
  const { error: delError } = await db.from(LIST_TABLE[kind]).delete().eq('id', from.id);
  if (delError) return { ok: false, error: `The questions moved, but “${from.name}” could not be removed: ${delError.message}` };
  return { ok: true, changed: (data ?? []).length };
}

export async function setListEntryRetired(kind: ListKind, courseIdIn: string, id: number, retired: boolean): Promise<ListChangeResult> {
  await requireAdmin();
  if (!listKindOk(kind)) return { ok: false, error: 'Unknown list.' };
  const courseId = String(courseIdIn || '').trim().toUpperCase();
  const { error } = await createServiceRoleClient()
    .from(LIST_TABLE[kind])
    .update({ retired: Boolean(retired) })
    .eq('course_id', courseId)
    .eq('id', id);
  if (error) return { ok: false, error: `Could not update it: ${error.message}` };
  return { ok: true, changed: 0 };
}

// Refused while any question carries the word — the key refuses it too.
export async function deleteListEntry(kind: ListKind, courseIdIn: string, id: number): Promise<ListChangeResult> {
  await requireAdmin();
  if (!listKindOk(kind)) return { ok: false, error: 'Unknown list.' };
  const courseId = String(courseIdIn || '').trim().toUpperCase();
  const db = createServiceRoleClient();
  const entry = await readEntry(db, kind, courseId, id);
  if (!entry) return { ok: false, error: 'That entry is no longer on the list.' };

  const { count, error: countError } = await db
    .from('question_bank')
    .select('item_id', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .eq(LIST_COLUMN[kind], entry.name);
  if (countError) return { ok: false, error: 'Could not check the questions. Please try again.' };
  if (count) {
    return {
      ok: false,
      error: `${count} question${count === 1 ? ' still uses' : 's still use'} “${entry.name}” — merge it into another ${LIST_NOUN[kind]}, or retire it.`,
    };
  }
  const { error } = await db.from(LIST_TABLE[kind]).delete().eq('id', entry.id);
  if (error) return { ok: false, error: `Could not delete it: ${error.message}` };
  return { ok: true, changed: 0 };
}

// A double such as "Cardiovascular/Emergency": its questions take one
// part as their topic — added to the list if new — and the other parts
// join their tags, snapped to the spellings in use; the emptied entry is
// deleted. Only topics split (Sam, 2026-09-26: one topic per question).
export async function splitTopic(courseIdIn: string, id: number, keepIn: string): Promise<ListChangeResult> {
  const { profile } = await requireAdmin();
  const courseId = String(courseIdIn || '').trim().toUpperCase();
  const db = createServiceRoleClient();
  const entry = await readEntry(db, 'topic', courseId, id);
  if (!entry) return { ok: false, error: 'That topic is no longer on the list.' };

  const parts = entry.name.split('/').map(tidyWord).filter(Boolean);
  if (parts.length < 2) return { ok: false, error: `“${entry.name}” has no “/” to split on.` };
  const keep = parts.find((p) => p.toLowerCase() === tidyWord(keepIn).toLowerCase());
  if (!keep) return { ok: false, error: 'Choose which part becomes the topic.' };
  const toTags = parts.filter((p) => p !== keep);

  const [lists, inUse, rows] = await Promise.all([courseLists(db, courseId), tagSpellingsInUse(db), courseWordRows(db, courseId)]);
  if (!lists || !rows) return { ok: false, error: "Could not read this course's lists. Please try again." };

  // the kept part: the list's own spelling if it is there, else added
  let topic = findOnList(lists.topics, keep);
  if (!topic) {
    const { data, error } = await db.from('bank_topics').insert({ course_id: courseId, name: keep }).select('id, name, retired').single();
    if (error) return { ok: false, error: `Could not add “${keep}”: ${error.message}` };
    topic = data as ListEntry;
  }

  const groups = new Map<string, string[]>();
  for (const r of rows.filter((r) => r.maintopic === entry.name)) {
    const key = JSON.stringify(snapTags([...r.tags, ...toTags], inUse));
    groups.set(key, [...(groups.get(key) ?? []), r.item_id]);
  }
  let changed = 0;
  for (const [key, ids] of groups) {
    for (let i = 0; i < ids.length; i += PUBLISH_SLICE) {
      const slice = ids.slice(i, i + PUBLISH_SLICE);
      const { error } = await db
        .from('question_bank')
        .update({ maintopic: topic.name, tags: JSON.parse(key) as string[], updated_by: profile.user_id })
        .in('item_id', slice);
      if (error) {
        return { ok: false, error: `Could not split: ${error.message}` + (changed ? ` (${changed} questions moved before the failure)` : '') };
      }
      changed += slice.length;
    }
  }
  const { error: delError } = await db.from('bank_topics').delete().eq('id', entry.id);
  if (delError) return { ok: false, error: `The questions moved, but “${entry.name}” could not be removed: ${delError.message}` };
  return { ok: true, changed };
}
