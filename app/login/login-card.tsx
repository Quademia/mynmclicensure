// app/login/login-card.tsx
//
// The interactive login card — legacy login.html's markup and script,
// one component. Three doors: password (a Server Action), Google (the
// browser Supabase client starts it; Supabase returns here), magic link
// (a Server Action sends it; the emailed link returns here).
//
// THE RETURN FROM GOOGLE OR A MAGIC LINK lands on this same page, as it
// did in legacy, and is finished by completeExternalLoginAction. Two link
// shapes arrive (see MyNclex app/reset-password/page.tsx for the why):
//   ?code=…          Google (PKCE). The browser client exchanges it by
//                    itself the moment it is constructed — we only wait.
//   #access_token=…  the magic link (implicit, see sendMagicLinkAction).
//                    The library refuses this shape under PKCE, so we
//                    call setSession ourselves.
// Either way: show the overlay, get a session, hand off to the server.

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { buildFpHash } from '@/lib/auth/fingerprint';
import { Toast } from '@/lib/toast/toast';
import { completeExternalLoginAction, loginAction, sendMagicLinkAction } from './actions';

export function LoginCard() {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [fpHash, setFpHash] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);

  // Magic-link modal
  const [magicOpen, setMagicOpen] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicEmail, setMagicEmail] = useState('');
  const [magicSending, setMagicSending] = useState(false);
  const magicInput = useRef<HTMLInputElement>(null);

  const dismiss = useCallback(() => setError(null), []);

  useEffect(() => {
    buildFpHash().then(setFpHash);
  }, []);

  // ── Returning from Google / magic link ────────────────────────────
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
    // Deferred a tick, as legacy deferred its own handler (setTimeout 0):
    // the overlay is state set from an effect, and React asks that it not
    // be set synchronously there.
    const showOverlay = setTimeout(
      () => setOverlay(via === 'GOOGLE' ? 'Signing in with Google...' : 'Signing in with magic link...'),
      0
    );

    const supabase = createClient();
    let settled = false;
    let unsubscribe: (() => void) | null = null;

    async function finish() {
      if (settled) return;
      settled = true;
      window.history.replaceState(null, '', window.location.pathname);
      const fp = await buildFpHash();
      const result = await completeExternalLoginAction({ via, fpHash: fp });
      // On success the action redirects; only failures come back.
      if (result && !result.ok) {
        setOverlay(null);
        setError(result.error);
      }
    }

    function fail() {
      if (settled) return;
      settled = true;
      setOverlay(null);
      setError('Something went wrong during sign-in. Please try again.');
    }

    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => (error ? fail() : finish()));
    } else {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) void finish();
      });
      unsubscribe = () => sub.subscription.unsubscribe();
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) void finish();
      });
    }

    const deadline = setTimeout(fail, 10_000);
    return () => {
      clearTimeout(showOverlay);
      clearTimeout(deadline);
      unsubscribe?.();
    };
  }, []);

  // ── Email / password ──────────────────────────────────────────────
  async function handleSubmit(formData: FormData) {
    setError(null);
    setSubmitting(true);
    const result = await loginAction(formData);
    if (result && !result.ok) {
      setError(result.error);
      setSubmitting(false);
    }
  }

  // ── Google ────────────────────────────────────────────────────────
  async function startGoogle() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    });
    if (error) setError('Could not start Google sign-in. Please try again.');
  }

  // ── Magic link ────────────────────────────────────────────────────
  function openMagic() {
    setMagicEmail(email.trim());
    setMagicSent(false);
    setMagicOpen(true);
    setTimeout(() => magicInput.current?.focus(), 0);
  }

  async function sendMagic() {
    const value = magicEmail.trim();
    if (!value) {
      setError('Please enter your email address to receive a sign-in link.');
      return;
    }
    setMagicSending(true);
    const fd = new FormData();
    fd.set('email', value);
    const result = await sendMagicLinkAction(fd);
    setMagicSending(false);
    if (result.ok) setMagicSent(true);
    else setError(result.error);
  }

  return (
    <>
      <Toast message={error} onDismiss={dismiss} />

      <div className={`auth-overlay${overlay ? ' show' : ''}`} aria-hidden={!overlay}>
        <div className="auth-overlay-card">
          <div className="auth-overlay-spinner" />
          <p className="auth-overlay-text">{overlay ?? 'Signing in...'}</p>
        </div>
      </div>

      <div className="qa-card">
        <div className="qa-wordmark">
          <div>
            <div className="qa-wordmark-name">Quademia</div>
            <div className="qa-wordmark-sub">MyNMCLicensure</div>
          </div>
        </div>

        <div className="qa-head">
          <h1 className="qa-h1">Welcome back</h1>
          <p className="qa-sub">Sign in to continue your NMC licensure prep.</p>
        </div>

        <div className="qa-infobox">
          <strong>New here?</strong> You can sign in 3 ways — with your <strong>password</strong>,
          with <strong>Google</strong>, or with a <strong>magic link</strong> emailed to you. Use
          whichever is easiest. Forgot your password? The magic link signs you in without one.
        </div>

        <form action={handleSubmit}>
          <input type="hidden" name="fp_hash" value={fpHash ?? ''} />
          <div className="qa-field">
            <label className="qa-label" htmlFor="email">
              Email address
            </label>
            <input
              className="qa-input"
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

          <div className="qa-field">
            <div className="qa-label-row">
              <label className="qa-label" htmlFor="password">
                Password
              </label>
              <Link className="qa-forgot" href="/forgot-password">
                Forgot password?
              </Link>
            </div>
            <input
              className="qa-input"
              type="password"
              id="password"
              name="password"
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="qa-btn qa-btn-navy qa-submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="qa-divider">or</div>

        <div className="qa-doors">
          <button type="button" className="qa-btn qa-btn-google" onClick={startGoogle}>
            <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true">
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
            Continue with Google
          </button>
          <button type="button" className="qa-btn qa-btn-magic" onClick={openMagic}>
            Email me a magic link
          </button>
        </div>

        <div className="qa-foot">
          <p className="qa-footer">
            Don&apos;t have an account? <Link href="/register">Register here</Link>
          </p>
          <div className="qa-back-wrap">
            <Link className="qa-back" href="/">
              &larr; Back to Home
            </Link>
          </div>
        </div>
      </div>

      {/* Magic-link modal */}
      <div
        className={`qa-modal-scrim${magicOpen ? ' show' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setMagicOpen(false);
        }}
      >
        <div className="qa-modal" role="dialog" aria-modal="true">
          {!magicSent ? (
            <div>
              <div className="qa-modal-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="2.5" y="4.5" width="19" height="15" rx="3" stroke="#2d7d72" strokeWidth="2" />
                  <path
                    d="M3.5 6.5l8.5 6 8.5-6"
                    stroke="#2d7d72"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="qa-modal-title">Sign in without a password</h3>
              <p className="qa-modal-help">Enter your email and we&apos;ll send you a sign-in link.</p>
              <div className="qa-field">
                <label className="qa-label" htmlFor="magicEmail">
                  Email address
                </label>
                <input
                  ref={magicInput}
                  className="qa-input"
                  type="email"
                  id="magicEmail"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={magicEmail}
                  onChange={(e) => setMagicEmail(e.target.value)}
                />
              </div>
              <div className="qa-modal-actions">
                <button type="button" className="qa-btn qa-btn-ghost" onClick={() => setMagicOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="qa-btn qa-btn-navy" onClick={sendMagic} disabled={magicSending}>
                  {magicSending ? 'Sending...' : 'Send link'}
                </button>
              </div>
            </div>
          ) : (
            <div className="qa-sent">
              <div className="qa-sent-icon">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    stroke="#16a34a"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="qa-sent-title">Check your inbox</h3>
              <p className="qa-sent-text">
                Tap the link we sent to <span className="qa-sent-email">{magicEmail || 'your email'}</span> to
                sign in. It may take a minute to arrive.
              </p>
              <div className="qa-modal-actions">
                <button type="button" className="qa-btn qa-btn-ghost" onClick={() => setMagicOpen(false)}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
