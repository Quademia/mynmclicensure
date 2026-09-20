// lib/attempts/admin-actions.ts
//
// The admin Attempts analytics page's Server Actions (slice 14b), each
// behind requireAdmin(): the four headline counts, the window's rows,
// and one attempt's full row for the detail modal. The window bounds
// arrive from the browser as ISO strings — legacy computed "today" and
// "N days ago" on the admin's own clock and calendar, and so does this
// page; the server only applies them.

'use server';

import { requireAdmin } from '@/lib/access';
import { countAttempts, getAttemptsWindow, type AttemptsWindow } from './admin-queries';
import { getAttemptById } from './queries';
import type { AttemptDetail } from './types';

export type HeadlineCounts = { total: number; today: number; week: number; month: number };

function iso(v: unknown): string | null {
  const s = String(v || '').trim();
  return s && !Number.isNaN(new Date(s).getTime()) ? s : null;
}

export async function headlineCountsAction(todayIso: string, weekIso: string, monthIso: string): Promise<HeadlineCounts> {
  const { supabase } = await requireAdmin();
  const [total, today, week, month] = await Promise.all([
    countAttempts(supabase, null, null),
    countAttempts(supabase, iso(todayIso), null),
    countAttempts(supabase, iso(weekIso), null),
    countAttempts(supabase, iso(monthIso), null),
  ]);
  return { total, today, week, month };
}

export async function attemptsWindowAction(fromIso: string | null, toIso: string | null): Promise<AttemptsWindow> {
  const { supabase } = await requireAdmin();
  return getAttemptsWindow(supabase, iso(fromIso), iso(toIso));
}

// The detail modal: the header plus the count of answered rows (since
// 03 Q5 the answers are attempt_items rows; the admin reads every row).
export async function attemptDetailAction(attemptIdIn: string): Promise<AttemptDetail | null> {
  const { supabase } = await requireAdmin();
  const attemptId = String(attemptIdIn || '').trim();
  if (!attemptId) return null;
  const attempt = await getAttemptById(supabase, attemptId);
  if (!attempt) return null;
  const { count, error } = await supabase
    .from('attempt_items')
    .select('attempt_item_id', { count: 'exact', head: true })
    .eq('attempt_id', attemptId)
    .not('chosen', 'is', null);
  if (error) console.error('attemptDetailAction rows:', error);
  return { ...attempt, answered_count: Number(count ?? 0) };
}
