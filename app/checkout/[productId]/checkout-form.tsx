'use client';

// app/checkout/[productId]/checkout-form.tsx — the checkout's one moving
// part (02 C4, 2026-09-23): the whole two-column body, because the Pay
// button in the right-hand summary submits the details on the left.
//
// THE LAYOUT IS MYNCLEX'S (Sam, 2026-09-23, after reading
// components/checkout/checkout-shell.tsx there): on the left what you are
// buying, then your details; on the right an order summary with the Pay
// button, then "What happens next". One Quademia checkout across the
// products. Deliberately NOT carried from MyNclex: the step wizard (one
// short form has nothing to step through), the "this email already has
// an account, log in first" check (D31 rules the opposite here — a paid
// email with an account gets the package added to it), and the Pay
// button held disabled until the form is complete (this app reports
// problems as toasts on Pay, UI convention 1).
//
// A plain onSubmit reading FormData, not <form action>: React 19 resets a
// form's fields after an action returns, and a buyer refused for a
// mistyped number must not have to type everything again (AGENTS.md).
//
// The checks here run first so a mistake is caught without a round trip,
// in the order the fields sit. init-public repeats every one of them; the
// browser's copy is a courtesy, the server's is the gate. The one check
// the server cannot repeat is the confirm box — it only ever sees one
// email — which is exactly why the box exists: a typo sends the account
// and the receipt somewhere the buyer cannot reach (Sam, 2026-09-23).
//
// ⚠ method="post", though a script always handles the submit. If the
// page's JavaScript never loads — a dropped connection mid-load, which is
// this audience's normal case — a tap on Pay falls back to the browser's
// own submit, and a form with no method sends a GET: the email and the
// WhatsApp number land in the address bar, the history and the server's
// logs. Seen in the 2026-09-23 walk, where the dev server refused its
// scripts to 127.0.0.1. POST keeps them out of the address; the buyer
// just sees the page again.
//
// ⚠ "WHAT HAPPENS NEXT" DESCRIBES TODAY'S FLOW, pay-first with the setup
// form on the confirmation page. When D31 lands (the account made at
// payment, a set-password link emailed) step 2 changes with it.
//
// Nothing is remembered in the browser. The old subscribe page kept the
// last email, phone and reference in localStorage, and a shared computer
// is this audience's normal case; Paystack returns the buyer with the
// reference in the address, which is all the confirmation page needs.

import { useCallback, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Toast } from '@/lib/toast/toast';
import { initPublicPayment } from '@/lib/payments/init-public';
import { initUpgradePayment } from '@/lib/payments/init-upgrade';

type Msg = { text: string; tone: 'error' | 'success' | 'info' } | null;

const START_FAILED = 'Could not start payment. Please try again.';

export function CheckoutForm({
  children,
  changeHref,
  productId,
  productName,
  durationDays,
  amountLabel,
  programs,
  defaultProgram,
  buyer,
}: {
  /** The product card, rendered on the server. */
  children: ReactNode;
  /** Back to the page the buyer most likely came from. */
  changeHref: string;
  productId: string;
  productName: string;
  durationDays: number;
  /** "GHS 150.00", formatted on the server. */
  amountLabel: string;
  programs: { id: string; name: string }[];
  /** The product's one programme, or '' when it has none or several. */
  defaultProgram: string;
  /** The signed-in account, or null for a new buyer. */
  buyer: { email: string; programName: string } | null;
}) {
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const dismiss = useCallback(() => setMsg(null), []);

  // Off to Paystack. The button stays disabled: the page is leaving.
  function go(result: Awaited<ReturnType<typeof initPublicPayment>>) {
    if (result.ok) {
      window.location.assign(result.authorization_url);
      return;
    }
    setMsg({ text: result.message || START_FAILED, tone: 'error' });
    setBusy(false);
  }

  function validate(fd: FormData): string | null {
    const e = String(fd.get('email') ?? '').trim();
    const again = String(fd.get('confirmEmail') ?? '').trim();
    const phone = String(fd.get('phone') ?? '').trim();
    if (!e) return 'Please enter your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Please enter a valid email address.';
    if (e.toLowerCase() !== again.toLowerCase()) return "The two email addresses don't match.";
    if (phone.replace(/\D/g, '').length < 9) return 'Please enter a valid WhatsApp number.';
    if (!String(fd.get('program') ?? '')) return 'Please select your programme.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    if (buyer) {
      setBusy(true);
      setMsg(null);
      try {
        go(await initUpgradePayment(productId));
      } catch (err) {
        console.error('checkout init-upgrade:', err);
        setMsg({ text: START_FAILED, tone: 'error' });
        setBusy(false);
      }
      return;
    }

    const fd = new FormData(e.currentTarget);
    const problem = validate(fd);
    if (problem) {
      setMsg({ text: problem, tone: 'error' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      go(
        await initPublicPayment({
          email: String(fd.get('email') ?? ''),
          phone_number: String(fd.get('phone') ?? ''),
          program_id: String(fd.get('program') ?? ''),
          product_id: productId,
        }),
      );
    } catch (err) {
      console.error('checkout init-public:', err);
      setMsg({ text: START_FAILED, tone: 'error' });
      setBusy(false);
    }
  }

  const typed = email.trim();

  const details = buyer ? (
    <section className="card chk-details" aria-labelledby="chk-details-title">
      <h2 className="chk-title" id="chk-details-title">
        Paying as
      </h2>
      <dl className="chk-who">
        <dt>Email</dt>
        <dd>{buyer.email}</dd>
        {buyer.programName ? (
          <>
            <dt>Programme</dt>
            <dd>{buyer.programName}</dd>
          </>
        ) : null}
      </dl>
    </section>
  ) : (
    <section className="card chk-details" aria-labelledby="chk-details-title">
      <h2 className="chk-title" id="chk-details-title">
        Your details
      </h2>

      <label className="chk-field" htmlFor="chk-email">
        Email address
        <input
          className="chk-input"
          id="chk-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
        />
        <span className="chk-hint">
          {typed ? (
            <>
              Your account and receipt go to <strong>{typed}</strong>.
            </>
          ) : (
            'Your account and receipt go to this address.'
          )}
        </span>
      </label>

      <label className="chk-field" htmlFor="chk-email-again">
        Confirm email address
        <input
          className="chk-input"
          id="chk-email-again"
          name="confirmEmail"
          type="email"
          autoComplete="email"
          placeholder="Type it again"
          required
        />
      </label>

      <label className="chk-field" htmlFor="chk-phone">
        WhatsApp number
        <input
          className="chk-input"
          id="chk-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="e.g. 024 123 4567"
          required
        />
      </label>

      <label className="chk-field" htmlFor="chk-program">
        Programme
        <select className="chk-input" id="chk-program" name="program" required defaultValue={defaultProgram}>
          <option value="">Select your programme</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="chk-hint">This becomes your account&apos;s programme.</span>
      </label>
    </section>
  );

  return (
    <form method="post" onSubmit={handleSubmit} noValidate className="chk-grid">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />

      <div className="chk-main">
        <section aria-labelledby="chk-package-title">
          <div className="chk-section-head">
            <h2 className="chk-title" id="chk-package-title">
              Your package
            </h2>
            <Link href={changeHref} className="chk-change">
              Change package
            </Link>
          </div>
          {children}
        </section>

        {details}
      </div>

      <aside className="chk-rail">
        <div className="card chk-summary">
          <h2 className="chk-title">Order summary</h2>
          <div className="chk-line">
            <div>
              <div className="chk-line-name">{productName}</div>
              <div className="chk-line-meta">{durationDays} days</div>
            </div>
            <div className="chk-line-amount">{amountLabel}</div>
          </div>
          <div className="chk-total">
            <span>Pay today</span>
            <span className="chk-total-amount">{amountLabel}</span>
          </div>
          <button type="submit" className="btn btn-accent btn-lg chk-submit" disabled={busy}>
            {busy ? 'Starting payment…' : `Pay ${amountLabel}`}
          </button>
          <p className="chk-note">You pay securely with Paystack — mobile money or card.</p>
        </div>

        <div className="card chk-next">
          <h2 className="chk-title">What happens next</h2>
          <ol>
            <li>Pay with Paystack — mobile money or card.</li>
            {buyer ? (
              <li>You come back to a confirmation page, and the package is added to your account.</li>
            ) : (
              <li>
                You come back to a confirmation page. If you&apos;re new, you set your name and a
                password there — that creates your account.
              </li>
            )}
            {buyer ? (
              <li>The new courses are on your dashboard straight away.</li>
            ) : (
              <li>Your courses open as soon as you sign in.</li>
            )}
          </ol>
        </div>
      </aside>
    </form>
  );
}
