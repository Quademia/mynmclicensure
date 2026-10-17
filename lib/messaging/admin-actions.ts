// lib/messaging/admin-actions.ts
//
// The admin side's Server Actions (08.2; Sam, 2026-09-18 and 2026-10-17),
// each behind requireAdmin(), used by the admin's view of one student —
// that student's Messages as they see them. Every write goes through the
// database's msg_* functions with the service role. One request each:
//   adminOpenThreadAction — a thread's row and messages, Quademia's read
//     stamp set;
//   adminSendMessageAction — a reply (a closed thread is reopened with the
//     line "Reopened by a reply.");
//   adminStartForAction — "Start a message" under a label for the student:
//     the label's newest open thread, or a new one, and the message (bound
//     to the student on the page);
//   closeThreadAction / reopenThreadAction.
// A reply or a started message tells the student's devices that said yes
// (08.5b), after the answer has gone back, so Send never waits for it.
//
// Bulk Send went (Sam, 2026-09-18: announcements are the broadcast); the
// old inbox's list, search and New Thread dialog went with the students
// list (2026-10-17).

'use server';

import { after } from 'next/server';
import { requireAdmin } from '@/lib/access';
import { notifyReply } from '@/lib/notifications/send';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getThreadMessages } from './queries';
import { isMessageLabel, MESSAGE_REFUSALS, THREAD_COLUMNS, type ActionResult, type OpenThreadResult, type SendMessageResult, type Thread } from './types';

type Reply = { ok?: boolean; code?: string; thread_id?: string; message_id?: string; created?: boolean; reopened?: boolean; at?: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function sendReply(data: unknown, error: unknown, fallback: string): SendMessageResult {
  if (error) return fail(fallback);
  const r = (data ?? {}) as Reply;
  if (!r.ok || !r.thread_id || !r.message_id) return fail(MESSAGE_REFUSALS[r.code ?? ''] ?? fallback);
  const threadId = r.thread_id;
  after(() => notifyReply(threadId));
  return { ok: true, thread_id: r.thread_id, message_id: r.message_id, created: Boolean(r.created), reopened: Boolean(r.reopened), at: r.at ?? null };
}

export async function adminOpenThreadAction(threadIdIn: string): Promise<OpenThreadResult> {
  const { supabase } = await requireAdmin();
  const threadId = String(threadIdIn || '').trim();
  if (!threadId) return fail('This conversation could not be found.');
  const [threadRes, messages, read] = await Promise.all([
    supabase.from('messages_threads').select(THREAD_COLUMNS).eq('thread_id', threadId).maybeSingle(),
    getThreadMessages(supabase, threadId),
    createServiceRoleClient().rpc('msg_mark_read', { p_thread_id: threadId, p_side: 'admin' }),
  ]);
  if (read.error) console.error('adminOpenThreadAction - read:', read.error);
  const thread = threadRes.data as unknown as Thread | null;
  if (!thread) return fail('This conversation could not be found.');
  return { ok: true, thread, messages };
}

export async function adminSendMessageAction(threadIdIn: string, body: string): Promise<SendMessageResult> {
  const { profile } = await requireAdmin();
  const threadId = String(threadIdIn || '').trim();
  if (!threadId) return fail('Thread is required');
  const { data, error } = await createServiceRoleClient().rpc('msg_admin_send', {
    p_admin_id: profile.user_id,
    p_thread_id: threadId,
    p_body: String(body ?? ''),
  });
  return sendReply(data, error, 'Could not send the reply. Please try again.');
}

/** "Start a message" under a label on a student's page; the page binds the student. */
export async function adminStartForAction(userIdIn: string, label: string, courseId: string | null, body: string): Promise<SendMessageResult> {
  const { profile } = await requireAdmin();
  const userId = String(userIdIn || '').trim();
  if (!userId) return fail('Student not found.');
  if (!isMessageLabel(label)) return fail('Choose what the message is about.');
  const { data, error } = await createServiceRoleClient().rpc('msg_admin_start', {
    p_admin_id: profile.user_id,
    p_user_id: userId,
    p_label: label,
    p_course_id: label === 'course' ? courseId : null,
    p_body: String(body ?? ''),
  });
  return sendReply(data, error, 'Could not start the conversation. Please try again.');
}

async function setStatus(threadIdIn: string, status: 'open' | 'closed'): Promise<ActionResult> {
  await requireAdmin();
  const threadId = String(threadIdIn || '').trim();
  if (!threadId) return fail('Thread is required');
  const { data, error } = await createServiceRoleClient().rpc('msg_set_status', { p_thread_id: threadId, p_status: status });
  if (error || !data) {
    if (error) console.error('setStatus:', error);
    return fail(status === 'closed' ? 'Could not close the conversation.' : 'Could not reopen the conversation.');
  }
  return { ok: true };
}

export async function closeThreadAction(threadId: string): Promise<ActionResult> {
  return setStatus(threadId, 'closed');
}

export async function reopenThreadAction(threadId: string): Promise<ActionResult> {
  return setStatus(threadId, 'open');
}
