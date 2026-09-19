// app/forgot-password/actions.ts
//
// Legacy forgot-password.html's submit handler on the server: reset
// rate limit (3 per email per 60 min; fails closed since D30) → Supabase
// sends the reset email → the request is logged with its status. The
// limit and the log go through the service role (§8 S9). The reply is
// neutral whatever happened to the address — "if that email is
// registered" — so the form cannot be used to find out who has an
// account.
//
// The email goes through a plain IMPLICIT-flow client for the same
// reason as the magic link (app/login/actions.ts): the link must work
// on whichever device the student opens it.

'use server';

import { createClient as createPlainClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { makeEventId } from '@/lib/auth/ids';
import { requestInfo, requestOrigin } from '@/lib/auth/request-info';
import { checkResetRateLimit, logResetRequest, retryMessage } from '@/lib/auth/events';

type ForgotResult = { ok: true } | { ok: false; error: string };

export async function forgotPasswordAction(formData: FormData): Promise<ForgotResult> {
  const email = String(formData.get('email') ?? '').trim();
  const fpHash = optionalString(formData.get('fp_hash'));
  if (!email) return { ok: false, error: 'Please enter your email address.' };

  const serviceDb = createServiceRoleClient();
  const info = await requestInfo();
  const requestId = makeEventId();

  const check = await checkResetRateLimit(serviceDb, email);
  if (check.status === 'error') {
    // Fail closed (D30): the check broke, so the request is refused.
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
  if (check.status === 'limited') {
    await logResetRequest(serviceDb, requestId, email, 'RATE_LIMITED', fpHash, info.deviceLabel);
    return {
      ok: false,
      error: retryMessage('Too many reset requests.', check.retryAfterSeconds),
    };
  }

  const origin = await requestOrigin();
  const plain = createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'implicit',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  const { error } = await plain.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });

  if (error) {
    await logResetRequest(serviceDb, requestId, email, 'EMAIL_FAILED', fpHash, info.deviceLabel);
    return { ok: false, error: error.message };
  }

  await logResetRequest(serviceDb, requestId, email, 'EMAIL_SENT', fpHash, info.deviceLabel);
  return { ok: true };
}

function optionalString(v: FormDataEntryValue | null): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
}
