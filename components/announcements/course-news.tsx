// components/announcements/course-news.tsx
//
// A course page's news (04.9; 08.1, 08.7 — Sam, 2026-10-18): the
// course's two newest notices, each in full, so Seen sets itself for the
// new ones — one small message after the page has shown — and a tap on a
// notice's button counts (Tapped). Each mark hands the bell and the menu
// row their new number (08.9). A failed mark changes nothing on screen.

'use client';

import { useEffect, useRef } from 'react';
import { AnnouncementBody } from './announcement-body';
import { useNewsCount } from '@/components/shell/news-count';
import { markNoticesSeen, recordNoticeState } from '@/lib/announcements/actions';
import { isNew } from '@/lib/announcements/display';
import type { StudentAnnouncement } from '@/lib/announcements/types';

export function CourseNews({ news, dayOf }: { news: StudentAnnouncement[]; dayOf: Record<string, string> }) {
  const count = useNewsCount();
  const sent = useRef(false);
  const fresh = news.filter(isNew).map((a) => a.announcement_id).join(',');

  useEffect(() => {
    if (!fresh || sent.current) return;
    sent.current = true;
    markNoticesSeen(fresh.split(','))
      .then((r) => {
        if (r.ok) count.set(r.newCount);
      })
      .catch(() => {});
  }, [fresh, count]);

  function tapped(id: string) {
    recordNoticeState(id, 'clicked')
      .then((r) => {
        if (r.ok) count.set(r.newCount);
      })
      .catch(() => {});
  }

  return (
    <>
      {news.map((a) => (
        <div key={a.announcement_id} className="cp-news-item">
          <span className="cp-name">{a.title}</span>
          <AnnouncementBody doc={a.body} className="cp-news-body" onButtonClick={() => tapped(a.announcement_id)} />
          {dayOf[a.announcement_id] ? <span className="cp-line">{dayOf[a.announcement_id]}</span> : null}
        </div>
      ))}
    </>
  );
}
