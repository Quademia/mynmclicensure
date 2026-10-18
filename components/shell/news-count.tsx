// components/shell/news-count.tsx
//
// The number of new notices (08.9; Sam, 2026-10-18): on a computer the
// bell carries it, on a phone the menu's Announcements row and the menu
// button's dot. The student layout draws it once; a shared layout does not
// redraw (AGENTS.md), so this holds it: a page that marks notices hands
// in the number its mark brought back (useNewsCount().set), and the
// number is asked again when the app comes back to the screen — a notice
// published while the student was away. No live line: notices are few,
// and a return to the app is when one matters. The count is the
// database's (lib/announcements/badges.ts), never worked out here; a
// failed ask keeps the number shown.

'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { recountNewNotices } from '@/lib/announcements/badge-actions';

type NewsCount = { count: number; set: (n: number | null) => void };

const NewsCountContext = createContext<NewsCount | null>(null);

/** The new-notice number and its setter — 0 and a no-op outside a student shell. */
export function useNewsCount(): NewsCount {
  return useContext(NewsCountContext) ?? { count: 0, set: () => {} };
}

export function NewsCountLive({ initial, children }: { initial: number; children: React.ReactNode }) {
  const [count, setCount] = useState(initial);

  // A new count from the server (a full load, router.refresh()) replaces it.
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setCount(initial);
  }

  useEffect(() => {
    let stopped = false;
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const n = await recountNewNotices();
        if (!stopped && n != null) setCount(n);
      } catch {
        /* a dropped connection: keep the number shown */
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const value = useMemo<NewsCount>(() => ({ count, set: (n) => { if (n != null) setCount(n); } }), [count]);
  return <NewsCountContext.Provider value={value}>{children}</NewsCountContext.Provider>;
}
