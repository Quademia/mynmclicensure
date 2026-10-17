// lib/messaging/actions.ts
//
// The student side's Server Actions (08.2; Sam, 2026-09-18 and
// 2026-10-17), each behind requireStudent(). Every write goes through the
// database's msg_* functions with the service role, naming the signed-in
// student: the browser holds no write on either table. One request each,
// for students on weak data:
//   openThreadAction — a thread of the student's own: its row and its
//     messages, and the student's read stamp set, in one trip;
//   sendMessageAction — a message into a thread of the student's own; a
//     closed one is reopened with the line "Reopened by a reply.";
//   sendByLabelAction — a message by label (a course's: that course): the
//     label's newest open thread, or a new one made with the message —
//     Messages' "Start a message" and the "Message us" box.

'use server';

import { requireStudent } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getStudentThread, getThreadMessages } from './queries';
import { isMessageLabel, MESSAGE_REFUSALS, type OpenThreadResult, type SendMessageResult } from './types';

type Reply = { ok?: boolean; code?: string; thread_id?: string; message_id?: string; created?: boolean; reopened?: boolean; at?: string };

function refusal(code: string | undefined, fallback: string): string {
  return MESSAGE_REFUSALS[code ?? ''] ?? fallback;
}

function sendReply(data: unknown, error: unknown): SendMessageResult {
  if (error) return { ok: false, error: 'Could not send your message. Please try again.' };
  const r = (data ?? {}) as Reply;
  if (!r.ok || !r.thread_id || !r.message_id) return { ok: false, error: refusal(r.code, 'Could not send your message. Please try again.') };
  return {
    ok: true,
    thread_id: r.thread_id,
    message_id: r.message_id,
    created: Boolean(r.created),
    reopened: Boolean(r.reopened),
    at: r.at ?? null,
  };
}

export async function openThreadAction(threadIdIn: string): Promise<OpenThreadResult> {
  const { supabase, profile } = await requireStudent();
  const threadId = String(threadIdIn || '').trim();
  if (!threadId) return { ok: false, error: refusal('no_thread', 'This conversation could not be found.') };
  const thread = await getStudentThread(supabase, profile.user_id, threadId);
  if (!thread) return { ok: false, error: refusal('no_thread', 'This conversation could not be found.') };
  const [messages, read] = await Promise.all([
    getThreadMessages(supabase, threadId),
    createServiceRoleClient().rpc('msg_mark_read', { p_thread_id: threadId, p_side: 'student', p_user_id: profile.user_id }),
  ]);
  if (read.error) console.error('openThreadAction - read:', read.error);
  return { ok: true, thread, messages };
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
