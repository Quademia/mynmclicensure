// lib/messaging/actions.ts
//
// The student side's Server Actions (08.2; Sam, 2026-09-18 and
// 2026-10-17), each behind requireStudent(). Every write goes through the
// database's msg_* functions with the service role, naming the signed-in
// student: the browser holds no write on either table.
//   openLabelThreadAction — the newest open thread of a label (a course's:
//     that course), made when there is none (Messages' "+ New");
//   sendMessageAction — a message into a thread of the student's own; a
//     closed one is reopened with the line "Reopened by a reply.";
//   sendByLabelAction — the "Message us" box: the label's thread found or
//     made and the message written, in one trip;
//   markThreadReadAction — the student's read stamp on the thread.
// Plus the page's reloads: the thread list and one thread's messages,
// read through the student's own sign-in (the policies decide whose rows).

'use server';

import { requireStudent } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getStudentThread, getStudentThreads, getThreadMessages } from './queries';
import {
  isMessageLabel,
  MESSAGE_REFUSALS,
  type ActionResult,
  type Message,
  type OpenThreadResult,
  type SendMessageResult,
  type StudentThread,
} from './types';

type Reply = { ok?: boolean; code?: string; thread_id?: string; message_id?: string; created?: boolean };

function refusal(code: string | undefined, fallback: string): string {
  return MESSAGE_REFUSALS[code ?? ''] ?? fallback;
}

function sendReply(data: unknown, error: unknown): SendMessageResult {
  if (error) return { ok: false, error: 'Could not send your message. Please try again.' };
  const r = (data ?? {}) as Reply;
  if (!r.ok || !r.thread_id || !r.message_id) return { ok: false, error: refusal(r.code, 'Could not send your message. Please try again.') };
  return { ok: true, thread_id: r.thread_id, message_id: r.message_id, created: Boolean(r.created) };
}

export async function openLabelThreadAction(label: string, courseId: string | null): Promise<OpenThreadResult> {
  const { profile } = await requireStudent();
  if (!isMessageLabel(label)) return { ok: false, error: refusal('bad_label', 'Choose what your message is about.') };
  const { data, error } = await createServiceRoleClient().rpc('msg_thread_for', {
    p_user_id: profile.user_id,
    p_label: label,
    p_course_id: label === 'course' ? courseId : null,
    p_by: 'student',
  });
  if (error) return { ok: false, error: 'Could not open the conversation. Please try again.' };
  const r = (data ?? {}) as Reply;
  if (!r.ok || !r.thread_id) return { ok: false, error: refusal(r.code, 'Could not open the conversation. Please try again.') };
  return { ok: true, thread_id: r.thread_id, created: Boolean(r.created) };
}

export async function sendMessageAction(threadIdIn: string, body: string): Promise<SendMessageResult> {
  const { profile } = await requireStudent();
  const threadId = String(threadIdIn || '').trim();
  if (!threadId) return { ok: false, error: refusal('no_thread', 'This conversation could not be found.') };
  const { data, error } = await createServiceRoleClient().rpc('msg_student_send', {
    p_user_id: profile.user_id,
    p_thread_id: threadId,
    p_label: null,
    p_course_id: null,
    p_body: String(body ?? ''),
  });
  return sendReply(data, error);
}

export async function sendByLabelAction(label: string, courseId: string | null, body: string): Promise<SendMessageResult> {
  const { profile } = await requireStudent();
  if (!isMessageLabel(label)) return { ok: false, error: refusal('bad_label', 'Choose what your message is about.') };
  const { data, error } = await createServiceRoleClient().rpc('msg_student_send', {
    p_user_id: profile.user_id,
    p_thread_id: null,
    p_label: label,
    p_course_id: label === 'course' ? courseId : null,
    p_body: String(body ?? ''),
  });
  return sendReply(data, error);
}

export async function markThreadReadAction(threadIdIn: string): Promise<ActionResult> {
  const { profile } = await requireStudent();
  const threadId = String(threadIdIn || '').trim();
  if (!threadId) return { ok: false, error: 'Thread is required' };
  const { error } = await createServiceRoleClient().rpc('msg_mark_read', {
    p_thread_id: threadId,
    p_side: 'student',
    p_user_id: profile.user_id,
  });
  if (error) {
    console.error('markThreadReadAction:', error);
    return { ok: false, error: 'Could not mark the conversation read.' };
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
