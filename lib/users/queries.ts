// lib/users/queries.ts
//
// The admin Users page's and dashboard's reads (slice 14a), transcribed
// one for one: getUsers (js/mynmclicensure-api.js — name / forename /
// surname / email search, role and programme filters, newest first, 50
// a page), getUserById (the row, the ACTIVE subscription with the
// latest expiry, the history newest start first) with the school
// joined on the S4 key instead of legacy's map, the dashboard's four
// head counts and its last ten registrations (admin/dashboard.html).
// Each takes the admin gate's client — the ADMIN policies are the
// floor — and, as legacy, fails open: an error is logged and an empty
// result returned.

import type { ServerSupabaseClient } from '@/lib/access';
import { nowIso } from '@/lib/subscriptions/dates';
import type { DashboardCounts, DrawerSubscription, UserDetail, UserFilters, UserListRow, UsersPage } from './types';
import { USERS_PAGE_SIZE } from './types';

const LIST_COLUMNS = 'user_id, name, forename, surname, email, role, program_id, active, created_utc, level, cohort';

// ── getUsers ───────────────────────────────────────────────────────────
export async function getUsersPaginated(db: ServerSupabaseClient, filters: UserFilters, page: number, pageSize = USERS_PAGE_SIZE): Promise<UsersPage> {
  let query = db.from('users').select(LIST_COLUMNS, { count: 'exact' }).order('created_utc', { ascending: false });

  if (filters.role) query = query.eq('role', filters.role);
  if (filters.programId) query = query.eq('program_id', filters.programId);

  const term = String(filters.search || '').trim();
  if (term) {
    const like = `%${term}%`;
    query = query.or(`name.ilike.${like},forename.ilike.${like},surname.ilike.${like},email.ilike.${like}`);
  }

  const from = page * pageSize;
  const { data, count, error } = await query.range(from, from + pageSize - 1);
  if (error) {
    console.error('getUsersPaginated:', error);
    return { users: [], total: 0 };
  }
  return { users: (data ?? []) as UserListRow[], total: count || 0 };
}

// ── getUserById (the drawer) ───────────────────────────────────────────
export async function getUserDetail(db: ServerSupabaseClient, userId: string): Promise<UserDetail | null> {
  const { data: user, error: userError } = await db
    .from('users')
    .select('*, schools ( name, region )')
    .eq('user_id', userId)
    .maybeSingle();
  if (userError || !user) {
    if (userError) console.error('getUserDetail - user:', userError);
    return null;
  }

  const [activeRes, historyRes] = await Promise.all([
    db
      .from('subscriptions')
      .select('subscription_id, product_id, start_utc, expires_utc, status, source, products ( name, kind )')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .order('expires_utc', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('subscriptions')
      .select('subscription_id, product_id, start_utc, expires_utc, status, source, products ( name, kind )')
      .eq('user_id', userId)
      .order('start_utc', { ascending: false }),
  ]);
  if (activeRes.error) console.error('getUserDetail - active:', activeRes.error);
  if (historyRes.error) console.error('getUserDetail - history:', historyRes.error);

  return {
    ...(user as unknown as UserDetail),
    activeSubscription: (activeRes.data as unknown as DrawerSubscription | null) ?? null,
    subscriptionHistory: (historyRes.data ?? []) as unknown as DrawerSubscription[],
  };
}

// ── the dashboard's counts (legacy loadStats) ──────────────────────────
export async function getDashboardCounts(db: ServerSupabaseClient): Promise<DashboardCounts> {
  const now = nowIso();
  const in7days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const [total, students, active, expiring] = await Promise.all([
    db.from('users').select('*', { count: 'exact', head: true }),
    db.from('users').select('*', { count: 'exact', head: true }).eq('role', 'STUDENT'),
    db.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
    db.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE').gte('expires_utc', now).lte('expires_utc', in7days),
  ]);
  for (const r of [total, students, active, expiring]) if (r.error) console.error('getDashboardCounts:', r.error);

  return {
    totalUsers: total.count || 0,
    students: students.count || 0,
    activeSubscriptions: active.count || 0,
    expiringSoon: expiring.count || 0,
  };
}

// ── the dashboard's Recent Registrations (legacy loadRecentUsers) ──────
export async function getRecentUsers(db: ServerSupabaseClient, limit = 10): Promise<UserListRow[]> {
  const { data, error } = await db.from('users').select(LIST_COLUMNS).order('created_utc', { ascending: false }).limit(limit);
  if (error) {
    console.error('getRecentUsers:', error);
    return [];
  }
  return (data ?? []) as UserListRow[];
}
