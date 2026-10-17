// lib/offline-packs/offline-app.ts — the installable app (07.3; Sam,
// 2026-10-15: our own small file, as Next.js's own guide does; the icon
// opens the Dashboard; an install line on My packs). Browser only.
//
// Three jobs:
//   - registerOfflineApp: the service worker (public/sw.js), on a
//     production build only — on the dev server its copies of the app's
//     files would go stale between edits. It keeps one page, /offline,
//     with its files, and shows it when a page cannot be reached.
//   - warmOfflineApp: asks it to fetch /offline afresh (a release changes
//     its files). At most once a day, and only on a phone holding packs,
//     so a student who never saves a pack never pays the data; at once
//     after a Save.
//   - the install line's state: which phone this is, so its How? shows
//     that phone's own Add to Home screen steps, and nothing once the app
//     is on the home screen. Not Chrome's Install offer: on Android it
//     builds a small app through Google, which phones' safety checks can
//     block (Sam's phone did, 2026-10-15); a home-screen shortcut opens
//     offline just the same.

import { useSyncExternalStore } from 'react';

const WARMED_KEY = 'quademia-offline-warmed';
const WARM_EVERY_MS = 86_400_000;

function swSupported(): boolean {
  return process.env.NODE_ENV === 'production' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

export function registerOfflineApp(): void {
  if (!swSupported()) return;
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
    // no offline app on this browser; the online app is unaffected
  });
}

function readWarmed(): number {
  try {
    return Number(localStorage.getItem(WARMED_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeWarmed(at: number): void {
  try {
    localStorage.setItem(WARMED_KEY, String(at));
  } catch {
    // warmed again next time
  }
}

/** Refresh the phone's copy of the offline screen; `now` skips the once-a-day wait. */
export async function warmOfflineApp(now = false): Promise<void> {
  if (!swSupported()) return;
  const at = Date.now();
  if (!now && at - readWarmed() < WARM_EVERY_MS) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: 'warm' });
    writeWarmed(at);
  } catch {
    // tried again on the next page
  }
}

// ── The install line ──────────────────────────────────────────────────

/** Whose steps the install line shows: an Android phone's, an iPhone's, or none. */
export type InstallWay = 'android' | 'iphone' | 'none';

function installed(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

/** Read in a handler or a store's snapshot, never during render (also the notifications' ask, 08.5b). */
export function installWay(): InstallWay {
  if (installed()) return 'none';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iphone';
  return /Android/.test(ua) ? 'android' : 'none';
}

// Nothing here changes while a page is open.
function subscribeInstall(): () => void {
  return () => {};
}

export function useInstallWay(): InstallWay {
  return useSyncExternalStore(subscribeInstall, installWay, () => 'none');
}
