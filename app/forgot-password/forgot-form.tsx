// app/forgot-password/forgot-form.tsx — the form of legacy
// forgot-password.html. On success the button reads "Link Sent" and
// stays disabled, and the neutral message shows as a toast.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { buildFpHash } from '@/lib/auth/fingerprint';
import { Toast } from '@/lib/toast/toast';
import { forgotPasswordAction } from './actions';

export function ForgotForm() {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fpHash, setFpHash] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const dismissError = useCallback(() => setError(null), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  useEffect(() => {
    buildFpHash().then(setFpHash);
  }, []);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setNotice(null);
    setState('sending');
    const result = await forgotPasswordAction(formData);
    if (result.ok) {
      setNotice('If that email is registered, a reset link has been sent. Check your inbox.');
      setState('sent');
    } else {
      setError(result.error);
      setState('idle');
    }
  }

  const label = state === 'sending' ? 'Sending...' : state === 'sent' ? 'Link Sent' : 'Send Reset Link';

  return (
    <>
      <Toast message={error} onDismiss={dismissError} />
      <Toast message={notice} onDismiss={dismissNotice} tone="success" autoDismissMs={0} />

      <form action={handleSubmit}>
        <input type="hidden" name="fp_hash" value={fpHash ?? ''} />
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input type="email" id="email" name="email" placeholder="you@example.com" required autoComplete="email" />
        </div>

        <button type="submit" className="btn btn-primary" disabled={state !== 'idle'}>
          {label}
        </button>
      </form>
    </>
  );
}
