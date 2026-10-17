// components/notifications/admin-notify-switch.tsx — "Notify this device
// when a student writes", at the top of the admin's Messages (08.5b; Sam,
// 2026-10-17, drawn). Per device: on is this device's row carrying
// `student_message`, kept for the sitting by the relink. Turning it on
// asks the browser's Allow (in the tap) the first time; off drops the
// kind. Not drawn where notifications cannot work (the dev server, no
// keys, a browser without them); a browser that blocked them is told so
// in grey. The design system has no switch (09: a shared one offered),
// so this one is drawn here on tokens.

'use client';

import { useState, useSyncExternalStore } from 'react';
import { Toast } from '@/lib/toast/toast';
import { keptKindsRaw, parseKinds, pushState, subscribeNotify, turnOff, turnOn, type PushState } from '@/lib/notifications/client';
import '@/styles/notifications.css';

function noChange(): () => void {
  return () => {};
}

export function AdminNotifySwitch({ userId, publicKey }: { userId: string; publicKey: string | null }) {
  const raw = useSyncExternalStore(subscribeNotify, () => keptKindsRaw(userId), () => '');
  const state = useSyncExternalStore<PushState>(noChange, () => pushState(publicKey), () => 'unsupported');
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state === 'unsupported' || state === 'iphone' || !publicKey) return null;
  if (state === 'denied' || blocked) {
    return <p className="nask-line">Notifications are blocked in this browser. Allow them in its settings to be told when a student writes.</p>;
  }
  const on = state === 'granted' && parseKinds(raw).includes('student_message');

  async function flip() {
    if (!publicKey) return;
    setBusy(true);
    setError(null);
    if (on) {
      if (!(await turnOff(userId, 'student_message'))) setError('Could not turn notifications off. Please check your connection and try again.');
    } else {
      const r = await turnOn(userId, publicKey, 'student_message');
      if (r === 'denied') setBlocked(true);
      else if (typeof r === 'object') setError(r.error);
    }
    setBusy(false);
  }

  return (
    <div className="card nsw">
      <div className="nask-words">
        <p className="nask-title" id="nsw-label">Notify this device when a student writes</p>
        <p className="nask-sub">This phone or computer only.</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="nsw-label"
        className={`nsw-switch${on ? ' on' : ''}`}
        onClick={flip}
        disabled={busy}
      >
        <span className="nsw-knob" />
      </button>
      <Toast message={error} onDismiss={() => setError(null)} />
    </div>
  );
}
