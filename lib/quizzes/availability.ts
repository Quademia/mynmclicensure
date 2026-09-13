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

import type { Availability, Quiz } from './types';

type Scheduled = Pick<Quiz, 'status' | 'published' | 'publish_at' | 'unpublish_at'>;

export function getQuizAvailability(quiz: Scheduled, now: Date = new Date()): Availability {
  if (quiz.status !== 'active') return 'HIDDEN';
  if (!quiz.published) return 'HIDDEN';

  if (quiz.publish_at && new Date(quiz.publish_at) > now) return 'UPCOMING';
  if (quiz.unpublish_at && new Date(quiz.unpublish_at) < now) return 'CLOSED';

  return 'ACTIVE';
}
