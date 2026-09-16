// lib/email/templates/subscription-revoked.ts
//
// SUBSCRIPTION_REVOKED — legacy
// workers/email-worker/templates/subscription-revoked.html with its
// subject from the Worker's EVENT_MAP. Sent by the admin revoke action.
// "QAcademy" reads Quademia (UI convention #5); every value is escaped
// (§9 #25). The support address legacy's page passed in as data is the
// shared constant here — the page only ever passed that one address.

import { footer } from './footer';
import { SUPPORT_EMAIL, esc, type EmailContent } from './shared';

export type SubscriptionRevokedData = {
  name: string;
  productName: string;
  /** The site's own address — legacy's window.location.origin. */
  renewUrl: string;
};

export function subscriptionRevokedEmail(data: SubscriptionRevokedData): EmailContent {
  return {
    subject: 'Your Quademia access has been removed',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Quademia access has been removed</title>
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
                Your access to ${esc(data.productName)} on Quademia has been removed.
              </p>

              <!-- Warning panel (amber) -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7; border:1px solid #f59e0b; border-radius:6px; margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0; font-size:14px; color:#92400e; line-height:1.5;">
                      If you think this is a mistake, contact us at ${esc(SUPPORT_EMAIL)} and we'll look into it immediately.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA buttons side by side -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:12px;">
                          <a href="${esc(data.renewUrl)}" style="display:inline-block; padding:14px 28px; background:#2d7d72; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; border-radius:6px;">
                            Renew my access &rarr;
                          </a>
                        </td>
                        <td>
                          <a href="mailto:${esc(SUPPORT_EMAIL)}" style="display:inline-block; padding:13px 28px; background:#ffffff; color:#1e3a5f; font-size:15px; font-weight:600; text-decoration:none; border-radius:6px; border:2px solid #1e3a5f;">
                            Contact support
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <hr style="border:none; border-top:1px solid #e0e0e0; margin:24px 0;" />

              <p style="margin:0; font-size:12px; color:#999999; line-height:1.5;">
                If you were expecting this change, no action is needed.
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
