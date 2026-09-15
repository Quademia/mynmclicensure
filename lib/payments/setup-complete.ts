// lib/payments/setup-complete.ts
//
// POST /payments/setup-complete, re-implemented from the payments Worker
// to the contract in rebuild.md §7.1 — the confirmation page's "Create
// Account & Activate". No session: this is where the account is made.
//
// The Worker's checks, in its order, with its messages: the rate limit;
// reference, token, forename, surname and password required; password
// at least 8; the row exists; ACTIVATED → the same answer again
// (idempotent); FAILED → refuse; not PAID / SETUP_REQUIRED → "not
// ready for setup"; the token an exact string match; the token's clock
// within 48 hours (a missing clock refuses too); a programme from the
// form or the row.
//
// Then: if a user already exists for the row (by user_id, then email),
// reuse it — recovery after a half-finished earlier try. Otherwise the
// login (auth.admin.createUser with email_confirm true and the names in
// user_metadata) and the profile row with signup_source
// 'PAYSTACK_SETUP'. ⚠ As legacy: no school, no referral, no trial —
// the purchased product is what is granted. Then the row is stamped
// (user_id, phone, programme, setup_completed_utc only if unset, the
// setup_complete note in raw) and activated.
//
// On any failure the row's failure_note says why and the status is left
// alone, so it stays retryable; the browser gets a generic message
// (§7.1). One thing legacy did not do: if the profile insert fails
// after the login was created, the login is deleted again (rebuild.md
// §9 #4, the registration rollback), because an orphan login would
// make every retry fail with "already registered" — noted in the log.
//
// The input is a FormData, as the register and login actions take,
// and not a plain object: Next's dev server prints a Server Action's
// first arguments to the terminal, and a plain object would put the
// payer's password there (seen in Sam's walk, 2026-09-15). A FormData
// prints as {}.

'use server';

import { createServiceRoleClient } from '@/lib/supabase/server';
import { nowIso } from '@/lib/subscriptions/dates';
import { activatePaymentForUser } from './activate';
import { makePaymentUserId } from './ids';
import { findPaymentUser, getPaymentByReference, patchPayment, type ServiceDb } from './queries';
import { checkPaymentRateLimit } from './rate-limit';
import { RATE_LIMITED_MESSAGE, SETUP_TOKEN_LIFETIME_MS, type PaymentUser, type SetupCompleteResult } from './types';

function fail(error: string, message?: string): SetupCompleteResult {
  return { ok: false, error, message: message || error };
}

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
}

export async function completePaymentSetup(formData: FormData): Promise<SetupCompleteResult> {
  const rl = await checkPaymentRateLimit();
  if (!rl.ok) return fail('rate_limited', RATE_LIMITED_MESSAGE);

  const reference = field(formData, 'reference');
  const setupToken = field(formData, 'setup_token');
  const forename = field(formData, 'forename');
  const surname = field(formData, 'surname');
  const password = String(formData.get('password') ?? '');
  const phoneNumberInput = field(formData, 'phone_number');
  const programIdInput = field(formData, 'program_id');

  if (!reference) return fail('missing_reference');
  if (!setupToken) return fail('missing_setup_token');
  if (!forename || !surname || !password) return fail('missing_required_fields', 'forename, surname and password are required');
  if (password.length < 8) return fail('password_policy_failed', 'Password must be at least 8 characters');

  const db = createServiceRoleClient();

  let payment;
  try {
    payment = await getPaymentByReference(db, reference);
  } catch (err) {
    console.error('[payments] setup-complete lookup failed:', err);
    return fail('setup_complete_failed', 'Could not complete setup. Please retry.');
  }
  if (!payment) return fail('payment_not_found');

  if (payment.status === 'ACTIVATED' && payment.subscription_id) {
    return { ok: true, status: 'ACTIVATED', reference: payment.reference, subscription_id: payment.subscription_id, user_id: payment.user_id || null };
  }
  if (payment.status === 'FAILED') return fail('payment_failed', payment.failure_note || 'payment_failed');
  if (payment.status !== 'PAID' && payment.status !== 'SETUP_REQUIRED') {
    return fail('payment_not_ready_for_setup', 'payment_not_ready_for_setup');
  }

  if (String(payment.setup_token || '').trim() !== setupToken) return fail('invalid_setup_token');

  const setupCreatedAt = payment.setup_created_utc ? new Date(payment.setup_created_utc).getTime() : 0;
  if (!setupCreatedAt || Date.now() - setupCreatedAt > SETUP_TOKEN_LIFETIME_MS) {
    console.warn(`setup_token_expired: reference=${payment.reference}, created=${payment.setup_created_utc}`);
    return fail('setup_token_expired', 'This setup link has expired. Please contact support to get a new one sent to you.');
  }

  const finalProgramId = programIdInput || String(payment.program_id || '').trim();
  const finalPhoneNumber = phoneNumberInput || String(payment.phone_number || '').trim() || null;
  if (!finalProgramId) return fail('missing_program_id');

  const email = String(payment.email || '').trim().toLowerCase();

  try {
    // Idempotency / recovery: a matching user already exists → reuse it.
    let existingUser: PaymentUser | null = await findPaymentUser(db, payment);

    if (!existingUser) {
      existingUser = await createPayerAccount(db, { email, password, forename, surname, phoneNumber: finalPhoneNumber, programId: finalProgramId });
    }

    payment = await patchPayment(db, payment.reference, {
      user_id: existingUser.user_id,
      phone_number: finalPhoneNumber,
      program_id: finalProgramId,
      setup_completed_utc: payment.setup_completed_utc || nowIso(),
      raw: {
        ...(payment.raw && typeof payment.raw === 'object' ? payment.raw : {}),
        setup_complete: { ok: true, user_id: existingUser.user_id, email, program_id: finalProgramId, phone_number: finalPhoneNumber },
      },
    });

    const activation = await activatePaymentForUser(db, payment, existingUser);

    return {
      ok: true,
      status: 'ACTIVATED',
      reference: payment.reference,
      subscription_id: activation.subscription.subscription_id,
      activation_mode: activation.mode,
      user_id: existingUser.user_id,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'setup_complete_failed';
    console.error('[payments] setup-complete failed for', reference, msg);
    try {
      await db
        .from('payments')
        .update({
          failure_note: `setup_complete_failed: ${msg}`,
          raw: { ...(payment.raw && typeof payment.raw === 'object' ? payment.raw : {}), setup_complete: { ok: false, error: msg } },
        })
        .eq('reference', reference);
    } catch (patchErr) {
      console.error('[payments] setup-complete failure_note write failed:', patchErr);
    }
    return fail('setup_complete_failed', 'Could not complete setup. Please retry.');
  }
}

// The Worker's authAdminCreateUser + the users insert, with the §9 #4
// rollback when the second step fails.
async function createPayerAccount(
  db: ServiceDb,
  a: { email: string; password: string; forename: string; surname: string; phoneNumber: string | null; programId: string },
): Promise<PaymentUser> {
  const fullName = [a.forename, a.surname].filter(Boolean).join(' ').trim();

  const { data: created, error: authError } = await db.auth.admin.createUser({
    email: a.email,
    password: a.password,
    email_confirm: true,
    user_metadata: { forename: a.forename, surname: a.surname, name: fullName, phone_number: a.phoneNumber || null },
  });
  if (authError || !created?.user?.id) {
    throw new Error(`Supabase auth create user failed: ${authError?.message || 'no user id'}`);
  }
  const authId = created.user.id;

  const row = {
    user_id: makePaymentUserId(),
    auth_id: authId,
    email: a.email,
    forename: a.forename,
    surname: a.surname,
    name: fullName,
    program_id: a.programId,
    phone_number: a.phoneNumber,
    role: 'STUDENT',
    active: true,
    signup_source: 'PAYSTACK_SETUP',
    created_utc: nowIso(),
  };
  const { data: profile, error: profileError } = await db.from('users').insert(row).select('user_id, email, auth_id, forename, surname, name, active, program_id, phone_number').single();
  if (profileError || !profile) {
    try {
      await db.auth.admin.deleteUser(authId);
    } catch (rollbackErr) {
      console.error('[payments] setup-complete rollback deleteUser failed for', authId, rollbackErr);
    }
    throw new Error(`Supabase insert failed on users: ${profileError?.message || 'no row'}`);
  }
  return profile as PaymentUser;
}
