// lib/messaging/admin-queries.ts
//
// The admin side's reads (08.2): getAdminThreads (a student search
// resolved to ids first, then the threads with status and label filtered
// on the server, newest activity first, each with its latest message and
// whether the student's last message is unread — the thread's read
// stamps), searchStudentsForMessaging (the New
// Thread dialog's search, twenty at a time on the server) and the
// student's entitled courses (the dialog's course picker). Each read takes
// the admin gate's client — the ADMIN policies are the floor — names its
// columns, and fails open. Bulk Send's readers went with it (2026-10-17).
//
// D52 (2026-09-26; AGENTS.md rule 10): the inbox takes all threads and all
// their messages, so it goes through readAll(), and an id list it
// lengthens is sent in slices. The safety net only: the inbox paged on the
// server is step 4 of 08.2.

import type { ServerSupabaseClient } from '@/lib/access';
import { readAll, slices } from '@/lib/supabase/read-all';
import { nowIso } from '@/lib/subscriptions/dates';
import { THREAD_COLUMNS, unreadFor, type LatestMessage, type Thread } from './types';

/** contextType is the label (the column keeps its old name). */
export type AdminThreadFilters = { search: string; contextType: string; status: string };
export const EMPTY_ADMIN_FILTERS: AdminThreadFilters = { search: '', contextType: '', status: '' };

export type ThreadUser = { user_id: string; name: string | null; forename: string | null; surname: string | null; email: string; program_id: string | null; avatar_url: string | null };

export type AdminThread = Thread & { users: ThreadUser | null; latest: LatestMessage | null; unread: boolean };

export type StudentHit = ThreadUser;

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
    // A plain string, so the client does not parse it into a type of its own.
    const columns: string = `${THREAD_COLUMNS}, users ( user_id, name, forename, surname, email, program_id, avatar_url )`;
    let query = db.from('messages_threads').select(columns);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.contextType) query = query.eq('context_type', filters.contextType);
    return query.order('last_message_at', { ascending: false }).order('thread_id');
  };

  const { data, error } = await readAll<Thread & { users: ThreadUser | null }>((from, to) => build().range(from, to) as never);
  if (error) {
    console.error('getAdminThreads:', error);
    return [];
  }
  // The search's students are matched here, not sent as an .in() list:
  // a short term can match more ids than the request's address can hold.
  const threads = searchUserIds ? data.filter((t) => searchUserIds.has(t.user_id)) : data;
  if (!threads.length) return [];

  const latest: Record<string, LatestMessage> = {};
  for (const ids of slices(threads.map((t) => t.thread_id))) {
    const { data: msgs, error: msgError } = await readAll<LatestMessage>((from, to) =>
      db
        .from('messages')
        .select('thread_id, body_text, sender_role, created_at')
        .in('thread_id', ids)
        .neq('sender_role', 'system')
        .order('created_at', { ascending: false })
        .order('message_id')
        .range(from, to),
    );
    if (msgError) console.error('getAdminThreads - latest:', msgError);
    for (const m of msgs ?? []) {
      if (!latest[m.thread_id]) latest[m.thread_id] = m;
    }
  }
  return threads.map((t) => ({ ...t, latest: latest[t.thread_id] ?? null, unread: unreadFor(t, 'admin') }));
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
