// lib/auth/events.ts
//
// The five SECURITY DEFINER functions in licensure_gh, called by name
// with the same p_ arguments legacy's pages used. Nothing here changes
// a threshold; those live in the SQL (rebuild.md §10).
//
// Since §8 S9 (20260919120000_auth_floor.sql) the five answer to the
// service role only — EXECUTE is revoked from the browser roles — so
// every helper takes the service-role client, and the login limiter is
// given the caller's IP hash as its third key.
//
// Two policies, ruled apart (D30, Sam 2026-09-18):
//   - the LOG calls stay fire-and-forget, as legacy: a logging failure
//     never blocks a login;
//   - the two CHECKS fail CLOSED: when the check itself errors, the
//     caller refuses with its generic message rather than waving the
//     attempt through. Legacy's fail-open (§9 #7) ended with the port.
//
// Server only.

import type { createServiceRoleClient } from '@/lib/supabase/server';
import { makeEventId } from './ids';

type Db = ReturnType<typeof createServiceRoleClient>;

export type FailReason = 'INVALID_CREDENTIALS' | 'RATE_LIMITED' | 'NO_ACCOUNT';

export type AuthEventInput = {
  identifier: string;
  userId?: string | null;
  fpHash?: string | null;
  uaHash?: string | null;
  ipHash?: string | null;
  deviceLabel?: string | null;
};

type RateLimitResult = {
  allowed: boolean;
  retry_after_seconds?: number;
  reason?: string;
};

/** The outcome of a limit check: allowed, refused, or the check broke. */
export type RateLimitCheck =
  | { status: 'allowed' }
  | { status: 'limited'; retryAfterSeconds: number }
  | { status: 'error' };

export async function logLoginSuccess(db: Db, e: AuthEventInput): Promise<void> {
  await logAuthEvent(db, 'LOGIN_SUCCESS', e, null);
}

export async function logLoginFail(db: Db, e: AuthEventInput, reason: FailReason): Promise<void> {
  await logAuthEvent(db, 'LOGIN_FAIL', e, reason);
}

async function logAuthEvent(
  db: Db,
  eventType: 'LOGIN_SUCCESS' | 'LOGIN_FAIL',
  e: AuthEventInput,
  failReason: FailReason | null
): Promise<void> {
  try {
    const { error } = await db.rpc('log_auth_event', {
      p_event_id: makeEventId(),
      p_event_type: eventType,
      p_identifier: e.identifier,
      p_user_id: e.userId ?? null,
      p_fp_hash: e.fpHash ?? null,
      p_ua_hash: e.uaHash ?? null,
      p_device_label: e.deviceLabel ?? null,
      p_fail_reason: failReason,
      p_ip_hash: e.ipHash ?? null,
    });
    if (error) console.error('[auth] log_auth_event failed:', error.message);
  } catch (err) {
    // Non-critical, as legacy.
    console.error('[auth] log_auth_event threw:', err);
  }
}

/**
 * 5 fails in 10 min, 10 in 24 h, by email and by device; 20 and 50 by
 * IP. Fails closed: an error from the check is reported as such, and
 * the caller refuses.
 */
export async function checkLoginRateLimit(
  db: Db,
  identifier: string,
  fpHash: string | null,
  ipHash: string | null
): Promise<RateLimitCheck> {
  try {
    const { data, error } = await db.rpc('check_login_rate_limit', {
      p_identifier: identifier,
      p_fp_hash: fpHash,
      p_ip_hash: ipHash,
    });
    if (error) {
      console.error('[auth] check_login_rate_limit failed:', error.message);
      return { status: 'error' };
    }
    return toCheck(data as RateLimitResult | null);
  } catch (err) {
    console.error('[auth] check_login_rate_limit threw:', err);
    return { status: 'error' };
  }
}

/** 3 reset requests per email per 60 min. Same shape, same fail-closed. */
export async function checkResetRateLimit(db: Db, email: string): Promise<RateLimitCheck> {
  try {
    const { data, error } = await db.rpc('check_reset_rate_limit', { p_email: email });
    if (error) {
      console.error('[auth] check_reset_rate_limit failed:', error.message);
      return { status: 'error' };
    }
    return toCheck(data as RateLimitResult | null);
  } catch (err) {
    console.error('[auth] check_reset_rate_limit threw:', err);
    return { status: 'error' };
  }
}

function toCheck(rl: RateLimitResult | null): RateLimitCheck {
  if (!rl || typeof rl.allowed !== 'boolean') return { status: 'error' };
  if (!rl.allowed) return { status: 'limited', retryAfterSeconds: rl.retry_after_seconds ?? 60 };
  return { status: 'allowed' };
}

export type ResetStatus = 'EMAIL_SENT' | 'RATE_LIMITED' | 'EMAIL_FAILED';

export async function logResetRequest(
  db: Db,
  requestId: string,
  email: string,
  status: ResetStatus,
  fpHash: string | null,
  deviceLabel: string | null
): Promise<void> {
  try {
    const { error } = await db.rpc('log_reset_request', {
      p_request_id: requestId,
      p_email: email,
      p_status: status,
      p_fp_hash: fpHash,
      p_device_label: deviceLabel,
    });
    if (error) console.error('[auth] log_reset_request failed:', error.message);
  } catch (err) {
    // Non-critical, as legacy.
    console.error('[auth] log_reset_request threw:', err);
  }
}

export async function markResetUsed(db: Db, email: string): Promise<void> {
  try {
    const { error } = await db.rpc('mark_reset_used', { p_email: email });
    if (error) console.error('[auth] mark_reset_used failed:', error.message);
  } catch (err) {
    // Non-critical, as legacy.
    console.error('[auth] mark_reset_used threw:', err);
  }
}

/** The legacy wording for a refused attempt, minutes rounded up. */
export function retryMessage(prefix: string, retryAfterSeconds: number): string {
  const mins = Math.ceil((retryAfterSeconds || 60) / 60);
  return `${prefix} Please try again in ${mins} minute${mins === 1 ? '' : 's'}.`;
}
