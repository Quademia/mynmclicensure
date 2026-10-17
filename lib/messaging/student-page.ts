// lib/messaging/student-page.ts
//
// What the student's Messages page shows (08.2 step 3; Sam, 2026-10-17:
// drawn as B, each course its own row). The labels are the list: Payment
// or package, My account, Something isn't working and Something else,
// each with its newest conversation (open or closed) or nothing yet; then
// "Your courses" — the student's My courses list, each with its newest
// conversation; then "Earlier conversations" — every other thread, older
// ones behind a newer one of the same label and courses no longer listed.
// Worded here, on the server, in a few reads: the threads with their
// latest message, the courses and the student's access.

import type { AuthGateResult } from '@/lib/access';
import { getCourses } from '@/lib/catalogue/queries';
import { studentCourseList } from '@/lib/practice-papers/derive';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { getStudentThreads } from './queries';
import { labelWords, type MessageLabel, type StudentThread } from './types';

/** One row of the list: a label or a course, with its conversation if there is one. */
export type MessagesRow = {
  key: string;
  title: string;
  label: MessageLabel;
  courseId: string | null;
  threadId: string | null;
  status: 'open' | 'closed' | null;
  /** The start of the latest message — "You: …" for the student's own. */
  preview: string | null;
  /** "2h ago", "3d ago", "2 Oct". */
  when: string | null;
  unread: boolean;
};

export type MessagesPageData = {
  labels: MessagesRow[];
  courses: MessagesRow[];
  earlier: MessagesRow[];
};

const PLAIN_LABELS: MessageLabel[] = ['payment', 'account', 'technical', 'other'];

function ago(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const min = Math.floor((now - d.getTime()) / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function preview(t: StudentThread): string | null {
  if (!t.latest) return null;
  const text = t.latest.body_text.replace(/\s+/g, ' ').trim();
  return t.latest.sender_role === 'student' ? `You: ${text}` : text;
}

function rowOf(t: StudentThread | null, base: Pick<MessagesRow, 'key' | 'title' | 'label' | 'courseId'>, now: number): MessagesRow {
  return {
    ...base,
    threadId: t?.thread_id ?? null,
    status: t?.status ?? null,
    preview: t ? preview(t) : null,
    when: t ? ago(t.latest?.created_at ?? t.last_message_at, now) : null,
    unread: Boolean(t?.unread),
  };
}

export async function loadMessagesPage(gate: AuthGateResult): Promise<MessagesPageData> {
  const { supabase, profile } = gate;
  const [allCourses, access, threads] = await Promise.all([
    getCourses(supabase),
    getStudentCourseAccess(supabase, profile.user_id),
    getStudentThreads(supabase, profile.user_id),
  ]);
  const now = Date.now();
  const titles = new Map(allCourses.map((c) => [c.course_id, c.title]));
  const mine = studentCourseList(allCourses, access, profile.program_id ?? null);

  // threads come newest first, so the first of a key is its newest
  const used = new Set<string>();
  const newest = (match: (t: StudentThread) => boolean): StudentThread | null => {
    const t = threads.find(match) ?? null;
    if (t) used.add(t.thread_id);
    return t;
  };

  const labels = PLAIN_LABELS.map((label) =>
    rowOf(newest((t) => t.context_type === label), { key: label, title: labelWords(label), label, courseId: null }, now),
  );
  const courses = mine.map((c) =>
    rowOf(
      newest((t) => t.context_type === 'course' && t.course_id === c.course_id),
      { key: `course:${c.course_id}`, title: c.title, label: 'course', courseId: c.course_id },
      now,
    ),
  );
  const earlier = threads
    .filter((t) => !used.has(t.thread_id))
    .map((t) =>
      rowOf(
        t,
        {
          key: `thread:${t.thread_id}`,
          title: t.context_type === 'course' && t.course_id ? titles.get(t.course_id) ?? t.course_id : labelWords(t.context_type),
          label: t.context_type,
          courseId: t.course_id,
        },
        now,
      ),
    );
  return { labels, courses, earlier };
}
