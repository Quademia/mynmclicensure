// components/builder/builder-parts.tsx
//
// The status lines above the builder's circles. The pack builder's (07.2):
// the course's packs left, from the package; none with no limit.
//
// The Quiz Builder's status line (04.4; Sam, 2026-10-11: kept above the
// old wizard's circles) — a trial's quizzes left, a trial's used up, or
// free practice; none when paid. Single-use, so it lives beside its page.
// The words are Sam's to change.

'use client';

import { AppLink } from '@/components/shell/link-pending';
import type { BuilderDoorCourse } from '@/lib/attempts/types';

const PACKAGES_HREF = '/student/upgrade';

/** 07.2: the pack builder's line — the course's packs left; none with no limit. */
export function PackBanner({ course }: { course: BuilderDoorCourse }) {
  if (course.packsLeft === null || course.packsLeft === undefined) return null;
  const allowed = course.packsAllowed ?? course.packsLeft;
  return (
    <div className={course.packsLeft === 0 ? 'qb-banner qb-banner-warn' : 'qb-banner qb-banner-info'} role="status">
      <strong>
        {course.title} · {course.packsLeft} of {allowed} packs left
      </strong>
      <span>A pack counts when you make it. Deleting one doesn&apos;t give it back.</span>
    </div>
  );
}

/** The line at the top: a trial's quizzes left, a trial's used up, or free practice. None when paid. */
export function Banner({ course }: { course: BuilderDoorCourse }) {
  if (course.reason === 'paid') return null;
  if (course.reason === 'trial') {
    return (
      <div className="qb-banner qb-banner-warn" role="status">
        <strong>
          Trial · {course.quizzesLeft} of {course.quizzesTotal} quizzes left
        </strong>
        <span>A quiz counts when you build it. Retakes don&apos;t count.</span>
        <AppLink href={PACKAGES_HREF} className="qb-banner-link">
          Choose a package →
        </AppLink>
      </div>
    );
  }
  if (course.reason === 'trial-used') {
    return (
      <div className="qb-banner qb-banner-warn" role="status">
        <strong>You&apos;ve used your {course.quizzesTotal ?? 3} trial quizzes</strong>
        <span>Keep practising on the free questions, or choose a package for the whole bank.</span>
        <AppLink href={PACKAGES_HREF} className="qb-banner-link">
          Choose a package →
        </AppLink>
      </div>
    );
  }
  return (
    <div className="qb-banner qb-banner-info" role="status">
      <strong>Free practice</strong>
      <span>You build from the free questions in each course, in the Study modes. The whole bank opens with a package.</span>
      <AppLink href={PACKAGES_HREF} className="qb-banner-link">
        See packages →
      </AppLink>
    </div>
  );
}
