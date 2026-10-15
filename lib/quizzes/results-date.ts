// lib/quizzes/results-date.ts
//
// Results on a date (04.12; Sam, 2026-10-14/15): a paper's or a mock's
// `results_at`. While it has not come, every sitting of it is held — no
// score, report, answer or explanation reaches the student — and only the
// first sitting's mode can be sat. The database holds it
// (student_attempts(), the attempt_items policy, create_attempt); these
// helpers are the pages' copy of the same test and the one way the date
// is written, in Ghana's time (UTC), for server pages and the runner's
// client components alike, so the two never paint different words.
//
// Plain TypeScript, no server or client marker.

/** Held: a date is set and it has not come. */
export function resultsHeld(resultsAt: string | null | undefined, now: Date = new Date()): boolean {
  return !!resultsAt && new Date(resultsAt).getTime() > now.getTime();
}

/** "Friday 30 October at 6:00 pm" — the pop-up, the held screen, the start screen, a card. */
export function formatResultsAt(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
  return `${day} at ${time}`;
}

/** "Friday 30 October" — a heading. */
export function formatResultsDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** "30 Oct" — a list row's right-hand word: "Results on 30 Oct". */
export function formatResultsShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "4 November" — the review's closing day in a sentence (04.13). */
export function formatResultsDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

// ── the review (04.13; Sam, 2026-10-15) ─────────────────────────────────
// A paper's or mock's `review`: 'always' (the default), 'until' a date, or
// 'never'. Its own date, independent of the results date. While it is
// closed the score and the summary stay; the question-by-question review,
// the question map and Learning do not. The database holds it
// (student_attempts().review_closed, the attempt_items policy,
// create_attempt, check_answer); this is the pages' copy and its words.

export type ReviewSetting = 'always' | 'until' | 'never';

/** Closed: Not allowed, or Until and the date has come. */
export function reviewClosed(review: string | null | undefined, closesAt: string | null | undefined, now: Date = new Date()): boolean {
  if (review === 'never') return true;
  return review === 'until' && !!closesAt && new Date(closesAt).getTime() <= now.getTime();
}

/** What a closed review says: "… closed on 4 November" or "… are not shown". */
export function reviewClosedLine(review: string | null | undefined, closesAt: string | null | undefined, noun: string): string {
  if (review === 'until' && closesAt) return `The review of this ${noun} closed on ${formatResultsDate(closesAt)}.`;
  return `The answers to this ${noun} are not shown.`;
}

/** The line a paper's or mock's card carries about its review, or null for Always. */
export function reviewLine(
  review: string | null | undefined,
  closesAt: string | null | undefined,
  noun: string,
  now: Date = new Date(),
): string | null {
  if (review === 'never' || reviewClosed(review, closesAt, now)) return reviewClosedLine(review, closesAt, noun);
  if (review === 'until' && closesAt) return `Review open until ${formatResultsAt(closesAt)}.`;
  return null;
}

// ── the close (04.14; Sam, 2026-10-13/15) ───────────────────────────────
// After a paper or mock closes no sitting starts. A timed sitting whose
// clock is running keeps it to the end; any other sitting going is due —
// finished at the close on what was answered, or Abandoned with no answer —
// the next time it is opened (expire_attempt) or an answer is saved (the
// database refuses with "This paper has closed."). The pages' copy.

/** A sitting going whose paper has closed and which has no clock running. */
export function closeDue(
  a: { status: string; mode: string; started_utc: string | null; closes_at?: string | null },
  now: Date = new Date(),
): boolean {
  if (a.status !== 'in_progress' || !a.closes_at) return false;
  if (new Date(a.closes_at).getTime() >= now.getTime()) return false;
  return !(a.mode.startsWith('TIMED_') && a.started_utc);
}

/** The database's refusal of a save, a check, Submit or Start past the close. */
export function isCloseRefusal(message: string | null | undefined): boolean {
  return /^This (paper|mock) has closed\.$/.test(String(message ?? '').trim());
}

/** The line a sitting finished (or abandoned) at the close carries. */
export function closedSittingLine(noun: string, closesAt: string, scored: boolean): string {
  return scored
    ? `This ${noun} closed on ${formatResultsAt(closesAt)}, so your sitting was finished on what you had answered.`
    : `This ${noun} closed on ${formatResultsAt(closesAt)} before any question was answered, so this sitting was not scored.`;
}
