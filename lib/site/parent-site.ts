// lib/site/parent-site.ts
//
// The address of the Quademia parent site, for the "Back to Quademia"
// link on the public landing page. The legacy footer pointed at the old
// umbrella page, which is not rebuilt (Sam, 2026-09-11: the new parent
// site covers it).
//
// A plain env var read INSIDE the function, never at module scope, with
// the PROD value as the fallback (AGENTS.md, Known Workarounds): dev
// links to the dev parent site, prod to the real one, and a literal is
// never written into a page. PARENT_SITE_ORIGIN lives in .env.local and
// in wrangler.jsonc `vars` (both blocks).

export function parentSiteOrigin(): string {
  const raw = process.env.PARENT_SITE_ORIGIN || 'https://quademia.com';
  return raw.replace(/\/+$/, '');
}
