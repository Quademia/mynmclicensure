// lib/payments/init-public.ts
//
// POST /payments/init-public, re-implemented from the payments Worker to
// the contract in rebuild.md §7.1 — the pay-first door for the subscribe
// page and the Premium Prep page. No session: the payer may have no
// account yet. The Worker's own checks, in its order, with its messages:
// the rate limit, email and product required, the product active. Then
// an INIT row (service role — the table has no write policy), Paystack's
// initialize with this site's confirmation page as the callback, the
// init reply kept in `raw`, and the checkout address handed back. If
// Paystack refuses, the row is marked FAILED with Paystack's message as
// its failure_note, and the browser gets a generic message (§7.1: no
// `err.message` to the client).
//
// The Worker ignored the browser's callback_url on this route and built
// its own from APP_BASE_URL; here it is appOrigin().

'use server';

import { createServiceRoleClient } from '@/lib/supabase/server';
import { appOrigin } from '@/lib/site/app-origin';
import { makePaymentReference } from './ids';
import { paystackInitialize } from './paystack';
import { getProductForPayment } from './queries';
import { checkPaymentRateLimit } from './rate-limit';
import { trimInitReply } from './trim';
import { RATE_LIMITED_MESSAGE, type InitPublicInput, type InitResult } from './types';

export async function initPublicPayment(input: InitPublicInput): Promise<InitResult> {
  const rl = await checkPaymentRateLimit();
  if (!rl.ok) return { ok: false, error: 'rate_limited', message: RATE_LIMITED_MESSAGE };

  const email = String(input?.email || '').trim().toLowerCase();
  const productId = String(input?.product_id || '').trim();
  const programId = String(input?.program_id || '').trim();
  const phoneNumber = String(input?.phone_number || '').trim();

  if (!email || !productId) {
    return { ok: false, error: 'missing_required_fields', message: 'email and product_id are required' };
  }

  const db = createServiceRoleClient();

  let product;
  try {
    product = await getProductForPayment(db, productId, true);
  } catch (err) {
    console.error('[payments] init-public product lookup failed:', err);
    return { ok: false, error: 'server_error', message: 'Could not start payment. Please try again.' };
  }
  if (!product) {
    // Legacy sent the code with no message; the page showed the code.
    return { ok: false, error: 'product_not_found_or_inactive', message: 'product_not_found_or_inactive' };
  }

  const reference = makePaymentReference();
  const callbackUrl = `${appOrigin()}/payment-confirmation`;

  const { error: insertError } = await db.from('payments').insert({
    reference,
    status: 'INIT',
    email,
    user_id: null,
    product_id: product.product_id,
    product_name: product.name,
    amount_minor_expected: product.price_minor,
    currency: product.currency,
    amount_minor_paid: null,
    paid_utc: null,
    activated_utc: null,
    subscription_id: null,
    failure_note: null,
    raw: null,
    setup_token: null,
    setup_created_utc: null,
    setup_completed_utc: null,
    program_id: programId || null,
    phone_number: phoneNumber || null,
  });
  if (insertError) {
    console.error('[payments] init-public insert failed:', insertError.message);
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
        product_id: product.product_id,
        product_name: product.name,
        program_id: programId || null,
        phone_number: phoneNumber || null,
      },
    });

    // Trimmed before the write (D32): the checkout address and access
    // code are handed to the browser once and never stored.
    await db.from('payments').update({ raw: { init: trimInitReply(initResult) } }).eq('reference', reference);

    const authorizationUrl = String(initResult?.data?.authorization_url || '');
    if (!authorizationUrl) {
      // The page's own check, moved server-side: no link, no redirect.
      return { ok: false, error: 'paystack_init_failed', message: 'Payment link missing from worker response' };
    }
    return { ok: true, reference, authorization_url: authorizationUrl };
  } catch (err) {
    const note = err instanceof Error ? err.message : 'Paystack initialize failed';
    console.error('[payments] init-public Paystack failed:', note);
    await db.from('payments').update({ status: 'FAILED', failure_note: note }).eq('reference', reference);
    return { ok: false, error: 'paystack_init_failed', message: 'Could not initialize payment' };
  }
}
