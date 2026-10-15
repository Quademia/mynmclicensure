// lib/offline-packs/door.ts
//
// The pack builder's door (07.2; Sam, 2026-10-15: the pack builder is the
// Quiz Builder with a pack's extras). What this student may make packs
// from, decided on the server from their live grants and the package's
// allowance — the page, the course load, the keyword and Make pack all ask
// it, so a tampered page asks for nothing it was not offered. The lock is
// the database's (create_offline_pack asks pack_allowance()).
//
// A course opens when the student holds it now and its package includes
// packs (an allowance of 0 — the trial's — does not). A course with no
// packs left still shows, closed, so the student sees why. Packs come
// from the Practice and Free pools only (06.8), so its total counts those.
// A trial or free student gets no door: the page shows the locked card.

import type { AuthGateResult } from '@/lib/access';
import { withTotals } from '@/lib/attempts/builder-door';
import type { BuilderDoorCourse } from '@/lib/attempts/types';
import { getCourses } from '@/lib/catalogue/queries';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { getOfflinePackAllowance } from './queries';

/** Every course the pack builder opens for this student, with its allowance, without the totals. */
export async function getPackDoor(gate: AuthGateResult): Promise<Omit<BuilderDoorCourse, 'total'>[]> {
  const [courses, access] = await Promise.all([getCourses(gate.supabase), getStudentCourseAccess(gate.supabase, gate.profile.user_id)]);
  const held = courses.filter((c) => Boolean(access[c.course_id]));
  const allowances = await Promise.all(held.map((c) => getOfflinePackAllowance(gate.supabase, gate.profile.user_id, c.course_id)));

  const door: Omit<BuilderDoorCourse, 'total'>[] = [];
  held.forEach((c, i) => {
    const a = allowances[i];
    if (!a.success) return; // no live grant, packs not in the package, or the check failed
    door.push({
      course_id: c.course_id,
      title: c.title,
      pool: 'all',
      reason: 'paid',
      quizzesLeft: null,
      quizzesTotal: null,
      packsLeft: a.remaining,
      packsAllowed: a.downloads_per_course,
    });
  });
  return door;
}

/** The door with each course's question count (Practice and Free, published). */
export async function getPackDoorWithTotals(gate: AuthGateResult): Promise<BuilderDoorCourse[]> {
  return withTotals(gate, await getPackDoor(gate));
}

/** One course's pack door, or null when packs cannot be made from it now. */
export async function packDoorFor(gate: AuthGateResult, courseId: string): Promise<Omit<BuilderDoorCourse, 'total'> | null> {
  return (await getPackDoor(gate)).find((c) => c.course_id === courseId) ?? null;
}
