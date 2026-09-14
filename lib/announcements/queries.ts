// lib/announcements/queries.ts
//
// The announcement reads, transcribed from legacy: the admin page's
// loadData (every row newest first, the engagement counts from every
// notice row, the distinct cohorts from `users`), and the student side —
// getAnnouncements (js/mynmclicensure-api.js: active and in schedule,
// pinned first then priority), the student's subscription kind and
// active product (the inline read on the dashboard and the
// announcements page: the most recently expiring ACTIVE subscription),
// the student's notice rows. The scope filter runs here on the server
// (rebuild.md §12 slice 11) through lib/announcements/scoping.
//
// Each takes the caller's per-request client and, as legacy, fails
// open: an error is logged and an empty result returned. RLS is the
// floor, not the filter (AGENTS.md): every student read names the
// student.

import type { ServerSupabaseClient } from '@/lib/access';
import type { Profile } from '@/lib/auth/profile';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { filterAnnouncementsForStudent, mergeNoticeStates } from './scoping';
import type { Announcement, EngageMap, StudentNoticeMap, StudentScope } from './types';

// ── admin ──────────────────────────────────────────────────────────────
export async function getAllAnnouncements(db: ServerSupabaseClient): Promise<Announcement[]> {
  const { data, error } = await db.from('announcements').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('getAllAnnouncements:', error);
    return [];
  }
  return (data ?? []) as Announcement[];
}

export async function getEngagementCounts(db: ServerSupabaseClient): Promise<EngageMap> {
  const { data, error } = await db.from('user_notice_state').select('item_id, state').eq('item_type', 'ANNOUNCEMENT');
  if (error) {
    console.error('getEngagementCounts:', error);
    return {};
  }
  const map: EngageMap = {};
  for (const row of (data ?? []) as { item_id: string; state: string }[]) {
    if (!map[row.item_id]) map[row.item_id] = { read: 0, clicked: 0, dismissed: 0 };
    if (row.state === 'read' || row.state === 'clicked' || row.state === 'dismissed') map[row.item_id][row.state]++;
  }
  return map;
}

// legacy: `select cohort from users where cohort is not null`, deduped and sorted
export async function getCohorts(db: ServerSupabaseClient): Promise<string[]> {
  const { data, error } = await db.from('users').select('cohort').not('cohort', 'is', null);
  if (error) {
    console.error('getCohorts:', error);
    return [];
  }
  return [...new Set((data ?? []).map((u: { cohort: string | null }) => u.cohort).filter((c): c is string => Boolean(c)))].sort();
}

export async function getAnnouncementById(db: ServerSupabaseClient, id: string): Promise<Announcement | null> {
  const { data, error } = await db.from('announcements').select('*').eq('announcement_id', id).maybeSingle();
  if (error) {
    console.error('getAnnouncementById:', error);
    return null;
  }
  return (data as Announcement | null) ?? null;
}

// ── student ────────────────────────────────────────────────────────────
// legacy getAnnouncements: active, in schedule, pinned first, then priority.
export async function getActiveAnnouncements(db: ServerSupabaseClient): Promise<Announcement[]> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from('announcements')
    .select('*')
    .eq('status', 'active')
    .or(`start_at.is.null,start_at.lte.${now}`)
    .or(`end_at.is.null,end_at.gte.${now}`)
    .order('pinned', { ascending: false })
    .order('priority', { ascending: false });
  if (error) {
    console.error('getActiveAnnouncements:', error);
    return [];
  }
  return (data ?? []) as Announcement[];
}

// The student's scope: the profile fields legacy read, the subscription
// kind and product from the most recently expiring ACTIVE subscription
// (FREE and '' when none), and the courses the access map covers.
export async function getStudentScope(db: ServerSupabaseClient, profile: Profile): Promise<StudentScope> {
  const [{ data: activeSub }, access] = await Promise.all([
    db
      .from('subscriptions')
      .select('product_id, products(kind)')
      .eq('user_id', profile.user_id)
      .eq('status', 'ACTIVE')
      .order('expires_utc', { ascending: false })
      .limit(1)
      .maybeSingle(),
    getStudentCourseAccess(db, profile.user_id),
  ]);

  type SubRow = { product_id: string | null; products: { kind: string | null } | null };
  const sub = (activeSub as SubRow | null) ?? null;

  return {
    user_id: profile.user_id,
    role: profile.role,
    program_id: profile.program_id,
    level: profile.level,
    cohort: profile.cohort,
    subscriptionKind: sub?.products?.kind || 'FREE',
    activeProductId: sub?.product_id || '',
    courseIds: Object.keys(access),
  };
}

// The announcements this student qualifies for, in legacy's order.
export async function getAnnouncementsForStudent(db: ServerSupabaseClient, profile: Profile): Promise<Announcement[]> {
  const [all, scope] = await Promise.all([getActiveAnnouncements(db), getStudentScope(db, profile)]);
  return filterAnnouncementsForStudent(all, scope);
}

export async function getStudentNoticeStates(db: ServerSupabaseClient, userId: string): Promise<StudentNoticeMap> {
  const { data, error } = await db
    .from('user_notice_state')
    .select('item_id, state')
    .eq('user_id', userId)
    .eq('item_type', 'ANNOUNCEMENT');
  if (error) {
    console.error('getStudentNoticeStates:', error);
    return {};
  }
  return mergeNoticeStates((data ?? []) as { item_id: string; state: string }[]);
}
