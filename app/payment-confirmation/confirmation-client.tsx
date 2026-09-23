// app/payment-confirmation/confirmation-client.tsx
//
// The script block of legacy payment-confirmation.html, transcribed: the
// reference from the address (`reference`, Paystack's `trxref`, or
// `ref`) or the browser's storage; verify on arrival and on a schedule
// while Paystack has not said "success" (D35, below); the four screens
// (verifying, activated, finish setup, verification issue) with the
// legacy titles and messages; Retry Verification; the setup form (first
// name, surname, password twice, phone, programme) → the setup-complete
// Server Action; Hide Setup Form; the support box; the amount line.
// The programme list is the page's own five options, as legacy had it.
//
// Changed on the way: the setup form's inline message boxes are the
// shared toast (UI convention #1) — the page's own status boxes stay,
// they are the screen, not a message; prices render through
// formatMinor() (convention #4); the support address is Quademia's
// (Sam, 2026-09-15) and the WhatsApp button stays hidden because its
// number was blank in legacy; "QAcademy" → "Quademia" (convention #5);
// the "Go to Dashboard" and "Go to Login" links are this app's routes.
//
// D35 (Sam, 2026-09-23). The poll no longer stops at one minute: every
// 3 s for the first minute, then every 10 s up to three — a mobile-money
// buyer leaves the browser to approve the prompt on their phone, and the
// test key's instant "success" had hidden how long that takes. A refused
// check (the limiter's `rate_limited` or `limiter_unavailable`) is NOT a
// verification issue: the page keeps saying it is still checking and
// tries again on the slow beat. Verify is now counted per payment, so
// the page's own polling should never be refused; this is the belt to
// that brace. And "Buy another package" on success — Sam's answer to two
// packages at once (no basket until the evidence asks for one).

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Toast } from '@/lib/toast/toast';
import { formatMinor } from '@/lib/money/format-minor';
import { verifyPayment } from '@/lib/payments/verify';
import { completePaymentSetup } from '@/lib/payments/setup-complete';
import {
  VERIFY_FAST_POLL_MS,
  VERIFY_FAST_POLLS,
  VERIFY_SLOW_POLL_MS,
  VERIFY_SLOW_POLLS,
  type ActivationMode,
  type VerifyResult,
} from '@/lib/payments/types';

// Support config. Leave blank to hide the button automatically.
const SUPPORT_WA_E164 = '';
const SUPPORT_EMAIL = 'support@quademia.com';

const PROGRAM_OPTIONS: [string, string][] = [
  ['RN', 'Registered Nurse (RN)'],
  ['RM', 'Registered Midwife (RM)'],
  ['RPHN', 'Registered Public Health Nurse (RPHN)'],
  ['RMHN', 'Mental Health Nurse (RMHN)'],
  ['NACNAP', 'NAC / NAP'],
];

type Msg = { text: string; tone: 'error' | 'success' | 'info' } | null;

type Screen = {
  title: string;
  subtitle: string;
  statusLine: string;
  ok: { kind: 'ok' | 'warn'; text: string } | null;
  err: string | null;
  showActions: boolean;
  showSetup: boolean;
  /** Only on success: the way back to the shop for a second package. */
  showBuyAnother: boolean;
  meta: string;
};

const INITIAL: Screen = {
  title: 'Confirming your payment…',
  subtitle: 'Please keep this page open while we verify your transaction and activate your access.',
  statusLine: '',
  ok: null,
  err: null,
  showActions: false,
  showSetup: false,
  showBuyAnother: false,
  meta: '',
};

function ls(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function describeActivationMode(mode: ActivationMode | '' | undefined): string {
  if (mode === 'created') return 'Payment confirmed. Your access is now active.';
  if (mode === 'existing_by_ref') return 'This payment was already confirmed earlier. Your access is active.';
  return 'Payment confirmed. Your access is now active.';
}

export function ConfirmationClient() {
  const [msg, setMsg] = useState<Msg>(null);
  const dismiss = useCallback(() => setMsg(null), []);

  const [screen, setScreen] = useState<Screen>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [reference, setReference] = useState('');
  const [supportEmail, setSupportEmail] = useState('');

  const referenceRef = useRef('');
  const setupTokenRef = useRef('');
  const pollCountRef = useRef(0);
  const pollTimerRef = useRef<number | null>(null);

  // The setup form.
  const [emailView, setEmailView] = useState('');
  const [forename, setForename] = useState('');
  const [surname, setSurname] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [phone, setPhone] = useState('');
  const [program, setProgram] = useState('');
  const [setupBusy, setSetupBusy] = useState(false);

  function getReference(): string {
    const qs = new URLSearchParams(window.location.search);
    return (qs.get('reference') || qs.get('trxref') || qs.get('ref') || ls()?.getItem('qa_last_reference') || '').trim();
  }

  function saveVerifyContext(payload: Partial<Record<string, unknown>> | null) {
    const store = ls();
    if (!payload) return;
    if (payload.reference) store?.setItem('qa_last_reference', String(payload.reference));
    if (payload.email) {
      store?.setItem('qa_last_email', String(payload.email));
      setSupportEmail(String(payload.email));
    }
    if (payload.phone_number) store?.setItem('qa_last_phone', String(payload.phone_number));
    if (payload.program_id) store?.setItem('qa_last_program_id', String(payload.program_id));
    if (payload.product_id) store?.setItem('qa_last_product_id', String(payload.product_id));
    if (payload.setup_token) {
      setupTokenRef.current = String(payload.setup_token || '').trim();
      store?.setItem('qa_setup_token', setupTokenRef.current);
    }
  }

  function renderActivated(payload: { activation_mode?: ActivationMode; amount_minor_expected?: number | null; currency?: string } | null) {
    setScreen({
      title: 'Access Activated',
      subtitle: 'Your payment has been verified successfully.',
      statusLine: 'ACTIVATED',
      ok: { kind: 'ok', text: describeActivationMode(payload?.activation_mode || '') },
      err: null,
      showActions: true,
      showSetup: false,
      showBuyAnother: true,
      meta: payload?.amount_minor_expected && payload?.currency ? `Amount: ${formatMinor(payload.amount_minor_expected, payload.currency)}` : '',
    });
  }

  function renderSetupRequired(payload: Extract<VerifyResult, { status: 'SETUP_REQUIRED' }>) {
    setScreen({
      title: 'Finish Setup to Activate',
      subtitle: 'Your payment is confirmed. Please complete the short setup below.',
      statusLine: 'SETUP_REQUIRED',
      ok: { kind: 'ok', text: 'Payment confirmed. We only need your account details to activate access.' },
      err: null,
      showActions: true,
      showSetup: true,
      showBuyAnother: false,
      meta: '',
    });
    const store = ls();
    const email = String(payload.email || store?.getItem('qa_last_email') || '').trim();
    const savedPhone = String(payload.phone_number || store?.getItem('qa_last_phone') || '').trim();
    const savedProgram = String(payload.program_id || store?.getItem('qa_last_program_id') || '').trim();
    setEmailView(email);
    setPhone((cur) => cur || savedPhone);
    if (savedProgram && PROGRAM_OPTIONS.some(([id]) => id === savedProgram)) setProgram(savedProgram);
  }

  function renderPending(message: string) {
    setScreen({
      title: 'Confirming your payment…',
      subtitle: 'Please keep this page open while we verify your transaction.',
      statusLine: 'VERIFYING',
      ok: { kind: 'warn', text: message || 'Still verifying. If you just paid, this can take a short moment.' },
      err: null,
      showActions: false,
      showSetup: false,
      showBuyAnother: false,
      meta: '',
    });
  }

  function renderError(message: string, statusLabel = 'ERROR') {
    setScreen({
      title: 'Verification Issue',
      subtitle: 'Please retry verification or contact support if this persists.',
      statusLine: statusLabel,
      ok: null,
      err: message || 'We could not confirm this payment yet.',
      showActions: true,
      showSetup: false,
      showBuyAnother: false,
      meta: '',
    });
  }

  // The next poll, on the D35 schedule: the fast beat for the first
  // minute, the slow one up to three, then the buyer is asked to retry.
  // `slow` forces the slow beat — used after a refused check, so the
  // page backs off instead of knocking again at once.
  function scheduleNextPoll(slow = false) {
    pollCountRef.current += 1;
    const n = pollCountRef.current;
    if (n > VERIFY_FAST_POLLS + VERIFY_SLOW_POLLS) {
      renderError('Verification is taking longer than expected. Please tap Retry Verification in a few seconds.', 'TIMEOUT');
      return;
    }
    const delay = !slow && n <= VERIFY_FAST_POLLS ? VERIFY_FAST_POLL_MS : VERIFY_SLOW_POLL_MS;
    pollTimerRef.current = window.setTimeout(() => verify(true), delay);
  }

  async function verify(autoPoll: boolean) {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    const ref = getReference();
    referenceRef.current = ref;
    setReference(ref);

    if (!ref) {
      renderError('Missing payment reference. Please return to the payment page and try again.', 'MISSING_REFERENCE');
      return;
    }

    setLoading(true);
    try {
      const out = await verifyPayment(ref);
      saveVerifyContext(out.ok ? (out as unknown as Record<string, unknown>) : { reference: ref });

      if (out.ok && out.status === 'ACTIVATED') {
        renderActivated(out);
        return;
      }
      if (out.ok && out.status === 'SETUP_REQUIRED') {
        renderSetupRequired(out);
        return;
      }
      if (!out.ok && out.error === 'not_ready') {
        renderPending(out.message || 'Still verifying…');
        if (autoPoll) scheduleNextPoll();
        else setScreen((s) => ({ ...s, showActions: true }));
        return;
      }
      // A refused check is not a failed payment (D35): keep waiting.
      if (!out.ok && (out.error === 'rate_limited' || out.error === 'limiter_unavailable')) {
        renderPending('Still checking your payment…');
        if (autoPoll) scheduleNextPoll(true);
        else setScreen((s) => ({ ...s, showActions: true }));
        return;
      }
      if (!out.ok && out.error === 'payment_not_found') {
        renderError('We could not find that payment reference. Please return to the payment page and try again.', 'NOT_FOUND');
        return;
      }
      if (!out.ok && out.error === 'amount_mismatch') {
        renderError('Payment amount mismatch. Please contact support with your reference.', 'AMOUNT_MISMATCH');
        return;
      }
      if (!out.ok && out.error === 'currency_mismatch') {
        renderError('Payment currency mismatch. Please contact support with your reference.', 'CURRENCY_MISMATCH');
        return;
      }
      if (!out.ok && out.error === 'payment_failed') {
        renderError(out.failure_note || 'This payment is marked as failed. Please contact support with your reference.', 'FAILED');
        return;
      }
      if (!out.ok) {
        renderError(out.message || out.error || 'Could not verify payment.', 'ERROR');
        return;
      }
    } catch (err) {
      console.error('verifyPayment:', err);
      renderError('Network error while checking your payment. Please retry.', 'NETWORK');
    } finally {
      setLoading(false);
    }
  }

  async function runSetupComplete() {
    const fn = forename.trim();
    const sn = surname.trim();
    const ph = phone.trim();
    const programId = program.trim();
    const email = emailView.trim();

    if (!fn || !sn) {
      setMsg({ text: 'Please enter your first name and surname.', tone: 'error' });
      return;
    }
    if (!password || password.length < 8) {
      setMsg({ text: 'Password must be at least 8 characters.', tone: 'error' });
      return;
    }
    if (password !== password2) {
      setMsg({ text: 'Passwords do not match.', tone: 'error' });
      return;
    }
    if (!programId) {
      setMsg({ text: 'Please choose your programme.', tone: 'error' });
      return;
    }

    setupTokenRef.current = String(setupTokenRef.current || ls()?.getItem('qa_setup_token') || '').trim();
    if (!setupTokenRef.current) {
      setMsg({ text: 'Setup token is missing. Please retry verification first.', tone: 'error' });
      return;
    }

    setLoading(true);
    setSetupBusy(true);
    try {
      // A FormData, not an object: Next's dev log prints an action's
      // arguments, and the password must not appear there.
      const fd = new FormData();
      fd.set('reference', referenceRef.current);
      fd.set('setup_token', setupTokenRef.current);
      fd.set('forename', fn);
      fd.set('surname', sn);
      fd.set('password', password);
      fd.set('phone_number', ph);
      fd.set('program_id', programId);
      const out = await completePaymentSetup(fd);
      if (!out.ok) throw new Error(out.message || out.error || 'Could not complete setup');

      const store = ls();
      if (email) store?.setItem('qa_last_email', email);
      if (ph) store?.setItem('qa_last_phone', ph);
      if (programId) store?.setItem('qa_last_program_id', programId);
      store?.removeItem('qa_setup_token');

      setMsg({ text: 'Setup completed successfully.', tone: 'success' });
      renderActivated(out);
    } catch (err) {
      console.error('runSetupComplete:', err);
      setMsg({ text: (err instanceof Error && err.message) || 'Could not complete setup. Please retry.', tone: 'error' });
    } finally {
      setLoading(false);
      setSetupBusy(false);
    }
  }

  // DOMContentLoaded: the saved context, then the first verify — after
  // mount, deferred a tick (React asks that an effect not set state
  // synchronously).
  useEffect(() => {
    const id = window.setTimeout(() => {
      const store = ls();
      referenceRef.current = getReference();
      setupTokenRef.current = String(store?.getItem('qa_setup_token') || '').trim();
      setReference(referenceRef.current);
      setEmailView(String(store?.getItem('qa_last_email') || '').trim());
      setSupportEmail(String(store?.getItem('qa_last_email') || '').trim());
      setPhone(String(store?.getItem('qa_last_phone') || '').trim());
      const savedProgram = String(store?.getItem('qa_last_program_id') || '').trim();
      if (savedProgram && PROGRAM_OPTIONS.some(([pid]) => pid === savedProgram)) setProgram(savedProgram);
      verify(true);
    }, 0);
    return () => {
      window.clearTimeout(id);
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
    };
    // Runs once, on arrival, as the legacy listener did.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The saved email and the reference are read after mount (state), so
  // the server and the first paint render the same placeholders.
  const supportMessage = `Hi Quademia Support, I need help with payment confirmation. My email is ${supportEmail || '____'} and my reference is ${reference || '____'}.`;
  const showSupport = Boolean(SUPPORT_WA_E164 || SUPPORT_EMAIL);

  return (
    <div className="pcf">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />

      <div className={`loader${loading ? ' on' : ''}`}>
        <div className="spin" aria-label="Loading" />
      </div>

      <div className="wrap">
        <div className="card">
          <div className="hero">
            <h1>{screen.title}</h1>
            <p className="sub">{screen.subtitle}</p>
          </div>

          <div className="body">
            <div className="kv">Reference: <b>{reference || '—'}</b></div>
            {screen.statusLine && (
              <div className="kv">Status: <b>{screen.statusLine}</b></div>
            )}

            {screen.ok && <div className={`status show ${screen.ok.kind}`}>{screen.ok.text}</div>}
            {screen.err && <div className="status show error">{screen.err}</div>}

            <div className={`actions${screen.showActions ? ' show' : ''}`}>
              <a className="btn btn-primary" href="/student/dashboard">Go to Dashboard</a>
              {screen.showBuyAnother && (
                <a className="btn btn-secondary" href="/subscribe">Buy another package</a>
              )}
              <a className="btn btn-secondary" href="/login">Go to Login</a>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  // Restarts the whole patient check, not one ask (Sam,
                  // 2026-09-23): a buyer taps Retry the moment they have
                  // approved on their phone, often seconds before Paystack
                  // has settled, and one "not yet" would leave them to
                  // guess that they must tap again. Legacy asked once.
                  pollCountRef.current = 0;
                  verify(true);
                }}
              >
                Retry Verification
              </button>
            </div>

            <div className={`setupBox${screen.showSetup ? ' show' : ''}`}>
              <div className="setupTitle">Finish setup to activate access</div>
              <p className="setupSub">
                Your payment is confirmed. We only need a few details to create your account and activate access.
              </p>

              <div className="field">
                <label className="label" htmlFor="emailView">Email</label>
                <input className="input" id="emailView" type="text" readOnly value={emailView} />
              </div>

              <div className="row">
                <div className="field">
                  <label className="label" htmlFor="forename">First name *</label>
                  <input className="input" id="forename" type="text" autoComplete="given-name" value={forename} onChange={(e) => setForename(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="surname">Surname *</label>
                  <input className="input" id="surname" type="text" autoComplete="family-name" value={surname} onChange={(e) => setSurname(e.target.value)} />
                </div>
              </div>

              <div className="row">
                <div className="field">
                  <label className="label" htmlFor="password">Password *</label>
                  <input className="input" id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <div className="hint">Minimum 8 characters.</div>
                </div>
                <div className="field">
                  <label className="label" htmlFor="password2">Confirm password *</label>
                  <input className="input" id="password2" type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
                </div>
              </div>

              <div className="row">
                <div className="field">
                  <label className="label" htmlFor="phone">Phone</label>
                  <input className="input" id="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="program">Programme *</label>
                  <select className="select" id="program" value={program} onChange={(e) => setProgram(e.target.value)}>
                    <option value="">Select your programme</option>
                    {PROGRAM_OPTIONS.map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="actions show setupActions">
                <button className="btn btn-primary" type="button" disabled={setupBusy} onClick={runSetupComplete}>
                  {setupBusy ? 'Creating account…' : 'Create Account & Activate'}
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setScreen((s) => ({ ...s, showSetup: false, showActions: true }))}
                >
                  Hide Setup Form
                </button>
              </div>
            </div>

            {showSupport && (
              <div className="support show">
                <h3>Need help?</h3>
                <p>If verification takes too long, contact support with your email address and payment reference.</p>
                <div className="supportLinks">
                  {SUPPORT_WA_E164 && (
                    <a className="btn btn-secondary" href={`https://wa.me/${encodeURIComponent(SUPPORT_WA_E164)}?text=${encodeURIComponent(supportMessage)}`} target="_blank" rel="noopener">
                      WhatsApp Support
                    </a>
                  )}
                  {SUPPORT_EMAIL && (
                    <a className="btn btn-secondary" href={`mailto:${encodeURIComponent(SUPPORT_EMAIL)}?subject=${encodeURIComponent('Payment confirmation help')}&body=${encodeURIComponent(supportMessage)}`}>
                      Email Support
                    </a>
                  )}
                </div>
              </div>
            )}

            {screen.meta && <div className="meta">{screen.meta}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
