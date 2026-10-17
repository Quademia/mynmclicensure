'use server';

// lib/history/actions.ts — Learning History's Load more (05.5). The first
// page and the figures are the page's own read; each later page of twenty
// comes from here, worded as the first.

import { requireStudent } from '@/lib/access';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { getHistoryChunk } from './queries';
import type { HistoryChunk } from './types';

export async function loadMoreHistory(courseId: string, page: number): Promise<HistoryChunk> {
  const { supabase, profile } = await requireStudent();
  const access = await getStudentCourseAccess(supabase, profile.user_id);
  return getHistoryChunk(profile.user_id, access, String(courseId || ''), Math.max(0, Math.floor(Number(page) || 0)));
}
