// lib/payments/activate.ts
//
// The Worker's activatePaymentForUser(), transcribed (rebuild.md §7.1).
// Three modes, checked in this order:
//   existing_by_ref — a subscription with source PAYSTACK and this
//                     reference already exists (the replay guard): reuse
//                     it, keep the row's original activated_utc;
//   extended        — an ACTIVE, unexpired subscription for the same
//                     product: add the product's duration_days to its
//                     expiry, reset expiry_reminded, stamp the reference;
//   created         — a fresh row from now.
// The product lookup here does NOT require the product to be active.
// Every write is the service role's: the payer may have no session.
//
// Server only.

import { syncAccessRows, writeAccessRows } from '@/lib/subscriptions/access-rows';
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
    await syncAccessRows(db, existingByRef, false);
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

  const currentTime = nowIso();

  // Same product, ACTIVE and unexpired → extend from its expiry.
  const { data: activeSameProduct, error: findError } = await db
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.user_id)
    .eq('product_id', payment.product_id)
    .eq('status', 'ACTIVE')
    .gt('expires_utc', currentTime)
    .order('expires_utc', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findError) throw new Error(`Supabase select failed on subscriptions: ${findError.message}`);

  if (activeSameProduct) {
    const current = activeSameProduct as Subscription;
    const { data: updatedSub, error } = await db
      .from('subscriptions')
      .update({
        expires_utc: addDaysIso(current.expires_utc, product.duration_days),
        status: 'ACTIVE',
        source: 'PAYSTACK',
        source_ref: payment.reference,
        expiry_reminded: false,
      })
      .eq('subscription_id', current.subscription_id)
      .select('*')
      .single();
    if (error) throw new Error(`Supabase patch failed on subscriptions: ${error.message}`);

    const sub = updatedSub as Subscription;
    // The receipt's course rows take the new end with it (02 C2; the
    // extend branch itself goes when stacking turns on, C3).
    await syncAccessRows(db, sub, false);
    await patchPayment(db, payment.reference, {
      user_id: user.user_id,
      subscription_id: sub.subscription_id,
      status: 'ACTIVATED',
      activated_utc: nowIso(),
    });
    return { mode: 'extended', subscription: sub };
  }

  const startIso = currentTime;
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
  // One course row per course of the product, the receipt's dates (02 C2).
  await writeAccessRows(db, sub);
  await patchPayment(db, payment.reference, {
    user_id: user.user_id,
    subscription_id: sub.subscription_id,
    status: 'ACTIVATED',
    activated_utc: nowIso(),
  });
  return { mode: 'created', subscription: sub };
}
