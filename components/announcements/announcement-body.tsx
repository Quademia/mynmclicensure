// components/announcements/announcement-body.tsx
//
// One announcement body, sanitised at render as every legacy surface
// did (the student page's sanitiseHtml, the dashboard's
// sanitiseBodyHtml): the allow-list keeps paragraphs, emphasis, lists,
// links (href and data-qa, opened in a new tab) and images; anything
// else becomes its text. Client-only because the sanitiser uses the
// browser's DOM; nothing renders until hydration, so the server never
// emits the stored HTML. A click on a `data-qa="btn"` link inside the
// body reports up (the student page records "clicked").

'use client';

import { useSyncExternalStore } from 'react';
import { sanitiseHtml } from '@/lib/announcements/sanitise';

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
        if (onButtonClick && target?.closest('a[data-qa="btn"]')) onButtonClick();
      }}
    />
  );
}
