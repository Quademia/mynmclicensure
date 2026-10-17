// components/shell/unread-live.tsx
//
// The Messages badge kept fresh (08.5a; Sam, 2026-10-17). A layout draws
// the number once, on the server, and the shell stays as drawn while the
// student moves between pages (AGENTS.md: a shared layout does not
// redraw), so this holds the number instead:
//
// - a live line while the app is open — the live chat's own kind
//   (Supabase realtime on messages_threads): the student's own
//   conversations, every conversation for an admin. When one changes — a
//   reply, a read stamp, a close — the number is asked again;
// - the number asked again when the app comes back to the screen and when
//   the line reconnects after a drop: a phone cuts the line when the
//   screen locks or the student switches app, and what changed meanwhile
//   never arrives;
// - the count is the database's (recountUnread → badges.ts), never worked
//   out here, so its rule stays in one place. Asks close together run once
//   (a short wait), only the newest answer is kept, and a failed ask keeps
//   the number shown.
//
// The line is not critical: when it cannot connect, the recount on return
// still corrects the number. The top bar and both menus read it with
// useUnread(); a new count from the server (a full load, router.refresh())
// replaces it.

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { recountUnread } from '@/lib/messaging/badge-actions';

const UnreadContext = createContext<number | null>(null);

/** The live unread count — `fallback` outside the shell. */
export function useUnread(fallback = 0): number {
  return useContext(UnreadContext) ?? fallback;
}

/** Asks closer together than this run once. */
const WAIT_MS = 400;

export function UnreadLive({
  initial,
  side,
  userId,
  children,
}: {
  initial: number;
  side: 'student' | 'admin';
  userId: string;
  children: React.ReactNode;
}) {
  const [count, setCount] = useState(initial);

  // A new count from the server replaces the held one (adjust-state-
  // during-render, as the top bar's menu does on a route change).
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setCount(initial);
  }

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    let asked = 0;

    const recount = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        const mine = ++asked;
        try {
          const n = await recountUnread(side);
          if (!stopped && mine === asked && n != null) setCount(n);
        } catch {
          /* a dropped connection: keep the number shown */
        }
      }, WAIT_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') recount();
    };
    document.addEventListener('visibilitychange', onVisible);

    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    // The line must join as the signed-in person: the shell mounts before
    // the browser has loaded the sign-in, and a line joined then is a
    // visitor's, which the conversations' read rule shows nothing
    // (walked 2026-10-17). So the sign-in is read and handed over first.
    const open = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (stopped || !token) return;
        await supabase.realtime.setAuth(token);
        if (stopped) return;
        let joined = false;
        channel = supabase
          .channel(`unread-${side}-${userId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'licensure_gh',
              table: 'messages_threads',
              ...(side === 'student' ? { filter: `user_id=eq.${userId}` } : {}),
            },
            () => recount(),
          )
          .subscribe((status) => {
            if (status !== 'SUBSCRIBED') return;
            if (joined) recount(); // back after a drop
            joined = true;
          });
      } catch {
        /* the line is not critical */
      }
    };
    void open();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [side, userId]);

  return <UnreadContext.Provider value={count}>{children}</UnreadContext.Provider>;
}
