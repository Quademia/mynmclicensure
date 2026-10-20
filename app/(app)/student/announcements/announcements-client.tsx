// app/(app)/student/announcements/announcements-client.tsx
//
// The Announcements page (08.7; Sam, 2026-10-18 — drawn and taken on the
// app's own styles). Messages' layout: the list, and the opened notice
// beside it on a computer, in its place on a phone, where "‹
// Announcements" and the phone's back button return to the list (a
// history entry, no server trip, as Messages does).
//
// - The list is the hybrid: the first pinned notice a big card with its
//   picture; the rest rows — the blue dot and bold title while new, the
//   square (the picture's middle, or the kind's icon), the first line, the
//   time, a New badge. One list, no tabs: Mark all as read over the rows;
//   the dismissed ones folded at the foot.
// - Opened: the picture across the top, kind · date, the title, the
//   words with their button, Ask about this (the Message us box, the
//   notice named in the draft) and Dismiss where it is allowed.
// - On a computer the newest notice opens by itself; the address's notice
//   (?id=, from the dashboard or a device notice) opens on any screen.
// - **Seen sets itself** when a notice shows in full — opened here, or the
//   newest on a computer — one small message after the page has shown,
//   only when the notice is new; a tap on the notice's button counts
//   (Tapped). Each mark brings back the new number for the bell and the
//   menu row (08.9). A failed mark changes nothing on screen.
// - **"I've read this"** (08.16) on a notice that asks to confirm (every
//   Must-see does): Read (confirmed), which stops a Must-see's pop-up;
//   once pressed, the notice says so.
// - **The notifications ask** (08.15) heads the list: our replies and
//   important news on this device, where it can work and is not on yet.
//   A notice sent to this device while the page is open refreshes the list.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shell/page-header';
import { Icon } from '@/components/shell/icons';
import { useNewsCount } from '@/components/shell/news-count';
import { AnnouncementBody } from '@/components/announcements/announcement-body';
import { MessageUsDialog } from '@/components/messages/message-us';
import { Toast } from '@/lib/toast/toast';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { confirmNoticeRead, markNoticesSeen, recordNoticeState } from '@/lib/announcements/actions';
import { isNew, kindIcon, pictureUrl } from '@/lib/announcements/display';
import type { StudentAnnouncement } from '@/lib/announcements/types';
import { NewsAsk } from './news-ask';

/** A notice with the words the server worked out for it. */
export type NoticeItem = StudentAnnouncement & { when: string; date: string; line: string };

type Marks = Record<string, { seen?: true; tapped?: true; dismissed?: true; confirmed?: true }>;

function isComputer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 769px)').matches;
}

function timeOf(a: NoticeItem): number {
  const t = Date.parse(a.start_at || a.created_at || '');
  return Number.isNaN(t) ? 0 : t;
}

export function AnnouncementsClient({
  items,
  openId: askedId,
  notify,
}: {
  items: NoticeItem[];
  openId: string | null;
  /** The notifications ask at the top (08.15). */
  notify: { userId: string; publicKey: string | null } | null;
}) {
  const news = useNewsCount();
  const [marks, setMarks] = useState<Marks>({});
  const [openId, setOpenId] = useState<string | null>(askedId);
  const [showDismissed, setShowDismissed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const dismissError = useCallback(() => setError(null), []);
  const marking = useRef(new Set<string>());

  // a notice sent to this device while the page is open: the list asks the
  // server again (08.15; public/sw.js says 'notice-arrived'); what is open
  // stays open
  const router = useRouter();
  useEffect(() => {
    const onWorker = (e: MessageEvent) => {
      if (e.data?.type === 'notice-arrived') router.refresh();
    };
    navigator.serviceWorker?.addEventListener('message', onWorker);
    navigator.serviceWorker?.startMessages?.();
    return () => navigator.serviceWorker?.removeEventListener('message', onWorker);
  }, [router]);

  // the notices with this visit's marks laid over
  const all = items.map((a) => {
    const m = marks[a.announcement_id];
    if (!m) return a;
    const at = 'now';
    return {
      ...a,
      seen_at: a.seen_at || (m.seen || m.tapped || m.confirmed ? at : null),
      tapped_at: a.tapped_at || (m.tapped ? at : null),
      dismissed_at: a.dismissed_at || (m.dismissed ? at : null),
      confirmed_at: a.confirmed_at || (m.confirmed ? at : null),
    };
  });
  const live = all.filter((a) => !a.dismissed_at);
  const dismissed = all.filter((a) => a.dismissed_at);
  const hero = live.find((a) => a.pinned) ?? null;
  const rows = live.filter((a) => a !== hero);
  const newest = [...live].sort((x, y) => timeOf(y) - timeOf(x))[0] ?? null;
  const newCount = live.filter(isNew).length;

  // the notice in the reading pane: the one opened, else the newest (shown
  // only on a computer; a phone shows the list until a notice is opened)
  const shownId = openId ?? newest?.announcement_id ?? null;
  const shown = all.find((a) => a.announcement_id === shownId) ?? null;

  const lay = useCallback((ids: string[], mark: 'seen' | 'tapped' | 'dismissed' | 'confirmed') => {
    setMarks((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = { ...next[id], [mark]: true };
      return next;
    });
  }, []);

  // Seen sets itself when the notice is on screen in full.
  const shownNew = shown ? isNew(shown) : false;
  useEffect(() => {
    if (!shownId || !shownNew || marking.current.has(shownId)) return;
    if (openId === null && !isComputer()) return; // a phone's list: nothing open yet
    const id = shownId;
    marking.current.add(id);
    markNoticesSeen([id])
      .then((r) => {
        if (r.ok) {
          lay([id], 'seen');
          news.set(r.newCount);
        }
      })
      .catch(() => {})
      .finally(() => marking.current.delete(id));
  }, [shownId, shownNew, openId, lay, news]);

  // The phone's back button returns to the list.
  useEffect(() => {
    function onPop() {
      if (!window.history.state?.sann) setOpenId(null);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function open(id: string) {
    if (!isComputer() && !window.history.state?.sann) {
      window.history.pushState({ sann: id }, '');
      window.scrollTo(0, 0);
    }
    setOpenId(id);
  }

  function back() {
    if (window.history.state?.sann) window.history.back();
    else setOpenId(null);
  }

  async function markAll() {
    const ids = live.filter(isNew).map((a) => a.announcement_id);
    if (!ids.length) return;
    try {
      const r = await markNoticesSeen(ids);
      if (!r.ok) return setError(r.error);
      lay(ids, 'seen');
      news.set(r.newCount);
    } catch {
      setError('Could not mark them. Please check your connection.');
    }
  }

  async function dismiss(id: string) {
    try {
      const r = await recordNoticeState(id, 'dismissed');
      if (!r.ok) return setError(r.error);
      lay([id], 'dismissed');
      news.set(r.newCount);
      if (openId === id) {
        if (window.history.state?.sann) window.history.back();
        setOpenId(null);
      }
    } catch {
      setError('Could not dismiss it. Please check your connection.');
    }
  }

  // "I've read this" (08.16): on a notice that asks to confirm
  async function confirmRead(id: string) {
    setConfirming(true);
    try {
      const r = await confirmNoticeRead(id);
      if (!r.ok) return setError(r.error);
      lay([id], 'confirmed');
      news.set(r.newCount);
    } catch {
      setError('Could not save that. Please check your connection.');
    } finally {
      setConfirming(false);
    }
  }

  function tapped(id: string) {
    lay([id], 'tapped');
    recordNoticeState(id, 'clicked')
      .then((r) => {
        if (r.ok) news.set(r.newCount);
      })
      .catch(() => {});
  }

  const picture = (a: NoticeItem, size: 'list' | 'full') => pictureUrl(a.picture_path, size);

  function row(a: NoticeItem, faded = false) {
    const fresh = isNew(a);
    const src = picture(a, 'list');
    return (
      <li key={a.announcement_id}>
        <button
          type="button"
          className={`sann-row${fresh ? ' is-new' : ''}${a.announcement_id === shownId ? ' is-on' : ''}${faded ? ' is-faded' : ''}`}
          onClick={() => open(a.announcement_id)}
        >
          <span className="sann-dot" aria-hidden="true" />
          <span className="sann-tile" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- a ~10 KB square made at upload (08.10) */}
            {src ? <img src={src} alt="" loading="lazy" /> : <Icon name={kindIcon(a.kind_icon)} size={20} />}
          </span>
          <span className="sann-row-main">
            <span className="sann-row-title">
              {a.pinned ? <Icon name="flag" size={12} className="sann-pin" /> : null}
              {a.title}
            </span>
            {a.line ? <span className="sann-row-sub">{a.line}</span> : null}
          </span>
          <span className="sann-row-end">
            <span className="sann-when">{a.when}</span>
            {fresh ? <span className="badge badge-info">New</span> : null}
          </span>
        </button>
      </li>
    );
  }

  return (
    <>
      <PageHeader title="Announcements" subtitle={newCount ? `${newCount} new · news and notices from Quademia` : 'News and notices from Quademia'} />

      <div className={`sann${openId ? ' sann-open' : ''}`}>
        <div className="sann-grid">
          <section className="sann-list" aria-label="Announcements">
            {notify ? <NewsAsk userId={notify.userId} publicKey={notify.publicKey} /> : null}
            {hero ? (
              <button
                type="button"
                className={`card sann-hero${hero.announcement_id === shownId ? ' is-on' : ''}`}
                onClick={() => open(hero.announcement_id)}
              >
                {picture(hero, 'full') ? (
                  // eslint-disable-next-line @next/next/no-img-element -- the opened notice's size, made at upload (08.10)
                  <img className="sann-hero-pic" src={picture(hero, 'full')!} alt="" />
                ) : null}
                <span className="sann-hero-body">
                  <span className="sann-meta">
                    {isNew(hero) ? <span className="sann-dot is-new" aria-hidden="true" /> : null}
                    <Icon name={kindIcon(hero.kind_icon)} size={13} />
                    Pinned · {hero.kind} · {hero.when}
                    {isNew(hero) ? <span className="badge badge-info sann-hero-badge">New</span> : null}
                  </span>
                  <span className="sann-hero-title">{hero.title}</span>
                  {hero.line ? <span className={`sann-hero-sub${isNew(hero) ? ' is-new' : ''}`}>{hero.line}</span> : null}
                </span>
              </button>
            ) : null}

            {rows.length ? (
              <>
                <div className="sann-listhead">
                  <h2 className="sann-head">Latest</h2>
                  {newCount ? (
                    <button type="button" className="btn-link" onClick={() => void markAll()}>Mark all as read</button>
                  ) : null}
                </div>
                <ul className="card sann-rows">{rows.map((a) => row(a))}</ul>
              </>
            ) : !hero ? (
              <p className="card sann-empty">Nothing from Quademia yet. News and notices will show here.</p>
            ) : null}

            {dismissed.length ? (
              <>
                <button type="button" className="btn-link sann-foot" aria-expanded={showDismissed} onClick={() => setShowDismissed((s) => !s)}>
                  Dismissed ({dismissed.length}) {showDismissed ? '‹' : '›'}
                </button>
                {showDismissed ? <ul className="card sann-rows">{dismissed.map((a) => row(a, true))}</ul> : null}
              </>
            ) : null}
          </section>

          <section className="card sann-pane" aria-label="Announcement">
            {shown ? (
              <>
                <div className="sann-pane-head">
                  <button type="button" className="sann-back" onClick={back}>‹ Announcements</button>
                </div>
                <div className="sann-pane-scroll">
                  {picture(shown, 'full') ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the opened notice's size, made at upload (08.10)
                    <img className="sann-cover" src={picture(shown, 'full')!} alt="" />
                  ) : null}
                  <div className="sann-read">
                    <p className="sann-meta">
                      <Icon name={kindIcon(shown.kind_icon)} size={13} />
                      {shown.kind}{shown.date ? ` · ${shown.date}` : ''}
                    </p>
                    <h2 className="sann-title">{shown.title}</h2>
                    <AnnouncementBody doc={shown.body} className="sann-body" onButtonClick={() => tapped(shown.announcement_id)} />
                    {shown.ask_confirm ? (
                      shown.confirmed_at ? (
                        <p className="sann-confirmed"><Icon name="check-circle" size={14} />You confirmed you read this.</p>
                      ) : (
                        <div className="sann-confirm">
                          <button type="button" className="btn btn-primary" disabled={confirming} onClick={() => void confirmRead(shown.announcement_id)}>
                            {confirming ? 'Saving…' : "I've read this"}
                          </button>
                          <span className="sann-confirm-hint">Quademia asks you to confirm you have read this.</span>
                        </div>
                      )
                    ) : null}
                    <div className="sann-actions">
                      <button type="button" className="btn-link" onClick={() => setAsking(true)}>
                        <Icon name="message" size={14} />Ask about this
                      </button>
                      {shown.dismissible && !shown.dismissed_at ? (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void dismiss(shown.announcement_id)}>Dismiss</button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="sann-pick">Choose a notice to read it.</p>
            )}
          </section>
        </div>
      </div>

      {shown ? (
        <MessageUsDialog
          key={shown.announcement_id}
          open={asking}
          onClose={() => setAsking(false)}
          label="other"
          draft={`About the announcement "${shown.title}": `}
        />
      ) : null}
      <BodyPortal>
        <Toast message={error} onDismiss={dismissError} />
      </BodyPortal>
    </>
  );
}
