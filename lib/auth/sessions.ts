// lib/auth/sessions.ts
//
// Device sessions — the concurrent-login cap, transcribed from legacy
// auth.js createLoginSession() and guard.js verifySession() /
// deactivateCurrentSession(), moved to the server (rebuild.md §10):
//
//   - max 2 live sessions per user; a third login deactivates the OLDEST
//     LIVE one. ⭐ §9 #5: the kick query now filters `active AND
//     expires_utc > now`, the same filter the count uses, so it can no
//     longer leave three live by deactivating an already-expired row.
//   - 7-day expiry; rows are never deleted, only active = false.
//   - the session id lives in an httpOnly cookie, not localStorage.
//   - writes use the service role — the browser write path on `sessions`
//     is gone (rebuild.md §6.4). Reads on the gate run as the user.
//   - ip_hash is finally populated (§8 S6).
//
// Server only.

import { cookies } from 'next/headers';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { makeSessionId } from './ids';
import type { RequestInfo } from './request-info';

export const SESSION_COOKIE = 'licensure_session_id';
const MAX_ACTIVE_SESSIONS = 2;
const SESSION_DAYS = 7;

export type LoginVia = 'EMAIL' | 'GOOGLE' | 'MAGIC_LINK';

/**
 * Create the session row and set the cookie. Returns the new session id.
 */
export async function createLoginSession(
  userId: string,
  loginVia: LoginVia,
  info: RequestInfo
): Promise<string> {
  const admin = createServiceRoleClient();
  const now = new Date();
  const expires = new Date(now);
  expires.setDate(expires.getDate() + SESSION_DAYS);
  const nowIso = now.toISOString();

  const { count } = await admin
    .from('sessions')
    .select('session_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('active', true)
    .gt('expires_utc', nowIso);

  if ((count ?? 0) >= MAX_ACTIVE_SESSIONS) {
    const { data: oldest } = await admin
      .from('sessions')
      .select('session_id')
      .eq('user_id', userId)
      .eq('active', true)
      .gt('expires_utc', nowIso) // §9 #5: same filter as the count
      .order('issued_utc', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (oldest) {
      await admin
        .from('sessions')
        .update({ active: false })
        .eq('session_id', oldest.session_id);
    }
  }

  const sessionId = makeSessionId();
  const { error } = await admin.from('sessions').insert({
    session_id: sessionId,
    user_id: userId,
    kind: 'LOGIN',
    issued_utc: nowIso,
    expires_utc: expires.toISOString(),
    last_seen_utc: nowIso,
    device_label: info.deviceLabel,
    ua_hash: info.uaHash,
    ip_hash: info.ipHash,
    login_via: loginVia,
    active: true,
  });
  if (error) throw new Error(`Session insert failed: ${error.message}`);

  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });

  return sessionId;
}

/**
 * The gate's check, as the signed-in user (sessions_select policy):
 * the cookie's session must belong to this user, be active and not
 * expired. On a hit, last_seen_utc is touched without awaiting.
 */
export async function verifySession(userId: string): Promise<boolean> {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (!sessionId) return false;

  const db = await createClient();
  const nowIso = new Date().toISOString();
  const { data } = await db
    .from('sessions')
    .select('session_id')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .eq('active', true)
    .gt('expires_utc', nowIso)
    .maybeSingle();

  if (!data) return false;

  // Fire-and-forget, as legacy. Service role: no user write path.
  void createServiceRoleClient()
    .from('sessions')
    .update({ last_seen_utc: nowIso })
    .eq('session_id', sessionId)
    .then(() => {}, () => {});

  return true;
}

/**
 * Logout: the row goes inactive, the cookie goes. Never deletes.
 */
export async function deactivateCurrentSession(): Promise<void> {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    try {
      await createServiceRoleClient()
        .from('sessions')
        .update({ active: false })
        .eq('session_id', sessionId);
    } catch {
      // The cookie still goes; a stale row expires in 7 days.
    }
  }
  jar.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
}
