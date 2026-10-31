// app/reset-password/reset-card.tsx — the reset page's words and card
// (01.15).
//
// Legacy's rules for the link are kept: the form waits until the link has
// made a session; a link Supabase has already refused (error in the hash)
// says it no longer works; nothing at all after 5 seconds says the same.
// Two link shapes arrive (the MyNclex reset page is the worked
// reference): #access_token=… from our own reset emails (implicit flow,
// see app/forgot-password/actions.ts) — we call setSession ourselves;
// ?code=… from an admin-generated recovery link — the browser client
// exchanges it by itself and we only wait. It drives ONLY off the link's
// own tokens, never off a session already in this browser: a shared phone
// must not reset whoever happens to be signed in.
//
// Save and sign in (01, item 8: Sam, 2026-09-18): the action saves the
// password, signs every other device out and this one in, and moves to
// /router — the welcome screen, then the dashboard. A dropped connection
// says so and gives the button back (AGENTS.md); the move that worked
// arrives as a thrown signal, let through by isNavigation.

'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AppLink } from '@/components/shell/link-pending';
import { PleaseWait } from '@/components/shell/please-wait';
import { PasswordField } from '@/components/sign-in/password-field';
import { createClient } from '@/lib/supabase/client';
import { buildFpHash } from '@/lib/auth/fingerprint';
import { isNavigation } from '@/lib/auth/is-navigation';
import { Toast } from '@/lib/toast/toast';
import { completeResetAction } from './actions';

type Phase = 'checking' | 'ready' | 'used' | 'none';

const NO_CONNECTION = 'Could not save your new password. Please check your connection and try again.';
const MISMATCH = "The two passwords don't match.";

export function ResetCard() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fpHash, setFpHash] = useState<string | null>(null);

  const dismissError = useCallback(() => setError(null), []);

  useEffect(() => {
    buildFpHash().then(setFpHash);
  }, []);

  useEffect(() => {
    const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const hashParams = new URLSearchParams(rawHash);
    const hashError = hashParams.get('error') || hashParams.get('error_code');
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const code = new URLSearchParams(window.location.search).get('code');
    const arrivedFromLink = Boolean((accessToken && refreshToken) || code);

    let settled = false;
    let unsubscribe: (() => void) | null = null;

    function settle(next: Phase, address?: string | null) {
      if (settled) return;
      settled = true;
      // The link's tokens leave the address bar either way.
      if (window.location.hash || window.location.search) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      if (address) setEmail(address);
      setPhase(next);
    }

    // Each settle below runs after a reply or a timer, never during the
    // effect itself (the React compiler's rule, AGENTS.md).
    const start = setTimeout(() => {
      if (hashError) settle('used');
      else if (!arrivedFromLink) settle('none');
    }, 0);

    if (!hashError && arrivedFromLink) {
      const supabase = createClient();
      if (accessToken && refreshToken) {
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ data, error }) => (error ? settle('used') : settle('ready', data.user?.email)))
          .catch(() => {
            settle('used');
            setError('Could not check your link. Please check your connection and open it again.');
          });
      } else {
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) settle('ready', session.user.email);
        });
        unsubscribe = () => sub.subscription.unsubscribe();
        supabase.auth
          .getUser()
          .then(({ data }) => {
            if (data.user) settle('ready', data.user.email);
          })
          .catch(() => {
            // the deadline below says so
          });
      }
    }

    // Legacy's 5-second fallback.
    const deadline = setTimeout(() => settle('used'), 5000);
    return () => {
      clearTimeout(start);
      clearTimeout(deadline);
      unsubscribe?.();
    };
  }, []);

  // A plain onSubmit, not <form action>: React resets a form's fields
  // after its action returns, and the password should survive a failure.
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    // The two boxes must match (Sam, 2026-10-31: B) — said at once, with
    // no request; the server checks again.
    if (fd.get('password') !== fd.get('confirmPassword')) {
      setError(MISMATCH);
      return;
    }
    setSaving(true);
    try {
      const result = await completeResetAction(fd);
      // On success the action signs in and moves; only failures come back.
      if (result && !result.ok) {
        setError(result.error);
        setSaving(false);
      }
    } catch (err) {
      if (isNavigation(err)) return;
      setError(NO_CONNECTION);
      setSaving(false);
    }
  }

  return (
    <>
      <Toast message={error} onDismiss={dismissError} />
      {phase === 'checking' ? <PleaseWait message="Checking your link…" /> : null}
      {saving ? <PleaseWait message="Saving your new password…" detail="Then we sign you in." /> : null}

      {phase === 'ready' ? (
        <>
          <header className="si-head">
            <h1>Set a new password.</h1>
            <p>
              {email ? (
                <>
                  For <strong>{email}</strong>.{' '}
                </>
              ) : null}
              You&apos;ll be signed in as soon as it&apos;s saved.
            </p>
          </header>

          <form className="card si-card" method="post" onSubmit={handleSubmit}>
            <input type="hidden" name="fp_hash" value={fpHash ?? ''} />
            <PasswordField id="password" label="New password" againLabel="Type it again" disabled={saving} />
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              Save and sign in
            </button>
          </form>
        </>
      ) : null}

      {phase === 'used' || phase === 'none' ? (
        <>
          <header className="si-head">
            {phase === 'used' ? (
              <>
                <h1>This link no longer works.</h1>
                <p>A reset link works once, and only the newest one works. Ask for a new link, then open the latest email.</p>
              </>
            ) : (
              <>
                <h1>Open the link in your email.</h1>
                <p>This page sets a new password from the link we email you. Ask for one if you need it.</p>
              </>
            )}
          </header>

          <div className="si-actions">
            <AppLink className="btn btn-primary btn-lg" href="/forgot-password">
              Send me a new link
            </AppLink>
            <AppLink className="si-back si-back-centre" href="/login">
              ← Back to sign in
            </AppLink>
          </div>
        </>
      ) : null}
    </>
  );
}
