// lib/attempts/queries.ts
//
// The attempt reads, transcribed one for one from legacy
// js/mynmclicensure-api.js and the runners: getAttemptById,
// getStudentAttempts, getBuilderCourseItems. Each takes the caller's
// per-request client and, as legacy, fails open: an error is logged and
// an empty result returned.
//
// RLS is the floor, not the filter (AGENTS.md): the student reads name
// their user; the runner's ownership check is in lib/attempts/runner-load.

import type { ServerSupabaseClient } from '@/lib/access';
import { itemsTableFor } from '@/lib/bank/tables';
import type { Attempt, BuilderItem, QuizAttemptStats } from './types';

// The admin details step's attempt-stats box (legacy openEditQuiz's
// inline read on both admin quiz pages): every attempt on the quiz, the
// completed count and the mean completed score, rounded.
export async function getQuizAttemptStats(db: ServerSupabaseClient, quizId: string): Promise<QuizAttemptStats> {
  const { data, error } = await db.from('attempts').select('attempt_id, status, score_pct').eq('quiz_id', quizId);
  if (error) {
    console.error('getQuizAttemptStats:', error);
    return { total: 0, completed: 0, avgScore: 0 };
  }
  const rows = (data ?? []) as { status: string; score_pct: number | null }[];
  const completedRows = rows.filter((a) => a.status === 'completed');
  const completed = completedRows.length;
  const avgScore = completed > 0 ? Math.round(completedRows.reduce((s, a) => s + (a.score_pct || 0), 0) / completed) : 0;
  return { total: rows.length, completed, avgScore };
}

export async function getAttemptById(db: ServerSupabaseClient, attemptId: string): Promise<Attempt | null> {
  const { data, error } = await db.from('attempts').select('*').eq('attempt_id', attemptId).maybeSingle();
  if (error) {
    console.error('getAttemptById:', error);
    return null;
  }
  return (data as Attempt | null) ?? null;
}

/** A student's attempts, newest first; one course when asked (the list pages, 5b). */
export async function getStudentAttempts(
  db: ServerSupabaseClient,
  userId: string,
  courseId: string | null = null,
): Promise<Attempt[]> {
  let query = db.from('attempts').select('*').eq('user_id', userId).order('ts_iso', { ascending: false });
  if (courseId) query = query.eq('course_id', courseId);
  const { data, error } = await query;
  if (error) {
    console.error('getStudentAttempts:', error);
    return [];
  }
  return (data ?? []) as Attempt[];
}

// The builder's whole-course read: the light columns the wizard filters
// and counts on, by item id. (The SELECT policy through user_has_course()
// returns nothing for a course the student cannot access.)
export async function getBuilderCourseItems(db: ServerSupabaseClient, courseId: string): Promise<BuilderItem[]> {
  const table = itemsTableFor(courseId);
  if (!table) return [];
  const { data, error } = await db
    .from(table)
    .select('item_id, subject, maintopic, subtopic, difficulty, question_type, stem, rationale')
    .order('item_id');
  if (error) {
    console.error('getBuilderCourseItems:', error);
    return [];
  }
  return (data ?? []) as BuilderItem[];
}
