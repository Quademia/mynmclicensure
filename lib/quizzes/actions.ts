// lib/quizzes/actions.ts
//
// The Fixed Quizzes and Mock Exams admin pages' reads-on-demand and
// writes as Server Actions behind the admin gate — legacy
// admin/fixed-quizzes.html and admin/mock-exams.html did all of this from
// the browser with direct `db.from(...)` calls. Each write repeats the
// page's own validation, in its order, with its words. A Supabase error
// comes back as its own message, as the legacy pages showed it. The row
// types and constants live in ./types.
//
// 03 Q14 (§8 S20, 2026-09-27): the writes go through the service role
// behind requireAdmin() — rule 9 took INSERT / UPDATE / DELETE on both
// quiz tables back from the browser roles with the two admin write
// policies — and the save is one database function, save_quiz(), which
// writes the quiz row and replaces its question rows in one step.

'use server';

import { requireAdmin } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getQuizAttemptStats } from '@/lib/attempts/queries';
import type { AttemptMode, QuizAttemptStats } from '@/lib/attempts/types';
import { getItemsByFilters } from '@/lib/bank/queries';
import { MODES, orderModes } from '@/lib/attempts/modes';
import { getAllQuizzesPaginated, getQuizById } from './queries';
import {
  QUIZ_STATUSES,
  QUIZ_TABLES,
  type ActionResult,
  type PickerLoad,
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
//
// 06.8: a paper's picker offers the course's Paper questions, a mock's its
// Mock questions — the only ones its list can hold (a question may sit in
// several mocks).
export async function loadPickerItems(courseId: string, kind: QuizKind): Promise<PickerLoad> {
  await requireAdmin();
  const items = await getItemsByFilters(createServiceRoleClient(), courseId, { pool: kind === 'mock' ? 'mock' : 'paper' });
  return { ok: true, items };
}

// ── togglePublish ───────────────────────────────────────────────────────
// 04.16 (Sam, 2026-10-13): a mock goes live — Active and Published — only
// when every question in it is published. Its questions are written as
// drafts and published when it goes live; one left behind would show the
// student Start, then refuse. The words for both doors (the form's save,
// the list's Published switch).
function draftRefusal(drafts: number): string {
  const which = drafts === 1 ? 'One question in this mock is still a draft' : `${drafts} questions in this mock are still drafts`;
  return `${which}. Publish ${drafts === 1 ? 'it' : 'them'} in the Question Bank before making the mock live (Active and Published), or save it unpublished.`;
}

async function draftsIn(itemIds: string[]): Promise<number | null> {
  if (!itemIds.length) return 0;
  const { count, error } = await createServiceRoleClient()
    .from('question_bank')
    .select('item_id', { count: 'exact', head: true })
    .in('item_id', itemIds)
    .eq('is_published', false);
  return error ? null : (count ?? 0);
}

export async function setQuizPublished(kind: QuizKind, quizId: string, published: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (kind === 'mock' && published) {
    const quiz = await getQuizById(createServiceRoleClient(), 'mock', quizId);
    if (!quiz) return fail('That mock exam no longer exists.');
    if (quiz.status === 'active') {
      const drafts = await draftsIn(quiz.item_ids);
      if (drafts === null) return fail('Could not check the questions. Please try again.');
      if (drafts > 0) return fail(draftRefusal(drafts));
    }
  }
  const { error } = await createServiceRoleClient()
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
  await requireAdmin();
  if (status !== 'archived' && status !== 'draft') return fail('A quiz is archived, or restored as a draft.');
  const { error } = await createServiceRoleClient()
    .from(QUIZ_TABLES[kind])
    .update({ status, updated_at: new Date().toISOString() })
    .eq('quiz_id', quizId);
  if (error) return fail('Error: ' + error.message);
  return { ok: true };
}

// A datetime-local string ("YYYY-MM-DDTHH:MM", seconds optional) read as
// Ghana time, which is UTC — the results date (04.12) and the review's
// close (04.13). null when it is not one.
function utcStamp(raw: string): Date | null {
  const typed = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.exec(raw);
  const stamp = typed ? new Date(raw + (typed[1] ? 'Z' : ':00Z')) : null;
  return stamp && !Number.isNaN(stamp.getTime()) ? stamp : null;
}

const REVIEWS: readonly string[] = ['always', 'until', 'never'];

// ── saveQuiz ────────────────────────────────────────────────────────────
// The page's checks, in legacy's order, then legacy's payload and the
// picked ids to save_quiz() (03 Q14), which writes both in one step and
// refuses a repeat or a question not in the quiz's course by name. The
// two schedule datetime strings go in as they are; the results date and
// the review's close go in marked UTC (04.12, 04.13).
export async function saveQuiz(input: SaveQuizInput): Promise<ActionResult> {
  await requireAdmin();
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
  // §8 S21: the ticked modes, in the table's order, each once; at least one
  const sent = Array.isArray(input.allowedModes) ? input.allowedModes.map((m) => String(m)) : [];
  const allowedModes = orderModes(sent);
  if (allowedModes.length !== new Set(sent).size) return fail('Please choose a valid mode.');
  if (!allowedModes.length) return fail(`Tick at least one mode students can take this ${noun} in.`);
  // 04.5, 04.11: the first sitting of a paper or a mock is in one of its
  // ticked modes (the table's check holds it too); Free Navigation unless
  // the admin says otherwise.
  const firstMode = String(input.firstMode || 'TIMED_FREE_NAV');
  if (!(allowedModes as string[]).includes(firstMode)) {
    return fail('"First sitting in" must be one of the ticked modes. Tick it, or pick another.');
  }
  // 04.10: a whole number above 0, or empty for no limit (the table's
  // check holds it too).
  const sittingsRaw = String(input.sittingsAllowed ?? '').trim();
  const sittingsAllowed = sittingsRaw ? Number(sittingsRaw) : null;
  if (sittingsAllowed !== null && !(Number.isInteger(sittingsAllowed) && sittingsAllowed > 0)) {
    return fail('"Sittings allowed" is a whole number above 0, or empty for no limit.');
  }
  // 04.12 (Sam, 2026-10-15): results on a date, or '' for Immediately.
  // The form sends the datetime-local string, Ghana time, which is UTC;
  // it goes to the database marked UTC, so the database never reads it in
  // a zone of its own. On a date the first sitting is in an exam mode —
  // the table's check holds it too, in a constraint's words; these are
  // the form's.
  const resultsRaw = String(input.resultsAt ?? '').trim();
  let resultsAt: string | null = null;
  if (resultsRaw) {
    const stamp = utcStamp(resultsRaw);
    if (!stamp) return fail('Choose the date and time results come out.');
    if (MODES[firstMode as AttemptMode].group !== 'exam') {
      return fail('Results on a date need the first sitting in an exam mode: Free Navigation or Sequential.');
    }
    resultsAt = stamp.toISOString();
  }
  // 04.13 (Sam, 2026-10-15): the review Always, Until a date (marked UTC,
  // as the results date), or Not allowed. The form's words, asked again
  // here; the table's check holds all three. A request with no review is
  // refused rather than read as Always, which would show answers an admin
  // had closed.
  const review = String(input.review ?? '');
  if (!REVIEWS.includes(review)) return fail('Please choose a valid Review setting.');
  let reviewClosesAt: string | null = null;
  if (review === 'until') {
    const stamp = utcStamp(String(input.reviewClosesAt ?? '').trim());
    if (!stamp) return fail('Choose the date and time the review closes.');
    if (resultsAt && stamp.getTime() <= new Date(resultsAt).getTime()) {
      return fail('The review must close after the results come out. To never show the answers, choose Not allowed.');
    }
    reviewClosesAt = stamp.toISOString();
  }
  if (review === 'until' && firstMode === 'UNTIMED_LEARNING') return fail("With a review that closes, the first sitting can't be Learning: it shows each answer, and no one could start the paper after the close.");
  if (review === 'never' && (allowedModes as string[]).includes('UNTIMED_LEARNING')) {
    return fail("With the review not allowed, Learning can't be offered: it shows each answer. Untick Learning.");
  }

  // 06.8: a paper holds only Paper questions, a mock only Mock ones. The
  // database refuses another pool's question too; this names them all.
  {
    const want = input.kind === 'mock' ? 'mock' : 'paper';
    const noun = input.kind === 'mock' ? 'a mock exam' : 'a practice paper';
    const { data: other, error: otherError } = await createServiceRoleClient()
      .from('question_bank')
      .select('item_id')
      .in('item_id', itemIds)
      .neq('pool', want)
      .order('item_id');
    if (otherError) return fail('Could not check the questions. Please try again.');
    const ids = (other ?? []).map((r) => (r as { item_id: string }).item_id);
    const pool = want === 'mock' ? 'Mock' : 'Paper';
    if (ids.length === 1) return fail(`Question ${ids[0]} is not in the ${pool} pool, so it cannot be in ${noun}.`);
    if (ids.length > 1) return fail(`Questions ${ids.join(', ')} are not in the ${pool} pool, so they cannot be in ${noun}.`);
  }

  if (input.kind === 'mock' && input.status === 'active' && input.published) {
    const drafts = await draftsIn(itemIds);
    if (drafts === null) return fail('Could not check the questions. Please try again.');
    if (drafts > 0) return fail(draftRefusal(drafts));
  }

  const timeLimitRaw = input.timeLimitSec.trim();
  const timeLimit = timeLimitRaw ? parseInt(timeLimitRaw, 10) : null;

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    quiz_id: quizId,
    course_id: courseId,
    title,
    allowed_modes: allowedModes,
    shuffle: input.shuffle,
    time_limit_sec: Number.isFinite(timeLimit) ? timeLimit : null,
    published: input.published,
    publish_at: input.publishAt || null,
    unpublish_at: input.unpublishAt || null,
    status: input.status,
    notes: input.notes.trim() || null,
    first_mode: firstMode,
    sittings_allowed: sittingsAllowed,
    results_at: resultsAt,
    review,
    review_closes_at: reviewClosesAt,
    updated_at: now,
  };
  if (!input.isEdit) payload.created_at = now;

  // `n` is the rows written, set by the function.
  const { error } = await createServiceRoleClient().rpc('save_quiz', {
    p_kind: input.kind,
    p_is_edit: input.isEdit,
    p_quiz: payload,
    p_item_ids: itemIds,
  });
  if (error) return fail(`Error saving ${noun}: ` + error.message);

  return { ok: true };
}

// ── the attempt-stats box on the details step (legacy openEditQuiz) ───
// Added with slice 5b, once `attempts` existed.
export async function loadQuizAttemptStats(kind: QuizKind, quizId: string): Promise<QuizAttemptStats> {
  await requireAdmin();
  // The service role (04.12): the admin sees every score, held or not.
  return getQuizAttemptStats(createServiceRoleClient(), kind, quizId);
}
