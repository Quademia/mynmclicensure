// app/reset-password/actions.ts
//
// Finishes a password reset — legacy reset-password.html's submit
// handler on the server. The page has already turned the emailed link
// into a session, so the cookie client sees the student whose password
// is changing. Then mark the reset request used (through the service
// role — §8 S9 revoked the function from the browser roles), sign every
// OTHER device out, and sign this one in: the log row, this device's
// session, /router (01, item 8: Sam, 2026-09-18 — "after a reset the
// student is signed in straight away"; built with 01.15, 2026-10-31).
// The must_change_password clear that legacy did here went with the
// column (S9; §9 #8 closed).

'use server';

import { redirect } from 'next/navigation';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { findProfileByAuthId } from '@/lib/auth/profile';
import { logLoginFail, logLoginSuccess, markResetUsed } from '@/lib/auth/events';
import { rememberDoor } from '@/lib/auth/last-door';
import { requestInfo } from '@/lib/auth/request-info';
import { createLoginSession } from '@/lib/auth/sessions';

type ResetResult = { ok: true } | { ok: false; error: string };

export async function completeResetAction(formData: FormData): Promise<ResetResult> {
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');
  const fpHash = String(formData.get('fp_hash') ?? '').trim() || null;

  // Asked twice on this page (Sam, 2026-10-31); the page checks first.
  if (password !== confirmPassword) {
    return { ok: false, error: "The two passwords don't match." };
  }
  if (password.length < 8) {
    return { ok: false, error: 'Password should be at least 8 characters.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'This reset link no longer works. Please ask for a new one.' };
  }

  // "same_password": the account already has this password — typed on
  // purpose, or a second try after a dropped connection whose first try
  // saved it. Either way it is the password now, so carry on.
  const { error } = await supabase.auth.updateUser({ password });
  if (error && error.code !== 'same_password') {
    if (error.code === 'weak_password') {
      return { ok: false, error: 'Please choose a longer password: at least 8 characters.' };
    }
    console.error('[reset] password not saved:', error.code ?? error.status, error.message);
    return { ok: false, error: 'Could not save your new password. Please try again.' };
  }

  const serviceDb = createServiceRoleClient();
  if (user.email) {
    await markResetUsed(serviceDb, user.email);
  }

  // Every other device, on purpose (2026-10-17): a reset is often because
  // the password may be known to someone else, so their sign-ins end too.
  // This device stays signed in (item 8). The other sign-outs end only the
  // device they run on.
  await supabase.auth.signOut({ scope: 'others' });

  const info = await requestInfo();
  const base = {
    identifier: (user.email ?? '').toLowerCase(),
    fpHash,
    uaHash: info.uaHash,
    ipHash: info.ipHash,
    deviceLabel: info.deviceLabel,
  };

  let signedIn = false;
  try {
    // The sign-in table is shared with Quademia's other apps: a reset can
    // come from someone with no profile here, who registers first.
    const profile = await findProfileByAuthId(supabase, user.id);
    if (!profile) {
      await logLoginFail(serviceDb, base, 'NO_ACCOUNT');
      await supabase.auth.signOut({ scope: 'local' });
      return {
        ok: false,
        error: 'Your new password is saved, but this email has no account here yet. Please register first.',
      };
    }
    await logLoginSuccess(serviceDb, { ...base, userId: profile.user_id });
    await createLoginSession(profile.user_id, 'EMAIL', info);
    // Next time this device opens on the password just set (01.16).
    await rememberDoor('password');
    signedIn = true;
  } catch (err) {
    console.error('[reset] signing in after the reset failed:', err);
  }

  if (!signedIn) {
    // The password is saved; the student signs in with it by hand.
    await supabase.auth.signOut({ scope: 'local' });
    redirect('/login?reason=reset');
  }
  redirect('/router');
}
