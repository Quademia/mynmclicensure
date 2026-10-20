// app/(app)/student/announcements/news-ask.tsx — the ask at the top of
// Announcements (08.15; Sam, 2026-10-20): Messages' card, the same words
// (one yes brings our replies and important news), shown from this device's
// state rather than after a send — not where it cannot work, when blocked,
// when this device is on already, or within 7 days of Not now (askShape).
// Nothing on the server's first paint: what the device can do is known only
// in the browser. Once Turn on is pressed the card stays for its last line.

'use client';

import { useState, useSyncExternalStore } from 'react';
import { NotifyAsk } from '@/components/notifications/notify-ask';
import { askShape, subscribeNotify, type AskShape } from '@/lib/notifications/client';

export function NewsAsk({ userId, publicKey }: { userId: string; publicKey: string | null }) {
  const live = useSyncExternalStore(subscribeNotify, () => askShape(userId, publicKey), () => null);
  const [held, setHeld] = useState<Exclude<AskShape, null> | null>(null);
  const [closed, setClosed] = useState(false);
  const shape = held ?? live;
  if (closed || !shape || !publicKey) return null;
  return (
    <div className="sann-ask">
      <NotifyAsk shape={shape} userId={userId} publicKey={publicKey} onClose={() => setClosed(true)} onAct={() => setHeld(shape)} />
    </div>
  );
}
