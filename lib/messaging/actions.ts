// lib/messaging/actions.ts
//
// The student side's Server Actions (slice 12a), each behind
// requireStudent() and writing as the signed-in student — the own-row
// policies are the floor. Transcribed from legacy
// js/mynmclicensure-api.js:
//   ensureThread — reuse an OPEN thread of the same context (general:
//     the student's; course: the student's for that course), a question
//     thread is always new; else insert one;
//   sendMessage — insert the message (read by its own side), then stamp
//     the thread's last_message_at, last_sender_role and reopen it;
//   markThreadRead — every unread message on the thread, for the
//     student's side.
// Plus the page's reloads: the thread list and one thread's messages.
//
// The admin side (reply, close, reopen, New Thread, Bulk Send) is 12b.

'use server';

import { requireStudent } from '@/lib/access';
import { nowIso } from '@/lib/subscriptions/dates';
import { makeMessageId, makeThreadId } from './ids';
import { getStudentThread, getStudentThreads, getThreadMessages } from './queries';
import {
  CONTEXT_TYPES,
  MESSAGE_MAX_LEN,
  type ActionResult,
  type ContextType,
  type EnsureThreadResult,
  type Message,
  type SendMessageResult,
  type StudentThread,
} from './types';

export type EnsureThreadOpts = {
  course_id?: string | null;
  quiz_id?: string | null;
  question_id?: string | null;
  attempt_id?: string | null;
  subject?: string | null;
  ref_text?: string | null;
};

function clean(v: unknown, max = 4000): string | null {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
}

export async function ensureThreadAction(contextTypeIn: string, opts: EnsureThreadOpts = {}): Promise<EnsureThreadResult> {
  const { supabase, profile } = await requireStudent();

  const ct = String(contextTypeIn || 'general').toLowerCase();
  const contextType: ContextType = (CONTEXT_TYPES as readonly string[]).includes(ct) ? (ct as ContextType) : 'general';
  const courseId = clean(opts.course_id, 80);

  // Reuse an open thread (general / course only).
  if (contextType !== 'question') {
    let query = supabase
      .from('messages_threads')
      .select('thread_id')
      .eq('user_id', profile.user_id)
      .eq('status', 'open')
      .eq('context_type', contextType);
    if (contextType === 'course' && courseId) query = query.eq('course_id', courseId);

    const { data: existing, error: findError } = await query.order('last_message_at', { ascending: false }).limit(1).maybeSingle();
    if (findError) {
      console.error('ensureThreadAction - find:', findError);
      return { ok: false, error: findError.message };
    }
    if (existing) return { ok: true, thread_id: existing.thread_id as string, created: false };
  }

  const threadId = makeThreadId();
  const now = nowIso();
  const { error } = await supabase.from('messages_threads').insert({
    thread_id: threadId,
    user_id: profile.user_id,
    admin_id: 'admin1',
    status: 'open',
    context_type: contextType,
    subject: clean(opts.subject, 200),
    course_id: courseId,
    quiz_id: clean(opts.quiz_id, 80),
    question_id: clean(opts.question_id, 80),
    attempt_id: clean(opts.attempt_id, 80),
    bulk_batch_id: null,
    ref_text: clean(opts.ref_text, 6000),
    created_at: now,
    last_message_at: now,
    last_sender_role: 'student',
  });
  if (error) {
    console.error('ensureThreadAction - insert:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true, thread_id: threadId, created: true };
}

export async function sendMessageAction(threadIdIn: string, bodyIn: string): Promise<SendMessageResult> {
  const { supabase, profile } = await requireStudent();

  const threadId = String(threadIdIn || '').trim();
  const body = String(bodyIn || '').trim();
  if (!threadId) return { ok: false, error: 'Thread is required' };
  if (!body) return { ok: false, error: 'Message cannot be empty.' };
  if (body.length > MESSAGE_MAX_LEN) return { ok: false, error: `Message is over ${MESSAGE_MAX_LEN} characters.` };

  // The student's own thread only (the policy is the floor; the read
  // names the scope).
  const thread = await getStudentThread(supabase, profile.user_id, threadId);
  if (!thread) return { ok: false, error: 'Conversation not found.' };

  const messageId = makeMessageId();
  const now = nowIso();
  const { error } = await supabase.from('messages').insert({
    message_id: messageId,
    thread_id: threadId,
    sender_id: profile.user_id,
    sender_role: 'student',
    body_text: body,
    created_at: now,
    read_by_user: true,
    read_by_admin: false,
  });
  if (error) {
    console.error('sendMessageAction:', error);
    return { ok: false, error: error.message };
  }

  const { error: stampError } = await supabase
    .from('messages_threads')
    .update({ last_message_at: now, last_sender_role: 'student', status: 'open' })
    .eq('thread_id', threadId)
    .eq('user_id', profile.user_id);
  if (stampError) console.error('sendMessageAction - stamp:', stampError);

  return { ok: true, message_id: messageId };
}

export async function markThreadReadAction(threadIdIn: string): Promise<ActionResult> {
  const { supabase, profile } = await requireStudent();
  const threadId = String(threadIdIn || '').trim();
  if (!threadId) return { ok: false, error: 'Thread is required' };

  const thread = await getStudentThread(supabase, profile.user_id, threadId);
  if (!thread) return { ok: false, error: 'Conversation not found.' };

  const { error } = await supabase.from('messages').update({ read_by_user: true }).eq('thread_id', threadId).eq('read_by_user', false);
  if (error) {
    console.error('markThreadReadAction:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function listStudentThreadsAction(): Promise<StudentThread[]> {
  const { supabase, profile } = await requireStudent();
  return getStudentThreads(supabase, profile.user_id);
}

export async function threadMessagesAction(threadIdIn: string): Promise<Message[]> {
  const { supabase, profile } = await requireStudent();
  const threadId = String(threadIdIn || '').trim();
  if (!threadId) return [];
  const thread = await getStudentThread(supabase, profile.user_id, threadId);
  if (!thread) return [];
  return getThreadMessages(supabase, threadId);
}
