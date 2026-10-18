// components/announcements/announcements-strip.tsx
//
// The dashboard's announcements block (legacy student/dashboard.html
// loadAnnouncements, slice 11b): always visible; the unread ones only
// (no notice row), up to two, pinned expanded and the rest collapsed;
// "N unread" in the header; two empty states — "Nothing from us yet"
// when nothing reaches the student at all, "You're all caught up!"
// when everything has a state; the ✕ dismisses the item (A2, Sam
// 2026-09-18: it had marked it read) and fades it out, the count falling
// and the next unread one taking its place; "View all announcements →"
// with the unread count when more than two. The dashboard's server half
// hands in the student's announcements and states; from 7e the block
// sits among the other dashboard cards. Its redesign is 08.8. A tap on a
// notice's own button counts (Tapped); "View on announcements page"
// opens that notice there (?id=, 08.7); each mark hands the bell and the
// menu row their new number (08.9).

'use client';

import { useState } from 'react';
import { AnnouncementBody } from './announcement-body';
import { recordNoticeState } from '@/lib/announcements/actions';
import type { StudentAnnouncement, StudentNoticeMap } from '@/lib/announcements/types';
import { Icon } from '@/components/shell/icons';
import { AppLink } from '@/components/shell/link-pending';
import { useNewsCount } from '@/components/shell/news-count';

export function AnnouncementsStrip({ announcements, states }: { announcements: StudentAnnouncement[]; states: StudentNoticeMap }) {
  const news = useNewsCount();
  const [cleared, setCleared] = useState<Record<string, 'fading' | 'gone'>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // a tap on a notice's own button counts (Tapped, 08.7) wherever it shows
  function tapped(id: string) {
    recordNoticeState(id, 'clicked')
      .then((r) => {
        if (r.ok) news.set(r.newCount);
      })
      .catch(() => {});
  }

  const unread = announcements.filter((a) => !states[a.announcement_id] && cleared[a.announcement_id] !== 'gone');
  const totalUnread = unread.filter((a) => !cleared[a.announcement_id]).length;
  const toShow = unread.slice(0, 2);

  function isOpen(a: StudentAnnouncement): boolean {
    return open[a.announcement_id] ?? Boolean(a.pinned);
  }

  async function clearFromStrip(id: string) {
    let result;
    try {
      result = await recordNoticeState(id, 'dismissed');
    } catch {
      return; // a dropped connection: the item stays, the ✕ can be pressed again
    }
    if (!result.ok) return;
    news.set(result.newCount);
    setCleared((c) => ({ ...c, [id]: 'fading' }));
    window.setTimeout(() => setCleared((c) => ({ ...c, [id]: 'gone' })), 250);
  }

  return (
    <div className="announcements-block">
      <div className="announcements-block-header">
        <span className="announcements-block-title"><Icon name="megaphone" />Announcements</span>
        <span className="announcements-block-count">{totalUnread > 0 ? `${totalUnread} unread` : ''}</span>
      </div>
      <div>
        {announcements.length === 0 ? (
          <div className="announcements-empty">Nothing from us yet — check back soon.</div>
        ) : unread.length === 0 ? (
          <>
            <div className="announcements-empty">You&apos;re all caught up!</div>
            <AppLink href="/student/announcements" className="announcements-footer">View all announcements →</AppLink>
          </>
        ) : (
          <>
            {toShow.map((a) => (
              <div key={a.announcement_id} className={`announcement-item${a.pinned ? ' pinned' : ''}${cleared[a.announcement_id] === 'fading' ? ' fading' : ''}`}>
                <div className="announcement-item-header" onClick={() => setOpen((o) => ({ ...o, [a.announcement_id]: !isOpen(a) }))}>
                  <div className="announcement-title">{a.title}</div>
                  <div className="announcement-item-actions">
                    {a.dismissible ? (
                      <button type="button" className="announcement-dismiss" title="Dismiss" onClick={(e) => { e.stopPropagation(); void clearFromStrip(a.announcement_id); }}>×</button>
                    ) : null}
                    <button type="button" className={`announcement-expand-btn${isOpen(a) ? ' open' : ''}`} title="Expand" onClick={(e) => { e.stopPropagation(); setOpen((o) => ({ ...o, [a.announcement_id]: !isOpen(a) })); }}>▼</button>
                  </div>
                </div>
                <div className={`announcement-item-body${isOpen(a) ? ' open' : ''}`}>
                  {a.body_html || a.body_text ? (
                    <AnnouncementBody html={a.body_html || a.body_text || ''} className="announcement-item-html" onButtonClick={() => tapped(a.announcement_id)} />
                  ) : (
                    <p className="no-content">No content.</p>
                  )}
                  <AppLink href={`/student/announcements?id=${encodeURIComponent(a.announcement_id)}`} className="announcement-read-more">View on announcements page →</AppLink>
                </div>
              </div>
            ))}
            <AppLink href="/student/announcements" className="announcements-footer">
              {totalUnread > 2 ? `View all announcements (${totalUnread} unread) →` : 'View all announcements →'}
            </AppLink>
          </>
        )}
      </div>
    </div>
  );
}
