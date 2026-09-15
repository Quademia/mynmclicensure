// lib/toast/toast.tsx
//
// The toast primitives, copied from MyNclex's lib/toast (stack plumbing,
// rebuild.md §3.1) and folded into one file with a tone. The legacy auth
// pages showed messages in an inline box (.alert-error / .alert-success);
// the repo's UI convention #1 says toasts, so the same strings now show
// here: fixed top-right, auto-dismiss ~5 s, click × to close.
//
// Behaviour:
//   - `message` null → nothing rendered.
//   - each new message restarts the timer.
//   - autoDismissMs 0 → stays until closed.

'use client';

import { useEffect } from 'react';

type Tone = 'error' | 'success' | 'info';

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  tone?: Tone;
  autoDismissMs?: number;
}

const ICON: Record<Tone, string> = { error: '!', success: '✓', info: 'i' };

export function Toast({ message, onDismiss, tone = 'error', autoDismissMs = 5000 }: ToastProps) {
  useEffect(() => {
    if (!message || autoDismissMs <= 0) return;
    const id = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(id);
  }, [message, autoDismissMs, onDismiss]);

  if (!message) return null;

  const assertive = tone === 'error';
  return (
    <div
      className={`app-toast app-toast-${tone}`}
      role={assertive ? 'alert' : 'status'}
      aria-live={assertive ? 'assertive' : 'polite'}
    >
      <span className="app-toast-icon" aria-hidden="true">
        {ICON[tone]}
      </span>
      <span className="app-toast-message">{message}</span>
      <button type="button" className="app-toast-close" aria-label="Dismiss" onClick={onDismiss}>
        ✕
      </button>
    </div>
  );
}
