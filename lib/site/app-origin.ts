// lib/site/app-origin.ts
//
// This site's own public address, for every link the app hands to
// something outside itself: the Paystack callback (slice 9), the
// links in the four emails (slice 10), the setup link the admin copies
// (9b). One function, never a literal (AGENTS.md: "An email links to
// the site that sent it").
//
// A plain env var read INSIDE the function, never at module scope, with
// the PROD value as the fallback (AGENTS.md, Known Workarounds). APP_ORIGIN
// lives in .env.local (http://localhost:3000) and in wrangler.jsonc `vars`
// (both blocks), per environment.

export function appOrigin(): string {
  const raw = process.env.APP_ORIGIN || 'https://licensure-prod.qacademynurses.workers.dev';
  return raw.replace(/\/+$/, '');
}
