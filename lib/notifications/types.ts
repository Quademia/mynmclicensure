// lib/notifications/types.ts — phone notifications (08.5b; Sam,
// 2026-10-17). The shared words, kept out of the 'use server' module
// (AGENTS.md: such a module exports only async functions).

/** What a device is sent: a student their replies and important news (08.15), an admin's device the students' messages. Later kinds are Sam's call, one at a time, grouped by what the student cares about. */
export type NoticeKind = 'reply' | 'student_message' | 'announcement';

export const NOTICE_KINDS: readonly NoticeKind[] = ['reply', 'student_message', 'announcement'];

/** A student's kinds, in Profile's order: one yes turns on both (Sam, 2026-10-20). */
export const STUDENT_KINDS: readonly NoticeKind[] = ['reply', 'announcement'];

/** What the service worker shows: the title and line are ours, the label only — never the message's text (Sam: phones are shared). */
export type Notice = { title: string; body: string; url: string; tag: string };

/** The device's address and keys, as the browser's PushSubscription.toJSON() gives them. */
export type DeviceSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

export type SaveDeviceResult = { ok: true; kinds: NoticeKind[] } | { ok: false; error: string };

/** "Not now" hides the ask on that phone this long (Sam, 2026-10-17). */
export const ASK_LATER_DAYS = 7;

/** While the browser's Allow is open — Edge often shows it only as a bell in the address bar (walked 2026-10-17). */
export const WAITING_WORDS = "Waiting for your browser's Allow. If no box appeared, look for a bell at the end of the address bar.";
