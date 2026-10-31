// components/sign-in/password-field.tsx — a new password, typed once,
// with Show (01.15; Sam, 2026-10-31: one field with Show over typing it
// twice). On a phone, seeing what was typed catches a slip better than a
// second field does. Register and reset use it; sign in keeps its plain
// field. No strength rules or meter (Sam, 2026-10-31: in legacy, the
// password was one of the main things students struggled with and asked
// the admin about); the hint only asks them to remember it.

'use client';

import { useState } from 'react';

export function PasswordField({
  id,
  label,
  disabled = false,
}: {
  id: string;
  label: string;
  disabled?: boolean;
}) {
  const [shown, setShown] = useState(false);

  return (
    <div className="si-field">
      <label className="si-label" htmlFor={id}>
        {label}
      </label>
      <div className="si-reveal">
        <input
          className="si-input"
          type={shown ? 'text' : 'password'}
          id={id}
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          aria-describedby={`${id}-hint`}
          disabled={disabled}
        />
        <button
          type="button"
          className="si-show"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          aria-controls={id}
          disabled={disabled}
        >
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
      <p className="si-hint" id={`${id}-hint`}>
        At least 8 characters (remember it to sign in).
      </p>
    </div>
  );
}
