// components/announcements/must-see.tsx
//
// The Must-see pop-up (08.8, idea 10; Sam, 2026-10-18 — C): a notice the
// admin ticked Must-see pops up once, on the student's next dashboard,
// one at a time — on the shared dialog with its picture across the top,
// kind · date, the title, the words with their button (a tap counts as
// Tapped) and Close. It is the notice in full, so Seen sets itself as it
// shows; a seen notice never pops up again. Kept rare by the admin: a
// pop-up for everything would teach students to close it unread.

'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@/lib/overlays/shared/dialog';
import { Icon } from '@/components/shell/icons';
import { useNewsCount } from '@/components/shell/news-count';
import { AnnouncementBody } from './announcement-body';
import { markNoticesSeen, recordNoticeState } from '@/lib/announcements/actions';
import { kindIcon, pictureUrl } from '@/lib/announcements/display';
import type { StudentAnnouncement } from '@/lib/announcements/types';

export function MustSee({ notice, date }: { notice: StudentAnnouncement; date: string }) {
  const news = useNewsCount();
  const [open, setOpen] = useState(true);
  const marked = useRef(false);

  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    markNoticesSeen([notice.announcement_id])
      .then((r) => {
        if (r.ok) news.set(r.newCount);
      })
      .catch(() => {});
  }, [notice.announcement_id, news]);

  function tapped() {
    recordNoticeState(notice.announcement_id, 'clicked')
      .then((r) => {
        if (r.ok) news.set(r.newCount);
      })
      .catch(() => {});
  }

  const src = pictureUrl(notice.picture_path, 'full');
  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title={notice.title}
      media={
        // eslint-disable-next-line @next/next/no-img-element -- the opened notice's size, made at upload (08.10)
        src ? <img className="dlg-media" src={src} alt="" /> : undefined
      }
    >
      <p className="mustsee-meta">
        <Icon name={kindIcon(notice.kind_icon)} size={13} />
        {notice.kind}{date ? ` · ${date}` : ''}
      </p>
      <AnnouncementBody html={notice.body_html || notice.body_text || ''} className="mustsee-body" onButtonClick={tapped} />
      <div className="dlg-actions">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Close</button>
      </div>
    </Dialog>
  );
}
