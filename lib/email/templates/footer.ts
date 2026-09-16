// lib/email/templates/footer.ts
//
// Legacy's shared footer (workers/email-worker/templates/footer.html),
// placed where each template had {{footer}}. The three social links are
// constants, as the Worker filled them in (rebuild.md §7.2).
//
// Changed (Sam, 2026-09-16): "QAcademy Educational Consult" reads
// Quademia, with no company name — Quademia Ltd is not registered
// (MyNclex's rule); the support address is support@quademia.com; the site
// link is the Quademia parent site, per environment through
// parentSiteOrigin() as the landing page's link is; the Telegram button
// goes to the live channel the landing page and the sidebar use — the
// Worker's t.me/qacademynurses is a blank contact page. TikTok, WhatsApp,
// the phone number, the two product pills and the fixed "© 2026" are
// legacy's.

import { parentSiteOrigin } from '@/lib/site/parent-site';
import { SUPPORT_EMAIL, esc } from './shared';

const SOCIAL_TIKTOK = 'https://tiktok.com/@qacademynurses';
const SOCIAL_TELEGRAM = 'https://t.me/QAcademynurseshub';
const SOCIAL_WHATSAPP = 'https://wa.me/233538132277';

// A function, not a constant: the site link reads its env var per
// render, never at module load (AGENTS.md, Known Workarounds).
export function footer(): string {
  return `<!-- Shared footer -->
          <tr>
            <td style="padding:20px 24px; text-align:center; border-top:1px solid #e5e7eb;">

              <!-- Brand -->
              <p style="margin:0 0 2px; font-size:13px; font-weight:700; color:#1e3a5f;">Quademia</p>
              <p style="margin:0 0 12px; font-size:11px; color:#6b7280; letter-spacing:0.06em;">LEARN &middot; PRACTICE &middot; PASS</p>

              <!-- Product pills -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
                <tr>
                  <td style="padding-right:8px;">
                    <span style="display:inline-block; background:#edf6f5; color:#0f6e56; font-size:11px; font-weight:600; padding:3px 10px; border-radius:4px;">MyNMC Licensure</span>
                  </td>
                  <td>
                    <span style="display:inline-block; background:#edf6f5; color:#0f6e56; font-size:11px; font-weight:600; padding:3px 10px; border-radius:4px;">MyTeacher</span>
                  </td>
                </tr>
              </table>

              <!-- Contact -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
                <tr>
                  <td style="padding-right:20px;">
                    <a href="mailto:${esc(SUPPORT_EMAIL)}" style="font-size:11px; color:#2d7d72; text-decoration:none;">${esc(SUPPORT_EMAIL)}</a>
                  </td>
                  <td>
                    <span style="font-size:11px; color:#6b7280;">+233 53 813 2277</span>
                  </td>
                </tr>
              </table>

              <!-- Social links -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="padding-right:10px;">
                    <a href="${esc(SOCIAL_TIKTOK)}" style="display:inline-block; border:1px solid #dde3e9; border-radius:4px; padding:4px 12px; font-size:11px; color:#1e3a5f; font-weight:600; text-decoration:none;">TikTok</a>
                  </td>
                  <td style="padding-right:10px;">
                    <a href="${esc(SOCIAL_TELEGRAM)}" style="display:inline-block; border:1px solid #dde3e9; border-radius:4px; padding:4px 12px; font-size:11px; color:#1e3a5f; font-weight:600; text-decoration:none;">Telegram</a>
                  </td>
                  <td>
                    <a href="${esc(SOCIAL_WHATSAPP)}" style="display:inline-block; border:1px solid #dde3e9; border-radius:4px; padding:4px 12px; font-size:11px; color:#1e3a5f; font-weight:600; text-decoration:none;">WhatsApp</a>
                  </td>
                </tr>
              </table>

              <!-- Divider + copyright -->
              <hr style="border:none; border-top:1px solid #e5e7eb; margin:14px 0 12px;" />
              <p style="margin:0; font-size:10px; color:#9ca3af;">
                &copy; 2026 Quademia &middot; <a href="${esc(parentSiteOrigin())}" style="color:#9ca3af; text-decoration:none;">quademia.com</a>
              </p>

            </td>
          </tr>`;
}
