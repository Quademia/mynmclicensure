// app/(app)/admin/payments/payments-client.tsx
//
// The script block of legacy admin/payments.html (slice 9b): the
// seven-counter stats row (Total, Activated, Paid (stuck), Setup
// Required, Failed, Abandoned, Today's Revenue), the six filters (search
// debounced 300 ms, status, product, programme, from, to) and Clear,
// the table of 50 with Load More and the "Showing X of Y" count, the
// side panel (payment, student, timeline, subscription, failure reason,
// the raw payload toggle), Retry Activation → the admin retry action
// (verify, then the setup email), Copy Setup Link, View Student, and the
// revenue summary by product.
//
// Legacy quirks carried: the programme filter runs in the browser over
// the page already fetched (the programme lives on the joined student),
// so "Showing X of Y" counts the server's page against the server's
// total; a search change waits 300 ms, every other filter applies at
// once; the retry button reads "Activated ✓" and stays disabled after a
// success until the panel is reopened.
//
// Changed on the way: the panel's inline alert boxes are the shared
// toast (UI convention #1); money through formatMinor() (#4); the
// setup link is built on the site's own address handed in by the page
// (never the browser's origin); the PAYMENT_SETUP_REQUIRED email legacy's
// page fired after a retry that landed on SETUP_REQUIRED is sent by the
// retry action on the server (slice 10, rebuild.md §7.2).

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { formatMinor } from '@/lib/money/format-minor';
import { listPaymentsAction, retryActivationAction } from '@/lib/payments/admin-actions';
import {
  EMPTY_PAYMENT_FILTERS,
  type PaymentFilters,
  type PaymentListRow,
  type PaymentStatusCounts,
  type PaymentsPage,
  type RevenueRow,
} from '@/lib/payments/admin-queries';
import type { PaymentStatus } from '@/lib/payments/types';
import type { Product, Program } from '@/lib/catalogue/types';
import { Icon } from '@/components/shell/icons';

type Msg = { text: string; tone: 'error' | 'success' | 'info' } | null;

const STATUS_LABELS: Record<PaymentStatus, string> = {
  ACTIVATED: 'Activated',
  PAID: 'Paid',
  SETUP_REQUIRED: 'Setup Required',
  FAILED: 'Failed',
  INIT: 'Abandoned',
};

function formatStatus(status: string): string {
  return (STATUS_LABELS as Record<string, string>)[status] || status;
}

function formatTs(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDay(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getUserName(p: PaymentListRow): string {
  if (p.users) {
    return p.users.name || `${p.users.forename || ''} ${p.users.surname || ''}`.trim() || p.users.email || '';
  }
  return '';
}

export function PaymentsClient({
  products,
  programs,
  counts,
  today,
  firstPage,
  revenueRows,
  origin,
}: {
  products: Product[];
  programs: Program[];
  counts: PaymentStatusCounts;
  today: { minor: number; currency: string };
  firstPage: PaymentsPage;
  revenueRows: RevenueRow[];
  origin: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const dismiss = useCallback(() => setMsg(null), []);

  // ── the list ──
  const [rows, setRows] = useState<PaymentListRow[]>(firstPage.payments);
  const [total, setTotal] = useState(firstPage.total);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  // The first page follows the route refresh after a retry (legacy
  // re-fetched); a filter in force is re-applied below.
  const [filters, setFilters] = useState<PaymentFilters>(EMPTY_PAYMENT_FILTERS);
  // The filters in force, for the handlers (Load More, the retry's
  // reload); written only in applyFilter, never during render.
  const filtersRef = useRef<PaymentFilters>(EMPTY_PAYMENT_FILTERS);

  const [searchText, setSearchText] = useState('');
  const searchTimer = useRef<number | null>(null);

  async function loadPayments(nextFilters: PaymentFilters, nextPage: number, append: boolean) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const result = await listPaymentsAction(nextFilters, nextPage);
      setTotal(result.total);
      setRows((cur) => (append ? [...cur, ...result.payments] : result.payments));
      setPage(nextPage);
    } catch (err) {
      console.error('loadPayments:', err);
      setMsg({ text: 'Could not load payments. Please try again.', tone: 'error' });
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  function applyFilter(patch: Partial<PaymentFilters>) {
    const next = { ...filtersRef.current, ...patch };
    filtersRef.current = next;
    setFilters(next);
    loadPayments(next, 0, false);
  }

  // legacy applyFilters: the search input waits 300 ms.
  function onSearchChange(value: string) {
    setSearchText(value);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => applyFilter({ search: value.trim() }), 300);
  }

  function clearFilters() {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    setSearchText('');
    applyFilter({ ...EMPTY_PAYMENT_FILTERS });
  }

  function loadMore() {
    loadPayments(filtersRef.current, page + 1, true);
  }

  useEffect(() => () => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
  }, []);

  // Programme filter — client-side over the joined student, as legacy.
  const shown = filters.programId ? rows.filter((p) => (p.users?.program_id || '') === filters.programId) : rows;

  // ── stats ──
  const statTotal = counts.ACTIVATED + counts.PAID + counts.SETUP_REQUIRED + counts.FAILED + counts.INIT;

  // ── side panel ──
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [rawOpen, setRawOpen] = useState(false);
  const [retryState, setRetryState] = useState<'idle' | 'busy' | 'done'>('idle');
  const panel = selectedRef ? rows.find((p) => p.reference === selectedRef) ?? null : null;

  function openPanel(reference: string) {
    setSelectedRef(reference);
    setRawOpen(false);
    setRetryState('idle');
  }

  function closePanel() {
    setSelectedRef(null);
  }

  // legacy retryActivation: the verify route again, and on SETUP_REQUIRED
  // the setup email — both inside the action (slice 10).
  async function retryActivation(reference: string) {
    setRetryState('busy');
    try {
      const data = await retryActivationAction(reference);

      if (!data.ok) {
        setMsg({ text: `Retry failed: ${data.error === 'payment_failed' ? data.failure_note : data.message || data.error || 'Activation failed.'}`, tone: 'error' });
        setRetryState('idle');
        return;
      }

      if (data.status === 'ACTIVATED') {
        setMsg({ text: 'Activation successful! Subscription has been created.', tone: 'success' });
        setRetryState('done');
      } else if (data.status === 'SETUP_REQUIRED') {
        setMsg({ text: 'Payment verified but no account found yet. Student needs to complete setup.', tone: 'info' });
        setRetryState('idle');
      } else {
        setMsg({ text: `Status returned: ${(data as { status?: string }).status || 'unknown'}. Check Paystack dashboard.`, tone: 'info' });
        setRetryState('idle');
      }

      // legacy: loadStats() + loadPayments(false) — the counts come from
      // the route, the list from the action with the filters in force.
      router.refresh();
      await loadPayments(filtersRef.current, 0, false);
    } catch (err) {
      setMsg({ text: `Network error: ${err instanceof Error ? err.message : String(err)}`, tone: 'error' });
      setRetryState('idle');
    }
  }

  // legacy copySetupLink — on this site's own address.
  function copySetupLink(reference: string, setupToken: string) {
    const url = `${origin}/payment-confirmation?reference=${encodeURIComponent(reference)}&setup_token=${encodeURIComponent(setupToken)}`;
    navigator.clipboard
      .writeText(url)
      .then(() => setMsg({ text: 'Setup link copied to clipboard. Send it to the student.', tone: 'success' }))
      .catch(() => setMsg({ text: 'Could not copy. URL: ' + url, tone: 'error' }));
  }

  // ── revenue summary (legacy renderRevenue) ──
  const byProduct = new Map<string, { total: number; count: number }>();
  let grandTotal = 0;
  let revenueCurrency = 'GHS';
  for (const r of revenueRows) {
    const prod = products.find((x) => x.product_id === r.product_id);
    const key = prod?.name || r.product_id || 'Unknown';
    const amt = Number(r.amount_minor_paid || 0);
    revenueCurrency = r.currency || revenueCurrency;
    grandTotal += amt;
    const cur = byProduct.get(key) || { total: 0, count: 0 };
    cur.total += amt;
    cur.count += 1;
    byProduct.set(key, cur);
  }
  const revenueItems = Array.from(byProduct.entries()).sort((a, b) => b[1].total - a[1].total);

  const panelName = panel ? getUserName(panel) : '';

  return (
    <div className="pay">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />

      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-mini"><div className="label">Total</div><div className="value">{statTotal}</div></div>
        <div className="stat-mini"><div className="label">Activated</div><div className="value success">{counts.ACTIVATED}</div></div>
        <div className="stat-mini"><div className="label">Paid (stuck)</div><div className="value warning">{counts.PAID}</div></div>
        <div className="stat-mini"><div className="label">Setup Required</div><div className="value setup">{counts.SETUP_REQUIRED}</div></div>
        <div className="stat-mini"><div className="label">Failed</div><div className="value danger">{counts.FAILED}</div></div>
        <div className="stat-mini"><div className="label">Abandoned</div><div className="value muted">{counts.INIT}</div></div>
        <div className="stat-mini"><div className="label">Today&apos;s Revenue</div><div className="value accent">{today.minor > 0 ? formatMinor(today.minor, today.currency) : '—'}</div></div>
      </div>

      {/* Filters bar */}
      <div className="filters-bar">
        <div className="filter-group">
          <label htmlFor="filterSearch">Search</label>
          <input type="text" id="filterSearch" placeholder="Email or reference…" value={searchText} onChange={(e) => onSearchChange(e.target.value)} />
        </div>
        <div className="filter-group">
          <label htmlFor="filterStatus">Status</label>
          <select id="filterStatus" value={filters.status} onChange={(e) => applyFilter({ status: e.target.value })}>
            <option value="">All statuses</option>
            <option value="ACTIVATED">Activated</option>
            <option value="PAID">Paid (stuck)</option>
            <option value="SETUP_REQUIRED">Setup Required</option>
            <option value="FAILED">Failed</option>
            <option value="INIT">Abandoned</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filterProduct">Product</label>
          <select id="filterProduct" value={filters.productId} onChange={(e) => applyFilter({ productId: e.target.value })}>
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.product_id} value={p.product_id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filterProgramme">Programme</label>
          <select id="filterProgramme" value={filters.programId} onChange={(e) => applyFilter({ programId: e.target.value })}>
            <option value="">All programmes</option>
            {programs.map((p) => (
              <option key={p.program_id} value={p.program_id}>{p.program_id} — {p.program_name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filterFrom">From</label>
          <input type="date" id="filterFrom" value={filters.dateFrom} onChange={(e) => applyFilter({ dateFrom: e.target.value })} />
        </div>
        <div className="filter-group">
          <label htmlFor="filterTo">To</label>
          <input type="date" id="filterTo" value={filters.dateTo} onChange={(e) => applyFilter({ dateTo: e.target.value })} />
        </div>
        <div className="filter-actions">
          <button type="button" className="btn btn-ghost" onClick={clearFilters}>Clear</button>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <div className="table-header">
          <h3>All Payments</h3>
          <span className="result-count">
            {loading && rows.length === 0 ? 'Loading…' : `Showing ${shown.length} of ${total} payment${total !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div className="table-area">
          {loading && rows.length === 0 ? (
            <div className="empty-state">Loading payments…</div>
          ) : shown.length === 0 ? (
            <div className="empty-state">No payments match your filters.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Student</th>
                  <th>Product</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Paid</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.reference} onClick={() => openPanel(p.reference)}>
                    <td className="mono muted">{p.reference}</td>
                    <td>
                      <div className="student-name">{getUserName(p)}</div>
                      <div className="student-email">{p.email || '—'}</div>
                    </td>
                    <td className="cell-13">{p.products?.name || '—'}</td>
                    <td className="cell-13 bold">
                      {p.amount_minor_paid
                        ? formatMinor(p.amount_minor_paid, p.currency)
                        : p.amount_minor_expected
                          ? `(${formatMinor(p.amount_minor_expected, p.currency)})`
                          : '—'}
                    </td>
                    <td><span className={`badge ${p.status}`}>{formatStatus(p.status)}</span></td>
                    <td className="cell-12 muted nowrap">{formatDay(p.paid_utc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Load More */}
      {shown.length < total ? (
        <div className="load-more">
          <button type="button" className="btn btn-ghost" disabled={loading} onClick={loadMore}>{loading ? 'Loading…' : 'Load More'}</button>
        </div>
      ) : null}

      {/* Revenue Summary */}
      {revenueItems.length > 0 ? (
        <div className="revenue-card">
          <h3>Revenue Summary — Activated Payments Only</h3>
          <div className="revenue-grid">
            {revenueItems.map(([name, data]) => (
              <div key={name} className="revenue-item">
                <div className="r-label">{name}</div>
                <div className="r-value">{formatMinor(data.total, revenueCurrency)}</div>
                <div className="r-count">{data.count} payment{data.count !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
          <div className="revenue-total">
            Total collected: <strong>{formatMinor(grandTotal, revenueCurrency)}</strong> across {revenueRows.length} activated payment{revenueRows.length !== 1 ? 's' : ''}
          </div>
        </div>
      ) : null}

      <BodyPortal>
        <div className="pay-overlay">
          <div className={`overlay${panel ? ' show' : ''}`} onClick={closePanel} />
          <div className={`side-panel${panel ? ' open' : ''}`} aria-hidden={!panel}>
            {panel ? (
              <>
                <div className="panel-header">
                  <h3>Payment — {panel.reference}</h3>
                  <button type="button" className="panel-close" onClick={closePanel}>×</button>
                </div>
                <div className="panel-body">
                  <div className="detail-section">
                    <div className="detail-section-title">Payment</div>
                    <div className="detail-row"><span className="key">Reference</span><span className="val mono small">{panel.reference}</span></div>
                    <div className="detail-row"><span className="key">Status</span><span className="val"><span className={`badge ${panel.status}`}>{formatStatus(panel.status)}</span></span></div>
                    <div className="detail-row"><span className="key">Product</span><span className="val">{panel.products?.name || panel.product_name || '—'}</span></div>
                    <div className="detail-row"><span className="key">Expected</span><span className="val">{panel.amount_minor_expected ? formatMinor(panel.amount_minor_expected, panel.currency) : '—'}</span></div>
                    <div className="detail-row"><span className="key">Paid</span><span className={`val${panel.amount_minor_paid ? ' paid' : ''}`}>{panel.amount_minor_paid ? formatMinor(panel.amount_minor_paid, panel.currency) : '—'}</span></div>
                  </div>

                  <div className="detail-section">
                    <div className="detail-section-title">Student</div>
                    <div className="detail-row"><span className="key">Name</span><span className="val">{panelName}</span></div>
                    <div className="detail-row"><span className="key">Email</span><span className="val">{panel.email || '—'}</span></div>
                    <div className="detail-row"><span className="key">Programme</span><span className="val">{panel.users?.program_id || panel.program_id || '—'}</span></div>
                    <div className="detail-row"><span className="key">Phone</span><span className="val">{panel.phone_number || '—'}</span></div>
                  </div>

                  <div className="detail-section">
                    <div className="detail-section-title">Timeline</div>
                    <div className="detail-row"><span className="key">Paid</span><span className="val">{formatTs(panel.paid_utc)}</span></div>
                    <div className="detail-row"><span className="key">Activated</span><span className="val">{formatTs(panel.activated_utc)}</span></div>
                    {panel.setup_created_utc ? <div className="detail-row"><span className="key">Setup Started</span><span className="val">{formatTs(panel.setup_created_utc)}</span></div> : null}
                    {panel.setup_completed_utc ? <div className="detail-row"><span className="key">Setup Completed</span><span className="val">{formatTs(panel.setup_completed_utc)}</span></div> : null}
                  </div>

                  {panel.subscription_id ? (
                    <div className="detail-section">
                      <div className="detail-section-title">Subscription</div>
                      <div className="detail-row"><span className="key">ID</span><span className="val mono small">{panel.subscription_id}</span></div>
                    </div>
                  ) : null}

                  {panel.status === 'FAILED' && panel.failure_note ? (
                    <div className="detail-section">
                      <div className="detail-section-title">Failure Reason</div>
                      <div className="failure-note">{panel.failure_note}</div>
                    </div>
                  ) : null}

                  {panel.raw ? (
                    <div className="detail-section">
                      <div className="detail-section-title">Debug</div>
                      <button type="button" className="raw-toggle" onClick={() => setRawOpen((v) => !v)}>
                        {rawOpen ? '▼ Hide raw payload' : '▶ Show raw payload'}
                      </button>
                      <div className={`raw-box${rawOpen ? ' show' : ''}`}>{JSON.stringify(panel.raw, null, 2)}</div>
                    </div>
                  ) : null}
                </div>
                <div className="panel-actions">
                  <button type="button" className="btn btn-ghost" onClick={closePanel}>Close</button>
                  {panel.users?.user_id ? (
                    <a className="btn btn-ghost" href={`/admin/users?user_id=${encodeURIComponent(panel.users.user_id)}`}><Icon name="user" />View Student</a>
                  ) : null}
                  {panel.status === 'PAID' || panel.status === 'SETUP_REQUIRED' ? (
                    <button type="button" className="btn btn-warn" disabled={retryState !== 'idle'} onClick={() => retryActivation(panel.reference)}>
                      {retryState === 'busy' ? 'Retrying…' : retryState === 'done' ? 'Activated ✓' : <><Icon name="zap" />Retry Activation</>}
                    </button>
                  ) : null}
                  {panel.status === 'SETUP_REQUIRED' && panel.setup_token ? (
                    <button type="button" className="btn btn-accent" onClick={() => copySetupLink(panel.reference, panel.setup_token || '')}><Icon name="clipboard" />Copy Setup Link</button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </BodyPortal>
    </div>
  );
}
