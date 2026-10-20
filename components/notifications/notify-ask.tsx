// components/notifications/notify-ask.tsx — a student's ask (08.5b; Sam,
// 2026-10-17, drawn), under a sent message on Messages and, since 08.15
// (Sam, 2026-10-20), at the top of Announcements. One yes covers both of a
// student's kinds, so both places say both. Shown when the ask can work
// (lib/notifications/client askShape):
//   card — "Get notifications from Quademia", Not now and Turn on; Turn
//     on, then the browser's own Allow (two taps, once); then one grey
//     line, "Notifications on for this device", pointing to Profile, where
//     each kind has its switch; not shown on that device again. A Block is
//     told once, in grey.
//   iphone — an iPhone not yet on the Home Screen: "Show me how" opens the
//     install steps (07.3), since an iPhone shows notifications only from
//     there.
// Not now hides it on that device for 7 days, in both places. A failed
// request keeps the card, its words saying so, and Turn on tries again.

'use client';

import { useState } from 'react';
import { InstallAppDialog } from '@/components/install-app/install-app';
import { AppLink } from '@/components/shell/link-pending';
import { STUDENT_KINDS, WAITING_WORDS } from '@/lib/notifications/types';
import { IconBell } from '@/components/shell/icons';
import { askLater, turnOn, type AskShape } from '@/lib/notifications/client';
import '@/styles/notifications.css';

type Phase = 'ask' | 'working' | 'on' | 'blocked';

export function NotifyAsk({
  shape,
  userId,
  publicKey,
  onClose,
  onAct,
}: {
  shape: Exclude<AskShape, null>;
  userId: string;
  publicKey: string;
  onClose: () => void;
  /** Turn on was pressed: a place that shows the card from the device's state keeps it for its last line. */
  onAct?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('ask');
  const [error, setError] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  if (phase === 'on') {
    return (
      <p className="nask-line">
        Notifications on for this device. Change them any time on your <AppLink href="/student/profile">Profile</AppLink>.
      </p>
    );
  }
  if (phase === 'blocked') {
    return <p className="nask-line">Notifications are blocked on this device. You can allow them in your browser or device settings.</p>;
  }

  function later() {
    askLater(userId);
    onClose();
  }

  async function on() {
    onAct?.();
    setError(null);
    setPhase('working');
    const r = await turnOn(userId, publicKey, STUDENT_KINDS);
    if (r === 'on') setPhase('on');
    else if (r === 'denied') setPhase('blocked');
    else if (r === 'dismissed') setPhase('ask');
    else {
      setError(r.error);
      setPhase('ask');
    }
  }

  const iphone = shape === 'iphone';
  return (
    <div className="card nask" role="group" aria-label="Notifications">
      <div className="nask-row">
        <span className="nask-icon" aria-hidden="true">
          <IconBell />
        </span>
        <div className="nask-words">
          <p className="nask-title">{iphone ? 'Want notifications from Quademia?' : 'Get notifications from Quademia'}</p>
          <p className="nask-sub">
            {error ??
              (iphone
                ? 'Our replies and important news. On iPhone, add the app to your Home Screen first.'
                : phase === 'working'
                  ? WAITING_WORDS
                  : 'Our replies and important news, on this device, even when the app is closed.')}
          </p>
        </div>
      </div>
      <div className="nask-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={later} disabled={phase === 'working'}>
          Not now
        </button>
        {iphone ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setHowOpen(true)}>
            Show me how
          </button>
        ) : (
          <button type="button" className="btn btn-outline btn-sm" onClick={on} disabled={phase === 'working'}>
            {phase === 'working' ? 'Turning on…' : 'Turn on'}
          </button>
        )}
      </div>
      {iphone ? <InstallAppDialog open={howOpen} onClose={() => setHowOpen(false)} /> : null}
    </div>
  );
}
