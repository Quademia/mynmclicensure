// app/subscribe/subscribe-client.tsx
//
// The script block of legacy subscribe.html: the paid products (every
// active product that is not a programme's trial and costs more than
// nothing), the programme and product pickers, the price box, and
// "Proceed to Payment" → the init-public Server Action → Paystack's
// checkout. The typed email and phone and the last choices are
// remembered in localStorage under the legacy keys and restored on the
// next visit, as legacy.
//
// Changed on the way: the inline banner is the shared toast (UI
// convention #1); prices render through formatMinor() (convention #4);
// "QAcademy" → "Quademia" (convention #5); the paused panel is gone
// (the switch was lifted, Sam, 2026-09-11).

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Toast } from '@/lib/toast/toast';
import { formatMinor } from '@/lib/money/format-minor';
import { initPublicPayment } from '@/lib/payments/init-public';
import type { Product, Program } from '@/lib/catalogue/types';

type Msg = { text: string; tone: 'error' | 'success' | 'info' } | null;

function ls(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function paidProductsOf(programs: Program[], products: Product[]): Product[] {
  const trialIds = new Set(programs.map((p) => String(p.trial_product_id || '').trim()).filter(Boolean));
  return products.filter((product) => {
    const productId = String(product.product_id || '').trim();
    if (!productId) return false;
    if (trialIds.has(productId)) return false;
    if (Number(product.price_minor || 0) <= 0) return false;
    return true;
  });
}

export function SubscribeClient({ programs, products, signedIn }: { programs: Program[]; products: Product[]; signedIn: boolean }) {
  const paidProducts = paidProductsOf(programs, products);

  const [msg, setMsg] = useState<Msg>(null);
  const dismiss = useCallback(() => setMsg(null), []);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [programId, setProgramId] = useState('');
  const [productId, setProductId] = useState('');
  const [busy, setBusy] = useState(false);

  // The remembered values — after mount, so the server and the first
  // paint agree (deferred a tick; React asks that an effect not set
  // state synchronously).
  useEffect(() => {
    const id = window.setTimeout(() => {
      const store = ls();
      if (!store) return;
      setEmail(String(store.getItem('qa_last_email') || '').trim());
      setPhone(String(store.getItem('qa_last_phone') || '').trim());
      const lastProgram = String(store.getItem('qa_last_program_id') || '').trim();
      if (lastProgram && programs.some((p) => p.program_id === lastProgram)) setProgramId(lastProgram);
      const lastProduct = String(store.getItem('qa_last_product_id') || '').trim();
      if (lastProduct && paidProducts.some((p) => p.product_id === lastProduct)) setProductId(lastProduct);
    }, 0);
    return () => window.clearTimeout(id);
    // programs / paidProducts are derived from props and stable for the page's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = paidProducts.find((p) => p.product_id === productId) ?? null;
  const priceValue = selected ? formatMinor(selected.price_minor, selected.currency) : '—';
  const priceMeta = selected
    ? selected.duration_days
      ? `${selected.name || selected.product_id} • ${selected.duration_days} day(s)`
      : selected.name || selected.product_id
    : 'Choose a paid product to continue.';

  const payDisabled = busy || !productId || !email.trim();

  async function startPayment() {
    const e = email.trim().toLowerCase();
    const ph = phone.trim();

    if (!e) {
      setMsg({ text: 'Please enter your email address.', tone: 'error' });
      document.getElementById('email')?.focus();
      return;
    }
    if (!productId) {
      setMsg({ text: 'Please choose a paid product.', tone: 'error' });
      document.getElementById('product')?.focus();
      return;
    }

    setBusy(true);
    try {
      const out = await initPublicPayment({ email: e, phone_number: ph, program_id: programId.trim(), product_id: productId.trim() });
      if (!out.ok) throw new Error(out.message || out.error || 'Could not start payment');

      const store = ls();
      store?.setItem('qa_last_email', e);
      store?.setItem('qa_last_phone', ph);
      store?.setItem('qa_last_program_id', programId.trim());
      store?.setItem('qa_last_product_id', productId.trim());
      store?.setItem('qa_last_reference', out.reference || '');

      window.location.href = out.authorization_url;
    } catch (err) {
      console.error('startPayment:', err);
      setMsg({ text: (err instanceof Error && err.message) || 'Could not start payment. Please try again.', tone: 'error' });
      setBusy(false);
    }
  }

  return (
    <div className="subp">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />

      <div className="wrap">
        <div className="card">
          <div className="hero">
            <div className="eyebrow">Pay first • Setup after payment</div>
            <h1>Subscribe to Quademia Paid Access</h1>
            <p className="sub">
              This page is for paid onboarding only. Your free-trial registration stays separate.
              Choose a paid product, pay securely, then complete account setup only if needed.
            </p>
          </div>

          {signedIn && (
            <div className="signed-in">
              You are already signed in. For renewals or extensions, it is better to use the{' '}
              <a href="/student/upgrade">Upgrade page</a>.
            </div>
          )}

          <div className="grid">
            <div className="panel">
              <h2>Your payment details</h2>
              <p>Keep this form short. No account is created here before payment.</p>

              <div className="field">
                <label className="label" htmlFor="email">Email address *</label>
                <input className="input" id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                <div className="hint">Use the same email you want to use for login later.</div>
              </div>

              <div className="field">
                <label className="label" htmlFor="phone">Phone number</label>
                <input className="input" id="phone" type="tel" autoComplete="tel" placeholder="e.g. 233XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <div className="hint">Optional. Helpful for payment support and later setup prefill.</div>
              </div>

              <div className="field">
                <label className="label" htmlFor="program">Programme</label>
                <select className="select" id="program" value={programId} onChange={(e) => setProgramId(e.target.value)}>
                  {programs.length === 0 ? (
                    <option value="">No programmes found</option>
                  ) : (
                    <>
                      <option value="">Select your programme</option>
                      {programs.map((p) => (
                        <option key={p.program_id} value={p.program_id}>{p.program_name || p.program_id}</option>
                      ))}
                    </>
                  )}
                </select>
                <div className="hint">Optional. It helps prefill setup later, but it does not limit product choice.</div>
              </div>

              <div className="field">
                <label className="label" htmlFor="product">Paid product *</label>
                <select className="select" id="product" value={productId} onChange={(e) => setProductId(e.target.value)}>
                  {paidProducts.length === 0 ? (
                    <option value="">No paid products available</option>
                  ) : (
                    <>
                      <option value="">Select a paid product</option>
                      {paidProducts.map((p) => (
                        <option key={p.product_id} value={p.product_id}>
                          {p.name || p.product_id} — {formatMinor(p.price_minor, p.currency)}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              <div className="priceBox">
                <div className="priceLabel">Selected price</div>
                <div className="priceValue">{priceValue}</div>
                <div className="priceMeta">{priceMeta}</div>
              </div>

              <div className="actions">
                <button className="btn btn-primary" id="payBtn" type="button" disabled={payDisabled} onClick={startPayment}>
                  {busy ? 'Starting payment…' : 'Proceed to Payment'}
                </button>
                <a className="btn btn-secondary" href="/login">Already have an account? Log in</a>
              </div>

              <div className="footerLinks">
                Free trial still uses <a href="/register">Register</a>.
              </div>
            </div>

            <div className="panel">
              <h2>How this paid flow works</h2>
              <p>This matches the rebuilt payment flow in your new stack.</p>

              <div className="checks">
                <div className="check"><div className="dot" /><div>You choose a paid product and pay through Paystack.</div></div>
                <div className="check"><div className="dot" /><div>After payment, you land on the confirmation page for verification.</div></div>
                <div className="check"><div className="dot" /><div>If your user already exists, access is activated immediately.</div></div>
                <div className="check"><div className="dot" /><div>If no account exists yet, the confirmation page shows the short setup form.</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
