// app/(app)/student/dashboard/format.ts
//
// The dashboard's words for dates and numbers. Formatted on the server;
// Ghana keeps GMT all year and the Worker runs UTC, so the day shown is
// the reader's own.

/** "18 Oct 2026" */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** "1,080" */
export function fmtNumber(n: number): string {
  return n.toLocaleString('en-GB');
}

/** A whole percent of `part` in `whole`; 0 when there is no whole. */
export function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${fmtNumber(n)} ${n === 1 ? one : many}`;
}
