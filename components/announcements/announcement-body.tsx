// components/announcements/announcement-body.tsx
//
// One announcement body, sanitised at render as every legacy surface
// did (lib/announcements/sanitise): the allow-list keeps paragraphs,
// emphasis, lists, links (href and data-qa) and images; anything else
// becomes its text. Client-only because the sanitiser uses the browser's
// DOM; nothing renders until hydration, so the server never emits the
// stored HTML. A click on a `data-qa="btn"` link inside the body reports
// up (Tapped, 08.7). A link to a page inside the app (A4, 2026-10-18 — a
// path such as /student/mock-exams, picked from the editor's list) opens
// through the app's router, with no full reload, the button marked as
// pressed until the page arrives (a tap is never silent); a web address
// opens a new tab.

'use client';

import { useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { sanitiseHtml } from '@/lib/announcements/sanitise';
import { isAppPath } from '@/lib/announcements/app-pages';

const subscribeNever = () => () => {};

export function AnnouncementBody({
  html,
  className,
  onButtonClick,
}: {
  html: string;
  className: string;
  onButtonClick?: () => void;
}) {
  const router = useRouter();
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  if (!mounted) return <div className={className} />;
  const clean = sanitiseHtml(html);
  if (!clean) return null;
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: clean }}
      onClick={(e) => {
        const target = e.target as HTMLElement | null;
        const link = target?.closest('a') as HTMLAnchorElement | null;
        if (!link) return;
        if (onButtonClick && link.matches('a[data-qa="btn"]')) onButtonClick();
        const href = link.getAttribute('href') || '';
        if (isAppPath(href) && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
          e.preventDefault();
          link.classList.add('is-pending');
          router.push(href);
        }
      }}
    />
  );
}
