// app/(app)/student/profile/notifications-panel.tsx — Profile's
// Notifications (08.15; Sam, 2026-10-20, drawn), here until an account or
// settings page is built. One main switch, "Notifications on this device"
// (this device's yes: the browser's Allow and its place on our list), with
// each kind beneath it while on — When Quademia replies, Important news.
// Later kinds join as rows, grouped by what the student cares about (a
// Reminders row, not one per feature); optional emails, when they come,
// a "By email" block below in the same pattern.
//
// - Per device, remembered there until changed or signed out (a sign-out
//   takes the device off the list, as 08.5b).
// - Main on: the browser's Allow if not given, then both kinds. Main off:
//   both kinds dropped, the device off the list. Both kinds off reads as
//   main off. On again starts with both.
// - Where it cannot work it says why in one grey line, as the admin's
//   switch does: the dev server, no keys, an iPhone off the Home Screen
//   (Show me how), a browser without them, or blocked (the browser's or
//   device's settings — a page cannot ask again).
// - Nothing on the server's first paint: what the device can do is known
//   only in the browser; while this sitting's kinds are being read back,
//   the switch waits.

'use client';

import { useState, useSyncExternalStore } from 'react';
import { DeviceSwitch } from '@/components/notifications/device-switch';
import { InstallAppDialog } from '@/components/install-app/install-app';
import { Toast } from '@/lib/toast/toast';
import { keptKindsRaw, parseKinds, pushState, subscribeNotify, turnOff, turnOn, type PushState } from '@/lib/notifications/client';
import { STUDENT_KINDS, WAITING_WORDS, type NoticeKind } from '@/lib/notifications/types';
import '@/styles/notifications.css';

const KIND_WORDS: { kind: NoticeKind; label: string; sub: string }[] = [
  { kind: 'reply', label: 'When Quademia replies', sub: 'To your messages' },
  { kind: 'announcement', label: 'Important news', sub: 'Announcements from Quademia' },
];

function noChange(): () => void {
  return () => {};
}

export function NotificationsPanel({ userId, publicKey }: { userId: string; publicKey: string | null }) {
  const raw = useSyncExternalStore(subscribeNotify, () => keptKindsRaw(userId), () => '');
  const state = useSyncExternalStore<PushState | 'unknown'>(noChange, () => pushState(publicKey), () => 'unknown');
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  const kinds = state === 'granted' ? parseKinds(raw) : [];
  const reading = state === 'granted' && !raw; // the layout is reading this sitting's kinds back
  const mainOn = kinds.some((k) => STUDENT_KINDS.includes(k));

  async function change(on: boolean, which: readonly NoticeKind[]) {
    if (!publicKey) return;
    setBusy(true);
    setError(null);
    if (on) {
      setAsking(true);
      const r = await turnOn(userId, publicKey, which);
      setAsking(false);
      if (r === 'denied') setBlocked(true);
      else if (typeof r === 'object') setError(r.error);
    } else if (!(await turnOff(userId, which))) {
      setError('Could not turn notifications off. Please check your connection and try again.');
    }
    setBusy(false);
  }

  let body: React.ReactNode;
  if (state === 'unknown') body = null;
  else if (process.env.NODE_ENV !== 'production') {
    body = <p className="nask-line">Notifications work on the deployed app (and a production build), not on the dev server.</p>;
  } else if (!publicKey) body = <p className="nask-line">Notifications are not set up on this site yet.</p>;
  else if (state === 'iphone') {
    body = (
      <div className="nset-row">
        <p className="nask-line">On iPhone, add the app to your Home Screen to turn on notifications.</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setHowOpen(true)}>
          Show me how
        </button>
        <InstallAppDialog open={howOpen} onClose={() => setHowOpen(false)} />
      </div>
    );
  } else if (state === 'unsupported') body = <p className="nask-line">This browser cannot show notifications.</p>;
  else if (state === 'denied' || blocked) {
    body = <p className="nask-line">Notifications are blocked on this device. You can allow them in your browser or device settings.</p>;
  } else {
    body = (
      <>
        <div className="nset-row">
          <div className="nask-words">
            <p className="nask-title" id="nset-main">Notifications on this device</p>
            <p className="nask-sub">
              {asking ? WAITING_WORDS : mainOn ? 'Each phone or computer is set on its own.' : 'Off. Turn on for our replies and news.'}
            </p>
          </div>
          <DeviceSwitch on={mainOn} busy={busy || reading} labelledBy="nset-main" onFlip={() => void change(!mainOn, STUDENT_KINDS)} />
        </div>
        {mainOn
          ? KIND_WORDS.map((w) => {
              const on = kinds.includes(w.kind);
              return (
                <div className="nset-row nset-kind" key={w.kind}>
                  <div className="nask-words">
                    <p className="nset-label" id={`nset-${w.kind}`}>{w.label}</p>
                    <p className="nask-sub">{w.sub}</p>
                  </div>
                  <DeviceSwitch on={on} busy={busy} labelledBy={`nset-${w.kind}`} onFlip={() => void change(!on, [w.kind])} />
                </div>
              );
            })
          : null}
      </>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Notifications</h2>
      </div>
      <div className="panel-body nset">{body}</div>
      <Toast message={error} onDismiss={() => setError(null)} />
    </div>
  );
}
