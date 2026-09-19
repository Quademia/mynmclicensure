// lib/payments/activate.ts
//
// The Worker's activatePaymentForUser(), transcribed (rebuild.md §7.1).
// Two modes, checked in this order:
//   existing_by_ref — a subscription with source PAYSTACK and this
//                     reference already exists (the replay guard): reuse
//                     it, keep the row's original activated_utc;
//   created         — a fresh receipt from now; its course rows queue
//                     behind whatever the student already holds
//                     (02 C3a). The Worker's third mode — extending a
//                     same-product receipt — went with C3a: a renewal is
//                     a receipt of its own, and the rows carry the days.
// The product lookup here does NOT require the product to be active.
// Every write is the service role's: the payer may have no session.
//
// Server only.

import { ensureAccessRows, writeAccessRows } from '@/lib/subscriptions/access-rows';
import { addDaysIso, nowIso } from '@/lib/subscriptions/dates';
import { makeSubscriptionId } from '@/lib/subscriptions/ids';
import type { Subscription } from '@/lib/subscriptions/types';
import { getProductForPayment, getSubscriptionByPaymentRef, patchPayment, type ServiceDb } from './queries';
import type { ActivationMode, Payment, PaymentUser } from './types';

export type Activation = { mode: ActivationMode; subscription: Subscription };

export async function activatePaymentForUser(db: ServiceDb, payment: Payment, user: PaymentUser): Promise<Activation> {
  if (!payment?.reference) throw new Error('activatePaymentForUser: missing payment reference');
  if (!user?.user_id) throw new Error('activatePaymentForUser: missing user');

  // Idempotency 1: this reference already produced a subscription.
  const existingByRef = await getSubscriptionByPaymentRef(db, payment.reference);
  if (existingByRef) {
    // The course rows (02 C2) — written here too, so a retry after a
    // failure between the receipt and its rows heals itself.
    await ensureAccessRows(db, existingByRef);
    await patchPayment(db, payment.reference, {
      user_id: user.user_id,
      subscription_id: existingByRef.subscription_id,
      status: 'ACTIVATED',
      activated_utc: payment.activated_utc || nowIso(),
    });
    return { mode: 'existing_by_ref', subscription: existingByRef };
  }

  const product = await getProductForPayment(db, payment.product_id, false);
  if (!product) throw new Error('Activation failed: product not found');

  const startIso = nowIso();
  const { data: newSub, error: insertError } = await db
    .from('subscriptions')
    .insert({
      subscription_id: makeSubscriptionId(),
      user_id: user.user_id,
      product_id: payment.product_id,
      start_utc: startIso,
      expires_utc: addDaysIso(startIso, product.duration_days),
      status: 'ACTIVE',
      source: 'PAYSTACK',
      source_ref: payment.reference,
      expiry_reminded: false,
    })
    .select('*')
    .single();
  if (insertError) throw new Error(`Supabase insert failed on subscriptions: ${insertError.message}`);

  const sub = newSub as Subscription;
  // One course row per course of the product, each queued behind the
  // course's current end; the receipt's window then follows its rows,
  // and so does what this returns (02 C2, C3a, C3b).
  Object.assign(sub, await writeAccessRows(db, sub));
  await patchPayment(db, payment.reference, {
    user_id: user.user_id,
    subscription_id: sub.subscription_id,
    status: 'ACTIVATED',
    activated_utc: nowIso(),
  });
  return { mode: 'created', subscription: sub };
}
