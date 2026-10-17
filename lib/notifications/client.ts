// lib/notifications/client.ts — the browser half of phone notifications
// (08.5b; Sam, 2026-10-17). Browser only; every function is called from a
// handler, an effect or a store's snapshot, never during render.
//
//   pushState — what this browser can do: nothing (the dev server, no
//     keys, an old browser), an iPhone not yet on the Home Screen, or the
//     phone's own answer so far (denied, not asked, granted);
//   turnOn — the phone's Allow (called in the tap: a browser asks only
//     after one), then this device's address from its post office, then
//     the server; turnOff — the admin's switch off;
//   relinkOnce — once a sitting, this device's row moves to this sign-in
//     when it is the same person's (the week ran out, they signed in
//     again), and what it is sent is kept for the sitting;
//   askAfterSend — whether a student's send shows the ask: not when it
//     cannot work, when blocked, when already on, or within 7 days of Not
//     now on this phone.
//
// What is kept, keyed by the person (AGENTS.md: phones are shared): the
// kinds this device is sent, for the sitting (sessionStorage); the end of
// a Not now, on the phone (localStorage). Both read in try/catch.

import { installWay, registerOfflineApp } from '@/lib/offline-packs/offline-app';
import { dropKindAction, relinkDeviceAction, saveDeviceAction } from './actions';
import { ASK_LATER_DAYS, type NoticeKind } from './types';

export type PushState = 'unsupported' | 'iphone' | 'denied' | 'default' | 'granted';

function canPush(): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function pushState(publicKey: string | null): PushState {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production' || !publicKey) return 'unsupported';
  if (!canPush()) return installWay() === 'iphone' ? 'iphone' : 'unsupported';
  return Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'default';
}

// ── what is kept ───────────────────────────────────────────────────────

const kindsKey = (userId: string) => `qa_notify_kinds:${userId}`;
const laterKey = (userId: string) => `qa_notify_later:${userId}`;
const listeners = new Set<() => void>();

export function subscribeNotify(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The kept kinds as stored (a stable string for a store's snapshot); '' when not known this sitting. */
export function keptKindsRaw(userId: string): string {
  try {
    return sessionStorage.getItem(kindsKey(userId)) ?? '';
  } catch {
    return '';
  }
}

export function parseKinds(raw: string): NoticeKind[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((k): k is NoticeKind => k === 'reply' || k === 'student_message') : [];
  } catch {
    return [];
  }
}

function keepKinds(userId: string, kinds: NoticeKind[]): void {
  try {
    sessionStorage.setItem(kindsKey(userId), JSON.stringify(kinds));
  } catch {
    // asked again next sitting
  }
  for (const fn of listeners) fn();
}

export function askLater(userId: string): void {
  try {
    localStorage.setItem(laterKey(userId), String(Date.now() + ASK_LATER_DAYS * 86_400_000));
  } catch {
    // shown again after the next send
  }
}

function laterUntil(userId: string): number {
  try {
    return Number(localStorage.getItem(laterKey(userId))) || 0;
  } catch {
    return 0;
  }
}

// ── the device ─────────────────────────────────────────────────────────

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

async function existingSubscription(): Promise<PushSubscription | null> {
  if (!canPush()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export type TurnOnResult = 'on' | 'denied' | 'dismissed' | { error: string };

/** Call from the tap itself: the phone shows its Allow box only after one. */
export async function turnOn(userId: string, publicKey: string, kind: NoticeKind): Promise<TurnOnResult> {
  if (!canPush()) return { error: 'This browser cannot show notifications.' };
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'dismissed';
  try {
    registerOfflineApp();
    const reg = await navigator.serviceWorker.ready;
    const key = keyBytes(publicKey);
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub.options.applicationServerKey, key)) {
      await sub.unsubscribe().catch(() => false); // made with another key: start again
      sub = null;
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const json = sub.toJSON();
    const r = await saveDeviceAction(
      { endpoint: sub.endpoint, keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' } },
      kind,
    );
    if (!r.ok) return { error: r.error };
    keepKinds(userId, r.kinds);
    return 'on';
  } catch {
    return { error: 'Could not turn on notifications. Please check your connection and try again.' };
  }
}

export async function turnOff(userId: string, kind: NoticeKind): Promise<boolean> {
  try {
    const sub = await existingSubscription();
    const kept = parseKinds(keptKindsRaw(userId)).filter((k) => k !== kind);
    if (!sub) {
      keepKinds(userId, kept);
      return true;
    }
    const r = await dropKindAction(sub.endpoint, kind);
    if (r.ok) keepKinds(userId, kept);
    return r.ok;
  } catch {
    return false;
  }
}

export async function relinkOnce(userId: string): Promise<void> {
  if (!canPush() || Notification.permission !== 'granted') return;
  if (keptKindsRaw(userId)) return; // done this sitting
  try {
    const sub = await existingSubscription();
    keepKinds(userId, sub ? await relinkDeviceAction(sub.endpoint) : []);
  } catch {
    // tried again next sitting
  }
}

export type AskShape = 'card' | 'iphone' | null;

export function askAfterSend(userId: string, publicKey: string | null): AskShape {
  const state = pushState(publicKey);
  if (state === 'unsupported' || state === 'denied') return null;
  if (Date.now() < laterUntil(userId)) return null;
  if (state === 'iphone') return 'iphone';
  if (parseKinds(keptKindsRaw(userId)).includes('reply')) return null;
  return 'card';
}
