// app/(app)/student/dashboard/profile-nudge.tsx — legacy
// student/dashboard.html checkProfileCompletion (slice 7f).
//
// The slim amber strip above the subscription bar, shown only when the
// phone number OR the school is missing. The ✕ hides it for the rest of
// the browser session under legacy's own sessionStorage key; it
// disappears on its own once both fields are filled, because the server
// stops rendering it at all.
//
// Legacy read `users` a second time for the three columns; the gate has
// already handed the page the profile row, so the server decides whether
// to render this and only the dismissal lives here.
//
// sessionStorage is an external store, so it is read through
// useSyncExternalStore rather than an effect: the server snapshot is
// "hidden", which is what legacy's own markup did
// (`style="display:none"` until its script ran), and the browser's
// snapshot takes over after hydration. Reading storage during render
// would make the two paints differ — the hydration mismatch slice 9a
// hit on the confirmation page — and setting state from an effect is
// refused by the React compiler's lint (react-hooks/set-state-in-effect).

'use client';

import { useSyncExternalStore } from 'react';

const HIDDEN_KEY = 'qa_profile_nudge_hidden';

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function isHidden(): boolean {
  try {
    return Boolean(sessionStorage.getItem(HIDDEN_KEY));
  } catch {
    return false; // storage blocked — legacy's catch was non-blocking too
  }
}

/** Nothing is painted until the browser has been asked, as legacy did. */
function hiddenOnServer(): boolean {
  return true;
}

function hide(): void {
  try {
    sessionStorage.setItem(HIDDEN_KEY, '1');
  } catch {
    /* non-blocking, as legacy */
  }
  for (const onChange of listeners) onChange();
}

export function ProfileNudge() {
  const hidden = useSyncExternalStore(subscribe, isHidden, hiddenOnServer);

  if (hidden) return null;

  return (
    <div className="profile-nudge">
      <a className="pn-main" href="/student/profile?complete=1">
        <span className="pn-text">Finish setting up your profile — add your phone &amp; school.</span>
        <span className="pn-cta">Complete &rarr;</span>
      </a>
      <button type="button" className="pn-close" aria-label="Hide for now" onClick={hide}>
        &times;
      </button>
    </div>
  );
}
