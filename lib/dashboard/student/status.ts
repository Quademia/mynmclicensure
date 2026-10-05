// lib/dashboard/student/status.ts
//
// Which top card a student gets (11-pages.md Dashboard; 02.1: a receipt
// is live by its dates, never by the ACTIVE word alone). Revoked receipts
// play no part. The clock is read here, never in a component's render
// (AGENTS.md, the React compiler's purity rule).

import type { DashReceipt, TopCard } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The full recap shows for this many days after a trial or package ends, then one line (Sam, 2026-10-04). */
export const RECAP_FULL_DAYS = 14;

function nowMs(): number {
  return Date.now();
}

function latestBy(rows: DashReceipt[], key: 'start_utc' | 'expires_utc'): DashReceipt {
  return rows.reduce((best, r) => (Date.parse(r[key]) > Date.parse(best[key]) ? r : best));
}

export function topCardFor(receipts: DashReceipt[]): TopCard {
  const now = nowMs();
  const usable = receipts.filter((r) => r.status !== 'REVOKED');
  const live = usable.filter((r) => Date.parse(r.start_utc) <= now && now < Date.parse(r.expires_utc));
  const coming = usable.filter((r) => Date.parse(r.start_utc) > now);
  const firstComing = coming.length
    ? coming.reduce((first, c) => (Date.parse(c.start_utc) < Date.parse(first.start_utc) ? c : first))
    : null;

  const paid = live.filter((r) => r.kind !== 'TRIAL');
  if (paid.length) {
    const r = latestBy(paid, 'expires_utc');
    return { kind: 'paid', receipt: r, daysLeft: Math.ceil((Date.parse(r.expires_utc) - now) / DAY_MS), next: firstComing };
  }

  const trials = live.filter((r) => r.kind === 'TRIAL');
  if (trials.length) {
    const r = latestBy(trials, 'expires_utc');
    return {
      kind: 'trial',
      receipt: r,
      daysLeft: Math.ceil((Date.parse(r.expires_utc) - now) / DAY_MS),
      totalDays: Math.max(1, Math.round((Date.parse(r.expires_utc) - Date.parse(r.start_utc)) / DAY_MS)),
      next: firstComing,
    };
  }

  if (firstComing) return { kind: 'future', receipt: firstComing };

  const ended = usable.filter((r) => Date.parse(r.expires_utc) <= now);
  if (!ended.length) return { kind: 'floor', ended: null, recapFull: false };
  const last = latestBy(ended, 'expires_utc');
  return { kind: 'floor', ended: last, recapFull: now - Date.parse(last.expires_utc) < RECAP_FULL_DAYS * DAY_MS };
}

/** The weekday letters of the last 7 UTC days, oldest first — the streak strip's labels. */
export function lastSevenDayLetters(): string[] {
  const today = new Date(nowMs());
  const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (6 - i)));
    return letters[d.getUTCDay()];
  });
}
