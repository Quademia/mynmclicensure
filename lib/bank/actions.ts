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
import { checkListColumns, rowToPayload, type CsvRow } from './csv';
import { uploadRationaleImage } from './images';
import {
  existingItemIds,
  freeRowCounts,
  getItemFilterOptions,
  getItemsByFilters,
  liveQuizzesNaming,
  mockReservedIds,
  taggedRows,
  tagSpellingsInUse,
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
  const [items, options, tags] = await Promise.all([
    getItemsByFilters(svc, courseId, {}),
    getItemFilterOptions(supabase, courseId, { publishedOnly: false }),
    tagSpellingsInUse(svc),
  ]);
  return {
    ok: true,
    items,
    maintopics: options.maintopics,
    batchIds: options.batch_ids,
    tagsInUse: [...tags.values()].sort((a, b) => a.localeCompare(b)),
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

  // A mock's questions are never free (08 §3 item 4). A TypeScript check
  // here and in saveQuiz holds the rule from both sides until 03 Q14's
  // link table lets SQL hold it.
  if (input.isFreeSample) {
    const reserved = await mockReservedIds(db);
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
    subject: input.subject.trim() || null,
    maintopic: input.maintopic.trim() || null,
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
  const [inUse, reserved] = await Promise.all([
    tagSpellingsInUse(db),
    freeNew ? mockReservedIds(db) : Promise.resolve(new Set<string>()),
  ]);
  if (!reserved) return { ok: false, error: 'Could not check the mock exams. Please try again.' };

  // Every row lands in the one table under the page's course (08 B1).
  let failCount = 0;
  const errors: string[] = [];
  const payloads: Record<string, unknown>[] = [];
  for (const r of rows) {
    if (!(r.stem && r.correct && (r.option_a || r.option_b))) continue;
    const row: CsvRow = { ...r, item_id: r.item_id || `${courseId.replace(/_/g, '')}_${Date.now()}` };
    const offList = checkListColumns(row);
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
