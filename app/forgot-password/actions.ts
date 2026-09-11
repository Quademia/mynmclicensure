// app/forgot-password/actions.ts
//
// Legacy forgot-password.html's submit handler on the server: reset
// rate limit (3 per email per 60 min, fail open) → Supabase sends the
// reset email → the request is logged with its status. The reply is
// neutral whatever happened to the address — "if that email is
// registered" — so the form cannot be used to find out who has an
// account.
//
// The email goes through a plain IMPLICIT-flow client for the same
// reason as the magic link (app/login/actions.ts): the link must work
// on whichever device the student opens it.

'use server';

import { createClient as createPlainClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { makeEventId } from '@/lib/auth/ids';
import { requestInfo, requestOrigin } from '@/lib/auth/request-info';
import { checkResetRateLimit, logResetRequest, retryMessage } from '@/lib/auth/events';

type ForgotResult = { ok: true } | { ok: false; error: string };

export async function forgotPasswordAction(formData: FormData): Promise<ForgotResult> {
  const email = String(formData.get('email') ?? '').trim();
  const fpHash = optionalString(formData.get('fp_hash'));
  if (!email) return { ok: false, error: 'Please enter your email address.' };

  const supabase = await createClient();
  const info = await requestInfo();
  const requestId = makeEventId();

  const limited = await checkResetRateLimit(supabase, email);
  if (limited) {
    await logResetRequest(supabase, requestId, email, 'RATE_LIMITED', fpHash, info.deviceLabel);
    return {
      ok: false,
      error: retryMessage('Too many reset requests.', limited.retryAfterSeconds),
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
    await logResetRequest(supabase, requestId, email, 'EMAIL_FAILED', fpHash, info.deviceLabel);
    return { ok: false, error: error.message };
  }

  await logResetRequest(supabase, requestId, email, 'EMAIL_SENT', fpHash, info.deviceLabel);
  return { ok: true };
}

function optionalString(v: FormDataEntryValue | null): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
}
