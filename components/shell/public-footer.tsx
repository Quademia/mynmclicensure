// components/shell/public-footer.tsx
//
// The public footer, on every page a visitor sees (the home page, the
// shop, Premium Prep, checkout, the payment confirmation). Redesigned
// 2026-10-30 with the home page (Claude Design's canvas "Home page", Sam's
// choices): the wordmark and a line on what this is; Follow us — the four
// social links, moved here from the old home page's strip until Sam
// updates them; the open programmes, each linking to the shop with its
// packages first (Sam: kept, the one place the other public pages name
// them); the pages; then the way back to Quademia and the year.
//
// ⚠ A SERVER COMPONENT, for three reasons that are not style preferences:
//
//   1. `parentSiteOrigin()` reads a server-side env var. AGENTS.md is
//      explicit that server config is read INSIDE a function and never
//      at module scope, because under OpenNext `process.env` binds per
//      request — so this cannot move into a client component without
//      prop-drilling the origin through every page that renders it.
//
//   2. THE YEAR IS COMPUTED, NOT TYPED. A year baked into something meant
//      to outlive it is silently wrong from the 1st of January. Reading
//      the clock in a client render would trip `react-hooks/purity`
//      (AGENTS.md's React-compiler rule) and split the server's paint
//      from the browser's. On the server it is one string in the HTML.
//
//   3. The programmes and the trial's length are read
//      (getPublicProgrammes, cached: the home page asks the same in the
//      same render), so a programme opened or a trial changed by the
//      admin shows here with nothing typed.

import { getPublicProgrammes } from '@/lib/catalogue/queries';
import { parentSiteOrigin } from '@/lib/site/parent-site';
import { AppLink } from './link-pending';
import { Wordmark } from './wordmark';

/**
 * Read the clock outside render. Trivially a module-level helper here
 * because this is a Server Component, but kept as one so the rule stays
 * visible if the footer ever gains interactivity.
 */
function currentYear(): number {
  return new Date().getUTCFullYear();
}

/** The decided trial (03 F4a), only if no trial package can be read. */
const TRIAL_DAYS_FALLBACK = 14;

// The old home page's links, unchanged; Sam is updating the channels.
const SOCIALS: { name: string; href: string; icon: React.ReactNode }[] = [
  {
    name: 'Telegram',
    href: 'https://t.me/QAcademynurseshub',
    icon: (
      <>
        <path d="M14.67 1.33 7.33 8.67" />
        <path d="m14.67 1.33-4.67 13.33-2.67-6-6-2.67z" />
      </>
    ),
  },
  {
    name: 'WhatsApp',
    href: 'https://www.whatsapp.com/channel/0029Vb6ActpBA1ewCfBmAF3O',
    icon: <path d="M5.27 13.33A6 6 0 1 0 2.67 10.73L1.33 14.67z" />,
  },
  {
    name: 'TikTok',
    href: 'https://www.tiktok.com/@qacademynurses',
    icon: (
      <>
        <path d="M6 12V3.33l8-1.33v8.67" />
        <circle cx="4" cy="12" r="2" />
        <circle cx="12" cy="10.67" r="2" />
      </>
    ),
  },
  {
    name: 'YouTube',
    href: 'https://www.youtube.com/@QAcademyNursesHub',
    icon: (
      <>
        <circle cx="8" cy="8" r="6.67" />
        <path d="M6.67 5.33 10.67 8l-4 2.67z" />
      </>
    ),
  },
];

export async function PublicFooter() {
  const parentSite = parentSiteOrigin();
  const { programs, trialDays } = await getPublicProgrammes();
  const days = trialDays ?? TRIAL_DAYS_FALLBACK;

  return (
    <footer className="pubfoot">
      <div className="pubfoot-cols">
        <div className="pubfoot-brand">
          <AppLink href="/" className="pubfoot-home" title="MyNMCLicensure by Quademia — home">
            <Wordmark />
          </AppLink>
          <p>NMC Ghana licensure exam prep for nursing students, by Quademia.</p>
        </div>

        <nav className="pubfoot-col" aria-label="Follow Quademia">
          <p className="pubfoot-head">Follow us</p>
          <ul>
            {SOCIALS.map((s) => (
              <li key={s.name}>
                <a href={s.href} target="_blank" rel="noopener">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {s.icon}
                  </svg>
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {programs.length ? (
          <nav className="pubfoot-col" aria-label="Open programmes">
            <p className="pubfoot-head">Open programmes</p>
            <ul>
              {programs.map((p) => (
                <li key={p.program_id}>
                  <AppLink href={`/subscribe?programme=${encodeURIComponent(p.program_id)}`}>{p.program_name}</AppLink>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <nav className="pubfoot-col" aria-label="Pages">
          <p className="pubfoot-head">Pages</p>
          <ul>
            <li><AppLink href="/">Home</AppLink></li>
            <li><AppLink href="/premium-prep">Premium Prep</AppLink></li>
            <li><AppLink href="/subscribe">Packages</AppLink></li>
            <li><AppLink href="/trial">Start your {days}-day trial</AppLink></li>
            <li><AppLink href="/login">Sign in</AppLink></li>
          </ul>
        </nav>
      </div>

      <div className="pubfoot-base">
        <a href={parentSite}>← Back to Quademia</a>
        <span>&copy; {currentYear()} Quademia. All rights reserved.</span>
      </div>
    </footer>
  );
}
