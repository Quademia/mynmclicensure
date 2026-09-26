// lib/quizzes/actions.ts
//
// The Fixed Quizzes and Mock Exams admin pages' reads-on-demand and
// writes as Server Actions behind the admin gate — legacy
// admin/fixed-quizzes.html and admin/mock-exams.html did all of this from
// the browser with direct `db.from(...)` calls. Each write repeats the
// page's own validation, in its order, with its words, then writes as
// the signed-in admin (the RLS admin policies are the floor). A Supabase
// error comes back as its own message, as the legacy pages showed it.
// The row types and constants live in ./types.

'use server';

import { requireAdmin } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getQuizAttemptStats } from '@/lib/attempts/queries';
import type { QuizAttemptStats } from '@/lib/attempts/types';
import { getItemsByFilters } from '@/lib/bank/queries';
import type { Item } from '@/lib/bank/types';
import { getAllQuizzesPaginated, getQuizById } from './queries';
import {
  ALLOWED_MODES,
  QUIZ_STATUSES,
  QUIZ_TABLES,
  type ActionResult,
  type Quiz,
  type QuizKind,
  type QuizPage,
  type QuizStatus,
  type SaveQuizInput,
} from './types';

function fail(error: string): ActionResult {
  return { ok: false, error };
}

// The words differ by page; everything else is the same script.
const NOUN: Record<QuizKind, string> = { fixed: 'quiz', mock: 'mock exam' };

// ── loadQuizList: one page of either list (legacy loadQuizList; the mock
// list pages too since Q2) ──
export async function loadQuizPage(kind: QuizKind, searchTerm: string, page: number): Promise<QuizPage> {
  const { supabase } = await requireAdmin();
  return getAllQuizzesPaginated(supabase, kind, searchTerm, page, 50);
}

// ── openEditQuiz: the full row ──────────────────────────────────────────
// Legacy's fixed-quiz list selected only the list columns, then opened
// the row from that list — so the edit form came up with no questions,
// no time limit, no schedule and no notes until something re-fetched the
// whole table. The mock page loaded whole rows and had no such gap. The
// edit step here reads the full row (legacy getQuizById) for both.
// Logged as a fix in the 2026-09-13 session entry; not in §9. Service
// role since Q1: the admin's own client cannot read item_ids or notes.
export async function loadQuiz(kind: QuizKind, quizId: string): Promise<Quiz | null> {
  await requireAdmin();
  return getQuizById(createServiceRoleClient(), kind, quizId);
}

// ── loadPickerItems: the course's whole bank (legacy getItemsByFilters(courseId, {})) ──
// Service role since B2, for the same reason as loadQuiz above: the
// picker shows whole rows, and the admin's own client cannot read the
// answer half of question_bank any more.
export async function loadPickerItems(courseId: string): Promise<Item[]> {
  await requireAdmin();
  return getItemsByFilters(createServiceRoleClient(), courseId, {});
}

// ── togglePublish ───────────────────────────────────────────────────────
export async function setQuizPublished(kind: QuizKind, quizId: string, published: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from(QUIZ_TABLES[kind])
    .update({ published, updated_at: new Date().toISOString() })
    .eq('quiz_id', quizId);
  if (error) return fail('Failed to update: ' + error.message);
  return { ok: true };
}

// ── archiveCurrentQuiz: archive one-way, restore to draft ─────────────
// Legacy toggled archived ↔ active, so an archived draft came back
// active without anyone publishing it (D45 c). Since Q2 this action
// accepts two words only: 'archived' from any status, 'draft' as the
// only way back; active is a choice made on the details form.
export async function setQuizStatus(kind: QuizKind, quizId: string, status: QuizStatus): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (status !== 'archived' && status !== 'draft') return fail('A quiz is archived, or restored as a draft.');
  const { error } = await supabase
    .from(QUIZ_TABLES[kind])
    .update({ status, updated_at: new Date().toISOString() })
    .eq('quiz_id', quizId);
  if (error) return fail('Error: ' + error.message);
  return { ok: true };
}

// ── saveQuiz ────────────────────────────────────────────────────────────
// The page's checks, in legacy's order, then the insert or update with
// legacy's payload. The two datetime strings go in as they are.
export async function saveQuiz(input: SaveQuizInput): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const noun = NOUN[input.kind];

  const courseId = input.courseId;
  const title = input.title.trim();
  const quizId = input.quizId.trim();
  if (!courseId) return fail('Please select a course.');
  if (!title) return fail(`Please enter a ${noun} title.`);
  if (!quizId) return fail(`${input.kind === 'fixed' ? 'Quiz' : 'Mock Exam'} ID could not be generated. Please re-select the course.`);

  const itemIds = input.itemIds.map((id) => String(id || '').trim()).filter(Boolean);
  const n = itemIds.length;
  if (n === 0) return fail(`Cannot save a ${noun} with no questions.`);

  // Q2 (D45 d): the two words checked against their lists before the
  // write, as saveAnnouncement checks its own; Q1's CHECKs are the floor.
  if (!(QUIZ_STATUSES as readonly string[]).includes(input.status)) return fail('Please choose a valid status.');
  if (!(ALLOWED_MODES as readonly string[]).includes(input.allowedModes)) return fail('Please choose a valid mode.');

  // 08 B4: a mock's questions are never free (08 §3 item 4). The bank's
  // save refuses the free tick on a question a mock names; this is the
  // same rule from the other side. Service role: the free mark is
  // readable by the admin's client, but the rule should not rest on it.
  if (input.kind === 'mock') {
    const { data: free, error: freeError } = await createServiceRoleClient()
      .from('question_bank')
      .select('item_id')
      .in('item_id', itemIds)
      .eq('is_free_sample', true)
      .order('item_id');
    if (freeError) return fail('Could not check the questions. Please try again.');
    const freeIds = (free ?? []).map((r) => (r as { item_id: string }).item_id);
    if (freeIds.length === 1) return fail(`Question ${freeIds[0]} is a free question and cannot be in a mock exam.`);
    if (freeIds.length > 1) return fail(`Questions ${freeIds.join(', ')} are free questions and cannot be in a mock exam.`);
  }

  const timeLimitRaw = input.timeLimitSec.trim();
  const timeLimit = timeLimitRaw ? parseInt(timeLimitRaw, 10) : null;

  const payload: Record<string, unknown> = {
    course_id: courseId,
    title,
    item_ids: itemIds,
    n,
    allowed_modes: input.allowedModes,
    shuffle: input.shuffle,
    time_limit_sec: Number.isFinite(timeLimit) ? timeLimit : null,
    published: input.published,
    publish_at: input.publishAt || null,
    unpublish_at: input.unpublishAt || null,
    status: input.status,
    notes: input.notes.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const table = QUIZ_TABLES[input.kind];
  let error: { message: string } | null;
  if (input.isEdit) {
    ({ error } = await supabase.from(table).update(payload).eq('quiz_id', quizId));
  } else {
    payload.quiz_id = quizId;
    payload.created_at = new Date().toISOString();
    ({ error } = await supabase.from(table).insert(payload));
  }
  if (error) return fail(`Error saving ${noun}: ` + error.message);

  return { ok: true };
}

// ── the attempt-stats box on the details step (legacy openEditQuiz) ───
// Added with slice 5b, once `attempts` existed.
export async function loadQuizAttemptStats(kind: QuizKind, quizId: string): Promise<QuizAttemptStats> {
  const { supabase } = await requireAdmin();
  return getQuizAttemptStats(supabase, kind, quizId);
}
