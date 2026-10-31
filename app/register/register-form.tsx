// app/register/register-form.tsx — the register card (01.15, Sam
// 2026-10-31, on the sign-in page's look).
//
//   1. Start your N-day trial only checks the fields and opens "Almost
//      done!" — the app's own dialog, legacy's words; the account is made
//      after "Create my account".
//   2. "Creating your account…" on the please-wait screen (09.14) while
//      the server makes the login, the profile, the trial and the welcome
//      email, then signs the student in on this device.
//   3. Straight in (Sam: in place of "Your account is ready", then signing
//      in again): the action moves to /router, which shows the welcome
//      screen on the way to the dashboard.
//
// A DROPPED CONNECTION never leaves the screen stuck (AGENTS.md): the call
// is caught and says so, and the fields are still filled. A move that
// WORKED also arrives as a thrown signal; isNavigation lets it through.

'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PleaseWait } from '@/components/shell/please-wait';
import { PasswordField } from '@/components/sign-in/password-field';
import { buildFpHash } from '@/lib/auth/fingerprint';
import { isNavigation } from '@/lib/auth/is-navigation';
import { useConfirm } from '@/lib/overlays/shared/confirm-dialog';
import { Toast } from '@/lib/toast/toast';
import { registerAction } from './actions';

export type ProgramOption = { program_id: string; program_name: string };
export type SchoolOption = { id: number; name: string; region: string };

const REFERRALS = [
  'WhatsApp group',
  'A friend / colleague',
  'TikTok',
  'Facebook',
  'Instagram',
  'School / lecturer',
  'Google search',
];

const NO_CONNECTION = 'Could not create your account. Please check your connection and try again.';

export function RegisterForm({
  programs,
  schools,
  days,
}: {
  programs: ProgramOption[];
  schools: SchoolOption[];
  days: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [school, setSchool] = useState('');
  const [referral, setReferral] = useState('');
  const [fpHash, setFpHash] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const dismiss = useCallback(() => setError(null), []);

  useEffect(() => {
    buildFpHash().then(setFpHash);
  }, []);

  // Group schools by region, in the order they arrive (region, name).
  const regions: { region: string; items: SchoolOption[] }[] = [];
  for (const s of schools) {
    const last = regions[regions.length - 1];
    if (last && last.region === s.region) last.items.push(s);
    else regions.push({ region: s.region, items: [s] });
  }

  // The checks that need no server, in legacy's order and words; the
  // server repeats them.
  function validate(fd: FormData): string | null {
    const phone = String(fd.get('phone') ?? '').trim();
    const schoolVal = String(fd.get('school') ?? '');
    const schoolOther = String(fd.get('schoolOther') ?? '').trim();
    const referralVal = String(fd.get('referral') ?? '');
    const referralOther = String(fd.get('referralOther') ?? '').trim();

    if (!String(fd.get('program') ?? '')) return 'Please select your programme.';
    if (phone.replace(/\D/g, '').length < 9) return 'Please enter a valid WhatsApp number.';
    if (!schoolVal) return 'Please select your school.';
    if (schoolVal === '__OTHER__' && !schoolOther) return "Please type your school's name.";
    if (!referralVal) return 'Please tell us how you heard about us.';
    if (referralVal === '__OTHER__' && !referralOther) return 'Please tell us how you heard about us.';
    return null;
  }

  // A plain onSubmit, not a form action: React resets a form after its
  // action runs, and the fields must still be there after "Go back" or a
  // dropped connection.
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    const problem = validate(fd);
    if (problem) {
      setError(problem);
      return;
    }

    const email = String(fd.get('email') ?? '').trim();
    const go = await confirm({
      title: 'Almost done!',
      body: (
        <>
          <p className="dlg-text">
            Please remember the <strong>email</strong> and <strong>password</strong>{' '}
            you just entered — you&apos;ll need them every time you sign in.
          </p>
          <p className="si-dlg-email">
            Your email: <strong>{email}</strong>
          </p>
        </>
      ),
      confirmLabel: 'Create my account',
      cancelLabel: 'Go back',
    });
    if (!go) return;

    // The dialog has closed by now, so it cannot cover the screen below.
    setCreating(true);
    try {
      const result = await registerAction(fd);
      // On success the action signs in and moves; only failures come back.
      if (result && !result.ok) {
        setError(result.error);
        setCreating(false);
      }
    } catch (err) {
      if (isNavigation(err)) return;
      setError(NO_CONNECTION);
      setCreating(false);
    }
  }

  return (
    <>
      <Toast message={error} onDismiss={dismiss} />
      {confirmDialog}
      {creating ? (
        <PleaseWait message="Creating your account…" detail="Setting up your trial. This takes a few seconds." />
      ) : null}

      <form className="card si-card" method="post" onSubmit={handleSubmit}>
        <input type="hidden" name="fp_hash" value={fpHash ?? ''} />

        <div className="si-row-2">
          <div className="si-field">
            <label className="si-label" htmlFor="forename">
              First name
            </label>
            <input className="si-input" type="text" id="forename" name="forename" required autoComplete="given-name" />
          </div>
          <div className="si-field">
            <label className="si-label" htmlFor="surname">
              Last name
            </label>
            <input className="si-input" type="text" id="surname" name="surname" required autoComplete="family-name" />
          </div>
        </div>

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
          />
        </div>

        <div className="si-field">
          <label className="si-label" htmlFor="phone">
            WhatsApp number
          </label>
          <input
            className="si-input"
            type="tel"
            id="phone"
            name="phone"
            placeholder="e.g. 024 123 4567"
            required
            autoComplete="tel"
            inputMode="tel"
          />
        </div>

        <div className="si-field">
          <label className="si-label" htmlFor="program">
            Programme
          </label>
          <select className="si-input" id="program" name="program" required defaultValue="">
            <option value="">Select your programme</option>
            {programs.map((p) => (
              <option key={p.program_id} value={p.program_id}>
                {p.program_name}
              </option>
            ))}
          </select>
        </div>

        <div className="si-field">
          <label className="si-label" htmlFor="school">
            School
          </label>
          <select
            className="si-input"
            id="school"
            name="school"
            required
            value={school}
            onChange={(e) => setSchool(e.target.value)}
          >
            <option value="">{schools.length ? 'Select your school' : 'Could not load schools'}</option>
            {regions.map((r) => (
              <optgroup key={r.region} label={r.region}>
                {r.items.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value="__OTHER__">My school isn&apos;t listed</option>
          </select>
          {school === '__OTHER__' ? (
            <input
              className="si-input si-other"
              type="text"
              name="schoolOther"
              placeholder="Type your school's name"
              aria-label="Your school's name"
            />
          ) : null}
        </div>

        <div className="si-field">
          <label className="si-label" htmlFor="referral">
            How did you hear about us?
          </label>
          <select
            className="si-input"
            id="referral"
            name="referral"
            required
            value={referral}
            onChange={(e) => setReferral(e.target.value)}
          >
            <option value="">Select one</option>
            {REFERRALS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            <option value="__OTHER__">Other</option>
          </select>
          {referral === '__OTHER__' ? (
            <input
              className="si-input si-other"
              type="text"
              name="referralOther"
              placeholder="Tell us how"
              aria-label="How you heard about us"
            />
          ) : null}
        </div>

        <PasswordField id="password" label="Create a password" disabled={creating} />

        <button type="submit" className="btn btn-primary btn-lg" disabled={creating}>
          Start your {days}-day trial
        </button>
      </form>
    </>
  );
}
