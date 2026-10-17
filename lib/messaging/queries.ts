// lib/messaging/queries.ts
//
// The student side's reads (08.2): every thread, newest activity first,
// each with its latest message for the preview and whether Quademia's
// last reply is unread (the thread's read stamps); one thread's messages,
// oldest first (the badge is badges.ts). Both take the caller's
// per-request client, so the student's own-row policies are the floor,
// name their columns, and fail open: an error is logged and an empty
// result returned.
//
// RLS is the floor, not the filter (AGENTS.md): every read names the
// student. D52 (rule 10): the list's preview read takes every message of
// every thread the student holds — readAll().

import type { ServerSupabaseClient } from '@/lib/access';
import { readAll } from '@/lib/supabase/read-all';
import { MESSAGE_COLUMNS, THREAD_COLUMNS, unreadFor, type LatestMessage, type Message, type StudentThread, type Thread } from './types';

// ── getStudentThreads ──────────────────────────────────────────────────
/** side: whose unread it is — the student's own page, or Quademia's view of the student. */
export async function getStudentThreads(db: ServerSupabaseClient, userId: string, side: 'student' | 'admin' = 'student'): Promise<StudentThread[]> {
  const { data, error } = await db
    .from('messages_threads')
    .select(THREAD_COLUMNS)
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false });
  if (error) {
    console.error('getStudentThreads:', error);
    return [];
  }
  const threads = (data ?? []) as unknown as Thread[];
  if (!threads.length) return [];

  const ids = threads.map((t) => t.thread_id);
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
  if (msgError) console.error('getStudentThreads - latest:', msgError);

  // newest first: a thread's first message is its latest, and the last of the
  // student's before Quademia's latest reply is where a wait began (the rule
  // msg_admin_students() times the admin's list by)
  const latest: Record<string, LatestMessage> = {};
  const firstUnanswered: Record<string, string> = {};
  const answered = new Set<string>();
  for (const m of msgs ?? []) {
    if (!latest[m.thread_id]) latest[m.thread_id] = m;
    if (answered.has(m.thread_id)) continue;
    if (m.sender_role === 'admin') answered.add(m.thread_id);
    else if (m.sender_role === 'student') firstUnanswered[m.thread_id] = m.created_at;
  }
  return threads.map((t) => ({
    ...t,
    latest: latest[t.thread_id] ?? null,
    unread: unreadFor(t, side),
    firstUnanswered: firstUnanswered[t.thread_id] ?? null,
  }));
}

// ── getThreadMessages ──────────────────────────────────────────────────
export async function getThreadMessages(db: ServerSupabaseClient, threadId: string): Promise<Message[]> {
  const { data, error } = await db
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .order('message_id');
  if (error) {
    console.error('getThreadMessages:', error);
    return [];
  }
  return (data ?? []) as unknown as Message[];
}

// ── one thread, the student's own ──────────────────────────────────────
export async function getStudentThread(db: ServerSupabaseClient, userId: string, threadId: string): Promise<Thread | null> {
  const { data, error } = await db.from('messages_threads').select(THREAD_COLUMNS).eq('user_id', userId).eq('thread_id', threadId).maybeSingle();
  if (error) {
    console.error('getStudentThread:', error);
    return null;
  }
  return (data as unknown as Thread | null) ?? null;
}
