// lib/messaging/admin-actions.ts
//
// The admin side's Server Actions (slice 12b), each behind
// requireAdmin() and writing as the signed-in admin — the ADMIN
// policies are the floor (the thread INSERT bypass included: an
// admin-made thread is owned by the student). Transcribed from legacy
// js/mynmclicensure-api.js and admin/messages.html: the inbox reload,
// a thread's messages, reply (sendMessage as 'admin' — read by admin,
// unread by the student), mark read for the admin's side, close and
// reopen, the New Thread dialog's student search and course list,
// New Thread itself (one thread per chosen course, or one general —
// legacy's ensureThread reuse rule, with admin_id the admin's own id
// and the subject in brackets on the first line), Preview count, and
// Bulk Send.
//
// Bulk Send (Sam's ruling, 2026-09-15): legacy looped in the browser,
// one recipient at a time, three queries each. Here the recipients
// are resolved as legacy resolved them, the open threads they already
// hold (same context, and the course when it is a course thread) are
// read in one query, the missing threads are written in one insert,
// the messages in another, and the thread stamps in one update — the
// same rows as the loop, batched so a Worker's time limit is never
// met. The reuse rule is legacy's: a general or course thread is
// reused when open; each recipient gets exactly one message.

'use server';

import { requireAdmin } from '@/lib/access';
import { nowIso } from '@/lib/subscriptions/dates';
import { makeBulkBatchId, makeMessageId, makeThreadId } from './ids';
import {
  getAdminThreads,
  getDistinctLevelsAndCohorts,
  getStudentCourseIds,
  resolveRecipients,
  searchStudentsForMessaging,
  type AdminThread,
  type AdminThreadFilters,
  type RecipientScope,
  type StudentHit,
} from './admin-queries';
import { getThreadMessages } from './queries';
import { CONTEXT_TYPES, type ActionResult, type ContextType, type Message, type SendMessageResult } from './types';

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function clean(v: unknown, max = 4000): string | null {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
}

function contextOf(v: unknown): ContextType {
  const ct = String(v || 'general').toLowerCase();
  return (CONTEXT_TYPES as readonly string[]).includes(ct) ? (ct as ContextType) : 'general';
}

// ── the inbox ──────────────────────────────────────────────────────────
export async function listAdminThreadsAction(filters: AdminThreadFilters): Promise<AdminThread[]> {
  const { supabase } = await requireAdmin();
  return getAdminThreads(supabase, {
    search: String(filters?.search || ''),
    contextType: String(filters?.contextType || ''),
    status: String(filters?.status || ''),
  });
}

export async function adminThreadMessagesAction(threadIdIn: string): Promise<Message[]> {
  const { supabase } = await requireAdmin();
  const threadId = String(threadIdIn || '').trim();
  if (!threadId) return [];
  return getThreadMessages(supabase, threadId);
}

export async function adminMarkThreadReadAction(threadIdIn: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const threadId = String(threadIdIn || '').trim();
  if (!threadId) return fail('Thread is required');
  const { error } = await supabase.from('messages').update({ read_by_admin: true }).eq('thread_id', threadId).eq('read_by_admin', false);
  if (error) {
    console.error('adminMarkThreadReadAction:', error);
    return fail(error.message);
  }
  return { ok: true };
}

// ── reply (legacy sendMessage as 'admin') ──────────────────────────────
async function insertAdminMessage(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  adminId: string,
  threadId: string,
  body: string,
): Promise<SendMessageResult> {
  const messageId = makeMessageId();
  const now = nowIso();
  const { error } = await supabase.from('messages').insert({
    message_id: messageId,
    thread_id: threadId,
    sender_id: adminId,
    sender_role: 'admin',
    body_text: body,
    created_at: now,
    read_by_user: false,
    read_by_admin: true,
  });
  if (error) {
    console.error('insertAdminMessage:', error);
    return fail(error.message);
  }
  const { error: stampError } = await supabase
    .from('messages_threads')
    .update({ last_message_at: now, last_sender_role: 'admin', status: 'open' })
    .eq('thread_id', threadId);
  if (stampError) console.error('insertAdminMessage - stamp:', stampError);
  return { ok: true, message_id: messageId };
}

export async function adminSendMessageAction(threadIdIn: string, bodyIn: string): Promise<SendMessageResult> {
  const { supabase, profile } = await requireAdmin();
  const threadId = String(threadIdIn || '').trim();
  const body = String(bodyIn || '').trim();
  if (!threadId) return fail('Thread is required');
  if (!body) return fail('Message cannot be empty.');
  return insertAdminMessage(supabase, profile.user_id, threadId, body);
}

// ── close / reopen ─────────────────────────────────────────────────────
export async function closeThreadAction(threadIdIn: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const threadId = String(threadIdIn || '').trim();
  if (!threadId) return fail('Thread is required');
  const { error } = await supabase.from('messages_threads').update({ status: 'closed' }).eq('thread_id', threadId);
  if (error) {
    console.error('closeThreadAction:', error);
    return fail(error.message);
  }
  return { ok: true };
}

export async function reopenThreadAction(threadIdIn: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const threadId = String(threadIdIn || '').trim();
  if (!threadId) return fail('Thread is required');
  const { error } = await supabase.from('messages_threads').update({ status: 'open' }).eq('thread_id', threadId);
  if (error) {
    console.error('reopenThreadAction:', error);
    return fail(error.message);
  }
  return { ok: true };
}

// ── the New Thread dialog ──────────────────────────────────────────────
export async function searchStudentsForMessagingAction(q: string): Promise<StudentHit[]> {
  const { supabase } = await requireAdmin();
  return searchStudentsForMessaging(supabase, q);
}

export async function studentCoursesAction(userIdIn: string): Promise<string[]> {
  const { supabase } = await requireAdmin();
  const userId = String(userIdIn || '').trim();
  if (!userId) return [];
  return getStudentCourseIds(supabase, userId);
}

export async function bulkPickersAction(): Promise<{ levels: string[]; cohorts: string[] }> {
  const { supabase } = await requireAdmin();
  return getDistinctLevelsAndCohorts(supabase);
}

// legacy ensureThread for an admin-made thread: reuse an OPEN thread of
// the same context (course: for that course); question never arises
// here. Returns the thread id.
async function ensureAdminThread(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  adminId: string,
  userId: string,
  contextType: ContextType,
  opts: { subject: string | null; course_id: string | null; bulk_batch_id: string | null },
): Promise<string | null> {
  let query = supabase.from('messages_threads').select('thread_id').eq('user_id', userId).eq('status', 'open').eq('context_type', contextType);
  if (contextType === 'course' && opts.course_id) query = query.eq('course_id', opts.course_id);
  const { data: existing } = await query.order('last_message_at', { ascending: false }).limit(1).maybeSingle();
  if (existing) return existing.thread_id as string;

  const threadId = makeThreadId();
  const now = nowIso();
  const { error } = await supabase.from('messages_threads').insert({
    thread_id: threadId,
    user_id: userId,
    admin_id: adminId,
    status: 'open',
    context_type: contextType,
    subject: opts.subject,
    course_id: opts.course_id,
    quiz_id: null,
    question_id: null,
    attempt_id: null,
    bulk_batch_id: opts.bulk_batch_id,
    ref_text: null,
    created_at: now,
    last_message_at: now,
    last_sender_role: 'admin',
  });
  if (error) {
    console.error('ensureAdminThread:', error);
    return null;
  }
  return threadId;
}

export type NewThreadInput = {
  userId: string;
  contextType: string;
  courseIds: string[];
  subject: string;
  body: string;
};

export type NewThreadResult = { ok: true; threadCount: number; lastThreadId: string } | { ok: false; error: string };

export async function newThreadAction(input: NewThreadInput): Promise<NewThreadResult> {
  const { supabase, profile } = await requireAdmin();

  const userId = String(input?.userId || '').trim();
  const body = String(input?.body || '').trim();
  const subject = clean(input?.subject, 200);
  const contextType = contextOf(input?.contextType);
  if (!userId) return fail('Select a student first.');
  if (!body) return fail('Message cannot be empty.');

  const { data: target } = await supabase.from('users').select('user_id').eq('user_id', userId).maybeSingle();
  if (!target) return fail('Student not found.');

  const msgText = subject ? `[${subject}]\n${body}` : body;
  let lastThreadId: string | null = null;
  let threadCount = 0;

  if (contextType === 'course') {
    const courseIds = (input.courseIds ?? []).map((c) => String(c || '').trim()).filter(Boolean);
    if (!courseIds.length) return fail('Select at least one course.');
    for (const courseId of courseIds) {
      const threadId = await ensureAdminThread(supabase, profile.user_id, userId, 'course', { subject, course_id: courseId, bulk_batch_id: null });
      if (!threadId) continue;
      await insertAdminMessage(supabase, profile.user_id, threadId, msgText);
      lastThreadId = threadId;
      threadCount++;
    }
  } else {
    const threadId = await ensureAdminThread(supabase, profile.user_id, userId, contextType, { subject, course_id: null, bulk_batch_id: null });
    if (threadId) {
      await insertAdminMessage(supabase, profile.user_id, threadId, msgText);
      lastThreadId = threadId;
      threadCount = 1;
    }
  }

  if (!lastThreadId) return fail('Could not create thread.');
  return { ok: true, threadCount, lastThreadId };
}

// ── Bulk Send ──────────────────────────────────────────────────────────
export async function previewRecipientsAction(scope: RecipientScope): Promise<number> {
  const { supabase } = await requireAdmin();
  return (await resolveRecipients(supabase, scope ?? {})).length;
}

export type BulkSendInput = {
  subject: string;
  body: string;
  scope: RecipientScope;
  contextType: string;
  courseId: string | null;
};

export type BulkSendResult = { ok: true; batchId: string; count: number } | { ok: false; error: string };

const CHUNK = 500;

export async function bulkSendAction(input: BulkSendInput): Promise<BulkSendResult> {
  const { supabase, profile } = await requireAdmin();

  const body = String(input?.body || '').trim();
  if (!body) return fail('Message cannot be empty.');
  const subject = clean(input?.subject, 200);
  const contextType = contextOf(input?.contextType);
  const courseId = contextType === 'course' ? clean(input?.courseId, 80) : null;

  const userIds = await resolveRecipients(supabase, input?.scope ?? {});
  if (!userIds.length) return fail('No matching recipients');

  const batchId = makeBulkBatchId();
  const now = nowIso();
  const msgText = subject ? `[${subject}]\n${body}` : body;

  // The open threads the recipients already hold (legacy's reuse rule).
  const threadByUser: Record<string, string> = {};
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const slice = userIds.slice(i, i + CHUNK);
    let query = supabase
      .from('messages_threads')
      .select('thread_id, user_id, last_message_at')
      .in('user_id', slice)
      .eq('status', 'open')
      .eq('context_type', contextType);
    if (contextType === 'course' && courseId) query = query.eq('course_id', courseId);
    const { data, error } = await query.order('last_message_at', { ascending: false });
    if (error) {
      console.error('bulkSendAction - existing:', error);
      return fail(error.message);
    }
    for (const t of (data ?? []) as { thread_id: string; user_id: string }[]) {
      if (!threadByUser[t.user_id]) threadByUser[t.user_id] = t.thread_id;
    }
  }

  // The missing threads, one insert.
  const newThreads = userIds
    .filter((uid) => !threadByUser[uid])
    .map((uid) => {
      const threadId = makeThreadId();
      threadByUser[uid] = threadId;
      return {
        thread_id: threadId,
        user_id: uid,
        admin_id: profile.user_id,
        status: 'open',
        context_type: contextType,
        subject,
        course_id: courseId,
        quiz_id: null,
        question_id: null,
        attempt_id: null,
        bulk_batch_id: batchId,
        ref_text: null,
        created_at: now,
        last_message_at: now,
        last_sender_role: 'admin',
      };
    });
  for (let i = 0; i < newThreads.length; i += CHUNK) {
    const { error } = await supabase.from('messages_threads').insert(newThreads.slice(i, i + CHUNK));
    if (error) {
      console.error('bulkSendAction - threads:', error);
      return fail(error.message);
    }
  }

  // The messages, one insert.
  const threadIds = userIds.map((uid) => threadByUser[uid]);
  const messages = threadIds.map((threadId) => ({
    message_id: makeMessageId(),
    thread_id: threadId,
    sender_id: profile.user_id,
    sender_role: 'admin',
    body_text: msgText,
    created_at: now,
    read_by_user: false,
    read_by_admin: true,
  }));
  for (let i = 0; i < messages.length; i += CHUNK) {
    const { error } = await supabase.from('messages').insert(messages.slice(i, i + CHUNK));
    if (error) {
      console.error('bulkSendAction - messages:', error);
      return fail(error.message);
    }
  }

  // The thread stamps, one update (the reused threads need it; the new
  // ones already carry it).
  for (let i = 0; i < threadIds.length; i += CHUNK) {
    const { error } = await supabase
      .from('messages_threads')
      .update({ last_message_at: now, last_sender_role: 'admin', status: 'open' })
      .in('thread_id', threadIds.slice(i, i + CHUNK));
    if (error) console.error('bulkSendAction - stamp:', error);
  }

  return { ok: true, batchId, count: threadIds.length };
}
