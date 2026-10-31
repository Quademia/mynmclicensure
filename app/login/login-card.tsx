// app/login/login-card.tsx
//
// The sign-in card (01.12; 01.16, Sam 2026-10-31). A new device sees
// three equal ways in — Continue with password, Continue with Google,
// Email me a sign-in link (the six-digit code is 01.13). A tap opens that
// way on top (the email and password, or an email box for the link;
// Google starts at once), and under a line, "Other ways to sign in", the
// other two stay in view as buttons (Sam: B, nothing hidden behind a
// link). A device that has signed in before (lib/auth/last-door.ts) opens
// with the way it used last on top, marked Last used; tapping one of the
// other two moves it up, and the last-used way, below, keeps its tag.
// Why: a student unsure of the password sees Google and the emailed link
// before typing a wrong one (Sam: passwords were what sent legacy's
// students to the admin); the returning device pays no extra tap. The
// ways are in the page, so a tap costs no wait.
//
// Three doors: password (a Server Action), Google (the browser Supabase
// client starts it; Supabase returns here), the emailed link (a Server
// Action sends it; the link returns here).
//
// THE RETURN FROM GOOGLE OR THE EMAILED LINK lands on this same page and
// is finished by completeExternalLoginAction. Two link shapes arrive (see
// MyNclex app/reset-password/page.tsx for the why):
//   ?code=…          Google (PKCE). The browser client exchanges it by
//                    itself the moment it is constructed — we only wait.
//   #access_token=…  the emailed link (implicit, see sendMagicLinkAction).
//                    The library refuses this shape under PKCE, so we
//                    call setSession ourselves.
// Either way: the please-wait screen (09.14), a session, the server.
//
// A DROPPED CONNECTION never leaves a button stuck (AGENTS.md): every
// action call is caught and says so. But a sign-in that WORKS also
// "throws" — Next settles an action that redirects by rejecting its call
// with a redirect signal while it moves to /router — so a catch first
// lets Next's own signals through (isNavigation, lib/auth) and keeps
// "Signing in…" up while the page changes.

'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AppLink } from '@/components/shell/link-pending';
import { PleaseWait } from '@/components/shell/please-wait';
import { createClient } from '@/lib/supabase/client';
import { buildFpHash } from '@/lib/auth/fingerprint';
import { isNavigation } from '@/lib/auth/is-navigation';
import type { SignInDoor } from '@/lib/auth/types';
import { Toast } from '@/lib/toast/toast';
import { completeExternalLoginAction, loginAction, sendMagicLinkAction } from './actions';

const NO_SIGN_IN = 'Could not sign in. Please check your connection and try again.';
const NO_LINK = 'Could not send the link. Please check your connection and try again.';
const GENERIC_ERROR = 'Something went wrong during sign-in. Please try again.';

// The ways in, in the order the buttons always take.
const DOORS: readonly SignInDoor[] = ['password', 'google', 'link'];

export function LoginCard({ lastDoor }: { lastDoor: SignInDoor | null }) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [fpHash, setFpHash] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // The way on top: a returning device's last one; none on a new device,
  // which sees the three equal buttons.
  const [main, setMain] = useState<SignInDoor | null>(lastDoor);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  // Set by a tap, so the way it opens takes the focus; a way the page
  // opened by itself does not, or a phone's keyboard would pop up unasked.
  const focusOnOpen = useRef(false);

  const dismiss = useCallback(() => setError(null), []);

  useEffect(() => {
    buildFpHash().then(setFpHash);
  }, []);

  useEffect(() => {
    if (!focusOnOpen.current || main === null || main === 'google') return;
    focusOnOpen.current = false;
    if (main === 'password' && emailInput.current?.value) passwordInput.current?.focus();
    else emailInput.current?.focus();
  }, [main]);

  function open(next: SignInDoor) {
    focusOnOpen.current = true;
    setError(null);
    setMain(next);
  }

  // ── Returning from Google / the emailed link ──────────────────────
  useEffect(() => {
    const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const hashParams = new URLSearchParams(rawHash);
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const code = new URLSearchParams(window.location.search).get('code');
    const isReturn = Boolean((accessToken && refreshToken) || code);
    if (!isReturn) return;

    const via: 'GOOGLE' | 'MAGIC_LINK' =
      hashParams.get('type') === 'magiclink' ? 'MAGIC_LINK' : 'GOOGLE';
    // Deferred a tick: the screen is state set from an effect, and React
    // asks that it not be set synchronously there. ⚠ A broken or expired
    // link fails sooner than that tick (the token is refused before any
    // request), so stopping the wait also cancels a screen not yet shown —
    // else it appeared after the failure and stayed (found 2026-10-30;
    // the old overlay did the same).
    let stopped = false;
    const showWaiting = setTimeout(() => {
      if (!stopped) setWaiting(via === 'GOOGLE' ? 'Signing you in with Google…' : 'Signing you in…');
    }, 0);
    function stopWaiting(message: string) {
      stopped = true;
      clearTimeout(showWaiting);
      // The link's tokens leave the address bar on a failure too.
      window.history.replaceState(null, '', window.location.pathname);
      setWaiting(null);
      setError(message);
    }

    const supabase = createClient();
    let settled = false;
    let unsubscribe: (() => void) | null = null;

    function fail(message: string) {
      if (settled) return;
      settled = true;
      stopWaiting(message);
    }

    async function finish() {
      if (settled) return;
      settled = true;
      window.history.replaceState(null, '', window.location.pathname);
      try {
        const fp = await buildFpHash();
        const result = await completeExternalLoginAction({ via, fpHash: fp });
        // On success the action redirects; only failures come back.
        if (result && !result.ok) stopWaiting(result.error);
      } catch (err) {
        if (isNavigation(err)) return;
        stopWaiting(NO_SIGN_IN);
      }
    }

    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => (error ? fail(GENERIC_ERROR) : finish()))
        .catch(() => fail(NO_SIGN_IN));
    } else {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) void finish();
      });
      unsubscribe = () => sub.subscription.unsubscribe();
      supabase.auth
        .getUser()
        .then(({ data }) => {
          if (data.user) void finish();
        })
        .catch(() => {
          // the deadline below says so
        });
    }

    const deadline = setTimeout(() => fail(GENERIC_ERROR), 10_000);
    return () => {
      clearTimeout(showWaiting);
      clearTimeout(deadline);
      unsubscribe?.();
    };
  }, []);

  // ── Email and password ────────────────────────────────────────────
  // A plain onSubmit, not <form action>: React resets a form's fields
  // after its action returns, and a student whose signal dropped should
  // find the password still typed (AGENTS.md).
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    setSubmitting(true);
    try {
      const result = await loginAction(formData);
      if (result && !result.ok) {
        setError(result.error);
        setSubmitting(false);
      }
    } catch (err) {
      if (isNavigation(err)) return;
      setError(NO_SIGN_IN);
      setSubmitting(false);
    }
  }

  // ── Google ────────────────────────────────────────────────────────
  async function startGoogle() {
    setError(null);
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/login` },
      });
      if (error) setError('Could not start Google sign-in. Please try again.');
    } catch {
      setError('Could not start Google sign-in. Please check your connection and try again.');
    }
  }

  // ── The emailed link ──────────────────────────────────────────────
  // Its own step asks for the email (the same box the password step
  // uses, so an address typed in one carries to the other).
  async function sendLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim();
    if (!value) {
      setError('Please enter your email address to receive a sign-in link.');
      emailInput.current?.focus();
      return;
    }
    setError(null);
    setSending(true);
    try {
      const fd = new FormData();
      fd.set('email', value);
      const result = await sendMagicLinkAction(fd);
      if (result.ok) setSentTo(value);
      else setError(result.error);
    } catch {
      setError(NO_LINK);
    } finally {
      setSending(false);
    }
  }

  const emailField = (
    <div className="si-field">
      <label className="si-label" htmlFor="email">
        Email
      </label>
      <input
        ref={emailInput}
        className="si-input"
        type="email"
        id="email"
        name="email"
        placeholder="you@example.com"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
    </div>
  );

  // One way in as a button: the three on a new device, the other two
  // under the line otherwise. Password and the link open on top; Google
  // starts at once.
  function doorButton(door: SignInDoor) {
    const tag = lastDoor === door ? <LastUsed /> : null;
    if (door === 'google') {
      return (
        <button key={door} type="button" className="btn btn-ghost btn-lg si-alt" onClick={startGoogle}>
          <GoogleMark />
          Continue with Google
          {tag}
        </button>
      );
    }
    return (
      <button key={door} type="button" className="btn btn-ghost btn-lg si-alt" onClick={() => open(door)}>
        {door === 'password' ? <KeyMark /> : <MailMark />}
        {/* Not "…with email and password": that wraps to two lines on a
            phone; the way asks for both. */}
        {door === 'password' ? 'Continue with password' : 'Email me a sign-in link'}
        {tag}
      </button>
    );
  }

  return (
    <>
      <Toast message={error} onDismiss={dismiss} />
      {waiting ? <PleaseWait message={waiting} /> : null}

      {sentTo ? (
        <div className="card si-card si-sent" role="status">
          <h2>Check your email</h2>
          <p>
            If <strong>{sentTo}</strong>{' '}
            has an account here, we&apos;ve sent it a sign-in link. Tap it to sign in. It can take a minute to
            arrive.
          </p>
          <button type="button" className="btn btn-ghost btn-lg si-alt" onClick={() => setSentTo(null)}>
            Back to sign in
          </button>
        </div>
      ) : main === null ? (
        <div className="card si-card">{DOORS.map(doorButton)}</div>
      ) : (
        <div className="card si-card">
          {/* The way on top is the one this device used last: say so. */}
          {main === lastDoor ? <LastUsed /> : null}

          {main === 'password' ? (
            <form className="si-form" method="post" onSubmit={handleSubmit}>
              <input type="hidden" name="fp_hash" value={fpHash ?? ''} />

              {emailField}

              <div className="si-field">
                <div className="si-label-row">
                  <label className="si-label" htmlFor="password">
                    Password
                  </label>
                  <AppLink className="si-forgot" href="/forgot-password">
                    Forgot password?
                  </AppLink>
                </div>
                <input
                  ref={passwordInput}
                  className="si-input"
                  type="password"
                  id="password"
                  name="password"
                  placeholder="Your password"
                  required
                  autoComplete="current-password"
                />
              </div>

              <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          ) : main === 'link' ? (
            <form className="si-form" method="post" onSubmit={sendLink}>
              {emailField}

              <button type="submit" className="btn btn-primary btn-lg" disabled={sending}>
                {sending ? 'Sending…' : 'Email me a sign-in link'}
              </button>
            </form>
          ) : (
            <button type="button" className="btn btn-ghost btn-lg si-alt" onClick={startGoogle}>
              <GoogleMark />
              Continue with Google
            </button>
          )}

          <div className="si-divider">Other ways to sign in</div>

          {DOORS.filter((d) => d !== main).map(doorButton)}
        </div>
      )}
    </>
  );
}

/** On the way this device used last, sitting on the button's top edge. */
function LastUsed() {
  return <span className="badge badge-info si-last">Last used</span>;
}

function KeyMark() {
  return (
    <svg
      className="si-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function MailMark() {
  return (
    <svg
      className="si-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5l8.5 6 8.5-6" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
