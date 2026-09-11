// app/register/actions.ts
//
// Registration — legacy register.html's submit handler as ONE server
// call (rebuild.md §10): validate in the legacy order with the legacy
// messages → auth signup → profile row → sign out. The browser then
// shows the "Your account is ready!" screen.
//
// ⭐ §9 #4: if the profile insert fails, the auth user is deleted with
// the service role, so no orphan login is left behind (the MyNclex
// app/register/actions.ts rollback pattern).
//
// Not here yet, by slice: the trial subscription (slice 8 — needs
// `products` and `subscriptions`) and the welcome email (slice 10).
// Registration succeeds without them.

'use server';

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { makeUserId } from '@/lib/auth/ids';

type RegisterResult = { ok: true; email: string } | { ok: false; error: string };

export async function registerAction(formData: FormData): Promise<RegisterResult> {
  const forename = str(formData.get('forename'));
  const surname = str(formData.get('surname'));
  const email = str(formData.get('email'));
  const phone = str(formData.get('phone'));
  const programId = str(formData.get('program'));
  const schoolVal = str(formData.get('school'));
  const schoolOther = str(formData.get('schoolOther'));
  const referralVal = str(formData.get('referral'));
  const referralOther = str(formData.get('referralOther'));
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  // The browser's `required` attributes cover the empties; these are the
  // legacy script's own checks, in its order, with its words.
  if (password !== confirmPassword) {
    return { ok: false, error: 'Passwords do not match.' };
  }
  if (!programId) {
    return { ok: false, error: 'Please select your programme.' };
  }
  if (phone.replace(/\D/g, '').length < 9) {
    return { ok: false, error: 'Please enter a valid WhatsApp number.' };
  }
  if (!schoolVal) {
    return { ok: false, error: 'Please select your school.' };
  }
  if (schoolVal === '__OTHER__' && !schoolOther) {
    return { ok: false, error: "Please type your school's name." };
  }
  if (!referralVal) {
    return { ok: false, error: 'Please tell us how you heard about us.' };
  }
  if (referralVal === '__OTHER__' && !referralOther) {
    return { ok: false, error: 'Please tell us how you heard about us.' };
  }
  if (!forename || !surname || !email || password.length < 8) {
    return { ok: false, error: 'Please fill in every field. Passwords need at least 8 characters.' };
  }

  const supabase = await createClient();

  // Step 1: the Supabase Auth account. Supabase's own message on failure,
  // as legacy showed it (e.g. "User already registered").
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error || !data.user) {
    return { ok: false, error: error?.message ?? 'Signup failed. Please try again.' };
  }

  // Step 2: the profile row, as the new user (users_insert policy).
  const userId = makeUserId();
  const { error: profileError } = await supabase.from('users').insert({
    user_id: userId,
    auth_id: data.user.id,
    email,
    forename,
    surname,
    name: `${forename} ${surname}`,
    program_id: programId,
    role: 'STUDENT',
    active: true,
    signup_source: 'SUPABASE_AUTH',
    phone_number: phone,
    school_id: schoolVal === '__OTHER__' ? null : Number(schoolVal),
    school_other: schoolVal === '__OTHER__' ? schoolOther : null,
    referral_source: referralVal === '__OTHER__' ? referralOther : referralVal,
  });

  if (profileError) {
    console.error('[register] profile insert failed:', profileError.message);
    await rollbackAuthUser(data.user.id);
    await supabase.auth.signOut();
    return {
      ok: false,
      error: 'Account created but profile setup failed. Please contact support.',
    };
  }

  // Step 3 (trial) and step 5 (welcome email): slices 8 and 10.

  // Sign out so the student arrives at /login with a clean state, as
  // legacy did.
  await supabase.auth.signOut();

  return { ok: true, email };
}

async function rollbackAuthUser(authUserId: string): Promise<void> {
  try {
    await createServiceRoleClient().auth.admin.deleteUser(authUserId);
  } catch (err) {
    console.error('[register] rollback deleteUser failed for', authUserId, err);
  }
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : '';
}
