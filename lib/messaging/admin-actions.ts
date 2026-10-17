// lib/messaging/admin-actions.ts
//
// The admin side's Server Actions (08.2; Sam, 2026-09-18 and 2026-10-17),
// each behind requireAdmin(). Every write goes through the database's
// msg_* functions with the service role: a reply (a closed thread is
// reopened with the line "Reopened by a reply."), close and reopen, the
// admin's read stamp, and New Thread to one student — the newest open
// thread of the chosen label, or a new one, one per chosen course for "A
// course". The inbox reload, a thread's messages and the New Thread
// dialog's student search and course list are reads.
//
// Bulk Send is gone (Sam, 2026-09-18): announcements are the broadcast,
// with the same targeting; New Thread reaches one student.

'use server';

import { requireAdmin } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAdminThreads, getStudentCourseIds, searchStudentsForMessaging, type AdminThread, type AdminThreadFilters, type StudentHit } from './admin-queries';
import { getThreadMessages } from './queries';
import { isMessageLabel, MESSAGE_REFUSALS, type ActionResult, type Message, type SendMessageResult } from './types';

type Reply = { ok?: boolean; code?: string; thread_id?: string; message_id?: string; created?: boolean };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
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
  await requireAdmin();
  const threadId = String(threadIdIn || '').trim();
  if (!threadId) return fail('Thread is required');
  const { error } = await createServiceRoleClient().rpc('msg_mark_read', { p_thread_id: threadId, p_side: 'admin' });
  if (error) {
    console.error('adminMarkThreadReadAction:', error);
    return fail('Could not mark the conversation read.');
  }
  return { ok: true };
}

// ── reply ──────────────────────────────────────────────────────────────
export async function adminSendMessageAction(threadIdIn: string, body: string): Promise<SendMessageResult> {
  const { profile } = await requireAdmin();
  const threadId = String(threadIdIn || '').trim();
  if (!threadId) return fail('Thread is required');
  const { data, error } = await createServiceRoleClient().rpc('msg_admin_send', {
    p_admin_id: profile.user_id,
    p_thread_id: threadId,
    p_body: String(body ?? ''),
  });
  if (error) return fail('Could not send the reply. Please try again.');
  const r = (data ?? {}) as Reply;
  if (!r.ok || !r.thread_id || !r.message_id) return fail(MESSAGE_REFUSALS[r.code ?? ''] ?? 'Could not send the reply. Please try again.');
  return { ok: true, thread_id: r.thread_id, message_id: r.message_id, created: false };
}

// ── close / reopen ─────────────────────────────────────────────────────
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

export type NewThreadInput = {
  userId: string;
  /** One of the five labels. */
  label: string;
  /** For "A course": one thread per chosen course. */
  courseIds: string[];
  body: string;
};

export type NewThreadResult = { ok: true; threadCount: number; lastThreadId: string } | { ok: false; error: string };

export async function newThreadAction(input: NewThreadInput): Promise<NewThreadResult> {
  const { profile } = await requireAdmin();
  const userId = String(input?.userId || '').trim();
  const label = String(input?.label || '');
  if (!userId) return fail('Select a student first.');
  if (!isMessageLabel(label)) return fail('Choose what the message is about.');

  const courseIds = label === 'course' ? (input.courseIds ?? []).map((c) => String(c || '').trim()).filter(Boolean) : [null];
  if (!courseIds.length) return fail('Select at least one course.');

  const db = createServiceRoleClient();
  let lastThreadId: string | null = null;
  let threadCount = 0;
  let lastError: string | null = null;
  for (const courseId of courseIds) {
    const { data, error } = await db.rpc('msg_admin_start', {
      p_admin_id: profile.user_id,
      p_user_id: userId,
      p_label: label,
      p_course_id: courseId,
      p_body: String(input?.body ?? ''),
    });
    const r = (data ?? {}) as Reply;
    if (error || !r.ok || !r.thread_id) {
      lastError = error ? 'Could not start the conversation.' : MESSAGE_REFUSALS[r.code ?? ''] ?? 'Could not start the conversation.';
      continue;
    }
    lastThreadId = r.thread_id;
    threadCount++;
  }
  if (!lastThreadId) return fail(lastError ?? 'Could not start the conversation.');
  return { ok: true, threadCount, lastThreadId };
}
