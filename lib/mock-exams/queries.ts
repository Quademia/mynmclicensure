// lib/mock-exams/queries.ts
//
// What the Mock exams page reads (04.15; Sam, 2026-10-13: layout A, drawn
// at https://claude.ai/artifact/5QQCWH9ECauT7k69cUUxC3, boards A and B):
// one screen by time — Open now, Coming up, Past mocks — and a mock's own
// page, built as a paper's.
//
// A mock has a paper's shape, so each row and what the student did with it
// come from lib/practice-papers/derive (paperView). As there, the mocks are
// read with the service role, so a student without Premium Prep still sees
// them listed, locked (11-pages), and only the card's fields reach the
// page; the questions never do. A mock opens to a student whose live grant
// for its course includes mocks (02.10) — the rule create_attempt holds.
// Past mocks: every mock the student sat that is neither open nor coming,
// whatever its status since (Sam, 2026-10-13), so it is read by the ids of
// the student's own sittings as well.

import type { ServerSupabaseClient } from '@/lib/access';
import type { Profile } from '@/lib/auth/profile';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCourses } from '@/lib/catalogue/queries';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { getStudentAttempts } from '@/lib/attempts/queries';
import { getStudentReceipts } from '@/lib/dashboard/student/queries';
import { topCardFor } from '@/lib/dashboard/student/status';
import { getQuizAvailability } from '@/lib/quizzes/availability';
import { orderModes } from '@/lib/attempts/modes';
import type { AttemptMode } from '@/lib/attempts/types';
import { slices } from '@/lib/supabase/read-all';
import { paperView, startable, type PaperRow, type PaperView } from '@/lib/practice-papers/derive';
import { paperAccessByCourse, type PracticePapers } from '@/lib/practice-papers/queries';

export type MockView = PaperView & {
  course_title: string;
  /** When it closes; null = no end. */
  unpublish_at: string | null;
};

export type MockExams = {
  /** Open now, the soonest to close first. */
  open: MockView[];
  /** Coming up, the soonest to open first. */
  coming: MockView[];
  /** Sat by the student and no longer open or coming, the latest sat first. */
  past: MockView[];
  /** The card: a sitting going in an open mock, else the open mock that closes soonest not yet started. */
  next: MockView | null;
  /** No course of the student's includes mocks (no Premium Prep). */
  locked: boolean;
  ended: PracticePapers['ended'];
};

type MockRowRead = {
  quiz_id: string;
  course_id: string;
  title: string;
  n: number;
  allowed_modes: AttemptMode[];
  first_mode: AttemptMode;
  sittings_allowed: number | null;
  time_limit_sec: number | null;
  published: boolean;
  status: string;
  publish_at: string | null;
  unpublish_at: string | null;
};

const MOCK_COLUMNS =
  'quiz_id, course_id, title, n, allowed_modes, first_mode, sittings_allowed, time_limit_sec, published, status, publish_at, unpublish_at';

function byCloseThenTitle(a: MockView, b: MockView): number {
  const ca = a.unpublish_at ? Date.parse(a.unpublish_at) : Infinity;
  const cb = b.unpublish_at ? Date.parse(b.unpublish_at) : Infinity;
  if (ca !== cb) return ca - cb;
  return a.title.localeCompare(b.title, 'en', { numeric: true }) || a.course_title.localeCompare(b.course_title);
}

function latestSat(m: MockView): number {
  return Math.max(0, ...m.sittings.map((a) => Date.parse(a.ts_iso ?? '') || 0));
}

export async function loadMockExams(supabase: ServerSupabaseClient, profile: Profile): Promise<MockExams> {
  const userId = profile.user_id;
  const [access, allCourses, receipts, attempts] = await Promise.all([
    getStudentCourseAccess(supabase, userId),
    getCourses(supabase),
    getStudentReceipts(supabase, userId),
    getStudentAttempts(supabase, userId),
  ]);

  const heldIds = allCourses.filter((c) => access[c.course_id]).map((c) => c.course_id);
  // Nothing held: the programme's own courses, so the mocks still show, locked (as Practice Papers).
  const shownIds = heldIds.length
    ? heldIds
    : allCourses.filter((c) => profile.program_id && (c.program_scope ?? []).includes(profile.program_id)).map((c) => c.course_id);
  const titleOf = new Map(allCourses.map((c) => [c.course_id, c.title]));
  const accessBy = await paperAccessByCourse(userId, heldIds);

  const db = createServiceRoleClient();
  const rows = new Map<string, MockRowRead>();
  if (shownIds.length) {
    const { data, error } = await db
      .from('mock_quizzes')
      .select(MOCK_COLUMNS)
      .in('course_id', shownIds)
      .eq('status', 'active')
      .eq('published', true);
    if (error) console.error('loadMockExams mocks:', error);
    for (const r of (data ?? []) as MockRowRead[]) rows.set(r.quiz_id, r);
  }
  // The mocks the student sat, whatever their status or course now.
  const satIds = [...new Set(attempts.filter((a) => a.quiz_id && a.status !== 'abandoned').map((a) => a.quiz_id as string))].filter(
    (id) => !rows.has(id),
  );
  for (const ids of slices(satIds)) {
    const { data, error } = await db.from('mock_quizzes').select(MOCK_COLUMNS).in('quiz_id', ids);
    if (error) console.error('loadMockExams sat mocks:', error);
    for (const r of (data ?? []) as MockRowRead[]) rows.set(r.quiz_id, r);
  }

  const now = new Date();
  const views: MockView[] = [...rows.values()].map((q) => {
    const availability = getQuizAvailability(q as never, now);
    const row: PaperRow = {
      quiz_id: q.quiz_id,
      course_id: q.course_id,
      title: q.title,
      n: q.n,
      allowed_modes: orderModes(q.allowed_modes),
      first_mode: q.first_mode,
      time_limit_sec: q.time_limit_sec,
      // archived or paused since the student sat it: no longer open
      availability: availability === 'HIDDEN' ? 'CLOSED' : availability,
      publish_at: q.publish_at,
      in_trial: false,
      sittings_allowed: q.sittings_allowed,
    };
    const mocks = accessBy[q.course_id]?.mocks ?? false;
    return {
      ...paperView(row, mocks ? 'all' : 'none', attempts),
      course_title: titleOf.get(q.course_id) ?? q.course_id,
      unpublish_at: q.unpublish_at,
    };
  });

  const listed = (m: MockView) => rows.get(m.quiz_id)?.status === 'active' && rows.get(m.quiz_id)?.published === true;
  const open = views.filter((m) => listed(m) && m.availability === 'ACTIVE').sort(byCloseThenTitle);
  const coming = views
    .filter((m) => listed(m) && m.availability === 'UPCOMING')
    .sort((a, b) => Date.parse(a.publish_at ?? '') - Date.parse(b.publish_at ?? ''));
  const past = views
    .filter((m) => !open.includes(m) && !coming.includes(m) && m.sittings.length > 0)
    .sort((a, b) => latestSat(b) - latestSat(a));

  const next =
    open.find((m) => startable(m) && m.inProgress) ?? open.find((m) => startable(m) && m.state === 'new') ?? null;

  const top = topCardFor(receipts);
  const ended =
    top.kind === 'floor' && top.ended
      ? { kind: top.ended.kind === 'TRIAL' ? ('trial' as const) : ('package' as const), on: top.ended.expires_utc }
      : null;

  return {
    open,
    coming,
    past,
    next,
    locked: !heldIds.some((id) => accessBy[id]?.mocks),
    ended,
  };
}
