// app/offline/offline-packs.tsx — the packs on this phone, with no signal
// (07.3; Sam, 2026-10-15, drawn at
// https://claude.ai/artifact/NrEnZUieGVsFmZkZEmjbFm, "My packs · offline").
//
// Everything here comes from the phone (lib/offline-packs/phone): the list
// by course, newest first, each row with its questions and last score; a
// pack's own view with Practise and the two ways; and the offline player,
// whose way out comes back here with no page change, since a link would
// need the network. Past the check-in period the packs are listed but do
// not open: "Connect once to keep using your packs."
//
// The bar always says offline: this page shows only when a page could not
// be reached, and a phone whose data has run out still counts itself
// connected. When it does, the bar adds Try again — a plain link, because
// this page may be an older release's copy and should leave by a whole new
// page, not the app's own moves.

'use client';

import { useState, useSyncExternalStore } from 'react';
import { Wordmark } from '@/components/shell/wordmark';
import { Icon } from '@/components/shell/icons';
import { OfflinePlayer } from '@/components/offline-player/offline-player';
import { Dialog } from '@/lib/overlays/shared/dialog';
import { usePhonePacks, type PhonePack } from '@/lib/offline-packs/phone';
import { PACK_WAYS, type PackWay } from '@/lib/offline-packs/questions';

type View = { at: 'list' } | { at: 'pack'; id: string } | { at: 'play'; id: string; way: PackWay };

function subscribeOnline(fn: () => void): () => void {
  window.addEventListener('online', fn);
  window.addEventListener('offline', fn);
  return () => {
    window.removeEventListener('online', fn);
    window.removeEventListener('offline', fn);
  };
}

function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => false,
  );
}

function questions(n: number): string {
  return `${n} ${n === 1 ? 'question' : 'questions'}`;
}

function lastWords(pack: PhonePack, label: string): string {
  return pack.last ? `${label}: ${pack.last.right} of ${pack.last.total}` : 'Not practised yet';
}

/** The packs grouped by course, in the order the newest pack of each comes. */
function byCourse(packs: PhonePack[]): { title: string; packs: PhonePack[] }[] {
  const groups = new Map<string, { title: string; packs: PhonePack[] }>();
  for (const p of packs) {
    const g = groups.get(p.course_id) ?? { title: p.course_title, packs: [] };
    g.packs.push(p);
    groups.set(p.course_id, g);
  }
  return [...groups.values()];
}

function NoSignalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 8.8a15 15 0 0 1 20 0M5 12.6a10 10 0 0 1 14 0M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M3 3l18 18" />
    </svg>
  );
}

export function OfflinePacks() {
  const phone = usePhonePacks();
  const online = useOnline();
  const [view, setView] = useState<View>({ at: 'list' });
  const [choosing, setChoosing] = useState(false);

  const locked = Boolean(phone?.locked);
  const packs = phone?.packs ?? [];
  const pack = view.at === 'list' ? null : (packs.find((p) => p.pack_id === view.id) ?? null);

  if (view.at === 'play' && pack && !locked) {
    return (
      <OfflinePlayer
        packId={pack.pack_id}
        title={pack.pack_name}
        items={pack.questions}
        way={view.way}
        onExit={() => setView({ at: 'pack', id: pack.pack_id })}
      />
    );
  }

  return (
    <div className="off">
      <header className="off-top">
        <Wordmark />
      </header>

      <div className="off-status" role="status">
        <NoSignalIcon />
        <span>{packs.length && !locked ? "You're offline. Your packs on this phone are ready." : "You're offline."}</span>
        {online ? (
          // a whole new page: this one may be an older release's copy
          <a href="/router" className="btn-link off-open">
            Try again
          </a>
        ) : null}
      </div>

      <main className="pp-page opk off-main">
        {pack ? (
          <>
            <button type="button" className="btn-link pp-back" onClick={() => setView({ at: 'list' })}>
              ‹ My packs
            </button>
            <div className="opk-pack-facts">
              <h1 className="opk-pack-title">{pack.pack_name}</h1>
              <span className="pp-line">
                {pack.course_title} · {questions(pack.question_count)}
              </span>
            </div>
            {locked ? (
              <p className="pp-note">Connect once to keep using your packs.</p>
            ) : (
              <div className="card pp-card">
                <span className="opk-phone">
                  <span className="badge opk-here">On this phone</span>
                  <span className="pp-line">{lastWords(pack, 'Last practice')}</span>
                </span>
                <button type="button" className="btn btn-accent btn-lg" onClick={() => setChoosing(true)}>
                  Practise
                </button>
              </div>
            )}
            <Dialog open={choosing} onClose={() => setChoosing(false)} title={`Practise ${pack.pack_name}`}>
              <p className="dlg-text">Your score shows here only. Nothing is sent to your record.</p>
              <ul className="pp-ways">
                {PACK_WAYS.map((w) => (
                  <li key={w.way} className="pp-way">
                    <div className="pp-way-text">
                      <span className="pp-way-name">{w.name}</span>
                      <span className="pp-way-blurb">{w.blurb}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-accent"
                      onClick={() => {
                        setChoosing(false);
                        setView({ at: 'play', id: pack.pack_id, way: w.way });
                        window.scrollTo({ top: 0 });
                      }}
                    >
                      Start
                    </button>
                  </li>
                ))}
              </ul>
              <div className="dlg-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setChoosing(false)}>
                  Cancel
                </button>
              </div>
            </Dialog>
          </>
        ) : (
          <>
            <h1 className="off-title">My packs</h1>

            {phone === null ? null : !packs.length ? (
              <div className="card pp-card">
                <span className="pp-big">No packs on this phone yet</span>
                <span className="pp-line">When you&apos;re online, open a pack in My packs and tap Save to this phone.</span>
              </div>
            ) : (
              <>
                {locked ? <p className="pp-note">Connect once to keep using your packs.</p> : null}
                {byCourse(packs).map((g) => (
                  <section key={g.title} className="opk-course">
                    <h2 className="opk-title">{g.title}</h2>
                    <ul className="pp-list card opk-list">
                      {g.packs.map((p) => (
                        <li key={p.pack_id}>
                          {locked ? (
                            <div className="pp-row pp-row-locked">
                              <Icon name="lock" className="off-lock" />
                              <span className="pp-row-main">
                                <span className="pp-name">{p.pack_name}</span>
                                <span className="pp-line">Opens again once you connect</span>
                              </span>
                            </div>
                          ) : (
                            <button type="button" className="pp-row off-row" onClick={() => setView({ at: 'pack', id: p.pack_id })}>
                              <span className="pp-row-main">
                                <span className="pp-name">{p.pack_name}</span>
                                <span className="pp-line">
                                  {questions(p.question_count)} · {lastWords(p, 'Last')}
                                </span>
                              </span>
                              <span className="pp-chev" aria-hidden="true">
                                ›
                              </span>
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </>
            )}

            <p className="pp-line">Your other packs, and the rest of the app, open when you&apos;re back online.</p>
          </>
        )}
      </main>
    </div>
  );
}
