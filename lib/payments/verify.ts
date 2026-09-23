// lib/payments/verify.ts
//
// GET /payments/verify?reference=…, re-implemented from the payments
// Worker to the contract in rebuild.md §7.1. Called by the confirmation
// page (which polls on "not ready") and, in 9b, by the admin Retry
// Activation button. No session by design — the payer has none yet
// (§9 #21, carried).
//
// The Worker's order, kept exactly:
//   - ACTIVATED with a subscription → answer at once.
//   - PAID or SETUP_REQUIRED → try a local activation first (a user by
//     the row's user_id, then by its email); no user → SETUP_REQUIRED
//     with a NEW token and clock, every call (that is what makes Retry
//     Activation refresh the link).
//   - FAILED → refuse, terminal.
//   - INIT → ask Paystack. Not "success" yet → "not ready", the row stays
//     INIT. An amount mismatch → FAILED with the note "Amount mismatch.
//     Expected X, got Y", terminal; a currency mismatch the same way
//     (D36, added 2026-09-19). Success → PAID: adopt the Paystack
//     customer email, set paid_utc only if unset, merge the verify reply
//     into raw — TRIMMED first (D32, lib/payments/trim.ts: the card and
//     IP fields never reach the row); then the same activate-or-setup step.
// A thrown error writes failure_note and leaves the status alone
// (retryable); the browser gets a generic message (§7.1).

'use server';

import { createServiceRoleClient } from '@/lib/supabase/server';
import { nowIso } from '@/lib/subscriptions/dates';
import { activatePaymentForUser } from './activate';
import { makeSetupToken } from './ids';
import { paystackVerify } from './paystack';
import { findPaymentUser, getPaymentByReference, patchPayment, type ServiceDb } from './queries';
import { checkPaymentRateLimit } from './rate-limit';
import { trimVerifyReply } from './trim';
import type { Payment, VerifyResult } from './types';

export async function verifyPayment(referenceIn: string): Promise<VerifyResult> {
  const reference = String(referenceIn || '').trim();
  if (!reference) return { ok: false, error: 'missing_reference', reference, message: 'missing_reference' };

  // Counted per payment, not per address (D35): the confirmation page's
  // own polling stays under the limit, and two buyers on one connection
  // never share a tally.
  const rl = await checkPaymentRateLimit('verify', reference);
  if (!rl.ok) return { ok: false, error: rl.error, reference, message: rl.message };

  const db = createServiceRoleClient();

  let payment: Payment | null;
  try {
    payment = await getPaymentByReference(db, reference);
  } catch (err) {
    console.error('[payments] verify lookup failed:', err);
    return { ok: false, error: 'verify_failed', reference, message: 'Could not verify payment' };
  }
  if (!payment) return { ok: false, error: 'payment_not_found', reference, message: 'payment_not_found' };

  // Fast path: already activated.
  if (payment.status === 'ACTIVATED' && payment.subscription_id) {
    return {
      ok: true,
      status: 'ACTIVATED',
      reference: payment.reference,
      subscription_id: payment.subscription_id,
      requires_setup: false,
      ...receiptOf(payment),
    };
  }

  // Fast path: already paid / setup required → try local activation first.
  if (payment.status === 'PAID' || payment.status === 'SETUP_REQUIRED') {
    try {
      return await activateOrRequireSetup(db, payment);
    } catch (err) {
      return await recordVerifyFailure(db, reference, err);
    }
  }

  // Hard stop if already marked failed.
  if (payment.status === 'FAILED') {
    return {
      ok: false,
      error: 'payment_failed',
      status: 'FAILED',
      reference: payment.reference,
      failure_note: payment.failure_note || 'Payment already marked failed',
    };
  }

  // Normal verify path from INIT.
  try {
    const verifyResult = await paystackVerify(reference);
    const tx = (verifyResult?.data || {}) as Record<string, unknown>;
    // The only form of the reply that is ever written to the row.
    const verifySaved = trimVerifyReply(verifyResult);

    const gatewayStatus = String(tx.status || '').toLowerCase();
    const amountPaid = Number(tx.amount || 0);
    const currencyPaid = String(tx.currency || '').trim().toUpperCase();
    const currencyExpected = String(payment.currency || '').trim().toUpperCase();
    const customer = (tx.customer || {}) as Record<string, unknown>;
    const paidEmail = String(customer.email || payment.email || '').trim().toLowerCase();

    // Not successful yet: leave the row in INIT, soft answer (the 409).
    if (gatewayStatus !== 'success') {
      return {
        ok: false,
        error: 'not_ready',
        status: payment.status || 'INIT',
        reference,
        message: `Payment not successful yet. Gateway status: ${gatewayStatus || 'unknown'}`,
      };
    }

    // Amount mismatch = terminal failure for this reference.
    if (amountPaid !== Number(payment.amount_minor_expected || 0)) {
      await patchPayment(db, reference, {
        status: 'FAILED',
        amount_minor_paid: amountPaid,
        failure_note: `Amount mismatch. Expected ${payment.amount_minor_expected}, got ${amountPaid}`,
        raw: { ...(payment.raw || {}), verify: verifySaved },
      });
      return { ok: false, error: 'amount_mismatch', reference, message: 'amount_mismatch' };
    }

    // Currency mismatch = the same terminal failure (D36). Every product
    // is GHS today; the day a second currency exists, an equal minor
    // amount in the wrong one must not pass.
    if (currencyPaid !== currencyExpected) {
      await patchPayment(db, reference, {
        status: 'FAILED',
        amount_minor_paid: amountPaid,
        failure_note: `Currency mismatch. Expected ${currencyExpected || 'none'}, got ${currencyPaid || 'none'}`,
        raw: { ...(payment.raw || {}), verify: verifySaved },
      });
      return { ok: false, error: 'currency_mismatch', reference, message: 'currency_mismatch' };
    }

    payment = await patchPayment(db, reference, {
      status: 'PAID',
      email: paidEmail || payment.email,
      amount_minor_paid: amountPaid,
      paid_utc: payment.paid_utc || nowIso(),
      raw: { ...(payment.raw || {}), verify: verifySaved },
    });

    return await activateOrRequireSetup(db, payment);
  } catch (err) {
    return await recordVerifyFailure(db, reference, err);
  }
}

// A user for the row → activate; none → SETUP_REQUIRED with a fresh token.
async function activateOrRequireSetup(db: ServiceDb, payment: Payment): Promise<VerifyResult> {
  const existingUser = await findPaymentUser(db, payment);

  if (existingUser) {
    const activation = await activatePaymentForUser(db, payment, existingUser);
    return {
      ok: true,
      status: 'ACTIVATED',
      reference: payment.reference,
      subscription_id: activation.subscription.subscription_id,
      activation_mode: activation.mode,
      requires_setup: false,
      ...receiptOf(payment),
    };
  }

  const updated = await patchPayment(db, payment.reference, {
    status: 'SETUP_REQUIRED',
    setup_token: makeSetupToken(),
    setup_created_utc: nowIso(),
  });

  return {
    ok: true,
    status: 'SETUP_REQUIRED',
    reference: updated.reference,
    requires_setup: true,
    setup_token: updated.setup_token || '',
    email: updated.email || '',
    product_id: updated.product_id || '',
    product_name: updated.product_name || '',
    amount_minor_expected: updated.amount_minor_expected ?? null,
    currency: updated.currency || '',
    phone_number: updated.phone_number || '',
    program_id: updated.program_id || '',
  };
}

// The receipt half of an ACTIVATED reply: what was bought and the price,
// never who bought it.
function receiptOf(payment: Payment) {
  return {
    product_name: payment.product_name || payment.product_id || '',
    amount_minor_expected: payment.amount_minor_expected ?? null,
    currency: payment.currency || '',
  };
}

async function recordVerifyFailure(db: ServiceDb, reference: string, err: unknown): Promise<VerifyResult> {
  const note = err instanceof Error ? err.message : 'Verify failed';
  console.error('[payments] verify failed for', reference, note);
  try {
    await db.from('payments').update({ failure_note: note }).eq('reference', reference);
  } catch (patchErr) {
    console.error('[payments] verify failure_note write failed:', patchErr);
  }
  return { ok: false, error: 'verify_failed', reference, message: 'Could not verify payment' };
}
