// lib/practice-papers/queries.ts
//
// What the three Practice Papers screens read (04.7; Sam, 2026-10-12): the
// student's courses, each with its papers and the student's sittings of
// them, and what the student's access lets them do with a paper.
//
// A student who holds no live course (the free account, an ended trial)
// still sees every paper of their programme's courses, locked — so the
// papers are read with the service role and only the card's fields reach
// the page; the question list never does. The student's own sittings
// come under their own login. The access kind is worked out the way
// create_attempt works it out (20261012100000_first_mode.sql): a live
// grant with all papers opens every paper, any other live grant only the
// trial paper (`open_in_trial`).

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
import { byTitle, paperView, type CourseView, type PaperAccess, type PaperRow } from './derive';

export type PracticePapers = {
  courses: CourseView[];
  /** "Your trial ended on 18 October." — set when the last thing the student had has run out and nothing is live. */
  ended: { kind: 'trial' | 'package'; on: string } | null;
};

type QuizRowRead = {
  quiz_id: string;
  course_id: string;
  title: string;
  n: number;
  allowed_modes: AttemptMode[];
  first_mode: AttemptMode;
  time_limit_sec: number | null;
  published: boolean;
  status: string;
  publish_at: string | null;
  unpublish_at: string | null;
  open_in_trial: boolean;
};

/** Per course, the most a live grant lets the student do with papers. */
async function paperAccessByCourse(userId: string, held: string[]): Promise<Record<string, PaperAccess>> {
  const out: Record<string, PaperAccess> = {};
  if (!held.length) return out;
  const db = createServiceRoleClient();
  const nowIso = new Date().toISOString();
  const { data: rows, error } = await db
    .from('course_access')
    .select('course_id, subscription_id')
    .eq('user_id', userId)
    .is('revoked_utc', null)
    .lte('start_utc', nowIso)
    .gt('expires_utc', nowIso);
  if (error) {
    console.error('paperAccessByCourse:', error);
    return out;
  }
  const grants = (rows ?? []) as { course_id: string; subscription_id: string }[];
  const allowAll = new Set<string>();
  for (const ids of slices([...new Set(grants.map((g) => g.subscription_id))])) {
    const { data, error: subError } = await db.from('subscriptions').select('subscription_id, allow_papers').in('subscription_id', ids);
    if (subError) {
      console.error('paperAccessByCourse subscriptions:', subError);
      continue;
    }
    for (const s of (data ?? []) as { subscription_id: string; allow_papers: string | null }[]) {
      if (s.allow_papers === 'all') allowAll.add(s.subscription_id);
    }
  }
  for (const courseId of held) out[courseId] = 'trial';
  for (const g of grants) if (allowAll.has(g.subscription_id)) out[g.course_id] = 'all';
  return out;
}

export async function loadPracticePapers(supabase: ServerSupabaseClient, profile: Profile): Promise<PracticePapers> {
  const userId = profile.user_id;
  const [access, allCourses, receipts, attempts] = await Promise.all([
    getStudentCourseAccess(supabase, userId),
    getCourses(supabase),
    getStudentReceipts(supabase, userId),
    getStudentAttempts(supabase, userId),
  ]);

  const heldIds = allCourses.filter((c) => access[c.course_id]).map((c) => c.course_id);
  // Nothing held: the programme's own courses, so the papers still show, locked (Sam, 2026-10-11).
  const shown = heldIds.length
    ? allCourses.filter((c) => access[c.course_id])
    : allCourses.filter((c) => profile.program_id && (c.program_scope ?? []).includes(profile.program_id));

  const accessBy = await paperAccessByCourse(userId, heldIds);

  const db = createServiceRoleClient();
  const quizRows: QuizRowRead[] = [];
  if (shown.length) {
    const { data, error } = await db
      .from('quizzes')
      .select('quiz_id, course_id, title, n, allowed_modes, first_mode, time_limit_sec, published, status, publish_at, unpublish_at, open_in_trial')
      .in('course_id', shown.map((c) => c.course_id))
      .eq('status', 'active')
      .eq('published', true);
    if (error) console.error('loadPracticePapers quizzes:', error);
    quizRows.push(...((data ?? []) as QuizRowRead[]));
  }

  const now = new Date();
  const courses: CourseView[] = shown.map((c) => {
    const kind: PaperAccess = accessBy[c.course_id] ?? 'none';
    const papers = byTitle(quizRows.filter((q) => q.course_id === c.course_id)).flatMap((q) => {
      const availability = getQuizAvailability(q as never, now);
      if (availability === 'HIDDEN') return [];
      const row: PaperRow = {
        quiz_id: q.quiz_id,
        course_id: q.course_id,
        title: q.title,
        n: q.n,
        allowed_modes: orderModes(q.allowed_modes),
        first_mode: q.first_mode,
        time_limit_sec: q.time_limit_sec,
        availability,
        publish_at: q.publish_at,
        unpublish_at: q.unpublish_at,
        in_trial: q.open_in_trial,
      };
      return [paperView(row, kind, attempts)];
    });
    return { course_id: c.course_id, title: c.title, access: kind, papers };
  });

  // The banner: nothing live now, and a trial or package that ran out.
  const top = topCardFor(receipts);
  const ended =
    top.kind === 'floor' && top.ended
      ? { kind: top.ended.kind === 'TRIAL' ? ('trial' as const) : ('package' as const), on: top.ended.expires_utc }
      : null;

  return { courses, ended };
}
