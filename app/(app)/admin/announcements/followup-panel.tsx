// app/(app)/admin/announcements/followup-panel.tsx
//
// The follow-up on one notice (08.11; Sam, 2026-10-18 — "Yes, as drawn"):
// a side panel opened by a row's Follow-up. Four numbers, each out of who
// the notice reaches today — Reaches today · Seen · Tapped · Dismissed —
// and the students behind each, Not seen yet among them: name, programme,
// subscription kind and last sitting (the last sign-in once 01.6 records
// it). Read in one trip when the panel opens (followup-actions.ts), the
// counting and the tabs done here. A tab shows its first 100 with Show all.
// Only used here.

'use client';

import { useEffect, useState } from 'react';
import { getFollowUp } from '@/lib/announcements/followup-actions';
import { longWhen } from '@/lib/announcements/display';
import type { FollowUpRow } from '@/lib/announcements/types';

type Tab = 'unseen' | 'seen' | 'tapped' | 'dismissed';
const FIRST = 100;
const KIND_WORD: Record<string, string> = { PAID: 'Paid', TRIAL: 'Trial', FREE: 'Free' };

function pct(n: number, of: number): string {
  return of > 0 ? `${Math.round((n / of) * 100)}% of ${of}` : 'reaches no one today';
}

export function FollowUpPanel({
  notice,
  onClose,
}: {
  /** The notice followed up; null when the panel is closed. */
  notice: { announcement_id: string; title: string; when: string } | null;
  onClose: () => void;
}) {
  const open = Boolean(notice);
  return (
    <>
      <div className={`panel-overlay${open ? ' show' : ''}`} onClick={onClose} />
      <div className={`side-panel followup-panel${open ? ' open' : ''}`} aria-hidden={!open}>
        {notice ? <FollowUpBody key={notice.announcement_id} notice={notice} onClose={onClose} /> : null}
      </div>
    </>
  );
}

function FollowUpBody({ notice, onClose }: { notice: { announcement_id: string; title: string; when: string }; onClose: () => void }) {
  const [rows, setRows] = useState<FollowUpRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('unseen');
  const [all, setAll] = useState(false);

  useEffect(() => {
    let stopped = false;
    getFollowUp(notice.announcement_id)
      .then((r) => {
        if (stopped) return;
        if (r.ok) setRows(r.rows);
        else setError(r.error);
      })
      .catch(() => {
        if (!stopped) setError('The follow-up could not be read. Please check your connection.');
      });
    return () => {
      stopped = true;
    };
  }, [notice.announcement_id]);

  const list = rows ?? [];
  const reach = list.filter((r) => r.reached).length;
  const groups: Record<Tab, FollowUpRow[]> = {
    unseen: list.filter((r) => r.reached && !r.seen_at && !r.dismissed_at),
    seen: list.filter((r) => r.seen_at),
    tapped: list.filter((r) => r.tapped_at),
    dismissed: list.filter((r) => r.dismissed_at),
  };
  const dateOf: Record<Tab, (r: FollowUpRow) => string | null> = {
    unseen: () => null,
    seen: (r) => r.seen_at,
    tapped: (r) => r.tapped_at,
    dismissed: (r) => r.dismissed_at,
  };
  const shown = all ? groups[tab] : groups[tab].slice(0, FIRST);
  const tabs: { key: Tab; label: string }[] = [
    { key: 'seen', label: 'Seen' },
    { key: 'tapped', label: 'Tapped' },
    { key: 'dismissed', label: 'Dismissed' },
    { key: 'unseen', label: 'Not seen yet' },
  ];

  return (
    <>
      <div className="panel-header">
        <div>
          <h2>{notice.title}</h2>
          <p>Follow-up{notice.when ? ` · ${notice.when}` : ''}</p>
        </div>
        <button type="button" className="panel-close" aria-label="Close" onClick={onClose}>×</button>
      </div>
      <div className="panel-body">
        {error ? <p className="fu-note">{error}</p> : null}
        {!rows && !error ? <p className="fu-note">Counting…</p> : null}
        {rows ? (
          <>
            <div className="fu-numbers">
              <div className="fu-number"><span className="fu-label">Reaches today</span><span className="fu-value">{reach}</span><span className="fu-sub">students</span></div>
              <div className="fu-number"><span className="fu-label">Seen</span><span className="fu-value">{groups.seen.length}</span><span className="fu-sub">{pct(groups.seen.length, reach)}</span></div>
              <div className="fu-number"><span className="fu-label">Tapped the button</span><span className="fu-value">{groups.tapped.length}</span><span className="fu-sub">{pct(groups.tapped.length, reach)}</span></div>
              <div className="fu-number"><span className="fu-label">Dismissed</span><span className="fu-value">{groups.dismissed.length}</span><span className="fu-sub">{pct(groups.dismissed.length, reach)}</span></div>
            </div>
            <div className="fu-tabs" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  className={`fu-tab${tab === t.key ? ' is-on' : ''}`}
                  onClick={() => {
                    setTab(t.key);
                    setAll(false);
                  }}
                >
                  {t.label} ({groups[t.key].length})
                </button>
              ))}
            </div>
            {shown.length ? (
              <ul className="fu-rows">
                {shown.map((r) => {
                  const when = dateOf[tab](r);
                  return (
                    <li key={r.user_id} className="fu-row">
                      <span className="fu-name">{r.name}{r.reached ? '' : ' · no longer reached'}</span>
                      <span className="fu-meta">
                        {[r.program_id, KIND_WORD[r.sub_kind] ?? r.sub_kind, r.last_sitting ? `last sitting ${longWhen(r.last_sitting)}` : 'no sitting yet'].filter(Boolean).join(' · ')}
                        {when ? ` · ${longWhen(when)}` : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="fu-note">No one here yet.</p>
            )}
            {!all && groups[tab].length > FIRST ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAll(true)}>Show all {groups[tab].length}</button>
            ) : null}
            <p className="form-hint">
              Reaches today: the students the notice&apos;s targeting matches now, whatever its status. Seen counts a notice opened in full; a student no longer reached keeps the marks they made.
            </p>
          </>
        ) : null}
      </div>
    </>
  );
}
