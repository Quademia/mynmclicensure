// app/(app)/student/upgrade/upgrade-client.tsx
//
// The script block of legacy student/upgrade.html: the user pill, the
// "Your current active subscriptions" panel (product, days left, starts,
// ends, product id), the paid product picker with the programmes' trial
// products and zero-priced items hidden, the price box, and "Proceed to
// Payment" → the init-upgrade Server Action (slice 9a) → Paystack's
// checkout. The "session expired" branch is the gate's now (the page
// never renders without one).
//
// Changed on the way: the inline status box is the shared toast (UI
// convention #1); prices render through formatMinor() (convention #4);
// the dates use en-GB so the server and the first paint agree (legacy
// used the browser's locale); the paused panel is gone (the switch was
// lifted, Sam, 2026-09-11); Back to Dashboard is this app's route.

'use client';

import { useCallback, useState } from 'react';
import { Toast } from '@/lib/toast/toast';
import { formatMinor } from '@/lib/money/format-minor';
import { initUpgradePayment } from '@/lib/payments/init-upgrade';
import type { Product, Program } from '@/lib/catalogue/types';
import type { ActiveSubscriptionWithProduct } from '@/lib/subscriptions/types';

type Msg = { text: string; tone: 'error' | 'success' | 'info' } | null;

type ProfileBits = {
  name: string | null;
  forename: string | null;
  surname: string | null;
  email: string;
  program_id: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-GB', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / 86400000);
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

export function UpgradeClient({
  profile,
  subscriptions,
  programs,
  products,
}: {
  profile: ProfileBits;
  subscriptions: ActiveSubscriptionWithProduct[];
  programs: Program[];
  products: Product[];
}) {
  const paidProducts = paidProductsOf(programs, products);

  const [msg, setMsg] = useState<Msg>(null);
  const dismiss = useCallback(() => setMsg(null), []);

  const [productId, setProductId] = useState('');
  const [busy, setBusy] = useState(false);

  // legacy renderUserPill
  const fullName = profile.name || [profile.forename, profile.surname].filter(Boolean).join(' ').trim() || profile.email || 'Signed in user';
  const pillParts = [fullName];
  if (profile.email) pillParts.push(profile.email);
  if (profile.program_id) pillParts.push(profile.program_id);

  const selected = paidProducts.find((p) => p.product_id === productId) ?? null;
  const priceValue = selected ? formatMinor(selected.price_minor, selected.currency) : '—';

  async function startUpgradePayment() {
    const id = String(productId || '').trim();
    if (!id) {
      setMsg({ text: 'Please select a paid product first.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      const result = await initUpgradePayment(id);
      if (!result.ok) throw new Error(result.message || result.error || 'Could not start payment');
      if (!result.authorization_url) throw new Error('Payment link missing from worker response');
      window.location.href = result.authorization_url;
    } catch (err) {
      console.error('startUpgradePayment:', err);
      setMsg({ text: (err instanceof Error && err.message) || 'Could not start payment. Please try again.', tone: 'error' });
      setBusy(false);
    }
  }

  return (
    <div className="upg">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />

      <div className="wrap">
        <div className="card">
          <div className="topbar">
            <div>
              <h1 className="title">Upgrade / Extend Access</h1>
              <p className="subtitle">
                This page is for existing logged-in users only. Your free-trial registration stays separate.
                Paying for the same product again extends that product’s expiry.
              </p>
            </div>
            <div className="user-pill">{pillParts.join(' • ')}</div>
          </div>

          <div className="grid">
            <div className="panel">
              <h2>Your current active subscriptions</h2>
              <p>This helps you see what is already active before you buy another package.</p>

              {subscriptions.length === 0 ? (
                <div className="empty">No active subscriptions found yet.</div>
              ) : (
                <div className="subs">
                  {subscriptions.map((row) => {
                    const left = daysLeft(row.expires_utc);
                    const leftLabel = left == null ? 'Active' : `${left} day${left === 1 ? '' : 's'} left`;
                    const productName = row.products?.name || row.product_id || 'Subscription';
                    return (
                      <div key={row.subscription_id} className="sub-item">
                        <div className="sub-top">
                          <div className="sub-name">{productName}</div>
                          <div className="badge">{leftLabel}</div>
                        </div>
                        <div className="sub-meta">
                          <div><b>Starts:</b> {formatDate(row.start_utc)}</div>
                          <div><b>Ends:</b> {formatDate(row.expires_utc)}</div>
                          <div><b>Product ID:</b> {row.product_id || '—'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="panel">
              <h2>Choose a paid product</h2>
              <p>Trial products are hidden here automatically, so this page only shows real paid options.</p>

              <div className="field">
                <label className="label" htmlFor="productSelect">Product</label>
                <select className="select" id="productSelect" value={productId} onChange={(e) => setProductId(e.target.value)}>
                  {paidProducts.length === 0 ? (
                    <option value="">No paid products available</option>
                  ) : (
                    <>
                      <option value="">Select a paid product</option>
                      {paidProducts.map((p) => (
                        <option key={p.product_id} value={p.product_id}>
                          {p.name} — {formatMinor(p.price_minor, p.currency)}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              <div className="price-box">
                <div className="price-label">Price</div>
                <div className="price-value">{priceValue}</div>
              </div>

              <div className="hint">
                After payment, you will be sent to your payment confirmation page.
                Because you already have an account, setup should not be required.
              </div>

              <div className="actions">
                <button className="btn btn-primary" id="payBtn" type="button" disabled={busy || !productId} onClick={startUpgradePayment}>
                  {busy ? 'Starting payment…' : 'Proceed to Payment'}
                </button>
                <a className="btn btn-secondary" href="/student/dashboard">Back to Dashboard</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
