'use client';

// app/payment-confirmation/setup-form.tsx — "one step left" for a new
// buyer (2026-09-23): the account is made here, from a paid payment.
//
// Today's form, restyled on the design system and otherwise unchanged
// (Sam): first name, surname, password twice, WhatsApp number,
// programme, then completePaymentSetup(). The number and the programme
// arrive prefilled — the checkout collected both. D31 (ruled, not built)
// shrinks this to a password: the server will make the account at
// payment, and the name moves to the profile page.
//
// Legacy's checks and words, in legacy's order; the server repeats them.
// The programme list comes from the database (the old page typed its
// five names). A FormData, not an object, so the password never appears
// in Next's dev log. On success the page is asked for again, and the
// server — now finding the payment ACTIVATED — draws "You're in".
//
// Nothing is kept in the browser: the reference and the setup token come
// from the server's page, and the old page's localStorage copies of the
// email, phone, programme and token (a shared computer's leak) are gone.

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { completePaymentSetup } from '@/lib/payments/setup-complete';

type Msg = { text: string; tone: 'error' | 'success' | 'info' } | null;

export function SetupForm({
  reference,
  setupToken,
  email,
  phone,
  programId,
  programs,
}: {
  reference: string;
  setupToken: string;
  email: string;
  phone: string;
  programId: string;
  programs: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const dismiss = useCallback(() => setMsg(null), []);

  function validate(fd: FormData): string | null {
    const forename = String(fd.get('forename') ?? '').trim();
    const surname = String(fd.get('surname') ?? '').trim();
    const password = String(fd.get('password') ?? '');
    const password2 = String(fd.get('password2') ?? '');
    if (!forename || !surname) return 'Please enter your first name and surname.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (password !== password2) return 'Passwords do not match.';
    if (!String(fd.get('program_id') ?? '')) return 'Please choose your programme.';
    return null;
  }

  // A plain onSubmit: React 19 resets a form after an action returns, and
  // a buyer refused for a short password must not retype their name.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    const problem = validate(fd);
    if (problem) {
      setMsg({ text: problem, tone: 'error' });
      return;
    }
    fd.set('reference', reference);
    fd.set('setup_token', setupToken);
    fd.delete('password2');

    setBusy(true);
    setMsg(null);
    try {
      const out = await completePaymentSetup(fd);
      if (!out.ok) {
        setMsg({ text: out.message || 'Could not complete setup. Please retry.', tone: 'error' });
        setBusy(false);
        return;
      }
      router.refresh();
    } catch (err) {
      console.error('completePaymentSetup:', err);
      setMsg({ text: 'Could not complete setup. Please retry.', tone: 'error' });
      setBusy(false);
    }
  }

  return (
    <form className="pcf-setup" method="post" onSubmit={handleSubmit} noValidate>
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />

      <label className="pcf-field">
        Email
        <input className="pcf-input" type="email" value={email} readOnly />
      </label>

      <div className="pcf-row">
        <label className="pcf-field">
          First name
          <input className="pcf-input" name="forename" type="text" autoComplete="given-name" required />
        </label>
        <label className="pcf-field">
          Surname
          <input className="pcf-input" name="surname" type="text" autoComplete="family-name" required />
        </label>
      </div>

      <div className="pcf-row">
        <label className="pcf-field">
          Password
          <input className="pcf-input" name="password" type="password" autoComplete="new-password" required />
          <span className="pcf-hint">At least 8 characters.</span>
        </label>
        <label className="pcf-field">
          Confirm password
          <input className="pcf-input" name="password2" type="password" autoComplete="new-password" required />
        </label>
      </div>

      <div className="pcf-row">
        <label className="pcf-field">
          WhatsApp number
          <input
            className="pcf-input"
            name="phone_number"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            defaultValue={phone}
          />
        </label>
        <label className="pcf-field">
          Programme
          <select className="pcf-input" name="program_id" required defaultValue={programId}>
            <option value="">Select your programme</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button type="submit" className="btn btn-accent btn-lg pcf-setup-submit" disabled={busy}>
        {busy ? 'Creating your account…' : 'Create account & start studying'}
      </button>
    </form>
  );
}
