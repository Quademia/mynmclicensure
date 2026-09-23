// lib/payments/rate-limit.ts
//
// The payment actions' limiter, over the `check_payment_rate_limit`
// function and its `rate_limits` counter (rebuild.md §7.1), called with
// the service role. The function already takes a limit and a window, so
// every rule below is code, not schema.
//
// ── D35 (Sam, ruled 2026-09-18, built 2026-09-23) ─────────────────────
// It used to be ONE bucket per caller address for all four actions, 5 a
// minute. The confirmation page polls verify every 3 s, so it spent the
// bucket itself: the fifth or sixth poll came back "Too many requests"
// and the page stopped under "Verification Issue" — on a mobile-money
// payment that was still being approved on the buyer's phone. And a
// school lab or a campus behind one address shared five actions a minute
// between everyone in it (§9 #22).
//
// Now one tally per action:
//   init   — per address, 10 a minute (both checkout doors)
//   setup  — per address, 10 a minute (the password step after paying)
//   verify — per REFERENCE, 30 a minute: a poll is one payer watching one
//            payment, and 30 sits above the page's own fastest pace (20 a
//            minute), so its polls are in effect never counted and one
//            buyer's watching never touches another's on the same
//            connection.
// The numbers are Sam's (2026-09-23).
//
// ⚠ FAILS CLOSED (D30's rule, D35). If the counter cannot be read the
// action is refused with LIMITER_UNAVAILABLE_MESSAGE. It used to fail
// open — legacy's choice of availability over a limit nobody could see.
//
// The address comes from the same headers lib/auth/request-info reads;
// with neither (local dev) the key is 'unknown'.
//
// Server only.

import { headers } from 'next/headers';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { LIMITER_UNAVAILABLE_MESSAGE, RATE_LIMITED_MESSAGE } from './types';

export type PaymentLimitAction = 'init' | 'setup' | 'verify';

const RULES: Record<PaymentLimitAction, { limit: number; windowSeconds: number }> = {
  init: { limit: 10, windowSeconds: 60 },
  setup: { limit: 10, windowSeconds: 60 },
  verify: { limit: 30, windowSeconds: 60 },
};

export type PaymentLimitResult =
  | { ok: true }
  | { ok: false; error: 'rate_limited' | 'limiter_unavailable'; message: string };

/**
 * `reference` is required for verify, which is counted per payment;
 * init and setup are counted per caller address and ignore it.
 */
export async function checkPaymentRateLimit(
  action: PaymentLimitAction,
  reference?: string,
): Promise<PaymentLimitResult> {
  const rule = RULES[action];
  try {
    let subject: string;
    if (action === 'verify') {
      subject = String(reference || '').trim();
    } else {
      const h = await headers();
      subject =
        h.get('cf-connecting-ip') ??
        h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        'unknown';
    }

    const db = createServiceRoleClient();
    const { data, error } = await db.rpc('check_payment_rate_limit', {
      p_key: `payments:${action}:${subject}`,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });
    if (error) {
      console.error('[payments] rate limiter unavailable (fail closed):', error.message);
      return { ok: false, error: 'limiter_unavailable', message: LIMITER_UNAVAILABLE_MESSAGE };
    }
    if (data === false) return { ok: false, error: 'rate_limited', message: RATE_LIMITED_MESSAGE };
    return { ok: true };
  } catch (err) {
    console.error('[payments] rate limiter unavailable (fail closed):', err instanceof Error ? err.message : err);
    return { ok: false, error: 'limiter_unavailable', message: LIMITER_UNAVAILABLE_MESSAGE };
  }
}
