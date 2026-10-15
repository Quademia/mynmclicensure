// lib/offline-packs/phone.ts — the packs kept on this phone (07.3; Sam,
// 2026-10-15). Browser only: imported by client components, never by the
// server.
//
// A pack saved to a phone is a copy of its questions in the browser's own
// database (IndexedDB — localStorage holds about 5 MB, too little for a
// student's packs), so the offline screen (/offline) can open it with no
// signal. Beside the packs, one note: whose packs these are, when a page
// that only a signed-in device can open last confirmed it (the check-in),
// and how many days a check-in lasts (Config's offline_checkin_days).
//
// The rules, as ruled:
//   - packs only on a phone where the account is signed in: every signed-in
//     student page checks in (checkInPhone); a different account on the
//     phone clears the last one's packs (phones are shared); the sign-in
//     page clears them when the phone was signed out or bumped
//     (app/login/clear-phone-packs.tsx).
//   - past the check-in period the packs are listed but locked until the
//     phone connects once ("Connect once to keep using your packs").
//   - a pack deleted on another device leaves when My packs is next opened
//     here (prunePhone).
//   - the phone keeps only the packs and each one's last score; nothing goes
//     back to the server (Sam: no sync).
//
// The screens read it through usePhonePacks(): one read shared by every
// row on the page, re-read after each change.

import { useSyncExternalStore } from 'react';
import type { PackQuestion } from './questions';
import { OFFLINE_CHECKIN_DAYS_DEFAULT } from './types';

export type PhonePack = {
  pack_id: string;
  user_id: string;
  course_id: string;
  course_title: string;
  pack_name: string;
  question_count: number;
  created_utc: string;
  saved_at: number;
  questions: PackQuestion[];
  /** The PDF's cover (07.5); absent on a copy saved before it. */
  owner_name?: string;
  owner_email_mask?: string;
  picked?: string;
  /** The last practice on this phone. */
  last: { right: number; total: number; at: number } | null;
};

type PhoneNote = { user_id: string; checked_in_at: number; checkin_days: number };

export type PhoneState = {
  /** This phone's packs for the account last checked in, newest made first. */
  packs: PhonePack[];
  /** The check-in period has run out: the packs are listed but do not open. */
  locked: boolean;
  /** The browser keeps no packs (no IndexedDB, or it refused). */
  unavailable: boolean;
};

const DB_NAME = 'quademia-packs';
const DB_VERSION = 1;
const PACKS = 'packs';
const NOTE = 'note';
const NOTE_KEY = 'phone';
const DAY_MS = 86_400_000;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser keeps no packs.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PACKS)) db.createObjectStore(PACKS, { keyPath: 'pack_id' });
      if (!db.objectStoreNames.contains(NOTE)) db.createObjectStore(NOTE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise = opening;
  opening.catch(() => {
    dbPromise = null;
  });
  return opening;
}

function asked<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('The phone did not keep the change.'));
  });
}

async function readAll(): Promise<{ packs: PhonePack[]; note: PhoneNote | null }> {
  const db = await openDb();
  const tx = db.transaction([PACKS, NOTE], 'readonly');
  const [packs, note] = await Promise.all([
    asked(tx.objectStore(PACKS).getAll() as IDBRequest<PhonePack[]>),
    asked(tx.objectStore(NOTE).get(NOTE_KEY) as IDBRequest<PhoneNote | undefined>),
  ]);
  return { packs, note: note ?? null };
}

// ── The shared read (useSyncExternalStore) ────────────────────────────
let snapshot: PhoneState | null = null;
let reading = false;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

/** Read the phone again and tell every screen showing it. */
export async function refreshPhone(): Promise<void> {
  reading = true;
  try {
    const { packs, note } = await readAll();
    const mine = note ? packs.filter((p) => p.user_id === note.user_id) : [];
    mine.sort((a, b) => (a.created_utc < b.created_utc ? 1 : a.created_utc > b.created_utc ? -1 : 0));
    const locked = Boolean(note && Date.now() - note.checked_in_at > note.checkin_days * DAY_MS);
    snapshot = { packs: mine, locked, unavailable: false };
  } catch {
    snapshot = { packs: [], locked: false, unavailable: true };
  } finally {
    reading = false;
  }
  emit();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  if (!snapshot && !reading) void refreshPhone();
  return () => {
    listeners.delete(fn);
  };
}

function getSnapshot(): PhoneState | null {
  return snapshot;
}

function getServerSnapshot(): PhoneState | null {
  return null;
}

/** This phone's packs; null until the first read has come back. */
export function usePhonePacks(): PhoneState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ── Changes ───────────────────────────────────────────────────────────

/**
 * A signed-in page was opened: stamp the check-in. A different account's
 * packs leave first. A phone holding nothing is left untouched, so a
 * student with no packs here never gets a note. Says whether the phone
 * holds packs for this student.
 */
export async function checkInPhone(userId: string, checkinDays?: number): Promise<boolean> {
  const db = await openDb();
  const tx = db.transaction([PACKS, NOTE], 'readwrite');
  const packs = tx.objectStore(PACKS);
  const notes = tx.objectStore(NOTE);
  const [note, count] = await Promise.all([asked(notes.get(NOTE_KEY) as IDBRequest<PhoneNote | undefined>), asked(packs.count())]);
  let holds = count > 0;
  if (note && note.user_id !== userId) {
    packs.clear();
    holds = false;
  }
  if (note || holds) {
    notes.put(
      { user_id: userId, checked_in_at: Date.now(), checkin_days: checkinDays ?? note?.checkin_days ?? OFFLINE_CHECKIN_DAYS_DEFAULT } satisfies PhoneNote,
      NOTE_KEY,
    );
  }
  await finished(tx);
  if (listeners.size) await refreshPhone();
  return holds;
}

/** Keep a pack on this phone (Save to this phone, or the phone it was made on). */
export async function savePhonePack(pack: Omit<PhonePack, 'saved_at' | 'last'>, checkinDays: number): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([PACKS, NOTE], 'readwrite');
  const packs = tx.objectStore(PACKS);
  const notes = tx.objectStore(NOTE);
  const [note, before] = await Promise.all([
    asked(notes.get(NOTE_KEY) as IDBRequest<PhoneNote | undefined>),
    asked(packs.get(pack.pack_id) as IDBRequest<PhonePack | undefined>),
  ]);
  if (note && note.user_id !== pack.user_id) packs.clear();
  packs.put({ ...pack, saved_at: Date.now(), last: before?.user_id === pack.user_id ? before.last : null } satisfies PhonePack);
  notes.put({ user_id: pack.user_id, checked_in_at: Date.now(), checkin_days: checkinDays } satisfies PhoneNote, NOTE_KEY);
  await finished(tx);
  // Ask the browser not to clear the packs when space runs low (Chrome
  // grants it without a question to an installed app or a site in use).
  try {
    await navigator.storage?.persist?.();
  } catch {
    // the packs are kept either way
  }
  await refreshPhone();
}

/** Remove from this phone; the pack stays in My packs. */
export async function removePhonePack(packId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(PACKS, 'readwrite');
  tx.objectStore(PACKS).delete(packId);
  await finished(tx);
  await refreshPhone();
}

/** A practice finished: the pack's last score, if the pack is on this phone. */
export async function setLastScore(packId: string, right: number, total: number): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(PACKS, 'readwrite');
  const store = tx.objectStore(PACKS);
  const pack = await asked(store.get(packId) as IDBRequest<PhonePack | undefined>);
  if (pack) store.put({ ...pack, last: { right, total, at: Date.now() } } satisfies PhonePack);
  await finished(tx);
  if (listeners.size) await refreshPhone();
}

/**
 * My packs was opened (online, signed in): the packs deleted elsewhere
 * leave, and the check-in period takes Config's value.
 */
export async function prunePhone(userId: string, activeIds: string[], checkinDays: number): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([PACKS, NOTE], 'readwrite');
  const packs = tx.objectStore(PACKS);
  const notes = tx.objectStore(NOTE);
  const [all, note] = await Promise.all([
    asked(packs.getAll() as IDBRequest<PhonePack[]>),
    asked(notes.get(NOTE_KEY) as IDBRequest<PhoneNote | undefined>),
  ]);
  const active = new Set(activeIds);
  for (const p of all) if (p.user_id !== userId || !active.has(p.pack_id)) packs.delete(p.pack_id);
  if (note) notes.put({ user_id: userId, checked_in_at: Date.now(), checkin_days: checkinDays } satisfies PhoneNote, NOTE_KEY);
  await finished(tx);
  await refreshPhone();
}

/** Signed out on this phone, or bumped by a sign-in elsewhere: every pack leaves. */
export async function clearPhone(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([PACKS, NOTE], 'readwrite');
  tx.objectStore(PACKS).clear();
  tx.objectStore(NOTE).clear();
  await finished(tx);
  if (listeners.size) await refreshPhone();
}
