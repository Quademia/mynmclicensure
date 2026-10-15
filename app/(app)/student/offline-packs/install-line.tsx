// app/(app)/student/offline-packs/install-line.tsx — the install line on My
// packs (07.3; Sam, 2026-10-15: one quiet line). Most students will not
// know a website can sit on the home screen, and the icon is the one tap
// to their packs with no signal (an iPhone also clears a website's saved
// data after about a week unused, unless it is on the home screen).
//
// "How?" opens the app's dialog with that phone's own Add to Home screen
// steps — the normal way for Android and iPhone (Sam). No Install button:
// on Android it builds a small app through Google, and Sam's phone blocked
// it as unsafe; the home-screen shortcut opens offline just the same.
// Nothing on a computer, or once the app is on the home screen. Single-use,
// so beside its page.

'use client';

import { useState } from 'react';
import { Dialog } from '@/lib/overlays/shared/dialog';
import { useInstallWay } from '@/lib/offline-packs/offline-app';

const STEPS = {
  android: ['Open this page in Chrome.', 'Tap ⋮ at the top right.', 'Tap Add to Home screen.', 'Tap Add.'],
  iphone: ['Open this page in Safari.', 'Tap Share (the square with the arrow).', 'Tap Add to Home Screen.', 'Tap Add.'],
} as const;

export function InstallLine() {
  const way = useInstallWay();
  const [open, setOpen] = useState(false);
  if (way === 'none') return null;
  return (
    <>
      <p className="opk-install pp-line">
        Keep the app on your home screen to open your packs with no signal.{' '}
        <button type="button" className="btn-link opk-how" onClick={() => setOpen(true)}>
          How?
        </button>
      </p>
      <Dialog open={open} onClose={() => setOpen(false)} title="Keep the app on your home screen">
        <ol className="opk-steps">
          {STEPS[way].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="dlg-text">Then open MyNMCLicensure from its icon. The packs saved to this phone open there, even with no signal.</p>
        <div className="dlg-actions">
          <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      </Dialog>
    </>
  );
}
