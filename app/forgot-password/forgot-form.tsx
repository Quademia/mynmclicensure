// app/forgot-password/forgot-form.tsx — the page's words and card (01.15).
//
// Typed email → "Email me a reset link" → the answer in the card's place,
// the same whatever the address: "If … has an account here, we've sent
// it a link" (01: forgot password answers the same whether or not the
// email is known), as the sign-in card's emailed link answers; then only
// "Not there after a minute? Look in Spam." and two ways on — Send it
// again (the server's limit, 3 an hour, still holds) or Use another email
// (Sam, 2026-10-31: trimmed from about 55 words to 30). Every call is caught: a dropped connection says so and
// gives the button back (AGENTS.md).

'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AppLink } from '@/components/shell/link-pending';
import { buildFpHash } from '@/lib/auth/fingerprint';
import { Toast } from '@/lib/toast/toast';
import { forgotPasswordAction } from './actions';

const NO_CONNECTION = 'Could not send the link. Please check your connection and try again.';

export function ForgotForm() {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [fpHash, setFpHash] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const dismissError = useCallback(() => setError(null), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  useEffect(() => {
    buildFpHash().then(setFpHash);
  }, []);

  async function send(address: string): Promise<boolean> {
    setError(null);
    setNotice(null);
    setSending(true);
    try {
      const fd = new FormData();
      fd.set('email', address);
      fd.set('fp_hash', fpHash ?? '');
      const result = await forgotPasswordAction(fd);
      if (!result.ok) setError(result.error);
      return result.ok;
    } catch {
      setError(NO_CONNECTION);
      return false;
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const address = email.trim();
    if (await send(address)) setSentTo(address);
  }

  async function sendAgain() {
    // "Only the newest link works" is said here, where a second email
    // makes it true (Sam, 2026-10-31: B).
    if (sentTo && (await send(sentTo))) setNotice('Sent again. Use the newest email.');
  }

  return (
    <>
      <Toast message={error} onDismiss={dismissError} />
      <Toast message={notice} onDismiss={dismissNotice} tone="success" />

      <AppLink className="si-back" href="/login">
        ← Back to sign in
      </AppLink>

      {sentTo ? (
        <>
          <header className="si-head">
            <h1>Check your email.</h1>
            <p>
              If <strong>{sentTo}</strong>{' '}
              has an account here, we&apos;ve sent it a link to set a new password.
            </p>
          </header>

          <div className="card si-card si-sent" role="status">
            <div className="si-sent-row">
              <span className="si-sent-icon" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3.5 6.5l8.5 6 8.5-6" />
                </svg>
              </span>
              <p>Not there after a minute? Look in Spam.</p>
            </div>
            <p className="si-again">
              <button type="button" className="si-linkbtn" onClick={sendAgain} disabled={sending}>
                {sending ? 'Sending…' : 'Send it again'}
              </button>{' '}
              ·{' '}
              <button type="button" className="si-linkbtn" onClick={() => setSentTo(null)} disabled={sending}>
                Use another email
              </button>
            </p>
          </div>
        </>
      ) : (
        <>
          <header className="si-head">
            <h1>Forgot your password?</h1>
            <p>Type your email and we&apos;ll send you a link to set a new one.</p>
          </header>

          <form className="card si-card" method="post" onSubmit={handleSubmit}>
            <div className="si-field">
              <label className="si-label" htmlFor="email">
                Email
              </label>
              <input
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

            <button type="submit" className="btn btn-primary btn-lg" disabled={sending}>
              {sending ? 'Sending…' : 'Email me a reset link'}
            </button>
          </form>
        </>
      )}
    </>
  );
}
