// lib/email/templates/subscription-assigned.ts
//
// SUBSCRIPTION_ASSIGNED — legacy
// workers/email-worker/templates/subscription-assigned.html with its
// subject from the Worker's EVENT_MAP. Sent by the admin grant action,
// from the Subscriptions page's Grant and the Users page's Assign alike
// (Sam, 2026-09-16). "QAcademy" reads Quademia (UI convention #5); every
// value is escaped (§9 #25).
//
// The expiry is the saved row's, read back by the caller (rebuild.md
// §7.2) — legacy's page computed it in the browser from the start date
// plus the product's days, which was wrong whenever the grant extended an
// existing subscription.

import { footer } from './footer';
import { esc, type EmailContent } from './shared';

export type SubscriptionAssignedData = {
  name: string;
  loginUrl: string;
  /** As legacy's Grant dropdown labelled the product: `name (KIND)`. */
  productName: string;
  /** The subscription row's expires_utc; '' if it could not be read. */
  expiresUtc: string;
};

// legacy: toLocaleDateString('en-GB', { day: 'numeric', month: 'long',
// year: 'numeric' }) in the admin's browser. Ghana keeps GMT all year, so
// UTC on the server gives the same day ("13 October 2026").
function formatExpiry(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function subscriptionAssignedEmail(data: SubscriptionAssignedData): EmailContent {
  return {
    subject: 'Your Quademia access is now active',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Quademia access is now active</title>
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

              <p style="margin:0 0 16px; font-size:16px; color:#1a1a1a;">Hi ${esc(data.name)},</p>

              <p style="margin:0 0 20px; font-size:15px; color:#333333; line-height:1.6;">
                Your subscription has been activated and you now have full access to your courses. Sign in to get started!
              </p>

              <!-- Info panel -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#e8f5f2; border:1px solid #b2dfdb; border-radius:6px; margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px; font-size:13px; color:#555555;">Subscription</p>
                    <p style="margin:0 0 12px; font-size:15px; color:#1a1a1a; font-weight:600;">${esc(data.productName)}</p>
                    <p style="margin:0 0 6px; font-size:13px; color:#555555;">Expires</p>
                    <p style="margin:0; font-size:15px; color:#1a1a1a; font-weight:600;">${esc(formatExpiry(data.expiresUtc))}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA button (dark blue) -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${esc(data.loginUrl)}" style="display:inline-block; padding:14px 32px; background:#1e3a5f; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; border-radius:6px;">
                      Go to your courses &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Warning panel (amber) -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7; border:1px solid #f59e0b; border-radius:6px; margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0; font-size:14px; color:#92400e; line-height:1.5;">
                      Make the most of your access before it expires. Sign in regularly, complete your quizzes, and track your progress.
                    </p>
                  </td>
                </tr>
              </table>

              <hr style="border:none; border-top:1px solid #e0e0e0; margin:24px 0;" />

              <p style="margin:0; font-size:12px; color:#999999; line-height:1.5;">
                If you did not expect this, contact us.
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
