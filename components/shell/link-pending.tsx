// components/shell/link-pending.tsx
//
// The pressed link (Sam, 2026-09-28, "D"): put inside a next/link <Link>,
// it marks that link while its page is on its way — styles/loading.css
// turns the mark into a spinner in the menu's rows and a breathing link
// anywhere else. Next reports "pending" only until the address changes,
// and skips it altogether when the route was prefetched, because then
// the loading placeholder (page-loading.tsx) shows at once instead. So
// this covers the gap on a slow connection, when the tap lands before
// the placeholder has arrived.
//
// Always rendered, one empty element, so marking a link moves nothing.

'use client';

import Link, { useLinkStatus } from 'next/link';
import '@/styles/loading.css';

export function LinkPending() {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true" className={pending ? 'link-pending is-pending' : 'link-pending'} />;
}

/**
 * A link inside the app, for a place that was a plain <a>: a client-side
 * move (the placeholder shows, the page is not thrown away) with the
 * pressed mark in it. Server Components can render it.
 */
export function AppLink({
  href,
  className,
  title,
  children,
}: {
  href: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className} title={title}>
      {children}
      <LinkPending />
    </Link>
  );
}
