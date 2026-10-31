// components/sign-in/password-field.tsx — a new password with Show
// (01.15). Register types it once (Sam, 2026-10-31: one field with Show
// over typing it twice on a long form; on a phone, seeing what was typed
// catches a slip). Reset asks for it twice — `againLabel` — and one Show
// reveals both (Sam, 2026-10-31: B): the student there has already lost
// one password, and is signed in straight after, so a slip would only
// show at the next sign-in. Sign in keeps its plain field. No strength
// rules or meter (Sam, 2026-10-31: in legacy, the password was one of the
// main things students struggled with and asked the admin about); the
// hint only asks them to remember it.

'use client';

import { useState } from 'react';

export function PasswordField({
  id,
  label,
  againLabel,
  disabled = false,
}: {
  id: string;
  label: string;
  /** Ask for it a second time, under this label (sent as confirmPassword). */
  againLabel?: string;
  disabled?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const againId = `${id}-again`;
  const type = shown ? 'text' : 'password';

  return (
    <>
      <div className="si-field">
        <label className="si-label" htmlFor={id}>
          {label}
        </label>
        <div className="si-reveal">
          <input
            className="si-input"
            type={type}
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
            aria-controls={againLabel ? `${id} ${againId}` : id}
            disabled={disabled}
          >
            {shown ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="si-hint" id={`${id}-hint`}>
          At least 8 characters <span className="si-remember">(remember it to sign in)</span>.
        </p>
      </div>

      {againLabel ? (
        <div className="si-field">
          <label className="si-label" htmlFor={againId}>
            {againLabel}
          </label>
          <input
            className="si-input"
            type={type}
            id={againId}
            name="confirmPassword"
            required
            autoComplete="new-password"
            disabled={disabled}
          />
        </div>
      ) : null}
    </>
  );
}
