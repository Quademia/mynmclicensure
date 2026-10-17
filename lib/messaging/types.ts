// lib/messaging/types.ts
//
// The support desk (08.2; Sam, 2026-09-18 and 2026-10-17): the two rows as
// the app reads them, the five labels a thread carries, and the replies of
// the actions. Every write goes through the database's msg_* functions
// (db/migrations/20261017180000_support_desk.sql); the browser only reads.
//
// Constants live here, not in the 'use server' modules (AGENTS.md
// workaround).

/** A thread's label, in place of "general or a course" (Sam, 2026-10-17: B). */
export const MESSAGE_LABELS = [
  { value: 'payment', label: 'Payment or package' },
  { value: 'account', label: 'My account' },
  { value: 'technical', label: "Something isn't working" },
  { value: 'course', label: 'A course' },
  { value: 'other', label: 'Something else' },
] as const;

export type MessageLabel = (typeof MESSAGE_LABELS)[number]['value'];

export function isMessageLabel(v: unknown): v is MessageLabel {
  return MESSAGE_LABELS.some((l) => l.value === v);
}

export function labelWords(v: string): string {
  return MESSAGE_LABELS.find((l) => l.value === v)?.label ?? 'Something else';
}

export type ThreadStatus = 'open' | 'closed';
export type SenderRole = 'student' | 'admin' | 'system';

/** One message's limit (08: 2,000 characters; the database checks it too). */
export const MESSAGE_MAX_LEN = 2000;

export type Thread = {
  thread_id: string;
  user_id: string;
  status: ThreadStatus;
  /** The label (the column keeps its old name). */
  context_type: MessageLabel;
  course_id: string | null;
  created_at: string;
  last_message_at: string;
  last_sender_role: 'student' | 'admin';
  student_read_at: string | null;
  admin_read_at: string | null;
};

/** Named, never '*': the browser's grant is the floor (AGENTS.md). */
export const THREAD_COLUMNS =
  'thread_id, user_id, status, context_type, course_id, created_at, last_message_at, last_sender_role, student_read_at, admin_read_at';

export type Message = {
  message_id: string;
  thread_id: string;
  sender_id: string;
  sender_role: SenderRole;
  body_text: string;
  created_at: string;
};

export const MESSAGE_COLUMNS = 'message_id, thread_id, sender_id, sender_role, body_text, created_at';

/** The preview a list shows under each thread. */
export type LatestMessage = Pick<Message, 'thread_id' | 'body_text' | 'sender_role' | 'created_at'>;

export type StudentThread = Thread & { latest: LatestMessage | null; unread: boolean };

/** Unread for one side: the thread's last message is the other side's, after this side last read it. */
export function unreadFor(t: Pick<Thread, 'last_sender_role' | 'last_message_at' | 'student_read_at' | 'admin_read_at'>, side: 'student' | 'admin'): boolean {
  const read = side === 'student' ? t.student_read_at : t.admin_read_at;
  const other = side === 'student' ? 'admin' : 'student';
  return t.last_sender_role === other && (!read || new Date(read).getTime() < new Date(t.last_message_at).getTime());
}

/** A thread opened from Messages: its row and its messages (the read stamp set on the way). */
export type OpenThreadResult = { ok: true; thread: Thread; messages: Message[] } | { ok: false; error: string };
export type SendMessageResult =
  | { ok: true; thread_id: string; message_id: string; created: boolean; reopened?: boolean; at?: string | null }
  | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

/** The database's refusals, in the app's words. */
export const MESSAGE_REFUSALS: Record<string, string> = {
  empty: 'Type a message first.',
  too_long: `A message can be ${MESSAGE_MAX_LEN.toLocaleString('en-GB')} characters at most.`,
  bad_label: 'Choose what your message is about.',
  no_course: 'Choose the course your message is about.',
  no_thread: 'This conversation could not be found.',
  no_student: 'Student not found.',
};
