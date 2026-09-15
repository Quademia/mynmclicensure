// lib/payments/rate-limit.ts
//
// The Worker's checkRateLimit(): 5 requests per 60 seconds per caller
// address on the four public payment actions, none on the admin ones.
// gamma used a Cloudflare rate-limit binding keyed on CF-Connecting-IP;
// here it is the `check_payment_rate_limit` function over the
// `rate_limits` counter (rebuild.md §7.1), called with the service role.
// The address comes from the same headers lib/auth/request-info reads;
// with neither (local dev) the key is 'unknown', as the Worker's was.
//
// Fails OPEN: if the check itself errors, the request is allowed and the
// error logged — legacy's choice of availability over lockout.
//
// Server only.

import { headers } from 'next/headers';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function checkPaymentRateLimit(): Promise<{ ok: boolean }> {
  try {
    const h = await headers();
    const ip =
      h.get('cf-connecting-ip') ??
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown';

    const db = createServiceRoleClient();
    const { data, error } = await db.rpc('check_payment_rate_limit', { p_key: `payments:${ip}` });
    if (error) {
      console.warn('Rate limiter error (fail open):', error.message);
      return { ok: true };
    }
    return { ok: data !== false };
  } catch (err) {
    console.warn('Rate limiter error (fail open):', err instanceof Error ? err.message : err);
    return { ok: true };
  }
}
