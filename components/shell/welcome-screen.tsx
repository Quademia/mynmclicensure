// components/shell/welcome-screen.tsx
//
// The welcome screen (09.15; Sam, 2026-10-19: 1C, navy; placed
// 2026-10-20): the Q, QUADEMIA, MyNMCLicensure and the line beneath on
// navy, on the way in — the installed app's icon and signing in both go
// through /router, which adds ?welcome=1 to the dashboard it sends to;
// the middleware turns that into a header and the signed-in layout
// renders this. A bookmark straight to a page skips it (Sam).
//
// It never adds a wait: it shows only while the first page's grey
// placeholder is on screen and fades as the page replaces it — by the
// stylesheet alone (styles/loading.css), so it goes as soon as the page
// arrives, scripts or not. Once the page is in, this takes it away for
// good (a later move between pages shows the placeholder again, and the
// layout does not redraw) and drops ?welcome from the address, so a
// reload does not greet again.

'use client';

import { useEffect, useState } from 'react';
import '@/styles/loading.css';

const FADE_MS = 300;

// The 192px copy of the Q (18 KB, not the 91 KB original), drawn at 144px.
const MARK_192 = '/images/quademia-mark-192.png';

export function WelcomeScreen() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    let finished = false;
    let timer = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      observer.disconnect();
      const url = new URL(window.location.href);
      if (url.searchParams.has('welcome')) {
        url.searchParams.delete('welcome');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      }
      timer = window.setTimeout(() => setDone(true), FADE_MS);
    };
    const observer = new MutationObserver(() => {
      if (!document.querySelector('.page-loading')) finish();
    });
    if (document.querySelector('.page-loading')) observer.observe(document.body, { childList: true, subtree: true });
    else finish();
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  if (done) return null;
  return (
    <div className="welcome" aria-hidden="true">
      <div className="welcome-top" />
      {/* eslint-disable-next-line @next/next/no-img-element -- a 192px static asset drawn at 144px; next/image adds nothing here */}
      <img className="welcome-mark" src={MARK_192} alt="" width={144} height={144} />
      <div className="welcome-text">
        <span className="welcome-brand">Quademia</span>
        <span className="welcome-name">MyNMCLicensure</span>
        <span className="welcome-tag">NMC Ghana licensure exam prep</span>
      </div>
      <div className="welcome-grow" />
      <div className="welcome-track">
        <span />
      </div>
    </div>
  );
}
