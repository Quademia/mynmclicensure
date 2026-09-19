// lib/email/templates/shared.ts
//
// What the four templates, the footer and the sender share (slice 10):
// the support address, the escaping every filled-in value goes through,
// and the shape a template hands to send.ts.
//
// ⭐ §9 #25 (Sam, 2026-09-16): legacy's fillTemplate pasted each value
// into the HTML as it was, so a name typed at registration rendered as
// markup — a link typed into the First name box reached whoever owned
// the email address, from the product's own domain. Every value now
// passes through esc() as it is filled in; a name with no markup in it
// reads exactly as before.

/** Legacy's support@qacademynurses.com, as the confirmation page has it (9a). */
export const SUPPORT_EMAIL = 'support@quademia.com';

export type EmailContent = { subject: string; html: string };

/** A value as TEXT in the HTML — in a tag's body or an attribute — never as markup. */
export function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
