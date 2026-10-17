// components/notifications/notify-ask.tsx — the ask under a student's
// sent message (08.5b; Sam, 2026-10-17, drawn). Shown when a send has just
// gone and the ask can work (lib/notifications/client askAfterSend):
//   card — "Get a notification when we reply", Not now and Turn on; Turn
//     on, then the phone's own Allow (two taps, once); then one grey line,
//     "Notifications on for this phone.", and not shown on that phone
//     again. A Block is told once, in grey.
//   iphone — an iPhone not yet on the Home Screen: "Show me how" opens the
//     install steps (07.3), since an iPhone shows notifications only from
//     there.
// Not now hides it on that phone for 7 days. A failed request keeps the
// card, its words saying so, and Turn on tries again.

'use client';

import { useState } from 'react';
import { InstallAppDialog } from '@/components/install-app/install-app';
import { IconBell } from '@/components/shell/icons';
import { askLater, turnOn, type AskShape } from '@/lib/notifications/client';
import '@/styles/notifications.css';

type Phase = 'ask' | 'working' | 'on' | 'blocked';

export function NotifyAsk({
  shape,
  userId,
  publicKey,
  onClose,
}: {
  shape: Exclude<AskShape, null>;
  userId: string;
  publicKey: string;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('ask');
  const [error, setError] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  if (phase === 'on') return <p className="nask-line">Notifications on for this phone.</p>;
  if (phase === 'blocked') {
    return <p className="nask-line">Notifications are blocked on this phone. You can allow them in your phone&apos;s settings.</p>;
  }

  function later() {
    askLater(userId);
    onClose();
  }

  async function on() {
    setError(null);
    setPhase('working');
    const r = await turnOn(userId, publicKey, 'reply');
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
          <p className="nask-title">{iphone ? 'Want a notification when we reply?' : 'Get a notification when we reply'}</p>
          <p className="nask-sub">{error ?? (iphone ? 'On iPhone, add the app to your Home Screen first.' : 'On this phone, even when the app is closed.')}</p>
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
