// app/(app)/student/offline-packs/install-line.tsx — the install line on My
// packs (07.3; Sam, 2026-10-15: one quiet line). Most students will not
// know a website can become an app, and only the installed app opens with
// no signal for sure (an iPhone clears a website's saved data after about
// a week unused). Chrome's offer gives an Install button; an iPhone has
// no offer, so the line says the two taps. Nothing when the app is already
// installed, or the browser offers neither. Single-use, so beside its page.

'use client';

import { installApp, useInstallWay } from '@/lib/offline-packs/offline-app';

export function InstallLine() {
  const way = useInstallWay();
  if (way === 'none') return null;
  return (
    <p className="opk-install">
      {way === 'offer' ? (
        <>
          <span className="pp-line">Install the app to open your packs with no signal.</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void installApp()}>
            Install
          </button>
        </>
      ) : (
        <span className="pp-line">
          Install the app to open your packs with no signal: tap Share, then Add to Home Screen.
        </span>
      )}
    </p>
  );
}
