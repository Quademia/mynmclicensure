// components/shell/public-top-bar.tsx
//
// The public top bar — the signed-out sibling of DS5's `top-bar.tsx`
// (Sam, 2026-09-22). Extracted from the landing page's own `<nav>`,
// which was the only real public bar in the app: `/premium-prep` had a
// smaller one of its own ("Quademia" plus a sign-in link), and
// `/subscribe` and `/payment-confirmation` had none at all. Four public
// pages, three treatments, none shared.
//
// ⚠ IT IS A SERVER COMPONENT, deliberately. It reads nothing from the
// browser and holds no state, so it ships no JavaScript to a phone on a
// bad connection — and the pages that use it render it around their
// client half rather than from inside it.
//
// THE WORDMARK IS DS5's, not the landing page's. Brand first, product
// bold — "Quademia" muted, the product name heavier — because Sam ruled
// that the order says whose product it is and the weight says which one
// you are in (2026-09-22). The landing page used to add a tagline
// ("MyNMCLicensure · NMC Licensure Prep"); that is marketing copy, and
// it belongs on the landing page's hero rather than in a bar that is
// also shown to someone halfway through paying.
//
// `showSubscribe` exists because the landing page links to /subscribe
// from its bar and a page that IS the subscribe page should not. It
// defaults to off, so a new public page gets the two doors that always
// make sense — sign in, or register.

import Link from 'next/link';

export function PublicTopBar({
  product = 'MyNMCLicensure',
  showSubscribe = false,
}: {
  /** The product line beside the brand. Matches DS5's `product` prop. */
  product?: string;
  /** The landing page's extra "Subscribe" link. Off everywhere else. */
  showSubscribe?: boolean;
}) {
  return (
    <header className="pubbar">
      <Link href="/" className="pubbar-brand" aria-label="Quademia home">
        <span>Quademia</span>
        <b>{product}</b>
      </Link>

      <div className="pubbar-spacer" />

      <nav className="pubbar-actions" aria-label="Account">
        {showSubscribe ? (
          <Link href="/subscribe" className="pubbar-link">
            Subscribe
          </Link>
        ) : null}
        <Link href="/login" className="btn btn-outline btn-sm">
          Sign In
        </Link>
        <Link href="/register" className="btn btn-accent btn-sm">
          Register Free
        </Link>
      </nav>
    </header>
  );
}
