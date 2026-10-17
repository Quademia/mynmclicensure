// components/notifications/notify-relink.tsx — once a sitting, this
// device's notifications follow the same person to their new sign-in
// (08.5b; Sam, 2026-10-17: the week running out keeps a device; a
// sign-out or a bump deletes it). Draws nothing; both layouts carry it. A
// device another person said yes from is left alone — this person gets
// the ask after their next send.

'use client';

import { useEffect } from 'react';
import { relinkOnce } from '@/lib/notifications/client';

export function NotifyRelink({ userId }: { userId: string }) {
  useEffect(() => {
    void relinkOnce(userId);
  }, [userId]);
  return null;
}
