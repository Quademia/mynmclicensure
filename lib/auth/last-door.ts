// lib/auth/last-door.ts — which way in this device used last (01.16;
// Sam, 2026-10-31: C). The sign-in card shows three ways in, folded; a
// device that has signed in before opens straight on the way it used,
// so a student who signs in by password pays no extra tap.
//
// A cookie, written by the server when a sign-in succeeds and read by
// the sign-in page's server half, so the right step is in the first paint
// with no flicker on a slow connection. It holds the way in only, never
// who: on a shared phone the next person sees the last person's way in,
// not their email. A sign-out leaves it.
//
// Server only.

import { cookies } from 'next/headers';
import type { SignInDoor } from './types';

const LAST_DOOR_COOKIE = 'licensure_last_door';
const DOORS: readonly SignInDoor[] = ['password', 'google', 'link'];

export async function rememberDoor(door: SignInDoor): Promise<void> {
  const jar = await cookies();
  jar.set(LAST_DOOR_COOKIE, door, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
  });
}

export async function readLastDoor(): Promise<SignInDoor | null> {
  const jar = await cookies();
  const value = jar.get(LAST_DOOR_COOKIE)?.value;
  return DOORS.find((d) => d === value) ?? null;
}
