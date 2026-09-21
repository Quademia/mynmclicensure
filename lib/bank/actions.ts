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

'use server';

import { requireAdmin } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { rowToPayload, type CsvRow } from './csv';
import { uploadRationaleImage } from './images';
import { getItemFilterOptions, getItemsByFilters } from './queries';
import { courseExists } from './queries';
import {
  OPTION_LETTERS,
  RATIONALE_IMAGE_MAX_BYTES,
  type ActionResult,
  type CourseItemsResult,
  type ImportResult,
  type QuestionType,
} from './types';

function fail(error: string): ActionResult {
  return { ok: false, error };
}

// ── onCourseChange: the whole course plus the two dropdowns ────────────
export async function loadCourseItems(courseId: string): Promise<CourseItemsResult> {
  const { supabase } = await requireAdmin();
  if (!courseId.trim()) return { ok: false, error: 'Unknown course.' };

  const [items, options] = await Promise.all([
    getItemsByFilters(createServiceRoleClient(), courseId, {}),
    getItemFilterOptions(supabase, courseId),
  ]);
  return { ok: true, items, maintopics: options.maintopics, batchIds: options.batch_ids };
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
};

export async function saveQuestion(input: SaveQuestionInput, image: FormData | null): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const courseId = String(input.courseId || '').trim().toUpperCase();
  if (!(await courseExists(supabase, courseId))) return fail('Unknown course.');

  const itemId = input.itemId.trim();
  const stem = input.stem.trim();
  if (!itemId) return fail('Question ID is required.');
  if (!stem) return fail('Question stem is required.');

  let correct: string;
  if (input.questionType === 'SATA') {
    const checked = input.correct.map((c) => c.trim().toLowerCase()).filter(Boolean);
    if (!checked.length) return fail('Select at least one correct option for SATA.');
    correct = checked.join(',');
  } else {
    correct = (input.correct[0] || 'a').trim().toLowerCase();
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
    difficulty: input.difficulty || null,
    marks: parseFloat(input.marks) || 1,
    batch_id: input.batchId.trim() || null,
    shuffle_options: input.shuffleOptions,
  };
  for (const letter of OPTION_LETTERS) {
    payload[`option_${letter}`] = (input.options[letter] || '').trim() || null;
    payload[`fb_${letter}`] = (input.feedback[letter] || '').trim() || null;
  }

  // item_id is the primary key, so the id alone is the whole scope —
  // one row, or none. (The payload carries course_id, so an admin who
  // edits an item under another course moves it there, as before B2.)
  const db = createServiceRoleClient();
  const { error } = input.isNew
    ? await db.from('question_bank').insert(payload)
    : await db.from('question_bank').update(payload).eq('item_id', itemId);
  if (error) return fail('Save failed: ' + error.message);

  return { ok: true };
}

// ── runCsvImport (slice 4b) ────────────────────────────────────────────
// The rows arrive already read and checked in the browser (lib/bank/csv,
// the report the admin saw); the same rules run again here on what was
// sent, then legacy's upsert on item_id in batches of 50. A batch that
// fails counts its rows as failed and carries the message back — legacy
// wrote it to the browser console, which a Server Action cannot reach.
const IMPORT_BATCH = 50;

export async function importItems(courseIdIn: string, rows: CsvRow[]): Promise<ImportResult> {
  const { supabase } = await requireAdmin();
  const courseId = String(courseIdIn || '').trim().toUpperCase();
  if (!(await courseExists(supabase, courseId))) return { ok: false, error: 'Unknown course.' };

  // Every row lands in the one table under the page's course (08 B1).
  const payloads = rows
    .filter((r) => r.stem && r.correct && (r.option_a || r.option_b))
    .map((r) => ({ ...rowToPayload({ ...r, item_id: r.item_id || `${courseId.replace(/_/g, '')}_${Date.now()}` }), course_id: courseId }));
  if (!payloads.length) return { ok: true, successCount: 0, failCount: 0, errors: [] };

  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];
  const db = createServiceRoleClient();
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
export async function deleteQuestion(courseId: string, itemId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!String(courseId || '').trim()) return fail('Unknown course.');

  const { error } = await createServiceRoleClient()
    .from('question_bank')
    .delete()
    .eq('item_id', itemId)
    .eq('course_id', String(courseId).trim().toUpperCase());
  if (error) return fail('Delete failed: ' + error.message);
  return { ok: true };
}
