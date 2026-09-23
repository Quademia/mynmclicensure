// components/shell/public-top-bar.tsx
//
// The public top bar — the signed-out sibling of DS5's `top-bar.tsx`
// (Sam, 2026-09-22), on every public page: the landing page, Premium
// Prep, Packages (/subscribe), the checkout and the confirmation page.
//
// ⚠ IT IS A SERVER COMPONENT, deliberately. The wordmark, the links and
// Sign in are plain markup, so on a phone on a bad connection the bar
// costs no JavaScript — except the hamburger and its menu, which are the
// one client piece (`public-menu.tsx`) and the only part that has to be.
//
// DS21 (Sam, 2026-09-23), on MyNclex's pattern:
//   · the one wordmark both bars draw (`wordmark.tsx`) — the painted Q,
//     the product on top, "by Quademia" beneath;
//   · the links from `lib/nav/public.ts` in a row on a computer, the same
//     list behind the hamburger on a phone;
//   · ONE action, Sign in, on every page and every width. Subscribe and
//     Register Free left the bar: each page's own copy carries them.
//
// Nothing here knows who is signed in, by design (Sam): Dashboard and
// Sign in each land a visitor in the right place through the
// middleware's redirects, so a check would cost a round trip for nothing.

import Link from 'next/link';
import { PUBLIC_LINKS } from '@/lib/nav/public';
import { PublicMenu } from './public-menu';
import { Wordmark } from './wordmark';

export function PublicTopBar({
  product = 'MyNMCLicensure',
}: {
  /** The product line in the wordmark. Matches DS5's `product` prop. */
  product?: string;
}) {
  return (
    <header className="pubbar">
      <Link href="/" className="pubbar-brand" aria-label={`${product} by Quademia — home`}>
        <Wordmark product={product} />
      </Link>

      <nav className="pubbar-links" aria-label="Site">
        {PUBLIC_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="pubbar-link">
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="pubbar-actions">
        <Link href="/login" className="btn btn-outline btn-sm">
          Sign in
        </Link>
        <PublicMenu />
      </div>
    </header>
  );
}
