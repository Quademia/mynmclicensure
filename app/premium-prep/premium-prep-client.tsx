// app/premium-prep/premium-prep-client.tsx
//
// The script block of legacy premium-prep.html: the hero card with the
// lowest price, step 1 (pick a programme, with search and a summary),
// step 2 (email, confirm email, phone, the read-only programme), and
// the "Continue to Payment" button. The selection and the typed email /
// phone are remembered in localStorage under the legacy keys, and a
// `?program_id=` in the address pre-selects, as legacy.
//
// The payment: legacy posted to the payment Worker's /payments/init-public;
// that is the init-public Server Action (slice 9a), which hands back the
// Paystack checkout address the browser is sent to.
//
// Changed on the way: the "paid plans are paused" switch is lifted (Sam,
// 2026-09-11); "QAcademy Nurses Hub" → "Quademia"; the alerts are toasts
// (UI convention #1); prices render through formatMinor() (convention #4).

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Toast } from '@/lib/toast/toast';
import { formatMinor } from '@/lib/money/format-minor';
import { initPublicPayment } from '@/lib/payments/init-public';
import type { Product, Program } from '@/lib/catalogue/types';

type PremiumProgram = { program_id: string; program_name: string; product: Product };
type Msg = { text: string; tone: 'error' | 'success' | 'info' } | null;

// ⚠ WHICH PROGRAMME A PREMIUM PRODUCT BELONGS TO IS STILL READ FROM ITS
// ID, and that is deliberate rather than finished. S14 replaced the
// *premium test* — `id ends with _2026_PREP`, a rule carrying a year that
// would have broken in 2027 — with `products.is_premium`. It did not
// replace the *grouping*, which still needs to know that RN_2026_PREP is
// the RN programme's product. D23 item 2 (2026-09-18) rules the real
// answer: a product matches a programme when any of its courses is sat by
// that programme, through `courses.program_scope`, ignoring the courses
// every programme sits. That needs course data this page does not load,
// so it belongs to the shop slice, not here. Until then the programme is
// the longest known programme id the product id starts with — no year in
// it, so nothing expires, but still a naming convention.
function programOfProductId(
  productId: string,
  programMap: Map<string, { program_id: string; program_name: string }>,
): string | null {
  let best: string | null = null;
  for (const pid of programMap.keys()) {
    // `NACNAP_2026_PREP` must match NACNAP, not NAC, so the longest wins.
    if (productId.startsWith(`${pid}_`) && (best === null || pid.length > best.length)) best = pid;
  }
  return best;
}

// One premium product per programme (v1): the cheapest product carrying
// is_premium, for a programme that exists.
function getPremiumPrograms(programs: Program[], products: Product[]): PremiumProgram[] {
  const programMap = new Map<string, { program_id: string; program_name: string }>();
  for (const p of programs) {
    const pid = String(p.program_id || '').trim().toUpperCase();
    if (pid) programMap.set(pid, { program_id: pid, program_name: String(p.program_name || p.program_id || '').trim() });
  }

  const grouped = new Map<string, Product[]>();
  for (const product of products) {
    const productId = String(product.product_id || '').trim().toUpperCase();
    if (product.is_premium !== true) continue;
    // The price gate the other two doors have always had and this page
    // never did: a zero-price product was selectable and payable here.
    if (Number(product.price_minor || 0) <= 0) continue;
    const programId = programOfProductId(productId, programMap);
    if (!programId) continue;
    const normalized: Product = {
      ...product,
      product_id: productId,
      name: String(product.name || productId).trim(),
      price_minor: Number(product.price_minor || 0),
      currency: String(product.currency || 'GHS').trim().toUpperCase(),
      duration_days: Number(product.duration_days || 0),
    };
    if (!grouped.has(programId)) grouped.set(programId, []);
    grouped.get(programId)!.push(normalized);
  }

  return Array.from(grouped.entries())
    .map(([programId, items]) => {
      items.sort(
        (a, b) => Number(a.price_minor || 0) - Number(b.price_minor || 0) || String(a.name || '').localeCompare(String(b.name || '')),
      );
      const program = programMap.get(programId)!;
      return { program_id: program.program_id, program_name: program.program_name, product: items[0] };
    })
    .sort((a, b) => a.program_name.localeCompare(b.program_name));
}

function getLowestPrice(items: PremiumProgram[]): { minor: number; currency: string } | null {
  let lowest: number | null = null;
  let currency: string | null = null;
  for (const item of items) {
    const p = item.product;
    const minor = Number(p.price_minor || 0);
    const cur = String(p.currency || 'GHS').toUpperCase();
    if (!minor || minor <= 0) continue;
    if (currency === null) currency = cur;
    if (currency !== cur) return null;
    if (lowest === null || minor < lowest) lowest = minor;
  }
  if (lowest === null || currency === null) return null;
  return { minor: lowest, currency };
}

function summaryChips(item: PremiumProgram): string[] {
  const chips: string[] = [];
  if (item.product.duration_days > 0) chips.push('Duration: ' + item.product.duration_days + ' days');
  if (item.product.product_id) chips.push('Product: ' + item.product.product_id);
  return chips;
}

function ls(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function PremiumPrepClient({ programs, products }: { programs: Program[]; products: Product[] }) {
  const premiumPrograms = getPremiumPrograms(programs, products);
  const lowest = getLowestPrice(premiumPrograms);

  const [msg, setMsg] = useState<Msg>(null);
  const dismiss = useCallback(() => setMsg(null), []);

  const [panel, setPanel] = useState<'programs' | 'details'>('programs');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PremiumProgram | null>(null);
  const [email, setEmail] = useState('');
  const [email2, setEmail2] = useState('');
  const [phone, setPhone] = useState('');
  const [paying, setPaying] = useState(false);

  // restoreSelection() + the saved email / phone — after mount, so the
  // server and the first paint agree. Deferred a tick, as the legacy
  // boot() restored only after its own awaits (the login card does the
  // same for its return handler; React asks that an effect not set state
  // synchronously).
  useEffect(() => {
    const id = window.setTimeout(() => {
      const store = ls();
      const qs = new URLSearchParams(window.location.search);
      const requested = String(qs.get('program_id') || store?.getItem('qa_join_program') || '').trim().toUpperCase();
      if (requested) {
        const found = premiumPrograms.find((x) => x.program_id === requested);
        if (found) setSelected(found);
      }
      const savedEmail = store?.getItem('qa_last_email') || '';
      const savedPhone = store?.getItem('qa_last_phone') || '';
      if (savedEmail) {
        setEmail(savedEmail);
        setEmail2(savedEmail);
      }
      if (savedPhone) setPhone(savedPhone);
    }, 0);
    return () => window.clearTimeout(id);
    // premiumPrograms is derived from props and stable for the page's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showOnly(next: 'programs' | 'details') {
    setPanel(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function choose(item: PremiumProgram) {
    setSelected(item);
    ls()?.setItem('qa_join_program', item.program_id);
    ls()?.setItem('qa_join_product', item.product.product_id);
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? premiumPrograms.filter((item) => item.program_name.toLowerCase().includes(q) || item.program_id.toLowerCase().includes(q))
    : premiumPrograms;

  function validateDetails():
    | { ok: false; message: string; field?: string }
    | { ok: true; email: string; phone: string; program_id: string; product_id: string } {
    const e1 = email.trim().toLowerCase();
    const e2 = email2.trim().toLowerCase();
    const ph = phone.trim();
    if (!selected) return { ok: false, message: 'Please choose a programme first.' };
    if (!e1) return { ok: false, message: 'Please enter your email address.', field: 'email' };
    if (!e2) return { ok: false, message: 'Please confirm your email address.', field: 'email2' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e1)) return { ok: false, message: 'Please enter a valid email address.', field: 'email' };
    if (e1 !== e2) return { ok: false, message: 'Email addresses do not match.', field: 'email2' };
    const digits = ph.replace(/[^\d]/g, '');
    if (ph && digits.length < 7) {
      return { ok: false, message: 'Phone number looks too short. Please check it or leave it blank.', field: 'phone' };
    }
    return { ok: true, email: e1, phone: ph, program_id: selected.program_id, product_id: selected.product.product_id };
  }

  async function beginPayment() {
    const v = validateDetails();
    if (!v.ok) {
      setMsg({ text: v.message, tone: 'error' });
      if (v.field) document.getElementById(v.field)?.focus();
      return;
    }
    setPaying(true);
    ls()?.setItem('qa_last_email', v.email);
    ls()?.setItem('qa_last_phone', v.phone || '');
    ls()?.setItem('qa_last_product_id', v.product_id);
    ls()?.setItem('qa_last_program_id', v.program_id);
    ls()?.setItem('qa_join_program', v.program_id);
    ls()?.setItem('qa_join_product', v.product_id);
    try {
      const res = await initPublicPayment({ email: v.email, phone_number: v.phone || '', program_id: v.program_id, product_id: v.product_id });
      if (!res.ok) throw new Error(res.message || res.error || 'Could not start payment');
      if (!res.authorization_url) throw new Error('Payment session was created without an authorization URL.');
      ls()?.setItem('qa_last_reference', res.reference || '');
      setMsg({ text: 'Redirecting to Paystack…', tone: 'success' });
      window.location.href = res.authorization_url;
    } catch (err) {
      setMsg({ text: (err instanceof Error && err.message) || 'Network error. Please try again.', tone: 'error' });
      setPaying(false);
    }
  }

  // Enter on the details step starts the payment, as legacy.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Enter') return;
      if (panel === 'details') beginPayment();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // beginPayment reads the latest state through closures re-created each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, email, email2, phone, selected]);

  const price = selected ? formatMinor(selected.product.price_minor, selected.product.currency) : '—';
  const sub = selected ? selected.program_name + ' • ' + selected.product.name : '—';
  const chips = selected ? summaryChips(selected) : [];

  return (
    <div className="prep">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />

      <div className="wrap">
        <div className="topbar">
          <div><strong>Quademia</strong></div>
          <div>
            Already have an account? <a href="/login">Sign in</a>
          </div>
        </div>

        <section className="hero">
          <div className="prep-eyebrow">NMC 2026 Premium Prep</div>

          <div className="hero-grid">
            <div>
              <h1>Join the Premium Prep for your programme</h1>
              <p className="sub">
                Choose your programme, confirm your email, and pay securely with Paystack.
                Your account setup continues after payment on the confirmation page.
              </p>

              <div className="hero-points">
                <div className="point"><strong>Programme-first flow</strong><br />Pick the correct prep package for your programme.</div>
                <div className="point"><strong>Pay first</strong><br />No long signup form before payment.</div>
                <div className="point"><strong>Shared confirmation</strong><br />The existing confirmation page handles verify + setup.</div>
                <div className="point"><strong>Separate from trial</strong><br />This page is only for paid Premium Prep.</div>
              </div>
            </div>

            <div className="hero-card">
              <div className="price-kicker">Starting from</div>
              <div className="hero-price">{lowest ? formatMinor(lowest.minor, lowest.currency) : '—'}</div>
              <div className="hero-note">
                {premiumPrograms.length ? 'Choose your programme to continue to secure payment.' : 'No active Premium Prep products were found yet.'}
              </div>
              <div className="hero-actions">
                <button className="btn btn-primary" type="button" onClick={() => showOnly('programs')}>Choose Programme</button>
                <a className="btn btn-secondary" href="/register">Free Trial Instead</a>
              </div>
            </div>
          </div>
        </section>

        {/* Step 1 */}
        <section className={`panel${panel === 'programs' ? ' on' : ''}`}>
          <div className="panel-head">
            <div className="step-pill">Step 1 of 2</div>
            <h2>Select your programme</h2>
            <p>We will match you to the correct NMC 2026 Premium Prep product.</p>
          </div>

          <div className="panel-body">
            <div className="search-row">
              <div className="search-box">
                <input className="input" id="programSearch" type="text" placeholder="Search programme name or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="count">{filtered.length} programme{filtered.length === 1 ? '' : 's'}</div>
            </div>

            <div className="program-list">
              {premiumPrograms.length === 0 ? (
                <div className="empty">
                  No active Premium Prep products were found. Check that the products are active, priced, and ticked as <strong>Premium Prep</strong> on the admin Products page.
                </div>
              ) : filtered.length === 0 ? (
                <div className="empty">No matching premium programmes found.</div>
              ) : (
                filtered.map((item) => {
                  const isSel = selected?.program_id === item.program_id;
                  return (
                    <button key={item.program_id} type="button" className={`program-card${isSel ? ' selected' : ''}`} onClick={() => choose(item)}>
                      <div>
                        <div className="program-name">{item.program_name}</div>
                        <div className="program-meta">
                          {item.program_id}<br />
                          {item.product.name}<br />
                          <strong>{formatMinor(item.product.price_minor, item.product.currency)}</strong>
                        </div>
                      </div>
                      <div className="check">{isSel ? '✓' : ''}</div>
                    </button>
                  );
                })
              )}
            </div>

            {selected && (
              <div className="summary">
                <div className="summary-title">Selected premium package</div>
                <div className="summary-main">
                  <div>
                    <div className="summary-name">{selected.product.name}</div>
                    <div className="summary-sub">{sub}</div>
                  </div>
                  <div className="summary-price">{price}</div>
                </div>
                <div className="chips">
                  {chips.map((c) => (
                    <span key={c} className="badge">{c}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="actions-row">
              <button
                className="btn btn-primary"
                type="button"
                disabled={!selected}
                onClick={() => {
                  if (!selected) {
                    setMsg({ text: 'Please choose a programme to continue.', tone: 'error' });
                    return;
                  }
                  showOnly('details');
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </section>

        {/* Step 2 */}
        <section className={`panel${panel === 'details' ? ' on' : ''}`}>
          <div className="panel-head">
            <div className="step-pill">Step 2 of 2</div>
            <h2>Enter payment details</h2>
            <p>Use the email you want linked to this payment and later account setup.</p>
          </div>

          <div className="panel-body">
            {selected && (
              <div className="summary">
                <div className="summary-title">You are purchasing</div>
                <div className="summary-main">
                  <div>
                    <div className="summary-name">{selected.product.name}</div>
                    <div className="summary-sub">{sub}</div>
                  </div>
                  <div className="summary-price">{price}</div>
                </div>
                <div className="chips">
                  {chips.map((c) => (
                    <span key={c} className="badge">{c}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid-2 gap-top">
              <div className="field">
                <label htmlFor="email">Email address</label>
                <input className="input" id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="email2">Confirm email</label>
                <input className="input" id="email2" type="email" autoComplete="email" placeholder="Repeat your email" value={email2} onChange={(e) => setEmail2(e.target.value)} />
              </div>
            </div>

            <div className="grid-2">
              <div className="field">
                <label htmlFor="phone">Phone number <span className="hint">(optional)</span></label>
                <input className="input" id="phone" type="tel" autoComplete="tel" placeholder="WhatsApp / MoMo number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <div className="hint">Optional. Useful for payment/contact continuity.</div>
              </div>
              <div className="field">
                <label htmlFor="programReadonly">Programme</label>
                <input className="input" id="programReadonly" type="text" readOnly value={selected ? `${selected.program_name} (${selected.program_id})` : ''} />
                <div className="hint">This follows the programme you selected above.</div>
              </div>
            </div>

            <div className="actions-row">
              <button className="btn btn-secondary" type="button" onClick={() => showOnly('programs')}>Back</button>
              <button className="btn btn-primary btn-lg" type="button" disabled={paying} onClick={beginPayment}>
                {paying ? 'Starting payment…' : 'Continue to Payment'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
