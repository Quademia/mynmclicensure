// lib/quizzes/queries.ts
//
// The fixed-quiz and mock-exam reads, transcribed one for one from
// legacy js/mynmclicensure-api.js: getQuizzes, getAllQuizzesPaginated,
// getAllQuizzes, getQuizById, getMockQuizzes, getAllMockQuizzes,
// getMockQuizById. The two tables share a shape, so each read takes the
// kind and the table follows (lib/quizzes/types QUIZ_TABLES). Each takes
// the caller's per-request client and, as legacy, fails open: an error
// is logged and an empty result returned.
//
// RLS is the floor, not the filter (AGENTS.md): the "published + active"
// student reads name their filter here.

import type { ServerSupabaseClient } from '@/lib/access';
import { QUIZ_TABLES, type Quiz, type QuizKind, type QuizListRow, type QuizPage } from './types';

// getQuizzes / getMockQuizzes: one course, by title. Students see only
// published + active rows; adminMode returns every row of the course.
export async function getQuizzesForCourse(
  db: ServerSupabaseClient,
  kind: QuizKind,
  courseId: string,
  adminMode = false,
): Promise<Quiz[]> {
  let query = db.from(QUIZ_TABLES[kind]).select('*').eq('course_id', courseId).order('title');
  if (!adminMode) query = query.eq('published', true).eq('status', 'active');

  const { data, error } = await query;
  if (error) {
    console.error('getQuizzesForCourse:', error);
    return [];
  }
  return (data ?? []) as Quiz[];
}

// getAllQuizzesPaginated: the fixed-quiz admin list, fifty at a time,
// newest first, the search an ilike on title or quiz_id. Legacy selected
// only the list's columns (no item_ids); so does this.
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
// the attempts analytics page (slice 14).
export async function getAllQuizzes(db: ServerSupabaseClient, kind: QuizKind): Promise<Quiz[]> {
  const { data, error } = await db.from(QUIZ_TABLES[kind]).select('*').order('course_id').order('title');
  if (error) {
    console.error('getAllQuizzes:', error);
    return [];
  }
  return (data ?? []) as Quiz[];
}

// getQuizById / getMockQuizById: the full row — the runner's read before
// launch (slice 6), the admin edit step.
export async function getQuizById(db: ServerSupabaseClient, kind: QuizKind, quizId: string): Promise<Quiz | null> {
  const { data, error } = await db.from(QUIZ_TABLES[kind]).select('*').eq('quiz_id', quizId).maybeSingle();
  if (error) {
    console.error('getQuizById:', error);
    return null;
  }
  return (data as Quiz | null) ?? null;
}
