// components/announcements/must-see.tsx
//
// The Must-see pop-up (08.8, 08.16; Sam, 2026-10-18). A Must-see notice is
// delivery, and it asks the student to confirm: it pops up on the
// dashboard **until they press "I've read this"** — appearing alone counts
// for nothing (people close a pop-up at once). Several waiting come one
// after another, "1 of 3" at the top (Sam: B), in the list's order;
// confirming one brings the next. **Later** — or Escape, or the backdrop,
// the safe way out — hides them until the student next opens the app
// (lib/announcements/later.ts). On the shared dialog, with the notice's
// picture across the top, kind · date, the words and their button (a tap
// counts as Tapped). Each confirm hands the bell and the menu row their
// new number.

'use client';

import { useState, useSyncExternalStore } from 'react';
import { Dialog } from '@/lib/overlays/shared/dialog';
import { Icon } from '@/components/shell/icons';
import { useNewsCount } from '@/components/shell/news-count';
import { AnnouncementBody } from './announcement-body';
import { confirmNoticeRead, recordNoticeState } from '@/lib/announcements/actions';
import { kindIcon, pictureUrl } from '@/lib/announcements/display';
import { chooseLater, laterChosen, laterSubscribe } from '@/lib/announcements/later';
import type { StudentAnnouncement } from '@/lib/announcements/types';

export function MustSee({
  notices,
  dateOf,
  userId,
}: {
  /** The Must-see notices not yet confirmed, in the list's order. */
  notices: StudentAnnouncement[];
  dateOf: Record<string, string>;
  userId: string;
}) {
  const news = useNewsCount();
  const later = useSyncExternalStore(laterSubscribe, () => laterChosen(userId), () => false);
  const [done, setDone] = useState<Record<string, true>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const waiting = notices.filter((n) => !done[n.announcement_id]);
  const notice = waiting[0] ?? null;
  if (later || !notice) return null;

  const position = notices.length - waiting.length + 1;
  const src = pictureUrl(notice.picture_path, 'full');
  const date = dateOf[notice.announcement_id] ?? '';

  async function confirm(id: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await confirmNoticeRead(id);
      if (!r.ok) return setError(r.error);
      news.set(r.newCount);
      setDone((d) => ({ ...d, [id]: true }));
    } catch {
      setError('Could not save that. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  function tapped(id: string) {
    recordNoticeState(id, 'clicked')
      .then((r) => {
        if (r.ok) news.set(r.newCount);
      })
      .catch(() => {});
  }

  return (
    <Dialog
      open
      wide
      onClose={() => chooseLater(userId)}
      title={notice.title}
      media={
        // eslint-disable-next-line @next/next/no-img-element -- the opened notice's size, made at upload (08.10)
        src ? <img className="dlg-media" src={src} alt="" /> : undefined
      }
    >
      <p className="mustsee-meta">
        <Icon name={kindIcon(notice.kind_icon)} size={13} />
        {notice.kind}{date ? ` · ${date}` : ''}
        {notices.length > 1 ? <span className="mustsee-count">{position} of {notices.length}</span> : null}
      </p>
      {/* the same dialog stays open from one notice to the next; only its contents change */}
      <AnnouncementBody key={notice.announcement_id} html={notice.body_html || notice.body_text || ''} className="mustsee-body" onButtonClick={() => tapped(notice.announcement_id)} />
      {error ? <p className="dlg-text dlg-problem">{error}</p> : null}
      <div className="dlg-actions">
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => chooseLater(userId)}>Later</button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void confirm(notice.announcement_id)}>
          {busy ? 'Saving…' : "I've read this"}
        </button>
      </div>
    </Dialog>
  );
}
