// components/sign-in/frame.tsx — the frame the four sign-in pages share:
// sign in (01.12), register, forgot and reset password (01.15). Sam's
// layout B (2026-10-30; the other three on it 2026-10-31, canvas
// https://claude.ai/artifact/5vmaSLpvdCZtyxKhchQCTU): on a phone the
// wordmark and the column alone; from 960px the same column on the left
// and one photo on the right. The same photo on all four, so a student
// moving between them downloads it once.

import { AppLink } from '@/components/shell/link-pending';
import { Wordmark } from '@/components/shell/wordmark';
import '@/styles/login.css';

// The support number the emails carry (lib/email/templates/footer.ts):
// Messages needs a sign-in, so this is the way out for a student who
// cannot get in (01.10).
export const SUPPORT_WHATSAPP = 'https://wa.me/233538132277';

// The trial's length is read from the trial packages (getPublicProgrammes);
// this only shows if no open programme's trial package reads.
export const TRIAL_DAYS_FALLBACK = 14;

// Sam's photo (2026-10-30): students sitting an exam on computers.
// Cloudinary cuts it to the tall half it fills, at its economy quality and
// lightest format. The original is 1747 × 900, so a 4:5 cut is at most
// 720px wide; a wider one would be blown up. Only a screen of 960px and up
// asks for it: below that the <picture> falls back to an empty one-pixel
// image, so a phone downloads nothing (Sam: the card alone on a phone).
const PHOTO = 'v1793403972/login_page_wip9kz.png';
const photoAt = (width: number) =>
  `https://res.cloudinary.com/dbyufeays/image/upload/f_auto,q_auto:eco,c_fill,ar_4:5,g_auto,w_${width}/${PHOTO}`;
const PHOTO_SRCSET = [480, 720].map((w) => `${photoAt(w)} ${w}w`).join(', ');
const EMPTY_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export function SignInFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="si-page">
      <div className="si-main">
        {/* The wordmark goes home, as on most sign-in pages; "← Home" says
            so in a word, for a student who does not know that habit (Sam,
            2026-10-31: B, on trial — to remove if he does not like it). */}
        <div className="si-top">
          <AppLink href="/" className="si-home" title="Quademia MyNMCLicensure home">
            <Wordmark />
          </AppLink>
          <AppLink href="/" className="si-tohome">
            ← Home
          </AppLink>
        </div>

        <div className="si-centre">
          <div className="si-column">{children}</div>
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
    </div>
  );
}
