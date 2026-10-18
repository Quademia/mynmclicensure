// components/announcements/new-from-quademia.tsx
//
// The dashboard's news (08.8; Sam, 2026-10-18 — C, drawn and taken): a
// "New from Quademia" card under the welcome, only while something is new
// (neither seen nor dismissed) — up to two, each a tap into the
// Announcements page on that notice (?id=), its picture's square or its
// kind's icon, the title and the first line in Messages' blue for new; ✕
// dismisses where it is allowed, the next new one taking the place and the
// bell and the menu row their new number (08.9). "See all" leads to the
// page. Nothing new, no card: the old box at the foot went with it. The
// card shows a title and a line, not the notice in full, so it does not
// mark Seen.

'use client';

import { useState } from 'react';
import { Icon } from '@/components/shell/icons';
import { AppLink } from '@/components/shell/link-pending';
import { useNewsCount } from '@/components/shell/news-count';
import { recordNoticeState } from '@/lib/announcements/actions';
import { kindIcon, pictureUrl } from '@/lib/announcements/display';
import type { StudentAnnouncement } from '@/lib/announcements/types';

export type NewsItem = StudentAnnouncement & { line: string };

const HREF = '/student/announcements';

export function NewFromQuademia({ items }: { items: NewsItem[] }) {
  const news = useNewsCount();
  const [gone, setGone] = useState<Record<string, true>>({});
  const left = items.filter((a) => !gone[a.announcement_id]);
  if (!left.length) return null;

  async function dismiss(id: string) {
    try {
      const r = await recordNoticeState(id, 'dismissed');
      if (!r.ok) return;
      news.set(r.newCount);
      setGone((g) => ({ ...g, [id]: true }));
    } catch {
      /* a dropped connection: the row stays and ✕ can be pressed again */
    }
  }

  return (
    <section className="card sd-news" aria-label="New from Quademia">
      <div className="sd-news-head">
        <h2 className="sd-news-title"><Icon name="megaphone" />New from Quademia</h2>
        <AppLink href={HREF} className="btn-link">{left.length > 2 ? `See all (${left.length} new)` : 'See all'}</AppLink>
      </div>
      <ul className="sd-news-rows">
        {left.slice(0, 2).map((a) => {
          const src = pictureUrl(a.picture_path, 'list');
          return (
            <li key={a.announcement_id} className="sd-news-row">
              <AppLink href={`${HREF}?id=${encodeURIComponent(a.announcement_id)}`} className="sd-news-link">
                <span className="sd-news-dot" aria-hidden="true" />
                <span className="sd-news-tile" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element -- the ~10 KB square made at upload (08.10) */}
                  {src ? <img src={src} alt="" loading="lazy" /> : <Icon name={kindIcon(a.kind_icon)} size={20} />}
                </span>
                <span className="sd-news-main">
                  <span className="sd-news-name">{a.title}</span>
                  {a.line ? <span className="sd-news-line">{a.line}</span> : null}
                </span>
              </AppLink>
              {a.dismissible ? (
                <button type="button" className="sd-news-x" aria-label={`Dismiss ${a.title}`} onClick={() => void dismiss(a.announcement_id)}>×</button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
