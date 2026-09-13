// lib/subscriptions/dates.ts
//
// The payments Worker's date helpers, transcribed
// (legacy/mynmclicensure/workers/payment-worker/src/index.js): the admin
// dialogs send a bare YYYY-MM-DD; a start becomes midnight UTC, an expiry
// becomes the last millisecond of that day, and days are added on the
// UTC calendar. Plain TypeScript, no server marker, so the dialogs can
// preview an expiry with the same arithmetic.

export function nowIso(): string {
  return new Date().toISOString();
}

export function addDaysIso(baseIso: string, days: number): string {
  const d = new Date(baseIso);
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString();
}

export function isDateOnlyString(val: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(val || '').trim());
}

/** YYYY-MM-DD → that day's midnight UTC, or '' when malformed. */
export function dateOnlyToStartIso(val: string): string {
  const s = String(val || '').trim();
  if (!isDateOnlyString(s)) return '';
  return `${s}T00:00:00.000Z`;
}

/** YYYY-MM-DD → that day's last millisecond UTC, or '' when malformed. */
export function dateOnlyToEndIso(val: string): string {
  const s = String(val || '').trim();
  if (!isDateOnlyString(s)) return '';
  return `${s}T23:59:59.999Z`;
}
