// app/(app)/student/announcements/announcements-client.tsx
//
// The script block of legacy student/announcements.html (slice 11b):
// the subtitle "N announcements · M unread", the four tabs (All shows
// everything but the dismissed; Unread the ones with no state; Read the
// read and clicked; Dismissed the dismissed), the cards (the pinned and
// read badges, the date, the body, Mark as Read for an unread one,
// Dismiss for a dismissible one), a click on a button inside a body
// recording "clicked". Each write goes through recordNoticeState and
// the local state follows, as legacy's did; the card fades on Dismiss
// before it moves to the Dismissed tab.

'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shell/page-header';
import { AnnouncementBody } from '@/components/announcements/announcement-body';
import { recordNoticeState } from '@/lib/announcements/actions';
import type { Announcement, NoticeState, StudentNoticeMap } from '@/lib/announcements/types';

type Tab = 'all' | 'unread' | 'read' | 'dismissed';

const EMPTY: Record<Tab, { icon: string; text: string }> = {
  all: { icon: '📭', text: 'No announcements at the moment.' },
  unread: { icon: '🎉', text: "You're all caught up — no unread announcements." },
  read: { icon: '📭', text: 'No read announcements yet.' },
  dismissed: { icon: '🗑️', text: 'No dismissed announcements.' },
};

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

export function AnnouncementsClient({
  announcements,
  initialStates,
}: {
  announcements: Announcement[];
  initialStates: StudentNoticeMap;
}) {
  const [states, setStates] = useState<StudentNoticeMap>(initialStates);
  const [tab, setTab] = useState<Tab>('all');
  const [busy, setBusy] = useState<Record<string, 'saving' | 'dismissing'>>({});
  const [fading, setFading] = useState<Record<string, boolean>>({});

  const total = announcements.length;
  const unread = announcements.filter((a) => !states[a.announcement_id]).length;

  const visible = announcements.filter((a) => {
    const state = states[a.announcement_id];
    if (tab === 'dismissed') return state === 'dismissed';
    if (tab === 'unread') return !state;
    if (tab === 'read') return state === 'read' || state === 'clicked';
    return state !== 'dismissed';
  });

  async function record(id: string, state: NoticeState) {
    const result = await recordNoticeState(id, state);
    if (!result.ok) console.error('recordState error:', result.error);
  }

  // legacy markRead
  async function markRead(id: string) {
    setBusy((b) => ({ ...b, [id]: 'saving' }));
    await record(id, 'read');
    setStates((s) => ({ ...s, [id]: 'read' }));
    setBusy((b) => {
      const next = { ...b };
      delete next[id];
      return next;
    });
  }

  // legacy dismiss: fade, then move to the Dismissed tab
  async function dismiss(id: string) {
    setBusy((b) => ({ ...b, [id]: 'dismissing' }));
    await record(id, 'dismissed');
    setFading((f) => ({ ...f, [id]: true }));
    window.setTimeout(() => {
      setStates((s) => ({ ...s, [id]: 'dismissed' }));
      setFading((f) => {
        const next = { ...f };
        delete next[id];
        return next;
      });
      setBusy((b) => {
        const next = { ...b };
        delete next[id];
        return next;
      });
    }, 300);
  }

  // legacy: a click on a data-qa="btn" link records "clicked"
  function clicked(id: string) {
    void record(id, 'clicked');
    setStates((s) => (s[id] === 'dismissed' ? s : { ...s, [id]: 'clicked' }));
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'read', label: 'Read' },
    { key: 'dismissed', label: 'Dismissed' },
  ];

  return (
    <>
      <PageHeader title="Announcements" subtitle={`${total} announcement${total !== 1 ? 's' : ''} · ${unread} unread`} />
      <div className="sann">
        <div className="tab-bar">
          {tabs.map((t) => (
            <button key={t.key} type="button" className={`tab-btn${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        <div className="announce-list">
          {!visible.length ? (
            <div className="empty-state">
              <div className="empty-icon">{EMPTY[tab].icon}</div>
              <p>{EMPTY[tab].text}</p>
            </div>
          ) : (
            visible.map((a) => {
              const state = states[a.announcement_id];
              const isRead = state === 'read' || state === 'clicked';
              const b = busy[a.announcement_id];
              return (
                <div
                  key={a.announcement_id}
                  className={`announce-card${a.pinned ? ' pinned' : ''}${isRead ? ' is-read' : ''}${fading[a.announcement_id] ? ' fading' : ''}`}
                >
                  <div className="card-top">
                    <div>
                      <div className="card-title-row">
                        <span className="card-title">{a.title}</span>
                        {a.pinned ? <span className="pin-badge">📌 Pinned</span> : null}
                        {isRead ? <span className="read-badge">✅ Read</span> : null}
                      </div>
                      <div className="card-date">{fmtDate(a.created_at)}</div>
                    </div>
                  </div>
                  <AnnouncementBody html={a.body_html || a.body_text || ''} className="card-body" onButtonClick={() => clicked(a.announcement_id)} />
                  <div className="card-actions">
                    {!isRead ? (
                      <button type="button" className="btn btn-primary" disabled={Boolean(b)} onClick={() => markRead(a.announcement_id)}>
                        {b === 'saving' ? 'Saving…' : '✅ Mark as Read'}
                      </button>
                    ) : null}
                    {a.dismissible ? (
                      <button type="button" className="btn btn-ghost" disabled={Boolean(b)} onClick={() => dismiss(a.announcement_id)}>
                        {b === 'dismissing' ? 'Dismissing…' : '✕ Dismiss'}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
