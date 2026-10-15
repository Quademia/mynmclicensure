// lib/quizzes/availability.ts
//
// The availability state machine, transcribed from legacy
// js/mynmclicensure-api.js getQuizAvailability() — the same function the
// two student list pages and the course page carried inline. One copy
// here, used by slice 5b's student pages, slice 6's spawn and slice 7's
// course page. Plain TypeScript, no server or client marker, so both
// halves can import it.
//
//   1. status !== 'active'  → HIDDEN
//   2. published !== true   → HIDDEN
//   3. now < publish_at     → UPCOMING
//   4. now > unpublish_at   → CLOSED
//   5. all clear            → ACTIVE

import type { AttemptMode } from '@/lib/attempts/types';
import { resultsHeld } from './results-date';
import type { Availability, Quiz } from './types';

type Scheduled = Pick<Quiz, 'status' | 'published' | 'publish_at' | 'unpublish_at'>;

export function getQuizAvailability(quiz: Scheduled, now: Date = new Date()): Availability {
  if (quiz.status !== 'active') return 'HIDDEN';
  if (!quiz.published) return 'HIDDEN';

  if (quiz.publish_at && new Date(quiz.publish_at) > now) return 'UPCOMING';
  if (quiz.unpublish_at && new Date(quiz.unpublish_at) < now) return 'CLOSED';

  return 'ACTIVE';
}

// The one check Start and Retake share (03-quiz-system.md Q2, D45 a):
// the quiz must be ACTIVE on the server's clock and offer the mode. The
// words are the spawn's own; Retake refuses with the same ones. While its
// results are held (04.12) only the first sitting's mode is offered —
// create_attempt refuses the same, naming the paper or the mock.
export function startRefusal(
  quiz: Scheduled & Pick<Quiz, 'allowed_modes' | 'first_mode' | 'results_at'>,
  mode: AttemptMode,
  now: Date = new Date(),
): string | null {
  if (getQuizAvailability(quiz, now) !== 'ACTIVE') return 'This quiz is not open right now.';
  // §8 S21: the quiz's ticked list
  if (!(quiz.allowed_modes ?? []).includes(mode)) return 'This mode is not available for this quiz.';
  if (resultsHeld(quiz.results_at, now) && quiz.first_mode && mode !== quiz.first_mode) {
    return 'Until its results are out, this can only be sat in its first mode.';
  }
  return null;
}
