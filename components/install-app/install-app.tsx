// components/install-app/install-app.tsx — how to install the app on your
// phone (07.3; Sam, 2026-10-15: option 2). Putting MyNMCLicensure on the
// home screen is worth doing on its own — one tap to open it, like any app
// — and it is also what opens the packs saved to the phone with no signal.
//
//   - InstallAppDialog: the app's dialog with that phone's normal Add to
//     Home screen steps (Android in Chrome, iPhone in Safari; both on any
//     other device). No Install button: on Android it builds a small app
//     through Google, which Sam's phone blocked as unsafe; the home-screen
//     shortcut opens offline just the same.
//   - InstallAppLine: one quiet line, "How to install the app on your phone
//     for easy access ›", that opens the dialog — on the Dashboard with a ×
//     (remembered on this phone for this student, for good), on My packs
//     without. Phones only, and gone once the app is on the home screen.
//   - The account menu's "Install the app" row opens the same dialog
//     (components/shell/top-bar.tsx).

'use client';

import { useState, useSyncExternalStore } from 'react';
import { Dialog } from '@/lib/overlays/shared/dialog';
import { useInstallWay } from '@/lib/offline-packs/offline-app';
import '@/styles/install-app.css';

const STEPS = {
  android: ['Open this page in Chrome.', 'Tap ⋮ at the top right.', 'Tap Add to Home screen.', 'Tap Add.'],
  iphone: ['Open this page in Safari.', 'Tap Share (the square with the arrow).', 'Tap Add to Home Screen.', 'Tap Add.'],
} as const;

export function InstallAppDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const way = useInstallWay();
  const phones = way === 'none' ? (['android', 'iphone'] as const) : ([way] as const);
  return (
    <Dialog open={open} onClose={onClose} title="How to install the app on your phone">
      {phones.map((phone) => (
        <div key={phone}>
          {phones.length > 1 ? <p className="dlg-text install-phone">{phone === 'android' ? 'On Android' : 'On an iPhone'}</p> : null}
          <ol className="install-steps">
            {STEPS[phone].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ))}
      <p className="dlg-text">Then open MyNMCLicensure from its icon, like any app. Packs you save to this phone open there, even with no signal.</p>
      <div className="dlg-actions">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Dialog>
  );
}

// ── The Dashboard's ×, kept per student on this phone ─────────────────
const HIDDEN_KEY = 'quademia-install-hidden';
const hiddenListeners = new Set<() => void>();

function subscribeHidden(fn: () => void): () => void {
  hiddenListeners.add(fn);
  return () => {
    hiddenListeners.delete(fn);
  };
}

function readHidden(userId: string): boolean {
  try {
    return localStorage.getItem(`${HIDDEN_KEY}:${userId}`) === '1';
  } catch {
    return false;
  }
}

function hideFor(userId: string): void {
  try {
    localStorage.setItem(`${HIDDEN_KEY}:${userId}`, '1');
  } catch {
    // shown again next time
  }
  for (const fn of hiddenListeners) fn();
}

export function InstallAppLine({ closeFor }: { /** The student whose × hides it (the Dashboard); none = no ×. */ closeFor?: string }) {
  const way = useInstallWay();
  const hidden = useSyncExternalStore(
    subscribeHidden,
    () => (closeFor ? readHidden(closeFor) : false),
    () => true,
  );
  const [open, setOpen] = useState(false);
  if (way === 'none' || hidden) return null;
  return (
    <div className="install-line">
      <button type="button" className="install-open" onClick={() => setOpen(true)}>
        How to install the app on your phone for easy access <span aria-hidden="true">›</span>
      </button>
      {closeFor ? (
        <button type="button" className="install-close" aria-label="Hide this" onClick={() => hideFor(closeFor)}>
          &times;
        </button>
      ) : null}
      <InstallAppDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
