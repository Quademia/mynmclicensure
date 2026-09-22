// components/shell/public-footer.tsx
//
// The public footer, extracted from the landing page (Sam, 2026-09-22).
// Two things: the way back to the parent Quademia site, and the
// copyright line. It was the app's only footer — `/subscribe`,
// `/premium-prep` and `/payment-confirmation` each ended on whatever
// their last card was.
//
// ⚠ A SERVER COMPONENT, for two reasons that are not style preferences:
//
//   1. `parentSiteOrigin()` reads a server-side env var. AGENTS.md is
//      explicit that server config is read INSIDE a function and never
//      at module scope, because under OpenNext `process.env` binds per
//      request — so this cannot move into a client component without
//      prop-drilling the origin through every page that renders it.
//
//   2. THE YEAR IS COMPUTED, NOT TYPED. The landing page had `© 2026`
//      as a literal, which is the same bug this repo removed from the
//      product ids the same morning: a year baked into something meant
//      to outlive it, silently wrong from the 1st of January. Reading
//      the clock in a client render would trip `react-hooks/purity`
//      (AGENTS.md's React-compiler rule) and split the server's paint
//      from the browser's. On the server it is one string in the HTML,
//      correct by construction, with no hydration risk.

import { parentSiteOrigin } from '@/lib/site/parent-site';

/**
 * Read the clock outside render. Trivially a module-level helper here
 * because this is a Server Component, but kept as one so the rule stays
 * visible if the footer ever gains interactivity.
 */
function currentYear(): number {
  return new Date().getUTCFullYear();
}

export function PublicFooter() {
  const parentSite = parentSiteOrigin();

  return (
    <footer className="pubfoot">
      <a href={parentSite}>← Back to Quademia</a>
      <span>&copy; {currentYear()} Quademia. All rights reserved.</span>
    </footer>
  );
}
