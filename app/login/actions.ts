// app/login/actions.ts
//
// The three server halves of /login, transcribed from legacy login.html
// (rebuild.md §10):
//
//   loginAction                 email + password
//   completeExternalLoginAction the return from Google or a magic link,
//                               once the browser has the Supabase session
//   sendMagicLinkAction         "Email me a magic link"
//
// Strings are the legacy page's. Every LOGIN_* row that legacy wrote is
// written here, with the same fail_reason — through the service role
// since §8 S9 revoked the auth functions from the browser roles, with
// the caller's IP hash as the limiter's third key, and the limit check
// failing closed (D30).

'use server';

import { redirect } from 'next/navigation';
import { createClient as createPlainClient } from '@supabase/supabase-js';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { findProfileByAuthId } from '@/lib/auth/profile';
import { createLoginSession, type LoginVia } from '@/lib/auth/sessions';
import { requestInfo, requestOrigin } from '@/lib/auth/request-info';
import {
  checkLoginRateLimit,
  logLoginFail,
  logLoginSuccess,
  retryMessage,
} from '@/lib/auth/events';

type ActionResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = 'Something went wrong during sign-in. Please try again.';

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const fpHash = optionalString(formData.get('fp_hash'));

  if (!email || !password) {
    return { ok: false, error: 'Invalid email or password. Please try again.' };
  }

  const identifier = email.toLowerCase();
  const info = await requestInfo();
  const base = { identifier, fpHash, uaHash: info.uaHash, ipHash: info.ipHash, deviceLabel: info.deviceLabel };
  const supabase = await createClient();
  const serviceDb = createServiceRoleClient();

  // Rate limit first, fail closed (D30): a broken check refuses.
  const check = await checkLoginRateLimit(serviceDb, identifier, fpHash, info.ipHash);
  if (check.status === 'error') {
    return { ok: false, error: GENERIC_ERROR };
  }
  if (check.status === 'limited') {
    await logLoginFail(serviceDb, base, 'RATE_LIMITED');
    return {
      ok: false,
      error: retryMessage('Too many failed login attempts.', check.retryAfterSeconds),
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    await logLoginFail(serviceDb, base, 'INVALID_CREDENTIALS');
    return { ok: false, error: 'Invalid email or password. Please try again.' };
  }

  try {
    // One retry after 500 ms: replication lag right after signup.
    const profile = await findProfileByAuthId(supabase, data.user.id, { retry: true });

    await logLoginSuccess(serviceDb, { ...base, userId: profile?.user_id ?? null });

    if (!profile) {
      await supabase.auth.signOut();
      return { ok: false, error: 'No account found for this email. Please register first.' };
    }

    await createLoginSession(profile.user_id, 'EMAIL', info);
  } catch (err) {
    console.error('[login] post-login error:', err);
    return { ok: false, error: GENERIC_ERROR };
  }

  redirect('/router');
}

/**
 * The browser has just turned a Google or magic-link return into a
 * Supabase session (login-card.tsx). Finish the way legacy's
 * _handleAuthSession did: profile check, log, device session, /router.
 * Google and magic link NEVER create a profile — no account means sign
 * out and "register first".
 */
export async function completeExternalLoginAction(input: {
  via: LoginVia;
  fpHash: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: GENERIC_ERROR };

  const identifier = (user.email ?? '').toLowerCase();
  const info = await requestInfo();
  const base = {
    identifier,
    fpHash: input.fpHash,
    uaHash: info.uaHash,
    ipHash: info.ipHash,
    deviceLabel: info.deviceLabel,
  };
  const serviceDb = createServiceRoleClient();

  try {
    const profile = await findProfileByAuthId(supabase, user.id);

    if (!profile) {
      await logLoginFail(serviceDb, base, 'NO_ACCOUNT');
      await supabase.auth.signOut();
      return {
        ok: false,
        error:
          'No account found for this email. Please register first, then you can sign in with Google or a magic link.',
      };
    }

    await logLoginSuccess(serviceDb, { ...base, userId: profile.user_id });
    await createLoginSession(profile.user_id, input.via, info);
  } catch (err) {
    console.error('[login] external sign-in error:', err);
    return { ok: false, error: GENERIC_ERROR };
  }

  redirect('/router');
}

/**
 * Sends the magic link. Uses a plain client in the IMPLICIT flow, not the
 * cookie client: the SSR client's PKCE flow would tie the link to the
 * browser that asked for it, and a student who reads her email on her
 * phone and taps the link there must still get in. The link returns to
 * /login with the tokens in the hash, exactly the shape legacy handled.
 */
export async function sendMagicLinkAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) {
    return { ok: false, error: 'Please enter your email address to receive a sign-in link.' };
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

  const { error } = await plain.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/login` },
  });

  if (error) {
    return { ok: false, error: 'Could not send the link. Please check the email and try again.' };
  }
  return { ok: true };
}

function optionalString(v: FormDataEntryValue | null): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
}
