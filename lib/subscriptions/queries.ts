// lib/subscriptions/queries.ts
//
// The subscription reads, transcribed one for one: getStudentCourseAccess
// from legacy js/mynmclicensure-api.js; the admin list's joined select
// from admin/subscriptions.html; the Grant dialog's student search from
// the same page; getSubscriptionById from the payments Worker (its
// getActiveSubscriptionForUserProduct — the extend / duplicate test —
// went with 02 C3a). Each
// takes the caller's per-request client and, as legacy, fails open: an
// error is logged and an empty result returned.
//
// RLS is the floor, not the filter (AGENTS.md): every student read names
// its user; the admin list is admin by the gate that made the client.

import { cache } from 'react';
import type { ServerSupabaseClient } from '@/lib/access';
import { nowIso } from './dates';
import type { ActiveSubscriptionWithProduct, CourseAccessMap, StudentHit, Subscription, SubscriptionListRow } from './types';

// ── getStudentCourseAccess ──────────────────────────────────────────────
// The caller's courses with the latest end among their live course_access
// rows — my_course_access(), the one definition the SQL gate
// (user_has_course) reads too (02 C2, §8 S8). The days shown are that
// stored date's distance: a number nothing grants can no longer appear
// (D14), and tomorrow shows one less. Wrapped in cache() so a request
// reads once however many callers (D15). The row identity is the
// caller's own (auth.uid()); userId names the scope for the log.
export const getStudentCourseAccess = cache(async function getStudentCourseAccess(
  db: ServerSupabaseClient,
  userId: string,
): Promise<CourseAccessMap> {
  const now = Date.now();
  const { data, error } = await db.rpc('my_course_access');
  if (error) {
    console.error('getStudentCourseAccess:', userId, error);
    return {};
  }

  const result: CourseAccessMap = {};
  for (const row of (data ?? []) as { course_id: string; expires_utc: string }[]) {
    const remainingDays = Math.max(0, Math.ceil((new Date(row.expires_utc).getTime() - now) / (1000 * 60 * 60 * 24)));
    if (remainingDays === 0) continue;
    result[row.course_id] = { totalDays: remainingDays, expires: row.expires_utc };
  }
  return result;
});

// ── the dashboard's "starts later" line (02 C3b) ───────────────────────
// The student's earliest course row still to start — a receipt queued
// behind one that has since been revoked or run out, or a future-dated
// grant. Own rows only; null when nothing is coming.
export async function getUpcomingAccess(db: ServerSupabaseClient, userId: string): Promise<{ starts: string; productName: string } | null> {
  const { data, error } = await db
    .from('course_access')
    .select('start_utc, subscriptions ( products ( name ) )')
    .eq('user_id', userId)
    .is('revoked_utc', null)
    .gt('start_utc', nowIso())
    .order('start_utc')
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('getUpcomingAccess:', error);
    return null;
  }
  const row = data as unknown as { start_utc: string; subscriptions: { products: { name: string } | null } | null } | null;
  if (!row) return null;
  return { starts: row.start_utc, productName: row.subscriptions?.products?.name || 'Your' };
}

// ── the admin list (legacy loadData) ───────────────────────────────────
export async function getAllSubscriptions(db: ServerSupabaseClient): Promise<SubscriptionListRow[]> {
  const { data, error } = await db
    .from('subscriptions')
    .select(
      'subscription_id, user_id, product_id, start_utc, expires_utc, status, source, source_ref, created_utc, ' +
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

// ── the upgrade page's list (legacy loadActiveSubscriptions, slice 9b) ─
// The student's ACTIVE, unexpired subscriptions with their product
// name, latest expiry first.
export async function getActiveSubscriptionsWithProduct(db: ServerSupabaseClient, userId: string): Promise<ActiveSubscriptionWithProduct[]> {
  const { data, error } = await db
    .from('subscriptions')
    .select('subscription_id, user_id, product_id, start_utc, expires_utc, status, products ( name )')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .gt('expires_utc', nowIso())
    .order('expires_utc', { ascending: false });
  if (error) {
    console.error('getActiveSubscriptionsWithProduct:', error);
    return [];
  }
  return (data ?? []) as unknown as ActiveSubscriptionWithProduct[];
}
