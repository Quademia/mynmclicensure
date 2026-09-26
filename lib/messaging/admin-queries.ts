// lib/messaging/admin-queries.ts
//
// The admin side's reads (slice 12b), transcribed from legacy
// js/mynmclicensure-api.js: getAdminThreads (a student search resolved
// to ids first, then the threads with status and context filtered on
// the server, newest activity first, each with its latest message and
// an unread flag — "read by admin" is judged over the messages, as
// legacy judged it), getUnreadCountForAdmin (the sidebar's badge —
// distinct threads holding a message not read by admin),
// searchStudentsForMessaging (the New Thread dialog's search — legacy
// fetched every active user and filtered in the browser; here the
// same four columns are matched on the server, twenty at a time),
// the student's entitled courses (the dialog's course picker), the
// distinct levels and cohorts (the Bulk Send pickers), and
// resolveRecipients (AND across the scope's filters, OR within each;
// programme, level and cohort on users; subscription kind and course
// entitlement through the ACTIVE subscriptions' products). Each takes
// the admin gate's client — the ADMIN policies are the floor — and, as
// legacy, fails open.
//
// One shape change under the standing S4 tick: the student joins on
// `messages_threads.user_id` in the same select; legacy fetched the
// threads' users in a second call by id.
//
// D52 (2026-09-26; AGENTS.md rule 10): every read here but the dialog's
// search takes a whole table — all threads, all their messages, every
// unread message, every active student — so each goes through
// readAll(), and an id list it lengthens is sent in slices. The safety
// net only: the proper shapes (the inbox paged on the server, the badge
// one count) are D39's, queued under 07.

import type { ServerSupabaseClient } from '@/lib/access';
import { readAll, slices } from '@/lib/supabase/read-all';
import { nowIso } from '@/lib/subscriptions/dates';
import type { LatestMessage, Thread } from './types';

export type AdminThreadFilters = { search: string; contextType: string; status: string };
export const EMPTY_ADMIN_FILTERS: AdminThreadFilters = { search: '', contextType: '', status: '' };

export type ThreadUser = { user_id: string; name: string | null; forename: string | null; surname: string | null; email: string; program_id: string | null; avatar_url: string | null };

export type AdminThread = Thread & { users: ThreadUser | null; latest: LatestMessage | null; unread: boolean };

export type StudentHit = ThreadUser;

export type RecipientScope = {
  program_ids?: string[];
  level_ids?: string[];
  cohort_ids?: string[];
  subscription_kinds?: string[];
  course_ids?: string[];
};

// ── getAdminThreads ────────────────────────────────────────────────────
export async function getAdminThreads(db: ServerSupabaseClient, filters: AdminThreadFilters): Promise<AdminThread[]> {
  let searchUserIds: Set<string> | null = null;
  const term = String(filters.search || '').trim();
  if (term) {
    const like = `%${term}%`;
    const { data: matched, error } = await readAll<{ user_id: string }>((from, to) =>
      db
        .from('users')
        .select('user_id')
        .or(`name.ilike.${like},forename.ilike.${like},surname.ilike.${like},email.ilike.${like}`)
        .order('user_id')
        .range(from, to),
    );
    if (error) {
      console.error('getAdminThreads - search:', error);
      return [];
    }
    searchUserIds = new Set(matched.map((u) => u.user_id));
    if (!searchUserIds.size) return [];
  }

  const build = () => {
    let query = db.from('messages_threads').select('*, users ( user_id, name, forename, surname, email, program_id, avatar_url )');
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.contextType) query = query.eq('context_type', filters.contextType);
    return query.order('last_message_at', { ascending: false }).order('thread_id');
  };

  const { data, error } = await readAll<Thread & { users: ThreadUser | null }>((from, to) => build().range(from, to));
  if (error) {
    console.error('getAdminThreads:', error);
    return [];
  }
  // The search's students are matched here, not sent as an .in() list:
  // a short term can match more ids than the request's address can hold.
  const threads = searchUserIds ? data.filter((t) => searchUserIds.has(t.user_id)) : data;
  if (!threads.length) return [];

  const latest: Record<string, LatestMessage> = {};
  const unread: Record<string, boolean> = {};
  for (const ids of slices(threads.map((t) => t.thread_id))) {
    const { data: msgs, error: msgError } = await readAll<LatestMessage>((from, to) =>
      db
        .from('messages')
        .select('thread_id, body_text, sender_role, created_at, read_by_user, read_by_admin')
        .in('thread_id', ids)
        .order('created_at', { ascending: false })
        .order('message_id')
        .range(from, to),
    );
    if (msgError) console.error('getAdminThreads - latest:', msgError);
    for (const m of msgs ?? []) {
      if (!latest[m.thread_id]) latest[m.thread_id] = m;
      if (!m.read_by_admin) unread[m.thread_id] = true;
    }
  }
  return threads.map((t) => ({ ...t, latest: latest[t.thread_id] ?? null, unread: Boolean(unread[t.thread_id]) }));
}

// ── getUnreadCountForAdmin (the admin sidebar's badge) ─────────────────
export async function getUnreadCountForAdmin(db: ServerSupabaseClient): Promise<number> {
  const { data, error } = await readAll<{ thread_id: string }>((from, to) =>
    db.from('messages').select('thread_id').eq('read_by_admin', false).order('message_id').range(from, to),
  );
  if (error) {
    console.error('getUnreadCountForAdmin:', error);
    return 0;
  }
  return new Set(data.map((m) => m.thread_id)).size;
}

// ── searchStudentsForMessaging (the New Thread dialog) ─────────────────
export async function searchStudentsForMessaging(db: ServerSupabaseClient, q: string): Promise<StudentHit[]> {
  const term = String(q || '').trim();
  let query = db.from('users').select('user_id, name, forename, surname, email, program_id, avatar_url').eq('active', true).order('name');
  if (term) {
    const like = `%${term}%`;
    query = query.or(`name.ilike.${like},forename.ilike.${like},surname.ilike.${like},email.ilike.${like}`);
  }
  const { data, error } = await query.limit(20);
  if (error) {
    console.error('searchStudentsForMessaging:', error);
    return [];
  }
  return (data ?? []) as StudentHit[];
}

// ── a student's entitled courses (legacy ntLoadUserCourses) ────────────
// The student's live course_access rows (02 C2): unrevoked, inside their
// window. The admin reads them through the table's ADMIN policy.
export async function getStudentCourseIds(db: ServerSupabaseClient, userId: string): Promise<string[]> {
  const now = nowIso();
  const { data, error } = await db
    .from('course_access')
    .select('course_id')
    .eq('user_id', userId)
    .is('revoked_utc', null)
    .lte('start_utc', now)
    .gt('expires_utc', now);
  if (error) {
    console.error('getStudentCourseIds:', error);
    return [];
  }
  return Array.from(new Set((data ?? []).map((r) => r.course_id as string)));
}

// ── the distinct levels and cohorts (legacy fetchDistinctFilters) ──────
export async function getDistinctLevelsAndCohorts(db: ServerSupabaseClient): Promise<{ levels: string[]; cohorts: string[] }> {
  const { data: rows, error } = await readAll<{ level: string | null; cohort: string | null }>((from, to) =>
    db.from('users').select('level, cohort').eq('active', true).order('user_id').range(from, to),
  );
  if (error) {
    console.error('getDistinctLevelsAndCohorts:', error);
    return { levels: [], cohorts: [] };
  }
  const levels = [...new Set(rows.map((u) => u.level).filter((v): v is string => Boolean(v)))].sort();
  const cohorts = [...new Set(rows.map((u) => String(u.cohort || '')).filter(Boolean))].sort();
  return { levels, cohorts };
}

// ── resolveRecipients (the Bulk Send scope) ────────────────────────────
export async function resolveRecipients(db: ServerSupabaseClient, scope: RecipientScope): Promise<string[]> {
  const build = () => {
    let query = db.from('users').select('user_id').eq('active', true).eq('role', 'STUDENT');
    if (scope.program_ids?.length) query = query.in('program_id', scope.program_ids);
    if (scope.cohort_ids?.length) query = query.in('cohort', scope.cohort_ids);
    if (scope.level_ids?.length) query = query.in('level', scope.level_ids);
    return query.order('user_id');
  };

  const { data, error } = await readAll<{ user_id: string }>((from, to) => build().range(from, to));
  if (error) {
    console.error('resolveRecipients:', error);
    return [];
  }
  let userIds = data.map((u) => u.user_id);
  if (!userIds.length) return [];

  type SubRow = { user_id: string; products: { kind: string | null } | null };

  // The two narrowing reads below take the students in slices (D52):
  // past a few hundred ids the list is too long for the request's address.
  // As before, a failed read narrows to nobody (D39).
  if (scope.subscription_kinds?.length) {
    const want = new Set(scope.subscription_kinds.map((k) => k.toUpperCase()));
    const matched = new Set<string>();
    for (const ids of slices(userIds)) {
      const { data: subs } = await readAll<unknown>((from, to) =>
        db
          .from('subscriptions')
          .select('user_id, products ( kind )')
          .eq('status', 'ACTIVE')
          .in('user_id', ids)
          .order('subscription_id')
          .range(from, to),
      );
      for (const s of (subs ?? []) as SubRow[]) {
        if (want.has(String(s.products?.kind || '').toUpperCase())) matched.add(s.user_id);
      }
    }
    userIds = userIds.filter((id) => matched.has(id));
    if (!userIds.length) return [];
  }

  if (scope.course_ids?.length) {
    // Live course_access rows on any of the wanted courses (02 C2).
    const now = nowIso();
    const courseIds = scope.course_ids;
    const matched = new Set<string>();
    for (const ids of slices(userIds)) {
      const { data: rows } = await readAll<{ user_id: string }>((from, to) =>
        db
          .from('course_access')
          .select('user_id')
          .in('user_id', ids)
          .in('course_id', courseIds)
          .is('revoked_utc', null)
          .lte('start_utc', now)
          .gt('expires_utc', now)
          .order('access_id')
          .range(from, to),
      );
      for (const r of rows ?? []) matched.add(r.user_id);
    }
    userIds = userIds.filter((id) => matched.has(id));
  }

  return userIds;
}
