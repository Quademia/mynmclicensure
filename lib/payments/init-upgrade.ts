// lib/payments/init-upgrade.ts
//
// POST /payments/init-upgrade, re-implemented from the payments Worker to
// the contract in rebuild.md §7.1 — the signed-in door for the student
// upgrade page (wired in 9b). The Worker validated a Bearer token,
// resolved the users row by auth_id and refused an inactive one; here
// that is requireStudent() from lib/access — the Bearer dance disappears
// with the Worker. Then the Worker's own checks in its order: the rate
// limit, the product (uppercased) active, the email present; an INIT row
// tied to the student (service role — the table has no write policy);
// Paystack's initialize with the confirmation page as the callback; the
// init reply kept in `raw`. A Paystack refusal marks the row FAILED and
// answers generically (§7.1).

'use server';

import { requireStudent } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { appOrigin } from '@/lib/site/app-origin';
import { makePaymentReference } from './ids';
import { paystackInitialize } from './paystack';
import { getProductForPayment } from './queries';
import { checkPaymentRateLimit } from './rate-limit';
import { trimInitReply } from './trim';
import { RATE_LIMITED_MESSAGE, type InitResult } from './types';

export async function initUpgradePayment(productIdIn: string): Promise<InitResult> {
  const rl = await checkPaymentRateLimit();
  if (!rl.ok) return { ok: false, error: 'rate_limited', message: RATE_LIMITED_MESSAGE };

  const productId = String(productIdIn || '').trim().toUpperCase();
  if (!productId) return { ok: false, error: 'missing_product_id', message: 'missing_product_id' };

  // The gate: a signed-in, active STUDENT with a profile row.
  const { user, profile } = await requireStudent();
  if (profile.active === false) return { ok: false, error: 'user_inactive', message: 'user_inactive' };

  const db = createServiceRoleClient();

  let product;
  try {
    product = await getProductForPayment(db, productId, true);
  } catch (err) {
    console.error('[payments] init-upgrade product lookup failed:', err);
    return { ok: false, error: 'server_error', message: 'Could not start payment. Please try again.' };
  }
  if (!product) return { ok: false, error: 'product_not_found_or_inactive', message: 'product_not_found_or_inactive' };

  const email = String(profile.email || user.email || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'user_email_missing', message: 'user_email_missing' };

  const reference = makePaymentReference();
  const callbackUrl = `${appOrigin()}/payment-confirmation`;

  const { error: insertError } = await db.from('payments').insert({
    reference,
    status: 'INIT',
    email,
    user_id: profile.user_id,
    product_id: product.product_id,
    product_name: product.name,
    amount_minor_expected: product.price_minor,
    currency: product.currency,
    amount_minor_paid: null,
    paid_utc: null,
    activated_utc: null,
    subscription_id: null,
    failure_note: null,
    raw: { flow: 'upgrade', created_by: 'initUpgradePayment' },
    setup_token: null,
    setup_created_utc: null,
    setup_completed_utc: null,
    program_id: profile.program_id || null,
    phone_number: profile.phone_number || null,
  });
  if (insertError) {
    console.error('[payments] init-upgrade insert failed:', insertError.message);
    return { ok: false, error: 'server_error', message: 'Could not start payment. Please try again.' };
  }

  try {
    const initResult = await paystackInitialize({
      email,
      amount: product.price_minor,
      currency: product.currency,
      reference,
      callback_url: callbackUrl,
      metadata: {
        flow: 'upgrade',
        user_id: profile.user_id,
        auth_id: user.id,
        product_id: product.product_id,
        product_name: product.name,
        program_id: profile.program_id || null,
        phone_number: profile.phone_number || null,
      },
    });

    // Trimmed before the write (D32), as init-public.
    await db.from('payments').update({ raw: { flow: 'upgrade', init: trimInitReply(initResult) } }).eq('reference', reference);

    const authorizationUrl = String(initResult?.data?.authorization_url || '');
    if (!authorizationUrl) {
      return { ok: false, error: 'paystack_init_failed', message: 'Payment link missing from worker response' };
    }
    return { ok: true, reference, authorization_url: authorizationUrl };
  } catch (err) {
    const note = err instanceof Error ? err.message : 'Paystack initialize failed';
    console.error('[payments] init-upgrade Paystack failed:', note);
    await db
      .from('payments')
      .update({ status: 'FAILED', failure_note: note, raw: { flow: 'upgrade', init_error: note } })
      .eq('reference', reference);
    return { ok: false, error: 'paystack_init_failed', message: 'Could not initialize payment' };
  }
}
