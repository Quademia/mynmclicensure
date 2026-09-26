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
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkListColumns, rowToPayload, type CsvRow } from './csv';
import { uploadRationaleImage } from './images';
import { getItemFilterOptions, getItemsByFilters, liveQuizzesNaming, mockReservedIds, tagSpellingsInUse } from './queries';
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
  type ImportResult,
  type PublishResult,
  type QuestionType,
  type QuizUseResult,
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
// two switches are never in the payload — a row the file creates is a
// draft (the table's default) until 08 B4's second session gives the
// file its "publish now" choice, and a row that exists keeps its own.
const IMPORT_BATCH = 50;

export async function importItems(courseIdIn: string, rows: CsvRow[]): Promise<ImportResult> {
  const { supabase, profile } = await requireAdmin();
  const courseId = String(courseIdIn || '').trim().toUpperCase();
  if (!(await courseExists(supabase, courseId))) return { ok: false, error: 'Unknown course.' };

  const db = createServiceRoleClient();
  const inUse = await tagSpellingsInUse(db);

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
    if (Array.isArray(payload.tags)) payload.tags = snapTags(payload.tags as string[], inUse);
    payloads.push(payload);
  }
  if (!payloads.length) return { ok: true, successCount: 0, failCount, errors };

  let successCount = 0;
  for (let i = 0; i < payloads.length; i += IMPORT_BATCH) {
    const batch = payloads.slice(i, i + IMPORT_BATCH);
    const { error } = await db.from('question_bank').upsert(batch, { onConflict: 'item_id' });
    if (error) {
      failCount += batch.length;
      errors.push(error.message);
      console.error('CSV import batch error:', error);
    } else {
      successCount += batch.length;
    }
  }
  return { ok: true, successCount, failCount, errors: [...new Set(errors)] };
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
