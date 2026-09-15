// app/reset-password/actions.ts
//
// Finishes a password reset — legacy reset-password.html's submit
// handler on the server. The page has already turned the emailed link
// into a session, so the cookie client sees the student whose password
// is changing. Then, as legacy: clear must_change_password (§9 #8, the
// column is carried and cleared, nothing more), mark the reset request
// used, and sign out so the student lands on /login clean and signs in
// with the new password.

'use server';

import { createClient } from '@/lib/supabase/server';
import { markResetUsed } from '@/lib/auth/events';

type ResetResult = { ok: true } | { ok: false; error: string };

export async function completeResetAction(formData: FormData): Promise<ResetResult> {
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  if (password !== confirmPassword) {
    return { ok: false, error: 'Passwords do not match.' };
  }
  if (password.length < 8) {
    return { ok: false, error: 'Password should be at least 8 characters.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'No valid reset link found.' };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { ok: false, error: error.message };
  }

  await supabase.from('users').update({ must_change_password: false }).eq('auth_id', user.id);

  if (user.email) {
    await markResetUsed(supabase, user.email);
  }

  await supabase.auth.signOut();
  return { ok: true };
}
