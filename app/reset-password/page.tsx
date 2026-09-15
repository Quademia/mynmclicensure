// app/reset-password/page.tsx — legacy/mynmclicensure/reset-password.html.
//
// Where the reset email's link lands. Legacy: the form is hidden until
// the recovery session exists; a link Supabase has already refused
// (error in the hash) shows the "no longer valid" message; nothing at
// all after 5 seconds shows "No valid reset link found."
//
// Two link shapes arrive (the MyNclex reset page is the worked
// reference): #access_token=… from our own reset emails (implicit flow,
// see app/forgot-password/actions.ts) — we call setSession ourselves;
// ?code=… from an admin-generated recovery link — the browser client
// exchanges it by itself and we only wait. It drives ONLY off the
// link's own tokens, never off a session already in this browser: a
// shared phone must not reset whoever happens to be signed in.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Toast } from '@/lib/toast/toast';
import { completeResetAction } from './actions';
import '@/styles/auth.css';

type Phase = 'loading' | 'ready' | 'invalid';

const INVALID_LINK =
  'This reset link is no longer valid. If you requested multiple resets, only the most recent link will work. Check your inbox for the latest email.';
const NO_LINK = 'No valid reset link found.';

export default function ResetPasswordPage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [invalidText, setInvalidText] = useState(NO_LINK);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dismissError = useCallback(() => setError(null), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

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

    function settle(ok: boolean, message: string) {
      if (settled) return;
      settled = true;
      if (ok) {
        window.history.replaceState(null, '', window.location.pathname);
        setPhase('ready');
      } else {
        setInvalidText(message);
        setPhase('invalid');
      }
    }

    if (hashError) {
      settle(false, INVALID_LINK);
      return;
    }

    if (arrivedFromLink) {
      const supabase = createClient();
      if (accessToken && refreshToken) {
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ error }) => settle(!error, INVALID_LINK));
      } else {
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) settle(true, '');
        });
        unsubscribe = () => sub.subscription.unsubscribe();
        supabase.auth.getUser().then(({ data }) => {
          if (data.user) settle(true, '');
        });
      }
    }

    // Legacy's 5-second fallback.
    const deadline = setTimeout(() => settle(false, NO_LINK), arrivedFromLink ? 5000 : 0);
    return () => {
      clearTimeout(deadline);
      unsubscribe?.();
    };
  }, []);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSubmitting(true);
    const result = await completeResetAction(formData);
    if (result.ok) {
      setNotice('Password updated successfully! Redirecting to login...');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } else {
      setError(result.error);
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-wrapper">
      <Toast message={error} onDismiss={dismissError} />
      <Toast message={notice} onDismiss={dismissNotice} tone="success" autoDismissMs={0} />

      <div className="auth-card">
        <div className="auth-logo">
          <h1>Quademia</h1>
          <p>MyNMCLicensure</p>
        </div>

        <h2 className="auth-title">Set a new password</h2>
        <p className="auth-subtitle">Choose a strong password for your account</p>

        {phase === 'invalid' ? (
          <div className="auth-invalid">
            <p>{invalidText}</p>
            <p>
              <a href="/forgot-password">Request a new reset link</a>
            </p>
          </div>
        ) : null}

        {phase === 'ready' ? (
          <form action={handleSubmit}>
            <div className="form-group">
              <label htmlFor="password">New Password</label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="Minimum 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Repeat your new password"
                required
                autoComplete="new-password"
                disabled={submitting}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Set New Password'}
            </button>
          </form>
        ) : null}

        <div className="auth-footer">
          <a href="/login">Back to Sign In</a>
        </div>
      </div>
    </div>
  );
}
