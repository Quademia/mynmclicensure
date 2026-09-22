// app/register/register-form.tsx
//
// The register form and its two touchpoints, from legacy register.html:
//   1. the "Almost done!" modal — the first submit only opens it; the
//      account is created after "Create my account".
//   2. the "Your account is ready!" screen.
// The programme and school lists arrive as props from the server page.
// The trial hint under the programme reads `trialDays` per programme;
// until slice 8 brings `products`, every value is null and the hint
// stays hidden, exactly as legacy hides it when no days are known.

'use client';

import { useCallback, useState } from 'react';
import { Toast } from '@/lib/toast/toast';
import { registerAction } from './actions';

export type ProgramOption = { program_id: string; program_name: string; trialDays: number | null };
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

export function RegisterForm({ programs, schools }: { programs: ProgramOption[]; schools: SchoolOption[] }) {
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [program, setProgram] = useState('');
  const [school, setSchool] = useState('');
  const [referral, setReferral] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [pending, setPending] = useState<FormData | null>(null);

  const dismiss = useCallback(() => setError(null), []);

  const trialDays = programs.find((p) => p.program_id === program)?.trialDays ?? null;

  // Group schools by region, in the order they arrive (region, name).
  const regions: { region: string; items: SchoolOption[] }[] = [];
  for (const s of schools) {
    const last = regions[regions.length - 1];
    if (last && last.region === s.region) last.items.push(s);
    else regions.push({ region: s.region, items: [s] });
  }

  // Legacy validates before opening the modal; the server repeats the
  // same checks. Here: the checks that need no server, in the same order.
  function validate(fd: FormData): string | null {
    const password = String(fd.get('password') ?? '');
    const confirm = String(fd.get('confirmPassword') ?? '');
    const phone = String(fd.get('phone') ?? '').trim();
    const schoolVal = String(fd.get('school') ?? '');
    const schoolOther = String(fd.get('schoolOther') ?? '').trim();
    const referralVal = String(fd.get('referral') ?? '');
    const referralOther = String(fd.get('referralOther') ?? '').trim();

    if (password !== confirm) return 'Passwords do not match.';
    if (!String(fd.get('program') ?? '')) return 'Please select your programme.';
    if (phone.replace(/\D/g, '').length < 9) return 'Please enter a valid WhatsApp number.';
    if (!schoolVal) return 'Please select your school.';
    if (schoolVal === '__OTHER__' && !schoolOther) return "Please type your school's name.";
    if (!referralVal) return 'Please tell us how you heard about us.';
    if (referralVal === '__OTHER__' && !referralOther) return 'Please tell us how you heard about us.';
    return null;
  }

  // Touchpoint 1: the first submit only opens the modal. A plain onSubmit,
  // not a form action: React resets a form after an action runs, and the
  // fields must still be there if the student taps "Go back".
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    const problem = validate(fd);
    if (problem) {
      setError(problem);
      return;
    }
    setPending(fd);
    setConfirming(true);
  }

  async function confirmCreate() {
    if (!pending) return;
    setConfirming(false);
    setCreating(true);
    const result = await registerAction(pending);
    setCreating(false);
    setPending(null);
    if (result.ok) setDone(result.email);
    else setError(result.error);
  }

  return (
    <>
      <Toast message={error} onDismiss={dismiss} />

      <div className={`reg-creating${creating ? ' show' : ''}`} aria-hidden={!creating}>
        <div className="reg-spinner" />
        <div className="reg-msg">Creating your account…</div>
      </div>

      {/* Touchpoint 1: confirm before creating */}
      <div className={`reg-modal-overlay${confirming ? ' show' : ''}`}>
        <div className="reg-modal" role="dialog" aria-modal="true">
          <h3>Almost done!</h3>
          <p>
            Please remember the <strong>email</strong> and <strong>password</strong>{' '}
            you just entered — you&apos;ll need them every time you sign in.
          </p>
          <p className="reg-modal-email">
            Your email: <strong>{email}</strong>
          </p>
          <div className="reg-modal-actions">
            <button type="button" className="btn" onClick={() => setConfirming(false)}>
              Go back
            </button>
            <button type="button" className="btn btn-primary" onClick={confirmCreate}>
              Create my account
            </button>
          </div>
        </div>
      </div>

      {/* Touchpoint 2: success screen */}
      <div className={`reg-success-overlay${done ? ' show' : ''}`}>
        <div className="reg-success-card">
          <div className="reg-success-check">&#10003;</div>
          <h2>Your account is ready!</h2>
          <p>
            Your sign-in email is:
            <br />
            <strong className="se-email">{done}</strong>
          </p>
          <p className="reg-success-sub">We&apos;ve also sent a welcome email to that address.</p>
          <div className="reg-success-ways">
            <p className="ways-title">3 ways to sign in next time:</p>
            <ul>
              <li>
                <strong>Password</strong> — the one you just created.
              </li>
              <li>
                <strong>Google</strong> — if you used a Gmail address, just tap &quot;Sign in with Google&quot;.
              </li>
              <li>
                <strong>Magic link</strong> — forgot your password? Get a link sent to your email and tap
                it. No password needed.
              </li>
            </ul>
          </div>
          <a className="btn btn-primary reg-success-btn" href="/login">
            Go to Sign In &rarr;
          </a>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="forename">First Name</label>
            <input type="text" id="forename" name="forename" placeholder="First name" required />
          </div>
          <div className="form-group">
            <label htmlFor="surname">Last Name</label>
            <input type="text" id="surname" name="surname" placeholder="Last name" required />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
          />
        </div>

        <div className="form-group">
          <label htmlFor="phone">WhatsApp Number</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            placeholder="e.g. 024 123 4567"
            required
            autoComplete="tel"
            inputMode="tel"
          />
        </div>

        <div className="form-group">
          <label htmlFor="program">Programme</label>
          <select id="program" name="program" required value={program} onChange={(e) => setProgram(e.target.value)}>
            <option value="">Select your programme</option>
            {programs.map((p) => (
              <option key={p.program_id} value={p.program_id}>
                {p.program_name}
              </option>
            ))}
          </select>
          {trialDays && trialDays > 0 ? (
            <div className="form-hint-box">You&apos;ll get a {trialDays}-day free trial — no card required.</div>
          ) : null}
        </div>

        <div className="form-group">
          <label htmlFor="school">School</label>
          <select id="school" name="school" required value={school} onChange={(e) => setSchool(e.target.value)}>
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
            <input type="text" className="form-other" name="schoolOther" placeholder="Type your school's name" />
          ) : null}
        </div>

        <div className="form-group">
          <label htmlFor="referral">How did you hear about us?</label>
          <select
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
            <input type="text" className="form-other" name="referralOther" placeholder="Tell us how" />
          ) : null}
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            placeholder="Minimum 8 characters"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            placeholder="Repeat your password"
            required
            autoComplete="new-password"
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={creating}>
          {creating ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
    </>
  );
}
