// components/announcements/announcements-strip.tsx
//
// The dashboard's announcements block (legacy student/dashboard.html
// loadAnnouncements, slice 11b): always visible; the unread ones only
// (no notice row), up to two, pinned expanded and the rest collapsed;
// "N unread" in the header; two empty states — "Nothing from us yet"
// when nothing reaches the student at all, "You're all caught up!"
// when everything has a state; the ✕ marks the item read (legacy
// clearFromStrip) and fades it out; "View all announcements →" with
// the unread count when more than two. The dashboard's server half
// hands in the student's announcements and states; from 7e the block
// sits among the other dashboard cards.

'use client';

import { useState } from 'react';
import { AnnouncementBody } from './announcement-body';
import { recordNoticeState } from '@/lib/announcements/actions';
import type { Announcement, StudentNoticeMap } from '@/lib/announcements/types';

export function AnnouncementsStrip({ announcements, states }: { announcements: Announcement[]; states: StudentNoticeMap }) {
  const [cleared, setCleared] = useState<Record<string, 'fading' | 'gone'>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const unread = announcements.filter((a) => !states[a.announcement_id]);
  const totalUnread = unread.length;
  const toShow = unread.slice(0, 2).filter((a) => cleared[a.announcement_id] !== 'gone');

  function isOpen(a: Announcement): boolean {
    return open[a.announcement_id] ?? Boolean(a.pinned);
  }

  async function clearFromStrip(id: string) {
    const result = await recordNoticeState(id, 'read');
    if (!result.ok) return;
    setCleared((c) => ({ ...c, [id]: 'fading' }));
    window.setTimeout(() => setCleared((c) => ({ ...c, [id]: 'gone' })), 250);
  }

  return (
    <div className="announcements-block">
      <div className="announcements-block-header">
        <span className="announcements-block-title">📢 Announcements</span>
        <span className="announcements-block-count">{totalUnread > 0 ? `${totalUnread} unread` : ''}</span>
      </div>
      <div>
        {announcements.length === 0 ? (
          <div className="announcements-empty">🔔 Nothing from us yet — check back soon.</div>
        ) : unread.length === 0 ? (
          <>
            <div className="announcements-empty">🎉 You&apos;re all caught up!</div>
            <a href="/student/announcements" className="announcements-footer">View all announcements →</a>
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
                    <AnnouncementBody html={a.body_html || a.body_text || ''} className="announcement-item-html" />
                  ) : (
                    <p className="no-content">No content.</p>
                  )}
                  <a href="/student/announcements" className="announcement-read-more">View on announcements page →</a>
                </div>
              </div>
            ))}
            <a href="/student/announcements" className="announcements-footer">
              {totalUnread > 2 ? `View all announcements (${totalUnread} unread) →` : 'View all announcements →'}
            </a>
          </>
        )}
      </div>
    </div>
  );
}
