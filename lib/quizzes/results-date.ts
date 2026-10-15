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
