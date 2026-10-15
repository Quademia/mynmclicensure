// app/(app)/student/phone-check-in.tsx — every signed-in student page
// checks this phone in (07.3; Sam, 2026-10-15). The student layout renders
// it only after the gate has confirmed this device's sign-in, so the page
// itself is the proof: no request of its own (Sam: most students are on
// weak data). It stamps the check-in on a phone holding packs (another
// account's leave first), starts the offline app on a production build,
// and once a day refreshes the phone's copy of the offline screen if packs
// are kept here. Draws nothing. Single-use, so beside its layout.

'use client';

import { useEffect } from 'react';
import { checkInPhone } from '@/lib/offline-packs/phone';
import { registerOfflineApp, warmOfflineApp } from '@/lib/offline-packs/offline-app';

export function PhoneCheckIn({ userId }: { userId: string }) {
  useEffect(() => {
    registerOfflineApp();
    checkInPhone(userId)
      .then((holds) => (holds ? warmOfflineApp() : undefined))
      .catch(() => {
        // a browser keeping no packs: nothing to check in
      });
  }, [userId]);
  return null;
}
