// lib/messaging/admin-students.ts
//
// The admin's Messages, a list of students (08.2 step 4; Sam, 2026-10-17):
// one row per student — those waiting for a reply first, the longest
// waiting at the top — twenty a page, grouped and paged in the database
// (msg_admin_students). Search reaches every student, so one who never
// wrote can be found and written to; "All" lists everyone who has
// written, newest first; a label keeps students with a conversation of
// it. Service role; the caller has passed requireAdmin().

import { createServiceRoleClient } from '@/lib/supabase/server';
import { isMessageLabel, labelWords, type MessageLabel } from './types';

export const STUDENTS_PER_PAGE = 20;

export type StudentsView = 'waiting' | 'all';

export type StudentsFilters = { q: string; view: StudentsView; label: MessageLabel | ''; page: number };

export type StudentListRow = {
  user_id: string;
  name: string;
  email: string;
  programme: string | null;
  waiting: boolean;
  /** "Payment or package", "General Paper" — what is waiting. */
  waitingWhat: string[];
  preview: string | null;
  fromStudent: boolean;
  lastAt: string | null;
  /** "12m", "3h", "2d", "2 Oct" — worded here, where the clock may be read. */
  when: string;
};

function ago(iso: string | null, now: number): string {
  if (!iso) return '';
  const d = new Date(iso);
  const min = Math.floor((now - d.getTime()) / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function filtersFrom(params: { q?: string; view?: string; label?: string; page?: string }): StudentsFilters {
  return {
    q: String(params.q ?? '').trim().slice(0, 80),
    view: params.view === 'all' ? 'all' : 'waiting',
    label: isMessageLabel(params.label) ? params.label : '',
    page: Math.max(1, Math.floor(Number(params.page)) || 1),
  };
}

export async function getStudentsList(f: StudentsFilters): Promise<{ ok: true; rows: StudentListRow[]; total: number } | { ok: false }> {
  const { data, error } = await createServiceRoleClient().rpc('msg_admin_students', {
    p_search: f.q || null,
    p_view: f.view,
    p_label: f.label || null,
    p_limit: STUDENTS_PER_PAGE,
    p_offset: (f.page - 1) * STUDENTS_PER_PAGE,
  });
  if (error) {
    console.error('getStudentsList:', error);
    return { ok: false };
  }
  const rows = (data ?? []) as {
    user_id: string; name: string; email: string; program_id: string | null; waiting: boolean;
    waiting_labels: { label: string; course: string | null }[] | null;
    last_preview: string | null; last_sender: string | null; last_at: string | null; total: number | string;
  }[];
  const now = Date.now();
  return {
    ok: true,
    total: rows.length ? Number(rows[0].total) || 0 : 0,
    rows: rows.map((r) => ({
      user_id: r.user_id,
      name: r.name,
      email: r.email,
      programme: r.program_id,
      waiting: Boolean(r.waiting),
      waitingWhat: (r.waiting_labels ?? []).map((w) => (w.label === 'course' && w.course ? w.course : labelWords(w.label))),
      preview: r.last_preview,
      fromStudent: r.last_sender === 'student',
      lastAt: r.last_at,
      when: ago(r.last_at, now),
    })),
  };
}

/** The longest-waiting student other than this one — "Next waiting ›". */
export async function nextWaitingStudent(currentUserId: string): Promise<string | null> {
  const { data, error } = await createServiceRoleClient().rpc('msg_admin_students', {
    p_search: null,
    p_view: 'waiting',
    p_label: null,
    p_limit: 2,
    p_offset: 0,
  });
  if (error) return null;
  const next = ((data ?? []) as { user_id: string }[]).find((r) => r.user_id !== currentUserId);
  return next?.user_id ?? null;
}
