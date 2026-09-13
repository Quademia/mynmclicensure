// lib/bank/actions.ts
//
// The Question Bank page's writes and its "load a course" read as Server
// Actions behind the admin gate — legacy admin/question-bank.html did all
// of this from the browser with direct `db.from(...)` calls. Each action
// repeats the page's own validation, in its order, with its words, then
// writes as the signed-in admin (the RLS admin policies are the floor). A
// Supabase error comes back as its own message, as the legacy page showed
// it. The row types and constants live in ./types.

'use server';

import { requireAdmin } from '@/lib/access';
import { uploadRationaleImage } from './images';
import { getItemFilterOptions, getItemsByFilters } from './queries';
import { itemsTableFor } from './tables';
import {
  OPTION_LETTERS,
  RATIONALE_IMAGE_MAX_BYTES,
  type ActionResult,
  type CourseItemsResult,
  type QuestionType,
} from './types';

function fail(error: string): ActionResult {
  return { ok: false, error };
}

// ── onCourseChange: the whole course plus the two dropdowns ────────────
export async function loadCourseItems(courseId: string): Promise<CourseItemsResult> {
  const { supabase } = await requireAdmin();
  if (!itemsTableFor(courseId)) return { ok: false, error: 'Unknown course.' };

  const [items, options] = await Promise.all([
    getItemsByFilters(supabase, courseId, {}),
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
  const table = itemsTableFor(input.courseId);
  if (!table) return fail('Unknown course.');

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

  const { error } = input.isNew
    ? await supabase.from(table).insert(payload)
    : await supabase.from(table).update(payload).eq('item_id', itemId);
  if (error) return fail('Save failed: ' + error.message);

  return { ok: true };
}

// ── confirmDelete ──────────────────────────────────────────────────────
export async function deleteQuestion(courseId: string, itemId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const table = itemsTableFor(courseId);
  if (!table) return fail('Unknown course.');

  const { error } = await supabase.from(table).delete().eq('item_id', itemId);
  if (error) return fail('Delete failed: ' + error.message);
  return { ok: true };
}
