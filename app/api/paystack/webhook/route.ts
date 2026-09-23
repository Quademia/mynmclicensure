// app/api/paystack/webhook/route.ts
//
// D4 — Paystack's webhook. Until now a payment became a subscription only
// when the payer's browser came back to /payment-confirmation; a buyer
// who approved a mobile-money prompt and never returned had paid and
// received nothing. Paystack now calls this address itself the moment a
// charge succeeds, and it runs the same verify-and-activate path the
// confirmation page runs (lib/payments/verify.ts).
//
// Trust nothing in the body. The signature proves the call came from
// Paystack under OUR secret key; the reference is then checked with
// Paystack's own verify API before anything is written — the body's
// amount and status are never read. §8 S15's unique index makes the
// webhook and a returning browser safe to arrive in the same second.
//
// The answer tells Paystack whether to try again: 200 for everything
// handled or deliberately ignored, 500 for a passing failure (Paystack
// unreachable, the limiter, "not success yet") so it retries. 401 for a
// bad signature. No session and no cookie: the middleware lets the path
// through because it is not under an auth-required prefix.
//
// Set the address per mode in the Paystack dashboard (Settings → API
// Keys & Webhooks): the test field → the dev site, the live field → prod.
// Until cutover the business is shared with the Blogger-era app, so a
// reference this product never made answers 200 and is left alone.

import { isPaystackSignatureValid } from '@/lib/payments/paystack';
import { verifyPayment } from '@/lib/payments/verify';

export const dynamic = 'force-dynamic';

function answer(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

export async function POST(request: Request): Promise<Response> {
  // The signature is over the exact bytes sent, so read the text once and
  // parse it only after it has been checked.
  const rawBody = await request.text();
  let signed = false;
  try {
    signed = await isPaystackSignatureValid(rawBody, request.headers.get('x-paystack-signature') || '');
  } catch (err) {
    // No secret key configured: nothing can be checked, so nothing is trusted.
    console.error('[payments] webhook: signature check failed to run:', err);
    return answer(500, 'unavailable');
  }
  if (!signed) {
    console.warn('[payments] webhook: refused, bad signature');
    return answer(401, 'invalid signature');
  }

  let event: { event?: unknown; data?: { reference?: unknown } } | null;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return answer(400, 'invalid body');
  }

  const type = String(event?.event || '');
  const reference = String(event?.data?.reference || '').trim();
  // Only a successful charge moves a payment. Every other event Paystack
  // sends (transfers, refunds, subscriptions) has no reader here yet.
  if (type !== 'charge.success' || !reference) return answer(200, 'ignored');

  const result = await verifyPayment(reference, { keepLiveSetupToken: true });

  if (result.ok) {
    console.log(`[payments] webhook: ${reference} → ${result.status}`);
    return answer(200, 'ok');
  }

  switch (result.error) {
    // Not this product's payment, or one that is settled as failed:
    // retrying would change nothing.
    case 'payment_not_found':
    case 'payment_failed':
    case 'amount_mismatch':
    case 'currency_mismatch':
    case 'missing_reference':
      console.log(`[payments] webhook: ${reference} → ${result.error}, left alone`);
      return answer(200, 'ignored');
    // not_ready, verify_failed, rate_limited, limiter_unavailable: passing.
    default:
      console.warn(`[payments] webhook: ${reference} → ${result.error}, asking Paystack to retry`);
      return answer(500, 'retry');
  }
}
