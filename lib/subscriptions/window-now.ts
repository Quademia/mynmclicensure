// lib/subscriptions/window-now.ts
//
// A receipt's dates as a page reads them now (02, Premium goes first;
// 02.14). A receipt's own window is its first access row's start to its
// last row's end, and a Standard paused by Premium days has a gap inside
// it: read as one window it looks live through the pause, and "the live
// package with the latest end" picks it over the Premium that is really
// running. So a page that asks "what does the student hold now" reads
// the receipt with its rows: from the start of the stretch running now,
// or else the next one, to the last end. A paused receipt then reads as
// coming. A receipt with no rows keeps its own dates.
//
// Plain TypeScript, no server marker: the dashboard, Profile, the Upgrade
// page and Messages each embed `course_access ( start_utc, expires_utc,
// revoked_utc )` in their read of `subscriptions` and pass the rows here.

export type Stretch = { start_utc: string; expires_utc: string; revoked_utc: string | null };
export type Window = { start_utc: string; expires_utc: string };

function nowMs(): number {
  return Date.now();
}

const ms = (iso: string) => new Date(iso).getTime();

export function windowNow(own: Window, rows: Stretch[] | null | undefined): Window {
  const kept = (rows ?? []).filter((r) => !r.revoked_utc).sort((a, b) => ms(a.start_utc) - ms(b.start_utc));
  if (!kept.length) return { start_utc: own.start_utc, expires_utc: own.expires_utc };
  const now = nowMs();
  const end = kept.reduce((last, r) => (ms(r.expires_utc) > ms(last) ? r.expires_utc : last), kept[0].expires_utc);
  const running = kept.find((r) => ms(r.start_utc) <= now && now < ms(r.expires_utc));
  const next = kept.find((r) => ms(r.start_utc) > now);
  return { start_utc: (running ?? next ?? kept[0]).start_utc, expires_utc: end };
}

/** Started and not yet ended, by the window above. */
export function isLiveNow(w: Window): boolean {
  const now = nowMs();
  return ms(w.start_utc) <= now && now < ms(w.expires_utc);
}
