// lib/announcements/later.ts
//
// The Must-see pop-up's "Later" (08.16; Sam, 2026-10-18): it hides the
// pop-ups until the student next opens the app — kept in this tab's
// session storage, keyed by the student (phones are shared, AGENTS.md),
// so a new visit brings them back. Read through useSyncExternalStore
// (AGENTS.md: browser storage is never read in render); written from a
// handler through this module (the compiler's rule on writes to the
// browser's globals inside a component). Browser only.

const EVENT = 'qd-mustsee-later';

function key(userId: string): string {
  return `qd-mustsee-later:${userId}`;
}

export function laterSubscribe(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

export function laterChosen(userId: string): boolean {
  try {
    return window.sessionStorage.getItem(key(userId)) === '1';
  } catch {
    return false;
  }
}

export function chooseLater(userId: string): void {
  try {
    window.sessionStorage.setItem(key(userId), '1');
  } catch {
    /* storage refused: the pop-up simply closes for this page */
  }
  window.dispatchEvent(new Event(EVENT));
}
