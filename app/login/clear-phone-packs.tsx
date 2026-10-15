// app/login/clear-phone-packs.tsx — a phone signed out, or bumped by a
// sign-in elsewhere, clears the offline packs kept on it (07.3; Sam,
// 2026-10-15). The sign-out route sends such a phone here with
// ?packs=clear (app/logout/route.ts); a sign-in that only ran out its week
// comes without it and keeps them. Draws nothing. Single-use, so beside
// its page.

'use client';

import { useEffect } from 'react';
import { clearPhone } from '@/lib/offline-packs/phone';

export function ClearPhonePacks() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('packs') !== 'clear') return;
    void clearPhone()
      .catch(() => {
        // a browser keeping no packs has none to clear
      })
      .finally(() => {
        params.delete('packs');
        const rest = params.toString();
        window.history.replaceState(null, '', `/login${rest ? `?${rest}` : ''}`);
      });
  }, []);
  return null;
}
