// components/announcements/announcement-body.tsx
//
// One notice's words, drawn by the shared renderer (09.13) from the
// editor's document (08.14, 2026-10-19) — on the server with the page, so
// the words arrive with it instead of after its scripts, which the old HTML
// cleaner needed. A click on the notice's Button (`a[data-button]`)
// reports up (Tapped, 08.7). A link to a page inside the app (A4 — a path
// such as /student/mock-exams, picked from the editor's list) opens
// through the app's router, with no full reload, the link marked as
// pressed until the page arrives (a tap is never silent); a web address
// opens a new tab.

'use client';

import { useRouter } from 'next/navigation';
import { RichRender } from '@/components/editor/rich-render';
import { isAppPath } from '@/lib/editor/doc';
import type { RichDoc } from '@/lib/editor/types';

export function AnnouncementBody({
  doc,
  className,
  onButtonClick,
}: {
  doc: RichDoc | null;
  className: string;
  onButtonClick?: () => void;
}) {
  const router = useRouter();
  if (!doc) return null;
  return (
    <div
      className={className}
      onClick={(e) => {
        const target = e.target as HTMLElement | null;
        const link = target?.closest('a') as HTMLAnchorElement | null;
        if (!link) return;
        if (onButtonClick && link.matches('a[data-button]')) onButtonClick();
        const href = link.getAttribute('href') || '';
        if (isAppPath(href) && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
          e.preventDefault();
          link.classList.add('is-pending');
          router.push(href);
        }
      }}
    >
      <RichRender doc={doc} />
    </div>
  );
}
