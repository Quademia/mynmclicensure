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
//   - the install line's state: Chrome's install offer (the
//     `beforeinstallprompt` event, caught early by a line of script in the
//     student layout, since it can fire before the page wakes), whether
//     the app is already installed, and whether this is an iPhone, which
//     has no offer — only Share, then Add to Home Screen.

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

type InstallOffer = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

declare global {
  interface Window {
    /** Set by the student layout's early script when Chrome offers to install. */
    __qdInstall?: InstallOffer | null;
  }
}

/** What the install line shows: Chrome's offer, the iPhone's two steps, or nothing. */
export type InstallWay = 'offer' | 'iphone' | 'none';

const installListeners = new Set<() => void>();
let listening = false;

function emitInstall() {
  for (const fn of installListeners) fn();
}

function listen() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__qdInstall = e as InstallOffer;
    emitInstall();
  });
  window.addEventListener('appinstalled', () => {
    window.__qdInstall = null;
    emitInstall();
  });
}

function installed(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

function iPhone(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function installWay(): InstallWay {
  if (typeof window === 'undefined' || installed()) return 'none';
  if (window.__qdInstall) return 'offer';
  return iPhone() ? 'iphone' : 'none';
}

function subscribeInstall(fn: () => void): () => void {
  listen();
  installListeners.add(fn);
  return () => {
    installListeners.delete(fn);
  };
}

export function useInstallWay(): InstallWay {
  return useSyncExternalStore(subscribeInstall, installWay, () => 'none');
}

/** Chrome's own install box; the line goes once it is installed. */
export async function installApp(): Promise<void> {
  const offer = window.__qdInstall;
  if (!offer) return;
  await offer.prompt();
  const choice = await offer.userChoice.catch(() => ({ outcome: 'dismissed' }));
  if (choice.outcome === 'accepted') window.__qdInstall = null;
  emitInstall();
}

/** Started with the student pages, so a later offer is caught too. */
export function listenForInstall(): void {
  listen();
}
