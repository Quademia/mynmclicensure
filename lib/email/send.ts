// lib/email/send.ts
//
// The one sender (slice 10): an email handed to Resend from the server.
// Legacy's pages posted to a separate email Worker with a shared secret
// shipped in js/config.js, so anyone could send from the product's
// domain (rebuild.md §9 #1); that Worker is gone with the stack.
//
// Legacy's contract, kept (§7.2): the caller awaits it and it never
// throws. A failure — no key, Resend refusing, the network — is written
// to the server log and the action carries on. Nothing retries it and
// nothing records it: legacy had no queue, no retry and no email page
// (MyNclex's are a mechanism, not stack).
//
// ⚠ NO `resend` SDK — a plain fetch to their REST API, as MyNclex does:
// the SDK is a thin wrapper over one POST, and fetch is native on
// Cloudflare Workers.
//
// The sender as MyNclex sends today (Sam, 2026-09-16): EMAIL_FROM is
// `MyNMCLicensure <noreply@quademia.com>` (wrangler.jsonc, both
// environments), and a reply reaches support through the Reply-To header
// — legacy set none. RESEND_API_KEY is this product's own secret per
// environment (licensure-dev-app / licensure-prod-app), never MyNclex's.
// Both are read inside the function, never at module scope (AGENTS.md,
// Known Workarounds). The log names the subject, never the address.

import { SUPPORT_EMAIL, type EmailContent } from './templates/shared';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// A hung request must not hold a registration or an admin's button.
const SEND_TIMEOUT_MS = 10_000;

export async function sendEmail(to: string, content: EmailContent): Promise<void> {
  // legacy: the Worker refused a missing data.email, and the pages sent
  // nothing without one.
  const address = String(to || '').trim();
  if (!address) return;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.error(`[email] not sent, ${apiKey ? 'EMAIL_FROM' : 'RESEND_API_KEY'} is not set: "${content.subject}"`);
    return;
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [address],
        reply_to: [SUPPORT_EMAIL],
        subject: content.subject,
        html: content.html,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => null)) as { id?: string; name?: string; message?: string } | null;
    if (!res.ok) {
      console.error(`[email] Resend refused "${content.subject}": HTTP ${res.status} ${body?.name ?? ''} ${body?.message ?? ''}`.trim());
      return;
    }
    console.log(`[email] sent "${content.subject}" (Resend id ${body?.id ?? 'unknown'})`);
  } catch (err) {
    console.error(`[email] send failed "${content.subject}":`, err instanceof Error ? err.message : err);
  }
}
