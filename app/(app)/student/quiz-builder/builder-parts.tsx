// app/(app)/student/quiz-builder/builder-parts.tsx
//
// The Quiz Builder's small pieces (04.4): Start's arrow, a chip, a mode
// card and the status banner. Single-use, so they live beside their
// page. The words are the canvas's (Sam's "Quiz Builder Redesign",
// 2026-10-09), Sam's to change.

'use client';

import { AppLink } from '@/components/shell/link-pending';
import { Icon } from '@/components/shell/icons';
import type { ModeDef } from '@/lib/attempts/modes';
import type { BuilderDoorCourse } from '@/lib/attempts/types';

const PACKAGES_HREF = '/student/upgrade';

/** Start's arrow, as the canvas draws it. */
export function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** A toggle chip with its count; a count of 0 greys it out without hiding it. */
export function Chip({ label, count, pressed, onClick, disabled }: { label: string; count?: number; pressed: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={pressed ? 'qb-chip is-on' : 'qb-chip'} aria-pressed={pressed} onClick={onClick} disabled={disabled}>
      <span className="qb-chip-label">{label}</span>
      {count !== undefined ? <span className="qb-chip-count">{count.toLocaleString('en-GB')}</span> : null}
    </button>
  );
}

/** One mode, from the mode table; locked on the free questions (Exam modes open with a package). */
export function ModeCard({ mode, pressed, locked, onClick }: { mode: ModeDef; pressed: boolean; locked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`qb-mode${pressed ? ' is-on' : ''}${locked ? ' is-locked' : ''}`}
      aria-pressed={pressed}
      aria-describedby={locked ? 'qb-exam-locked' : undefined}
      onClick={onClick}
    >
      <span className="qb-radio" aria-hidden="true" />
      <span className="qb-mode-text">
        <span className="qb-mode-name">{mode.name}</span>
        <span className="qb-mode-line">{mode.card}</span>
      </span>
      {locked ? <Icon name="lock" className="qb-mode-lock" /> : null}
    </button>
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
