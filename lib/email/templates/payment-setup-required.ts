// lib/email/templates/payment-setup-required.ts
//
// PAYMENT_SETUP_REQUIRED — legacy
// workers/email-worker/templates/payment-setup-required.html with its
// subject from the Worker's EVENT_MAP. Sent by the admin Retry Activation
// action when verify answers SETUP_REQUIRED, and from nowhere else — as
// legacy, a payer who leaves before setup gets it only when an admin
// retries. "QAcademy" reads Quademia and support@qacademynurses.com reads
// support@quademia.com (UI convention #5, the 9a address); every value is
// escaped (§9 #25).

import { footer } from './footer';
import { SUPPORT_EMAIL, esc, type EmailContent } from './shared';

export type PaymentSetupRequiredData = {
  /** The payer's email, shown as "Payment registered for". */
  email: string;
  productName: string;
  /** The confirmation page with the reference and the fresh token (§9 #20). */
  setupUrl: string;
  expiryHours: number;
};

export function paymentSetupRequiredEmail(data: PaymentSetupRequiredData): EmailContent {
  return {
    subject: 'Complete your Quademia account setup',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Complete your Quademia account setup</title>
</head>
<body style="margin:0; padding:0; background:#f0f4f8; font-family:Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8; padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="540" cellpadding="0" cellspacing="0" style="max-width:540px; width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f; padding:28px 32px; border-radius:8px 8px 0 0; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700;">Quademia</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff; padding:32px; border-radius:0 0 8px 8px;">

              <p style="margin:0 0 16px; font-size:16px; color:#1a1a1a;">Hi there,</p>

              <p style="margin:0 0 20px; font-size:15px; color:#333333; line-height:1.6;">
                We have received your payment for ${esc(data.productName)}. Your account setup is not yet complete. Click the button below to finish setting up your Quademia account.
              </p>

              <!-- Warning panel (amber) -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7; border:1px solid #f59e0b; border-radius:6px; margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0; font-size:14px; color:#92400e; line-height:1.5;">
                      This link expires in ${esc(data.expiryHours)} hours. After that, contact support at ${esc(SUPPORT_EMAIL)} for a fresh link.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA button (dark blue) -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${esc(data.setupUrl)}" style="display:inline-block; padding:14px 32px; background:#1e3a5f; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; border-radius:6px;">
                      Complete my account setup &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info panel (teal) -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#e8f5f2; border:1px solid #b2dfdb; border-radius:6px; margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px; font-size:13px; color:#555555;">Payment registered for</p>
                    <p style="margin:0; font-size:15px; color:#1a1a1a; font-weight:600;">${esc(data.email)}</p>
                  </td>
                </tr>
              </table>

              <hr style="border:none; border-top:1px solid #e0e0e0; margin:24px 0;" />

              <p style="margin:0; font-size:12px; color:#999999; line-height:1.5;">
                If you did not make this payment, contact us immediately at ${esc(SUPPORT_EMAIL)}
              </p>
            </td>
          </tr>

          ${footer()}

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`,
  };
}
