// lib/messaging/queries.ts
//
// The student side's reads (slice 12a), transcribed one for one from
// legacy js/mynmclicensure-api.js: getStudentThreads (every thread,
// newest activity first, each with its latest message for the
// preview), getThreadMessages (oldest first), getUnreadCountForUser
// (open threads with at least one message the student has not read —
// the sidebar's badge). Each takes the caller's per-request client —
// the student's own-row policies are the floor — and, as legacy, fails
// open: an error is logged and an empty result returned.
//
// RLS is the floor, not the filter (AGENTS.md): every read names the
// student.

import type { ServerSupabaseClient } from '@/lib/access';
import type { LatestMessage, Message, StudentThread, Thread } from './types';

// ── getStudentThreads ──────────────────────────────────────────────────
export async function getStudentThreads(db: ServerSupabaseClient, userId: string): Promise<StudentThread[]> {
  const { data, error } = await db
    .from('messages_threads')
    .select('*')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false });
  if (error) {
    console.error('getStudentThreads:', error);
    return [];
  }
  const threads = (data ?? []) as Thread[];
  if (!threads.length) return [];

  const ids = threads.map((t) => t.thread_id);
  const { data: msgs, error: msgError } = await db
    .from('messages')
    .select('thread_id, body_text, sender_role, created_at, read_by_user, read_by_admin')
    .in('thread_id', ids)
    .order('created_at', { ascending: false });
  if (msgError) console.error('getStudentThreads - latest:', msgError);

  const latest: Record<string, LatestMessage> = {};
  for (const m of (msgs ?? []) as LatestMessage[]) {
    if (!latest[m.thread_id]) latest[m.thread_id] = m;
  }
  return threads.map((t) => ({ ...t, latest: latest[t.thread_id] ?? null }));
}

// ── getThreadMessages ──────────────────────────────────────────────────
export async function getThreadMessages(db: ServerSupabaseClient, threadId: string): Promise<Message[]> {
  const { data, error } = await db.from('messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: true });
  if (error) {
    console.error('getThreadMessages:', error);
    return [];
  }
  return (data ?? []) as Message[];
}

// ── getUnreadCountForUser (the student sidebar's badge) ────────────────
// Legacy: the student's OPEN threads, then the distinct ones holding a
// message not yet read by the student — the sender is not checked, so a
// thread the student just wrote to counts until the page marks it (the
// page itself counts only unread admin replies; both carried).
export async function getUnreadCountForUser(db: ServerSupabaseClient, userId: string): Promise<number> {
  const { data: threads, error } = await db.from('messages_threads').select('thread_id').eq('user_id', userId).eq('status', 'open');
  if (error) {
    console.error('getUnreadCountForUser:', error);
    return 0;
  }
  const ids = (threads ?? []).map((t) => t.thread_id as string);
  if (!ids.length) return 0;

  const { data: unread, error: unreadError } = await db.from('messages').select('thread_id').in('thread_id', ids).eq('read_by_user', false);
  if (unreadError) {
    console.error('getUnreadCountForUser - messages:', unreadError);
    return 0;
  }
  return new Set((unread ?? []).map((m) => m.thread_id as string)).size;
}

// ── one thread, the student's own ──────────────────────────────────────
export async function getStudentThread(db: ServerSupabaseClient, userId: string, threadId: string): Promise<Thread | null> {
  const { data, error } = await db.from('messages_threads').select('*').eq('user_id', userId).eq('thread_id', threadId).maybeSingle();
  if (error) {
    console.error('getStudentThread:', error);
    return null;
  }
  return (data as Thread | null) ?? null;
}
