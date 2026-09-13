// lib/subscriptions/queries.ts
//
// The subscription reads, transcribed one for one: getStudentCourseAccess
// from legacy js/mynmclicensure-api.js; the admin list's joined select
// from admin/subscriptions.html; the Grant dialog's student search from
// the same page; getSubscriptionById and
// getActiveSubscriptionForUserProduct from the payments Worker. Each
// takes the caller's per-request client and, as legacy, fails open: an
// error is logged and an empty result returned.
//
// RLS is the floor, not the filter (AGENTS.md): every student read names
// its user; the admin list is admin by the gate that made the client.

import type { ServerSupabaseClient } from '@/lib/access';
import { nowIso } from './dates';
import type { CourseAccessMap, StudentHit, Subscription, SubscriptionListRow } from './types';

// ── getStudentCourseAccess ──────────────────────────────────────────────
// Every ACTIVE subscription with its product; for each course the product
// covers, add the subscription's remaining days (rounded up; a
// subscription with none left is skipped). The expiry the student sees
// is today plus the total — doc 02's stacking, the reader's half of the
// two mechanisms (rebuild.md §7).
export async function getStudentCourseAccess(db: ServerSupabaseClient, userId: string): Promise<CourseAccessMap> {
  const now = new Date();

  const { data, error } = await db
    .from('subscriptions')
    .select('*, products ( product_id, name, kind, courses_included )')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE');

  if (error) {
    console.error('getStudentCourseAccess:', error);
    return {};
  }

  type Row = Subscription & { products: { courses_included: string[] | null } | null };
  const courseMap: Record<string, { totalDays: number; expires: Date }> = {};

  for (const sub of (data ?? []) as Row[]) {
    if (!sub.products?.courses_included) continue;

    const remainingMs = new Date(sub.expires_utc).getTime() - now.getTime();
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
    if (remainingDays === 0) continue;

    for (const courseId of sub.products.courses_included) {
      if (!courseMap[courseId]) {
        courseMap[courseId] = {
          totalDays: remainingDays,
          expires: new Date(now.getTime() + remainingDays * 24 * 60 * 60 * 1000),
        };
      } else {
        courseMap[courseId].totalDays += remainingDays;
        courseMap[courseId].expires = new Date(now.getTime() + courseMap[courseId].totalDays * 24 * 60 * 60 * 1000);
      }
    }
  }

  const result: CourseAccessMap = {};
  for (const [courseId, v] of Object.entries(courseMap)) {
    result[courseId] = { totalDays: v.totalDays, expires: v.expires.toISOString() };
  }
  return result;
}

// ── the admin list (legacy loadData) ───────────────────────────────────
export async function getAllSubscriptions(db: ServerSupabaseClient): Promise<SubscriptionListRow[]> {
  const { data, error } = await db
    .from('subscriptions')
    .select(
      'subscription_id, user_id, product_id, start_utc, expires_utc, status, source, source_ref, ' +
        'users ( user_id, name, forename, surname, email, program_id ), ' +
        'products ( name, kind, duration_days )',
    )
    .order('start_utc', { ascending: false });
  if (error) {
    console.error('getAllSubscriptions:', error);
    return [];
  }
  return (data ?? []) as unknown as SubscriptionListRow[];
}

// ── the Grant dialog's student search (legacy searchGrantUser) ─────────
export async function searchStudents(db: ServerSupabaseClient, q: string): Promise<StudentHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const { data, error } = await db
    .from('users')
    .select('user_id, name, forename, surname, email, program_id')
    .or(`name.ilike.%${term}%,email.ilike.%${term}%,forename.ilike.%${term}%,surname.ilike.%${term}%`)
    .eq('role', 'STUDENT')
    .eq('active', true)
    .limit(8);
  if (error) {
    console.error('searchStudents:', error);
    return [];
  }
  return (data ?? []) as StudentHit[];
}

// ── the Worker's two lookups ───────────────────────────────────────────
export async function getSubscriptionById(db: ServerSupabaseClient, subscriptionId: string): Promise<Subscription | null> {
  const { data, error } = await db.from('subscriptions').select('*').eq('subscription_id', subscriptionId).maybeSingle();
  if (error) {
    console.error('getSubscriptionById:', error);
    return null;
  }
  return (data as Subscription | null) ?? null;
}

/** An ACTIVE, unexpired row for this user and product — the extend / duplicate test. */
export async function getActiveSubscriptionForUserProduct(
  db: ServerSupabaseClient,
  userId: string,
  productId: string,
  excludeSubscriptionId = '',
): Promise<Subscription | null> {
  let query = db
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .eq('status', 'ACTIVE')
    .gt('expires_utc', nowIso());
  if (excludeSubscriptionId) query = query.neq('subscription_id', excludeSubscriptionId);

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    console.error('getActiveSubscriptionForUserProduct:', error);
    return null;
  }
  return (data as Subscription | null) ?? null;
}
