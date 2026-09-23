// lib/nav/public.ts
//
// The public top bar's links as data (AGENTS.md folder convention #4),
// Sam 2026-09-23. ONE list feeds both halves of the bar: the row beside
// the wordmark on a computer, and the menu behind the hamburger on a
// phone — two lists would drift.
//
// Dashboard is shown to everyone, signed in or not, with no check
// (Sam's point): /router is behind the middleware's sign-in wall, so a
// signed-out visitor lands on /login and a signed-in one on their own
// dashboard. Sign in is the bar's button, not a link here; a signed-in
// visitor who taps it is bounced from /login to /router the same way.

export type PublicLink = { href: string; label: string };

export const PUBLIC_LINKS: PublicLink[] = [
  { href: '/', label: 'Home' },
  { href: '/premium-prep', label: 'Premium Prep' },
  { href: '/subscribe', label: 'Packages' },
  { href: '/router', label: 'Dashboard' },
];
