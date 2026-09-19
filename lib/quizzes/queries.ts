// lib/quizzes/queries.ts
//
// The fixed-quiz and mock-exam reads, transcribed one for one from
// legacy js/mynmclicensure-api.js: getQuizzes, getAllQuizzesPaginated,
// getAllQuizzes, getQuizById, getMockQuizzes, getAllMockQuizzes,
// getMockQuizById. The two tables share a shape, so each read takes the
// kind and the table follows (lib/quizzes/types QUIZ_TABLES). As legacy,
// each fails open: an error is logged and an empty result returned.
//
// Two clients since Q1 (20260919170000_quiz_floor.sql, 03-quiz-system.md):
//   - the caller's per-request client for what a page renders — the
//     policies are course-scoped and item_ids / notes are not readable
//     by the browser roles, so these reads name the card's columns;
//   - the service role for the full row (item_ids, notes) — the attempt
//     spawn and the admin's edit and whole-table reads, each behind its
//     gate. The admin's cookie client is `authenticated` too and cannot
//     read the two columns.
// RLS is the floor, not the filter (AGENTS.md): the student reads still
// name "published + active" here.

import type { ServerSupabaseClient } from '@/lib/access';
import type { createServiceRoleClient } from '@/lib/supabase/server';
import { QUIZ_TABLES, type Quiz, type QuizCard, type QuizKind, type QuizListRow, type QuizPage } from './types';

export type ServiceDb = ReturnType<typeof createServiceRoleClient>;

// Every column but item_ids and notes — what the browser roles may read.
const CARD_COLUMNS =
  'quiz_id, course_id, title, n, allowed_modes, shuffle, time_limit_sec, published, publish_at, unpublish_at, status, created_at, updated_at';
const MOCK_CARD_COLUMNS = `${CARD_COLUMNS}, visibility`;

function cardColumns(kind: QuizKind): string {
  return kind === 'mock' ? MOCK_CARD_COLUMNS : CARD_COLUMNS;
}

// getQuizzes / getMockQuizzes: one course, by title, for a student's
// page — published + active rows, the card's columns. The policy is the
// floor beneath: a course the student does not hold returns nothing.
export async function getQuizzesForCourse(db: ServerSupabaseClient, kind: QuizKind, courseId: string): Promise<QuizCard[]> {
  const { data, error } = await db
    .from(QUIZ_TABLES[kind])
    .select(cardColumns(kind))
    .eq('course_id', courseId)
    .eq('published', true)
    .eq('status', 'active')
    .order('title');
  if (error) {
    console.error('getQuizzesForCourse:', error);
    return [];
  }
  return (data ?? []) as unknown as QuizCard[];
}

// getAllQuizzesPaginated: the fixed-quiz admin list, fifty at a time,
// newest first, the search an ilike on title or quiz_id. Legacy selected
// only the list's columns (no item_ids); so does this — the admin's own
// client reads it.
export async function getAllQuizzesPaginated(
  db: ServerSupabaseClient,
  searchTerm = '',
  page = 0,
  pageSize = 50,
): Promise<QuizPage> {
  let query = db
    .from('quizzes')
    .select('quiz_id, course_id, title, status, published, allowed_modes, n, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (searchTerm) {
    const term = `%${searchTerm}%`;
    query = query.or(`title.ilike.${term},quiz_id.ilike.${term}`);
  }

  query = query.range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('getAllQuizzesPaginated:', error);
    return { quizzes: [], total: 0 };
  }
  return { quizzes: (data ?? []) as QuizListRow[], total: count ?? 0 };
}

// getAllQuizzes / getAllMockQuizzes: every row, every course, every
// status — by course then title. The mock-exam admin list (whole) and
// the attempts analytics page (slice 14). Full rows: service role,
// behind requireAdmin().
export async function getAllQuizzes(db: ServiceDb, kind: QuizKind): Promise<Quiz[]> {
  const { data, error } = await db.from(QUIZ_TABLES[kind]).select('*').order('course_id').order('title');
  if (error) {
    console.error('getAllQuizzes:', error);
    return [];
  }
  return (data ?? []) as Quiz[];
}

// getQuizById / getMockQuizById: the full row — the attempt spawn's read
// before launch (slice 6, behind requireStudent() and the access check),
// the admin edit step (behind requireAdmin()). Service role.
export async function getQuizById(db: ServiceDb, kind: QuizKind, quizId: string): Promise<Quiz | null> {
  const { data, error } = await db.from(QUIZ_TABLES[kind]).select('*').eq('quiz_id', quizId).maybeSingle();
  if (error) {
    console.error('getQuizById:', error);
    return null;
  }
  return (data as Quiz | null) ?? null;
}
