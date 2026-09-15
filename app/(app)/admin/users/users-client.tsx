// app/(app)/admin/users/users-client.tsx
//
// The script block of legacy admin/users.html (slice 14a): the toolbar
// (search debounced 300 ms; role and programme filters applied at
// once), the table of 50 with Load More and "Showing X of Y", the side
// drawer (the profile fields, the active subscription with its expiry
// state, the subscription history) and its three actions — Assign
// Subscription with a product and an optional start date, Send
// Password Reset Email, Deactivate / Reactivate. After an action the
// drawer re-reads and the list reloads, as legacy did.
//
// Changed on the way, on Sam's rulings (2026-09-15): the drawer's
// Assign calls slice 8's grantSubscription instead of inserting a row
// from the browser (§9 #24 — extends an existing subscription, never a
// duplicate); a `?user_id=` in the address opens the drawer (§9 #23);
// the role filter has no Teacher option (§9 #12); the drawer's inline
// alert is the shared toast (UI convention #1); prices through
// formatMinor() (#4).

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Toast } from '@/lib/toast/toast';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { formatMinor } from '@/lib/money/format-minor';
import { grantSubscription } from '@/lib/subscriptions/actions';
import { getUserDetailAction, listUsersAction, sendPasswordResetAction, setUserActive } from '@/lib/users/actions';
import { EMPTY_USER_FILTERS, USER_ROLE_OPTIONS, type UserDetail, type UserFilters, type UserListRow, type UsersPage } from '@/lib/users/types';
import type { Product, Program } from '@/lib/catalogue/types';

type Msg = { text: string; tone: 'error' | 'success' } | null;

const ROLE_LABELS: Record<string, string> = { STUDENT: 'Student', ADMIN: 'Admin' };

function fmtDay(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function displayName(u: { name: string | null; forename: string | null; surname: string | null; email?: string | null }): string {
  return u.name || `${u.forename || ''} ${u.surname || ''}`.trim() || u.email || '—';
}

export function UsersClient({
  programs,
  products,
  firstPage,
  openUserId,
}: {
  programs: Program[];
  products: Product[];
  firstPage: UsersPage;
  openUserId: string;
}) {
  const [msg, setMsg] = useState<Msg>(null);
  const dismiss = useCallback(() => setMsg(null), []);

  // ── the list ──
  const [rows, setRows] = useState<UserListRow[]>(firstPage.users);
  const [total, setTotal] = useState(firstPage.total);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [filters, setFilters] = useState<UserFilters>(EMPTY_USER_FILTERS);
  const filtersRef = useRef<UserFilters>(EMPTY_USER_FILTERS);
  const [searchText, setSearchText] = useState('');
  const searchTimer = useRef<number | null>(null);

  async function loadUsers(nextFilters: UserFilters, nextPage: number, append: boolean) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const result = await listUsersAction(nextFilters, nextPage);
      setTotal(result.total);
      setRows((cur) => (append ? [...cur, ...result.users] : result.users));
      setPage(nextPage);
    } catch (err) {
      console.error('loadUsers:', err);
      setMsg({ text: 'Could not load users. Please try again.', tone: 'error' });
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  function applyFilter(patch: Partial<UserFilters>) {
    const next = { ...filtersRef.current, ...patch };
    filtersRef.current = next;
    setFilters(next);
    loadUsers(next, 0, false);
  }

  function onSearchChange(value: string) {
    setSearchText(value);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => applyFilter({ search: value.trim() }), 300);
  }

  function loadMore() {
    loadUsers(filtersRef.current, page + 1, true);
  }

  // ── the drawer ──
  const [panelOpen, setPanelOpen] = useState(false);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  // "Now" as of the drawer's read — the expiry arithmetic below must not
  // read the clock during render (react-hooks/purity).
  const [loadedAt, setLoadedAt] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignProduct, setAssignProduct] = useState('');
  const [assignStart, setAssignStart] = useState('');
  const [busy, setBusy] = useState(false);

  async function openPanel(userId: string) {
    setPanelOpen(true);
    setDetail(null);
    setDetailLoading(true);
    setAssignOpen(false);
    try {
      const d = await getUserDetailAction(userId);
      setLoadedAt(Date.now());
      setDetail(d);
      if (!d) setMsg({ text: 'User not found.', tone: 'error' });
    } finally {
      setDetailLoading(false);
    }
  }

  function closePanel() {
    setPanelOpen(false);
    setAssignOpen(false);
    setDetail(null);
  }

  // A `?user_id=` in the address opens the drawer on arrival (§9 #23).
  useEffect(() => {
    if (!openUserId) return;
    const id = window.setTimeout(() => openPanel(openUserId), 0);
    return () => window.clearTimeout(id);
    // Runs once, for the address the page arrived with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
  }, []);

  async function submitAssign() {
    if (!detail) return;
    if (!assignProduct) {
      setMsg({ text: 'Please select a product.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      const result = await grantSubscription(detail.user_id, assignProduct, assignStart);
      if (!result.ok) {
        setMsg({ text: result.error, tone: 'error' });
        return;
      }
      setMsg({ text: 'Subscription assigned successfully!', tone: 'success' });
      setAssignOpen(false);
      setAssignProduct('');
      setAssignStart('');
      await openPanel(detail.user_id);
      await loadUsers(filtersRef.current, 0, false);
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordReset() {
    if (!detail) return;
    setBusy(true);
    try {
      const result = await sendPasswordResetAction(detail.email);
      if (!result.ok) {
        setMsg({ text: 'Failed to send reset email: ' + result.error, tone: 'error' });
        return;
      }
      setMsg({ text: 'Password reset email sent to ' + detail.email, tone: 'success' });
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive() {
    if (!detail) return;
    setBusy(true);
    try {
      const result = await setUserActive(detail.user_id, !detail.active);
      if (!result.ok) {
        setMsg({ text: 'Action failed. Please try again.', tone: 'error' });
        return;
      }
      setMsg({ text: `Account ${detail.active ? 'deactivated' : 'reactivated'} successfully.`, tone: 'success' });
      await openPanel(detail.user_id);
      await loadUsers(filtersRef.current, 0, false);
    } finally {
      setBusy(false);
    }
  }

  // ── the drawer's derived bits ──
  const sub = detail?.activeSubscription ?? null;
  let expiryClass = '';
  let expiryText = '';
  if (sub) {
    const expiry = new Date(sub.expires_utc);
    const daysLeft = Math.ceil((expiry.getTime() - loadedAt) / (1000 * 60 * 60 * 24));
    expiryClass = daysLeft < 0 ? 'expired' : daysLeft <= 7 ? 'warning' : '';
    expiryText =
      daysLeft < 0
        ? `Expired ${expiry.toLocaleDateString('en-GB')}`
        : daysLeft <= 7
          ? `⚠️ Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
          : `Expires ${fmtDay(sub.expires_utc)}`;
  }

  const schoolText = detail?.schools
    ? { name: detail.schools.name, note: detail.schools.region }
    : detail?.school_other
      ? { name: detail.school_other, note: 'not listed' }
      : null;

  return (
    <div className="usr">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />

      {/* Toolbar */}
      <div className="page-toolbar">
        <input type="text" className="search-input" id="searchInput" placeholder="Search by name or email..." value={searchText} onChange={(e) => onSearchChange(e.target.value)} />
        <select className="filter-select" id="roleFilter" value={filters.role} onChange={(e) => applyFilter({ role: e.target.value })}>
          <option value="">All Roles</option>
          {USER_ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <select className="filter-select" id="programFilter" value={filters.programId} onChange={(e) => applyFilter({ programId: e.target.value })}>
          <option value="">All Programmes</option>
          {programs.map((p) => (
            <option key={p.program_id} value={p.program_id}>{p.program_name}</option>
          ))}
        </select>
      </div>

      <div className="results-count">
        {loading && rows.length === 0 ? '' : `Showing ${rows.length} of ${total} user${total !== 1 ? 's' : ''}`}
      </div>

      <div className="card table-card">
        {loading && rows.length === 0 ? (
          <p className="table-note">Loading users...</p>
        ) : rows.length === 0 ? (
          <p className="table-note">No users found.</p>
        ) : (
          <div className="table-scroll">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Name / Email</th>
                  <th>Programme</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.user_id} onClick={() => openPanel(u.user_id)}>
                    <td>
                      <div className="u-name">{displayName(u)}</div>
                      <div className="u-email">{u.email || '—'}</div>
                    </td>
                    <td>{u.program_id || '—'}</td>
                    <td><span className={`role-chip ${u.role}`}>{u.role}</span></td>
                    <td className="cell-13"><span className={`status-dot ${u.active ? 'active' : 'inactive'}`} />{u.active ? 'Active' : 'Inactive'}</td>
                    <td className="cell-13 muted">{fmtDay(u.created_utc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rows.length < total ? (
        <button type="button" className="btn-action load-more" disabled={loading} onClick={loadMore}>
          {loading ? 'Loading…' : 'Load More'}
        </button>
      ) : null}

      <BodyPortal>
        <div className="usr-overlay">
          <div className={`panel-overlay${panelOpen ? ' open' : ''}`} onClick={closePanel} />
          <div className={`side-panel${panelOpen ? ' open' : ''}`} aria-hidden={!panelOpen}>
            <div className="panel-header">
              <h2>{detail ? displayName(detail) : 'User Details'}</h2>
              <button type="button" className="panel-close" onClick={closePanel}>×</button>
            </div>

            <div className="panel-body">
              <div className="panel-section">
                <div className="panel-section-title">Profile</div>
                {detailLoading || !detail ? (
                  <p className="muted-14">{detailLoading ? 'Loading...' : ''}</p>
                ) : (
                  <>
                    <div className="detail-row"><span className="detail-label">Full Name</span><span className="detail-value">{detail.name || '—'}</span></div>
                    <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value">{detail.email || '—'}</span></div>
                    <div className="detail-row"><span className="detail-label">Phone / WhatsApp</span><span className="detail-value">{detail.phone_number || '—'}</span></div>
                    <div className="detail-row"><span className="detail-label">Programme</span><span className="detail-value">{detail.program_id || '—'}</span></div>
                    <div className="detail-row">
                      <span className="detail-label">School</span>
                      <span className="detail-value">
                        {schoolText ? (
                          <>
                            {schoolText.name} <span className="detail-note">({schoolText.note})</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </span>
                    </div>
                    <div className="detail-row"><span className="detail-label">Level</span><span className="detail-value">{detail.level || '—'}</span></div>
                    <div className="detail-row"><span className="detail-label">Cohort</span><span className="detail-value">{detail.cohort ? String(detail.cohort) : '—'}</span></div>
                    <div className="detail-row"><span className="detail-label">Referral source</span><span className="detail-value">{detail.referral_source || '—'}</span></div>
                    <div className="detail-row"><span className="detail-label">Role</span><span className="detail-value"><span className={`role-chip ${detail.role}`}>{detail.role}</span></span></div>
                    <div className="detail-row">
                      <span className="detail-label">Account Status</span>
                      <span className="detail-value"><span className={`status-dot ${detail.active ? 'active' : 'inactive'}`} />{detail.active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div className="detail-row"><span className="detail-label">Joined</span><span className="detail-value">{fmtDay(detail.created_utc)}</span></div>
                  </>
                )}
              </div>

              {detail ? (
                <>
                  <div className="panel-section">
                    <div className="panel-section-title">Active Subscription</div>
                    {sub ? (
                      <div className="sub-card">
                        <div className="sub-card-name">{sub.products?.name || 'Subscription'}</div>
                        <div className={`sub-card-expiry ${expiryClass}`}>{expiryText}</div>
                      </div>
                    ) : (
                      <div className="no-sub-badge">No active subscription</div>
                    )}
                  </div>

                  <div className="panel-section">
                    <div className="panel-section-title">Subscription History</div>
                    {detail.subscriptionHistory.length === 0 ? (
                      <p className="muted-13">No subscription history.</p>
                    ) : (
                      <table className="history-table">
                        <thead>
                          <tr><th>Product</th><th>Start</th><th>Expires</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          {detail.subscriptionHistory.map((h) => (
                            <tr key={h.subscription_id}>
                              <td>{h.products?.name || '—'}</td>
                              <td>{fmtDay(h.start_utc)}</td>
                              <td>{fmtDay(h.expires_utc)}</td>
                              <td>{h.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="panel-section">
                    <div className="panel-section-title">Actions</div>
                    <div className="panel-actions">
                      <button type="button" className="btn-action" onClick={() => setAssignOpen((v) => !v)}>🎟️ Assign Subscription</button>
                      <div className={`assign-form${assignOpen ? ' open' : ''}`}>
                        <select id="assignProduct" value={assignProduct} onChange={(e) => setAssignProduct(e.target.value)}>
                          <option value="">Select a product...</option>
                          {products.map((p) => (
                            <option key={p.product_id} value={p.product_id}>
                              {p.name}
                              {p.price_minor > 0 ? ` — ${formatMinor(p.price_minor, p.currency)}` : ' — Free'} ({p.duration_days}d)
                            </option>
                          ))}
                        </select>
                        <input type="date" id="assignStartDate" title="Start date (leave blank for today)" value={assignStart} onChange={(e) => setAssignStart(e.target.value)} />
                        <div className="assign-form-actions">
                          <button type="button" className="btn-sm btn-sm-primary" disabled={busy} onClick={submitAssign}>Confirm</button>
                          <button type="button" className="btn-sm btn-sm-cancel" onClick={() => setAssignOpen(false)}>Cancel</button>
                        </div>
                      </div>

                      <button type="button" className="btn-action" disabled={busy} onClick={handlePasswordReset}>🔑 Send Password Reset Email</button>

                      <button type="button" className={`btn-action ${detail.active ? 'danger' : 'success'}`} disabled={busy} onClick={handleToggleActive}>
                        {detail.active ? '🚫 Deactivate Account' : '✅ Reactivate Account'}
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </BodyPortal>
    </div>
  );
}
