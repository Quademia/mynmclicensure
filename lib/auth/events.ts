// lib/auth/events.ts
//
// The five SECURITY DEFINER functions in licensure_gh, called the way the
// legacy pages called them — by name, with the same p_ arguments. Nothing
// here changes a rule; the thresholds live in the SQL (rebuild.md §10).
//
// The log calls are fire-and-forget in legacy (.then(()=>{}).catch(()=>{}))
// and stay so here: a logging failure never blocks a login. The rate-limit
// checks FAIL OPEN on error, as legacy chose (rebuild.md §9 #7, kept).
//
// Server only.

import type { createClient } from '@/lib/supabase/server';
import { makeEventId } from './ids';

type Db = Awaited<ReturnType<typeof createClient>>;

export type FailReason = 'INVALID_CREDENTIALS' | 'RATE_LIMITED' | 'NO_ACCOUNT';

export type AuthEventInput = {
  identifier: string;
  userId?: string | null;
  fpHash?: string | null;
  uaHash?: string | null;
  deviceLabel?: string | null;
};

type RateLimitResult = {
  allowed: boolean;
  retry_after_seconds?: number;
  reason?: string;
};

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
    await db.rpc('log_auth_event', {
      p_event_id: makeEventId(),
      p_event_type: eventType,
      p_identifier: e.identifier,
      p_user_id: e.userId ?? null,
      p_fp_hash: e.fpHash ?? null,
      p_ua_hash: e.uaHash ?? null,
      p_device_label: e.deviceLabel ?? null,
      p_fail_reason: failReason,
    });
  } catch {
    // Non-critical, as legacy.
  }
}

/**
 * 5 fails in 10 min, 10 in 24 h, by email and by device. Returns the
 * refusal, or null when allowed — and null on any error (fail open).
 */
export async function checkLoginRateLimit(
  db: Db,
  identifier: string,
  fpHash: string | null
): Promise<{ retryAfterSeconds: number } | null> {
  try {
    const { data } = await db.rpc('check_login_rate_limit', {
      p_identifier: identifier,
      p_fp_hash: fpHash,
    });
    const rl = data as RateLimitResult | null;
    if (rl && !rl.allowed) {
      return { retryAfterSeconds: rl.retry_after_seconds ?? 60 };
    }
    return null;
  } catch {
    return null;
  }
}

/** 3 reset requests per email per 60 min. Same shape, same fail-open. */
export async function checkResetRateLimit(
  db: Db,
  email: string
): Promise<{ retryAfterSeconds: number } | null> {
  try {
    const { data } = await db.rpc('check_reset_rate_limit', { p_email: email });
    const rl = data as RateLimitResult | null;
    if (rl && !rl.allowed) {
      return { retryAfterSeconds: rl.retry_after_seconds ?? 60 };
    }
    return null;
  } catch {
    return null;
  }
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
    await db.rpc('log_reset_request', {
      p_request_id: requestId,
      p_email: email,
      p_status: status,
      p_fp_hash: fpHash,
      p_device_label: deviceLabel,
    });
  } catch {
    // Non-critical, as legacy.
  }
}

export async function markResetUsed(db: Db, email: string): Promise<void> {
  try {
    await db.rpc('mark_reset_used', { p_email: email });
  } catch {
    // Non-critical, as legacy.
  }
}

/** The legacy wording for a refused attempt, minutes rounded up. */
export function retryMessage(prefix: string, retryAfterSeconds: number): string {
  const mins = Math.ceil((retryAfterSeconds || 60) / 60);
  return `${prefix} Please try again in ${mins} minute${mins === 1 ? '' : 's'}.`;
}
