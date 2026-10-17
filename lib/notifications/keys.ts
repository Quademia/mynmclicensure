// lib/notifications/keys.ts — the VAPID keys (08.5b). Server only, read
// inside a function (AGENTS.md: under OpenNext process.env binds per
// request). The public half is a plain variable (wrangler.jsonc vars,
// .env.local) handed to the page; the private half a Worker Secret. No
// keys: the app offers no notifications and sends none.

/** The contact a post office may write to about our notices (RFC 8292). */
export const VAPID_SUBJECT = 'mailto:support@quademia.com';

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

export function vapidKeys(): { subject: string; publicKey: string; privateKey: string } | null {
  const publicKey = vapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || null;
  if (!publicKey || !privateKey) return null;
  return { subject: VAPID_SUBJECT, publicKey, privateKey };
}
