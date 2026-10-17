// lib/messaging/page-data.ts
//
// What a student's Messages shows (08.2; Sam, 2026-10-17: drawn as B, each
// course its own row) — to the student on their page, and to Quademia on
// the admin's view of that student, the same rows from either side. The
// labels are the list: Payment or package, My account, Something isn't
// working and Something else, each with its newest conversation (open or
// closed) or nothing yet; then the courses — the student's My courses
// list, each with its newest conversation; then earlier conversations —
// every other thread, older ones behind a newer one of the same label and
// courses no longer listed. Worded here, on the server, in a few reads.
//
// The admin's side also reads the one line about the student above their
// Messages: the programme and school, the live package and its days, the
// last paid payment and how many are unfinished.

import type { AuthGateResult, ServerSupabaseClient } from '@/lib/access';
import { getCourses } from '@/lib/catalogue/queries';
import { studentCourseList } from '@/lib/practice-papers/derive';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { createServiceRoleClient } from '@/lib/supabase/server';
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
  /** The start of the latest message — "You: …" for the viewing side's own. */
  preview: string | null;
  /** "2h ago", "3d ago", "2 Oct". */
  when: string | null;
  unread: boolean;
  /** The student's last message in an open conversation, not yet answered. */
  waiting: boolean;
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

function buildRows(
  threads: StudentThread[],
  titles: Map<string, string>,
  courses: { course_id: string; title: string }[],
  side: 'student' | 'admin',
): MessagesPageData {
  const now = Date.now();
  const mine = side === 'student' ? 'student' : 'admin';
  const preview = (t: StudentThread): string | null => {
    if (!t.latest) return null;
    const text = t.latest.body_text.replace(/\s+/g, ' ').trim();
    return t.latest.sender_role === mine ? `You: ${text}` : text;
  };
  const rowOf = (t: StudentThread | null, base: Pick<MessagesRow, 'key' | 'title' | 'label' | 'courseId'>): MessagesRow => ({
    ...base,
    threadId: t?.thread_id ?? null,
    status: t?.status ?? null,
    preview: t ? preview(t) : null,
    when: t ? ago(t.latest?.created_at ?? t.last_message_at, now) : null,
    unread: Boolean(t?.unread),
    waiting: Boolean(t && t.status === 'open' && t.last_sender_role === 'student'),
  });

  // threads come newest first, so the first of a key is its newest
  const used = new Set<string>();
  const newest = (match: (t: StudentThread) => boolean): StudentThread | null => {
    const t = threads.find(match) ?? null;
    if (t) used.add(t.thread_id);
    return t;
  };

  const labels = PLAIN_LABELS.map((label) => rowOf(newest((t) => t.context_type === label), { key: label, title: labelWords(label), label, courseId: null }));
  const courseRows = courses.map((c) =>
    rowOf(newest((t) => t.context_type === 'course' && t.course_id === c.course_id), {
      key: `course:${c.course_id}`,
      title: c.title,
      label: 'course',
      courseId: c.course_id,
    }),
  );
  const earlier = threads
    .filter((t) => !used.has(t.thread_id))
    .map((t) =>
      rowOf(t, {
        key: `thread:${t.thread_id}`,
        title: t.context_type === 'course' && t.course_id ? titles.get(t.course_id) ?? t.course_id : labelWords(t.context_type),
        label: t.context_type,
        courseId: t.course_id,
      }),
    );
  return { labels, courses: courseRows, earlier };
}

/** The student's own Messages. */
export async function loadMessagesPage(gate: AuthGateResult): Promise<MessagesPageData> {
  const { supabase, profile } = gate;
  const [allCourses, access, threads] = await Promise.all([
    getCourses(supabase),
    getStudentCourseAccess(supabase, profile.user_id),
    getStudentThreads(supabase, profile.user_id, 'student'),
  ]);
  const titles = new Map(allCourses.map((c) => [c.course_id, c.title]));
  return buildRows(threads, titles, studentCourseList(allCourses, access, profile.program_id ?? null), 'student');
}

// ── the admin's view of one student ────────────────────────────────────

export type AdminStudentLine = {
  user_id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  programme: string | null;
  school: string | null;
  /** The live package with the latest end, and its days left. */
  package: { name: string; days: number } | null;
  /** The last paid payment. */
  lastPayment: { amountMinor: number; currency: string; paidUtc: string; status: string } | null;
  /** Payments started and not finished (not yet activated). */
  unfinished: number;
};

export type AdminStudentPage = { line: AdminStudentLine; data: MessagesPageData; waitingKey: string | null };

/** The courses a student holds now, read for Quademia (the student's own reader reads the caller's). */
async function heldNow(userId: string): Promise<Record<string, true>> {
  const now = new Date().toISOString();
  const { data, error } = await createServiceRoleClient()
    .from('course_access')
    .select('course_id')
    .eq('user_id', userId)
    .is('revoked_utc', null)
    .lte('start_utc', now)
    .gt('expires_utc', now);
  if (error) console.error('heldNow:', error);
  return Object.fromEntries((data ?? []).map((r) => [r.course_id as string, true as const]));
}

export async function loadAdminStudentPage(db: ServerSupabaseClient, userId: string): Promise<AdminStudentPage | null> {
  const service = createServiceRoleClient();
  const now = new Date().toISOString();
  const [userRes, allCourses, held, threads, subRes, paidRes, unfinishedRes] = await Promise.all([
    service.from('users').select('user_id, name, forename, surname, email, program_id, school_id, school_other, avatar_url').eq('user_id', userId).maybeSingle(),
    getCourses(db),
    heldNow(userId),
    getStudentThreads(db, userId, 'admin'),
    service
      .from('subscriptions')
      .select('expires_utc, products ( name )')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .lte('start_utc', now)
      .gt('expires_utc', now)
      .order('expires_utc', { ascending: false })
      .limit(1),
    service
      .from('payments')
      .select('amount_minor_paid, amount_minor_expected, currency, paid_utc, status')
      .eq('user_id', userId)
      .not('paid_utc', 'is', null)
      .order('paid_utc', { ascending: false })
      .limit(1),
    service.from('payments').select('reference', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['INIT', 'PAID']).is('activated_utc', null),
  ]);
  const u = userRes.data as {
    user_id: string; name: string | null; forename: string | null; surname: string | null; email: string;
    program_id: string | null; school_id: number | null; school_other: string | null; avatar_url: string | null;
  } | null;
  if (!u) return null;

  let school: string | null = u.school_other || null;
  if (u.school_id) {
    const { data: s } = await service.from('schools').select('name').eq('id', u.school_id).maybeSingle();
    school = (s?.name as string | undefined) ?? school;
  }

  const sub = (subRes.data ?? [])[0] as { expires_utc: string; products: { name: string } | { name: string }[] | null } | undefined;
  const productName = sub ? (Array.isArray(sub.products) ? sub.products[0]?.name : sub.products?.name) ?? 'A package' : null;
  const pay = (paidRes.data ?? [])[0] as { amount_minor_paid: number | null; amount_minor_expected: number; currency: string; paid_utc: string; status: string } | undefined;

  const name = [u.forename, u.surname].filter(Boolean).join(' ').trim() || u.name || u.email;
  const line: AdminStudentLine = {
    user_id: u.user_id,
    name,
    email: u.email,
    avatarUrl: u.avatar_url,
    programme: u.program_id,
    school,
    package: sub && productName ? { name: productName, days: Math.max(0, Math.ceil((new Date(sub.expires_utc).getTime() - Date.now()) / 86400000)) } : null,
    lastPayment: pay ? { amountMinor: pay.amount_minor_paid ?? pay.amount_minor_expected, currency: pay.currency, paidUtc: pay.paid_utc, status: pay.status } : null,
    unfinished: unfinishedRes.count ?? 0,
  };

  const titles = new Map(allCourses.map((c) => [c.course_id, c.title]));
  const data = buildRows(threads, titles, studentCourseList(allCourses, held, u.program_id), 'admin');
  const all = [...data.labels, ...data.courses, ...data.earlier];
  // the waiting conversation opens at once — the longest-waiting, timed from
  // the student's first unanswered message, as the students list is
  const waiting = all.filter((r) => r.waiting).sort((a, b) => waitingSince(threads, a.threadId) - waitingSince(threads, b.threadId));
  return { line, data, waitingKey: waiting[0]?.key ?? null };
}

function waitingSince(threads: StudentThread[], id: string | null): number {
  const t = id ? threads.find((x) => x.thread_id === id) : null;
  return t ? new Date(t.firstUnanswered ?? t.last_message_at).getTime() : Number.MAX_SAFE_INTEGER;
}
