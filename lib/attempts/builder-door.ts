// lib/attempts/builder-door.ts
//
// The Quiz Builder's door (04.4; Sam, 2026-10-04 "one builder", kept
// 2026-10-11). What this student may build from, decided once per course
// on the server — whichever page opened the builder, from the student's
// grants, never from the address. The page, the course load, the keyword
// and Start all ask it, so a tampered page asks for nothing it was not
// offered. It is the student's view only: create_attempt in the database
// holds the same rules and is the lock (UX in TS, security in SQL).
//
// Per course:
//   - a live grant with no builder count (a package, Free Full Access):
//     the whole bank — 'paid';
//   - a live grant with a count and quizzes left (the trial's 3): the
//     whole bank — 'trial', with how many are left;
//   - a live grant whose count is used: the free questions, Study modes
//     only, until it ends — 'trial-used' (Sam, 2026-10-11: b);
//   - no live grant, a course of the student's programme: the free
//     questions, Study modes only — 'free', the floor (03).
// Where two grants cover a course the more generous wins, as in the
// database. A count belongs only to the trial today, so the page calls a
// counted grant "Trial".

import type { AuthGateResult } from '@/lib/access';
import { heldBackIds } from '@/lib/bank/queries';
import { getCourses } from '@/lib/catalogue/queries';
import { slices } from '@/lib/supabase/read-all';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { BuilderDoorCourse } from './types';

type GrantRow = {
  course_id: string;
  subscription_id: string;
  start_utc: string;
  expires_utc: string;
  revoked_utc: string | null;
  subscriptions: { start_utc: string | null; allow_builder_quizzes: number | null } | null;
};

function nowMs(): number {
  return Date.now();
}

/** The student's own course rows with their receipt's builder count. One student's rows. */
async function readGrants(gate: AuthGateResult): Promise<GrantRow[]> {
  const { data, error } = await gate.supabase
    .from('course_access')
    .select('course_id, subscription_id, start_utc, expires_utc, revoked_utc, subscriptions ( start_utc, allow_builder_quizzes )')
    .eq('user_id', gate.profile.user_id);
  if (error) {
    console.error('builder door, grants:', gate.profile.user_id, error);
    return [];
  }
  return (data ?? []) as unknown as GrantRow[];
}

/**
 * Builder quizzes made under a counted receipt since it began, in its
 * courses — the database's own count (create_attempt). Service role: the
 * sitting's start time is not among the student's readable columns.
 */
async function usedUnder(userId: string, since: string, courseIds: string[]): Promise<number> {
  const { count, error } = await createServiceRoleClient()
    .from('attempts')
    .select('attempt_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('source', 'builder')
    .gte('ts_iso', since)
    .in('course_id', courseIds);
  if (error) {
    console.error('builder door, quizzes used:', userId, error);
    return Number.MAX_SAFE_INTEGER; // unknown: offer the free questions, never more
  }
  return count ?? 0;
}

/** Every course the builder opens for this student, in the courses' own order, without the totals. */
export async function getBuilderDoor(gate: AuthGateResult): Promise<Omit<BuilderDoorCourse, 'total'>[]> {
  const { profile } = gate;
  const [courses, grants] = await Promise.all([getCourses(gate.supabase), readGrants(gate)]);

  const now = nowMs();
  const live = grants.filter(
    (g) => !g.revoked_utc && Date.parse(g.start_utc) <= now && now < Date.parse(g.expires_utc),
  );

  // Each counted receipt's quizzes used, read once however many courses it covers.
  const counted = new Map<string, { limit: number; since: string }>();
  for (const g of live) {
    const limit = g.subscriptions?.allow_builder_quizzes;
    if (limit !== null && limit !== undefined && !counted.has(g.subscription_id)) {
      counted.set(g.subscription_id, { limit, since: g.subscriptions?.start_utc || g.start_utc });
    }
  }
  const used = new Map<string, number>();
  await Promise.all(
    [...counted].map(async ([subId, c]) => {
      const coursesOfReceipt = [...new Set(grants.filter((g) => g.subscription_id === subId).map((g) => g.course_id))];
      used.set(subId, await usedUnder(profile.user_id, c.since, coursesOfReceipt));
    }),
  );

  const door: Omit<BuilderDoorCourse, 'total'>[] = [];
  for (const course of courses) {
    const held = live.filter((g) => g.course_id === course.course_id);
    const base = { course_id: course.course_id, title: course.title };

    if (held.length) {
      if (held.some((g) => !counted.has(g.subscription_id))) {
        door.push({ ...base, pool: 'all', reason: 'paid', quizzesLeft: null, quizzesTotal: null });
        continue;
      }
      // Counted grants only: the most quizzes left wins.
      let best: { left: number; total: number } | null = null;
      for (const g of held) {
        const c = counted.get(g.subscription_id)!;
        const left = Math.max(0, c.limit - (used.get(g.subscription_id) ?? 0));
        if (!best || left > best.left) best = { left, total: c.limit };
      }
      if (best && best.left > 0) {
        door.push({ ...base, pool: 'all', reason: 'trial', quizzesLeft: best.left, quizzesTotal: best.total });
      } else {
        door.push({ ...base, pool: 'free', reason: 'trial-used', quizzesLeft: 0, quizzesTotal: best?.total ?? null });
      }
      continue;
    }

    // No live grant: the floor, in the student's own programme only.
    if (profile.program_id && (course.program_scope || []).includes(profile.program_id)) {
      door.push({ ...base, pool: 'free', reason: 'free', quizzesLeft: null, quizzesTotal: null });
    }
  }
  return door;
}

/** One course's door, or null when the builder does not open it for this student. */
export async function builderDoorFor(gate: AuthGateResult, courseId: string): Promise<Omit<BuilderDoorCourse, 'total'> | null> {
  return (await getBuilderDoor(gate)).find((c) => c.course_id === courseId) ?? null;
}

/**
 * The question count each course shows in the course list: published,
 * free ones only on the free pool, less any a draft or active mock holds
 * back (08 B6) — the number the course's "All topics" will show once it
 * loads. Counts, not rows (rule 10). A mock's questions are never free, so
 * the free pool needs no hold-back.
 */
export async function withTotals(gate: AuthGateResult, door: Omit<BuilderDoorCourse, 'total'>[]): Promise<BuilderDoorCourse[]> {
  const svc = createServiceRoleClient();
  return Promise.all(
    door.map(async (c) => {
      let q = gate.supabase
        .from('question_bank')
        .select('item_id', { count: 'exact', head: true })
        .eq('course_id', c.course_id)
        .eq('is_published', true);
      if (c.pool === 'free') q = q.eq('is_free_sample', true);
      const [{ count, error }, held] = await Promise.all([q, c.pool === 'all' ? heldBackIds(svc, c.course_id) : Promise.resolve(new Set<string>())]);
      if (error) console.error('builder door, total:', c.course_id, error);
      let heldPublished = 0;
      if (held && held.size) {
        for (const ids of slices([...held])) {
          const r = await svc
            .from('question_bank')
            .select('item_id', { count: 'exact', head: true })
            .eq('course_id', c.course_id)
            .eq('is_published', true)
            .in('item_id', ids);
          heldPublished += r.count ?? 0;
        }
      }
      return { ...c, total: Math.max(0, (count ?? 0) - heldPublished) };
    }),
  );
}
