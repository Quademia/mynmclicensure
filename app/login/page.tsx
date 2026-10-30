// app/login/page.tsx — the sign-in page (01.12; Sam's layout B,
// 2026-10-30, from the canvas https://claude.ai/artifact/5vmaSLpvdCZtyxKhchQCTU).
//
// One sign-in for students and admins, as before; /router splits them
// after. On a computer the column and one photo side by side; on a phone
// the column alone. The card and its script live in login-card.tsx.

import type { Metadata } from 'next';
import { AppLink } from '@/components/shell/link-pending';
import { Wordmark } from '@/components/shell/wordmark';
import { getPublicProgrammes } from '@/lib/catalogue/queries';
import { LoginCard } from './login-card';
import { ClearPhonePacks } from './clear-phone-packs';
import '@/styles/login.css';

export const metadata: Metadata = {
  title: 'Sign in | MyNMCLicensure',
};

// The trial's length is read, as on the home page; this only shows if no
// open programme's trial package reads.
const TRIAL_DAYS_FALLBACK = 14;

// The support number the emails carry (lib/email/templates/footer.ts):
// Messages needs a sign-in, so this is the way out for a student who
// cannot get in (01.10).
const SUPPORT_WHATSAPP = 'https://wa.me/233538132277';

// Sam's photo for this page (2026-10-30): students sitting an exam on
// computers. Cloudinary cuts it to the tall half it fills, at its economy
// quality and lightest format. The original is 1747 × 900, so a 4:5 cut
// is at most 720px wide; a wider one would be blown up. Only a screen of
// 960px and up asks for it: below that the <picture> falls back to an
// empty one-pixel image, so a phone downloads nothing (Sam: the card alone
// on a phone).
const PHOTO = 'v1793403972/login_page_wip9kz.png';
const photoAt = (width: number) =>
  `https://res.cloudinary.com/dbyufeays/image/upload/f_auto,q_auto:eco,c_fill,ar_4:5,g_auto,w_${width}/${PHOTO}`;
const PHOTO_SRCSET = [480, 720].map((w) => `${photoAt(w)} ${w}w`).join(', ');
const EMPTY_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// Why the sign-out route sent this browser here. Looked up, never echoed:
// printing the address's words would let anyone put words of their
// choosing on the sign-in page with a link (MyNclex's rule).
const REASONS: Record<string, string> = {
  'other-device':
    'You were signed out because your account was signed in on another device. Sign in again to carry on here.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const notice = reason ? REASONS[reason] : undefined;
  const { trialDays } = await getPublicProgrammes();
  const days = trialDays ?? TRIAL_DAYS_FALLBACK;

  return (
    <div className="si-page">
      <div className="si-main">
        <AppLink href="/" className="si-home" title="Quademia MyNMCLicensure home">
          <Wordmark />
        </AppLink>

        <div className="si-centre">
          <div className="si-column">
            <header className="si-head">
              <h1>Pick up where you left off.</h1>
              <p>Sign in to your NMC licensure practice.</p>
            </header>

            {notice ? <p className="si-notice">{notice}</p> : null}

            <LoginCard />

            <div className="si-foot">
              <p>
                New here? <AppLink href="/register">Start your {days}-day trial</AppLink>
              </p>
              <p>
                Can&apos;t sign in?{' '}
                <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer">
                  Message us on WhatsApp
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="si-photo" aria-hidden="true">
        <picture>
          <source media="(min-width: 960px)" srcSet={PHOTO_SRCSET} sizes="50vw" />
          {/* A <picture>, not next/image: the photo is chosen by screen width
              (none on a phone), which next/image cannot do. */}
          <img src={EMPTY_PIXEL} alt="" />
        </picture>
      </div>

      <ClearPhonePacks />
    </div>
  );
}
