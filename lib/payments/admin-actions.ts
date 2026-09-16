// lib/payments/admin-actions.ts
//
// The admin Payments page's two Server Actions. A filter change or Load
// More re-reads a page of payments behind the admin gate, as legacy's
// loadPayments() re-queried from the browser (slice 9b). Retry
// Activation is legacy's retryActivation: the verify route again, then
// the PAYMENT_SETUP_REQUIRED email legacy's page fired when verify
// answered SETUP_REQUIRED (slice 10). Copy Setup Link needs nothing from
// the server.
//
// ⚠ The email is sent here and never inside verify: the confirmation
// page calls verify every 3 seconds while a payer waits, and legacy sent
// the email only from the admin's button (rebuild.md §7.2).

'use server';

import { requireAdmin } from '@/lib/access';
import { sendEmail } from '@/lib/email/send';
import { paymentSetupRequiredEmail } from '@/lib/email/templates/payment-setup-required';
import { appOrigin } from '@/lib/site/app-origin';
import { getPaymentsPaginated, type PaymentFilters, type PaymentsPage } from './admin-queries';
import { SETUP_TOKEN_LIFETIME_MS, type VerifyResult } from './types';
import { verifyPayment } from './verify';

export async function listPaymentsAction(filters: PaymentFilters, page: number): Promise<PaymentsPage> {
  const { supabase } = await requireAdmin();
  return getPaymentsPaginated(supabase, filters, Math.max(0, Number(page) || 0));
}

// The same verify the confirmation page polls, so its rate limit and its
// answers are unchanged; the page reads the result as before. On
// SETUP_REQUIRED with an email, the setup link on this site's own address
// — the one Copy Setup Link builds, token included (§9 #20) — and the
// token's 48 hours.
export async function retryActivationAction(reference: string): Promise<VerifyResult> {
  await requireAdmin();
  const result = await verifyPayment(reference);

  if (result.ok && result.status === 'SETUP_REQUIRED' && result.email) {
    const setupUrl =
      `${appOrigin()}/payment-confirmation?reference=${encodeURIComponent(result.reference)}` +
      `&setup_token=${encodeURIComponent(result.setup_token || '')}`;
    await sendEmail(
      result.email,
      paymentSetupRequiredEmail({
        email: result.email,
        productName: result.product_name || '',
        setupUrl,
        expiryHours: SETUP_TOKEN_LIFETIME_MS / (60 * 60 * 1000),
      }),
    );
  }

  return result;
}
