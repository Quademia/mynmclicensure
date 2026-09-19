// lib/messaging/types.ts
//
// The two messaging rows as the app reads them (the legacy tables,
// column for column), the student page's thread view (a thread with
// its latest message, legacy getStudentThreads' `_latest`), the deep
// link the course page and the runners arrive with, and the constants.
//
// Constants live here, not in the 'use server' module (AGENTS.md
// workaround).

export const CONTEXT_TYPES = ['general', 'course', 'question'] as const;
export type ContextType = (typeof CONTEXT_TYPES)[number];

export type ThreadStatus = 'open' | 'closed';
export type SenderRole = 'student' | 'admin';

/** The compose box's limit, as legacy's MAX_LEN. */
export const MESSAGE_MAX_LEN = 800;

export type Thread = {
  thread_id: string;
  user_id: string;
  admin_id: string;
  status: ThreadStatus;
  context_type: ContextType;
  subject: string | null;
  course_id: string | null;
  quiz_id: string | null;
  question_id: string | null;
  attempt_id: string | null;
  bulk_batch_id: string | null;
  ref_text: string | null;
  created_at: string;
  last_message_at: string;
  last_sender_role: SenderRole;
};

export type Message = {
  message_id: string;
  thread_id: string;
  sender_id: string;
  sender_role: SenderRole;
  body_text: string;
  read_by_user: boolean;
  read_by_admin: boolean;
  created_at: string;
};

/** The preview columns legacy fetched per thread. */
export type LatestMessage = Pick<Message, 'thread_id' | 'body_text' | 'sender_role' | 'created_at' | 'read_by_user' | 'read_by_admin'>;

export type StudentThread = Thread & { latest: LatestMessage | null };

/** What the course page and the runners put in the address. */
export type ThreadDeepLink = {
  course_id: string | null;
  quiz_id: string | null;
  item_id: string | null;
  attempt_id: string | null;
  ref: string | null;
};

export type EnsureThreadResult = { ok: true; thread_id: string; created: boolean } | { ok: false; error: string };
export type SendMessageResult = { ok: true; message_id: string } | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };
