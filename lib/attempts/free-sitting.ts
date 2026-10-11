// lib/attempts/free-sitting.ts
//
// A free sitting (03, 04.4): a Quiz Builder quiz, or its retake, whose
// questions are all published free questions of its course. A student
// with no live grant for the course may still open it, play it, review it
// and read its report — the free set is open to every signed-in student
// (F1). Papers and mocks are never free. The callers have already checked
// the sitting is the student's own; the rows are read with the service
// role (the bank's free mark is the test, not the browser's view of it).
//
// Built for the free builder (2026-10-11). What a sitting made in the
// trial shows once the trial ends — the review locked, an unfinished one
// finishable — is F2's, with the free account's pages.

import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Attempt } from './types';

export async function isFreeSitting(attempt: Pick<Attempt, 'attempt_id' | 'course_id' | 'quiz_id'>): Promise<boolean> {
  if (attempt.quiz_id) return false;
  const svc = createServiceRoleClient();

  const { data, error } = await svc.from('attempt_items').select('item_id').eq('attempt_id', attempt.attempt_id);
  if (error) {
    console.error('isFreeSitting rows:', attempt.attempt_id, error);
    return false;
  }
  const ids = [...new Set((data ?? []).map((r) => (r as { item_id: string }).item_id))];
  if (!ids.length) return false;

  // A builder quiz holds at most the builder's limit (50), one request.
  const { count, error: countError } = await svc
    .from('question_bank')
    .select('item_id', { count: 'exact', head: true })
    .eq('course_id', attempt.course_id)
    .eq('is_published', true)
    .eq('is_free_sample', true)
    .in('item_id', ids);
  if (countError) {
    console.error('isFreeSitting bank:', attempt.attempt_id, countError);
    return false;
  }
  return count === ids.length;
}
