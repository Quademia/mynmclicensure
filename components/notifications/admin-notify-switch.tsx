// components/notifications/admin-notify-switch.tsx — "Notify this device
// when a student writes", at the top of the admin's Messages (08.5b; Sam,
// 2026-10-17, drawn). Per device: on is this device's row carrying
// `student_message`, kept for the sitting by the relink. Turning it on
// asks the browser's Allow (in the tap) the first time; off drops the
// kind. Where notifications cannot work it says why in one grey line
// rather than vanishing (Sam looked for it on the dev server, 2026-10-17):
// the dev server, an iPhone off the Home Screen, a browser without them; a
// browser that blocked them is told so too. The switch is the notification
// places' own (device-switch.tsx; 09.12, one for the whole app, queued).

'use client';

import { useState, useSyncExternalStore } from 'react';
import { Toast } from '@/lib/toast/toast';
import { DeviceSwitch } from './device-switch';
import { keptKindsRaw, parseKinds, pushState, subscribeNotify, turnOff, turnOn, type PushState } from '@/lib/notifications/client';
import { WAITING_WORDS } from '@/lib/notifications/types';
import '@/styles/notifications.css';

function noChange(): () => void {
  return () => {};
}
export function AdminNotifySwitch({ userId, publicKey }: { userId: string; publicKey: string | null }) {
  const raw = useSyncExternalStore(subscribeNotify, () => keptKindsRaw(userId), () => '');
  // the server cannot know what the browser can do: nothing is drawn until it is read
  const state = useSyncExternalStore<PushState | 'unknown'>(noChange, () => pushState(publicKey), () => 'unknown');
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state === 'unknown') return null;
  if (process.env.NODE_ENV !== 'production') {
    return <p className="nask-line nsw-note">Notifications work on the deployed app (and a production build), not on the dev server.</p>;
  }
  if (!publicKey) return <p className="nask-line nsw-note">Notifications are not set up on this site yet.</p>;
  if (state === 'iphone') {
    return <p className="nask-line nsw-note">On iPhone, add the app to your Home Screen to turn on notifications.</p>;
  }
  if (state === 'unsupported') return <p className="nask-line nsw-note">This browser cannot show notifications.</p>;
  if (state === 'denied' || blocked) {
    return <p className="nask-line">Notifications are blocked in this browser. Allow them in its settings to be told when a student writes.</p>;
  }
  const on = state === 'granted' && parseKinds(raw).includes('student_message');

  async function flip() {
    if (!publicKey) return;
    setBusy(true);
    setError(null);
    if (on) {
      if (!(await turnOff(userId, ['student_message']))) setError('Could not turn notifications off. Please check your connection and try again.');
    } else {
      setAsking(true);
      const r = await turnOn(userId, publicKey, ['student_message']);
      setAsking(false);
      if (r === 'denied') setBlocked(true);
      else if (typeof r === 'object') setError(r.error);
    }
    setBusy(false);
  }

  return (
    <div className="card nsw">
      <div className="nask-words">
        <p className="nask-title" id="nsw-label">Notify this device when a student writes</p>
        <p className="nask-sub">{asking ? WAITING_WORDS : 'This device only.'}</p>
      </div>
      <DeviceSwitch on={on} busy={busy} labelledBy="nsw-label" onFlip={() => void flip()} />
      <Toast message={error} onDismiss={() => setError(null)} />
    </div>
  );
}
