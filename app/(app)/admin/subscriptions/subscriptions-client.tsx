// app/(app)/admin/subscriptions/subscriptions-client.tsx
//
// The script block of legacy admin/subscriptions.html (slice 8): the
// seven-counter stats row, the six filters and the Expiring Soon toggle,
// the table grouped by student (first row full, the rest indented), the
// side panel, the Grant dialog with its live student search and expiry
// preview, the Edit dialog, the Revoke dialog, and the Sync Status
// button. The lists arrive as props; after a write the route is
// refreshed so the props carry the new rows (legacy re-fetched). Errors
// and "done" messages are toasts (UI convention #1) where legacy used
// the dialogs' inline alert boxes or a browser alert().
//
// The two emails legacy fired after a grant and a revoke are slice 10;
// the Grant dialog's line promising one is legacy copy and stays.
//
// One legacy quirk changed: the student search ran a query on every
// keystroke; here it waits 250 ms after typing stops. Same results.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import {
  grantSubscription,
  revokeSubscription,
  searchStudentsAction,
  syncExpiredSubscriptions,
  updateSubscription,
} from '@/lib/subscriptions/actions';
import { SUB_STATUSES, type StudentHit, type SubscriptionListRow } from '@/lib/subscriptions/types';
import type { Product, Program } from '@/lib/catalogue/types';

type Msg = { text: string; tone: 'error' | 'success' } | null;

const DAY_MS = 24 * 60 * 60 * 1000;

function studentName(u: SubscriptionListRow['users']): string {
  if (!u) return '—';
  return u.name || `${u.forename || ''} ${u.surname || ''}`.trim() || '—';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateLong(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const SOURCE_LABELS: Record<string, string> = {
  PAYSTACK: 'Paystack',
  ADMIN: 'Admin',
  SELF_TRIAL_SIGNUP: 'Self-trial signup',
};

export function SubscriptionsClient({
  subscriptions,
  products,
  programs,
}: {
  subscriptions: SubscriptionListRow[];
  products: Product[];
  programs: Program[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const dismiss = useCallback(() => setMsg(null), []);
  const err = (text: string) => setMsg({ text, tone: 'error' });
  const ok = (text: string) => setMsg({ text, tone: 'success' });

  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * DAY_MS);
  const isExpiringSoon = (s: SubscriptionListRow) => {
    const exp = new Date(s.expires_utc);
    return s.status === 'ACTIVE' && exp <= in7 && exp >= now;
  };

  // ── stats (legacy updateStats) ──
  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter((s) => s.status === 'ACTIVE').length,
    expired: subscriptions.filter((s) => s.status === 'EXPIRED').length,
    paid: subscriptions.filter((s) => s.products?.kind === 'PAID').length,
    trial: subscriptions.filter((s) => s.products?.kind === 'TRIAL').length,
    free: subscriptions.filter((s) => s.products?.kind === 'FREE').length,
    expiring: subscriptions.filter(isExpiringSoon).length,
  };

  // ── filters (legacy applyFilters) ──
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fKind, setFKind] = useState('');
  const [fProduct, setFProduct] = useState('');
  const [fProgramme, setFProgramme] = useState('');
  const [fSource, setFSource] = useState('');
  const [showExpiring, setShowExpiring] = useState(false);

  const q = search.toLowerCase().trim();
  const filtered = subscriptions.filter((s) => {
    const u = s.users;
    const fullName = studentName(u).toLowerCase();
    const email = (u?.email || '').toLowerCase();
    if (q && !fullName.includes(q) && !email.includes(q)) return false;
    if (fStatus && s.status !== fStatus) return false;
    if (fKind && s.products?.kind !== fKind) return false;
    if (fProduct && s.product_id !== fProduct) return false;
    if (fProgramme && u?.program_id !== fProgramme) return false;
    if (fSource && s.source !== fSource) return false;
    if (showExpiring && !isExpiringSoon(s)) return false;
    return true;
  });

  function clearFilters() {
    setSearch('');
    setFStatus('');
    setFKind('');
    setFProduct('');
    setFProgramme('');
    setFSource('');
    setShowExpiring(false);
  }

  // ── table rows (legacy renderTable): by student name, then start desc; grouped ──
  const sorted = [...filtered].sort((a, b) => {
    const nameA = studentName(a.users).toLowerCase();
    const nameB = studentName(b.users).toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return new Date(b.start_utc).getTime() - new Date(a.start_utc).getTime();
  });
  const userSubCount: Record<string, number> = {};
  for (const s of sorted) userSubCount[s.user_id] = (userSubCount[s.user_id] || 0) + 1;
  const seen = new Set<string>();

  // ── side panel ──
  const [panelId, setPanelId] = useState<string | null>(null);
  const panelSub = panelId ? subscriptions.find((s) => s.subscription_id === panelId) ?? null : null;
  const closePanel = () => setPanelId(null);

  // ── Grant dialog ──
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantSearch, setGrantSearch] = useState('');
  const [grantHits, setGrantHits] = useState<StudentHit[] | null>(null);
  const [grantUserId, setGrantUserId] = useState('');
  const [grantUserLabel, setGrantUserLabel] = useState('');
  const [grantProduct, setGrantProduct] = useState('');
  const [grantStart, setGrantStart] = useState('');
  const [grantBusy, setGrantBusy] = useState<'idle' | 'granting' | 'granted'>('idle');

  const activeProducts = products.filter((p) => String(p.status || '').toLowerCase() === 'active');

  function resetGrant() {
    setGrantSearch('');
    setGrantHits(null);
    setGrantUserId('');
    setGrantUserLabel('');
    setGrantProduct('');
    setGrantStart('');
    setGrantBusy('idle');
  }

  function openGrantModal() {
    resetGrant();
    setGrantOpen(true);
  }

  function openGrantForUser(userId: string, name: string, email: string) {
    resetGrant();
    setGrantSearch(name);
    setGrantUserId(userId);
    setGrantUserLabel(`${name} (${email})`);
    setGrantOpen(true);
  }

  // legacy searchGrantUser: typing clears the selection; 2+ chars searches.
  useEffect(() => {
    if (!grantOpen) return;
    const term = grantSearch.trim();
    if (grantUserId || term.length < 2) return;
    const id = window.setTimeout(async () => {
      const hits = await searchStudentsAction(term);
      setGrantHits(hits);
    }, 250);
    return () => window.clearTimeout(id);
  }, [grantSearch, grantOpen, grantUserId]);

  function onGrantSearchChange(value: string) {
    setGrantSearch(value);
    setGrantUserId('');
    setGrantUserLabel('');
    if (value.trim().length < 2) setGrantHits(null);
  }

  function selectGrantUser(u: StudentHit) {
    const name = studentName(u);
    setGrantUserId(u.user_id);
    setGrantSearch(name);
    setGrantUserLabel(`${name} (${u.email})`);
    setGrantHits(null);
  }

  function clearSelectedUser() {
    setGrantUserId('');
    setGrantSearch('');
    setGrantUserLabel('');
  }

  // legacy updateDurationPreview
  const grantProductRow = activeProducts.find((p) => p.product_id === grantProduct);
  let durationPreview = '';
  if (grantProductRow && grantProductRow.duration_days) {
    const start = grantStart ? new Date(grantStart) : new Date();
    const expiry = new Date(start.getTime() + grantProductRow.duration_days * DAY_MS);
    durationPreview = `✅ Access will be granted for ${grantProductRow.duration_days} days — expires ${fmtDateLong(expiry)}`;
  }

  async function submitGrant() {
    if (!grantUserId) return err('Please select a student.');
    if (!grantProduct) return err('Please select a product.');

    setGrantBusy('granting');
    const result = await grantSubscription(grantUserId, grantProduct, grantStart || '');
    if (!result.ok) {
      setGrantBusy('idle');
      return err(result.error);
    }
    setGrantBusy('granted');
    ok('✅ Subscription granted successfully.');
    router.refresh();
    window.setTimeout(() => setGrantOpen(false), 1800);
  }

  // ── Edit dialog ──
  const [editId, setEditId] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editExpiry, setEditExpiry] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [editSource, setEditSource] = useState('ADMIN');
  const [editSourceRef, setEditSourceRef] = useState('');
  const [editBusy, setEditBusy] = useState<'idle' | 'saving' | 'saved'>('idle');
  const editSub = editId ? subscriptions.find((s) => s.subscription_id === editId) ?? null : null;

  function openEditModal(subId: string) {
    const s = subscriptions.find((x) => x.subscription_id === subId);
    if (!s) return;
    setEditId(subId);
    setEditProduct(s.product_id || '');
    setEditStatus(s.status);
    setEditSource(s.source || 'ADMIN');
    setEditSourceRef(s.source_ref || '');
    setEditStart(s.start_utc ? s.start_utc.substring(0, 10) : '');
    setEditExpiry(s.expires_utc ? s.expires_utc.substring(0, 10) : '');
    setEditBusy('idle');
  }

  // legacy updateEditPreview: a product or start change recalculates the expiry.
  function recalcExpiry(productId: string, start: string) {
    const p = products.find((x) => x.product_id === productId);
    if (!p?.duration_days || !start) return;
    const expiry = new Date(new Date(start).getTime() + p.duration_days * DAY_MS);
    setEditExpiry(expiry.toISOString().substring(0, 10));
  }

  async function submitEdit() {
    if (!editId) return;
    if (!editProduct) return err('Please select a product.');
    if (!editStart) return err('Please set a start date.');
    if (!editExpiry) return err('Please set an expiry date.');

    setEditBusy('saving');
    const result = await updateSubscription({
      subscriptionId: editId,
      productId: editProduct,
      startDate: editStart,
      expiryDate: editExpiry,
      status: editStatus,
      source: editSource,
      sourceRef: editSourceRef.trim(),
    });
    if (!result.ok) {
      setEditBusy('idle');
      return err(result.error);
    }
    setEditBusy('saved');
    ok('✅ Subscription updated successfully.');
    router.refresh();
    window.setTimeout(() => {
      setEditId(null);
      closePanel();
    }, 1500);
  }

  // ── Revoke dialog ──
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);
  const [revoking, setRevoking] = useState(false);

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    const result = await revokeSubscription(revokeTarget.id);
    setRevoking(false);
    if (!result.ok) return err(result.error);
    setRevokeTarget(null);
    closePanel();
    router.refresh();
  }

  // ── Sync Status ──
  const [syncLabel, setSyncLabel] = useState('🔄 Sync Status');
  const [syncing, setSyncing] = useState(false);

  async function syncStatus() {
    setSyncing(true);
    setSyncLabel('Syncing…');
    const result = await syncExpiredSubscriptions();
    if (!result.ok) {
      err('Sync failed: ' + result.error);
      setSyncing(false);
      setSyncLabel('🔄 Sync Status');
      return;
    }
    setSyncLabel(result.updatedCount > 0 ? `✅ ${result.updatedCount} updated` : '✅ Up to date');
    router.refresh();
    window.setTimeout(() => {
      setSyncing(false);
      setSyncLabel('🔄 Sync Status');
    }, 1800);
  }

  // ── the reference column (legacy refCol) ──
  function refCell(s: SubscriptionListRow) {
    if (s.source === 'PAYSTACK' && s.source_ref) {
      return (
        <a className="ref-link" href={`/admin/payments?ref=${encodeURIComponent(s.source_ref)}`} title="View payment" onClick={(e) => e.stopPropagation()}>
          {s.source_ref.substring(0, 12)}…
        </a>
      );
    }
    if (s.source === 'ADMIN') return <span className="cell-ref">{s.source_ref || 'Admin grant'}</span>;
    if (s.source === 'SELF_TRIAL_SIGNUP') return <span className="cell-ref">{s.source_ref || 'Self-trial'}</span>;
    return <span className="cell-ref">—</span>;
  }

  const panelName = panelSub ? studentName(panelSub.users) : '';
  const panelDaysLeft = panelSub ? Math.ceil((new Date(panelSub.expires_utc).getTime() - now.getTime()) / DAY_MS) : 0;

  return (
    <div className="subs">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />

      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-mini"><div className="label">Total</div><div className="value">{stats.total}</div></div>
        <div className="stat-mini"><div className="label">Active</div><div className="value success">{stats.active}</div></div>
        <div className="stat-mini"><div className="label">Expired</div><div className="value danger">{stats.expired}</div></div>
        <div className="stat-mini"><div className="label">Paid</div><div className="value accent">{stats.paid}</div></div>
        <div className="stat-mini"><div className="label">Trial</div><div className="value">{stats.trial}</div></div>
        <div className="stat-mini"><div className="label">Free</div><div className="value muted">{stats.free}</div></div>
        <div className="stat-mini"><div className="label">Expiring (7d)</div><div className="value warning">{stats.expiring}</div></div>
      </div>

      {/* Filters bar */}
      <div className="filters-bar">
        <div className="filter-group">
          <label htmlFor="filterSearch">Search student</label>
          <input id="filterSearch" type="text" placeholder="Name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="filter-group">
          <label htmlFor="filterStatus">Status</label>
          <select id="filterStatus" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="REVOKED">Revoked</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filterKind">Kind</label>
          <select id="filterKind" value={fKind} onChange={(e) => setFKind(e.target.value)}>
            <option value="">All kinds</option>
            <option value="PAID">Paid</option>
            <option value="TRIAL">Trial</option>
            <option value="FREE">Free</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filterProduct">Product</label>
          <select id="filterProduct" value={fProduct} onChange={(e) => setFProduct(e.target.value)}>
            <option value="">All products</option>
            {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filterProgramme">Programme</label>
          <select id="filterProgramme" value={fProgramme} onChange={(e) => setFProgramme(e.target.value)}>
            <option value="">All programmes</option>
            {programs.map((p) => <option key={p.program_id} value={p.program_id}>{p.program_name}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filterSource">Source</label>
          <select id="filterSource" value={fSource} onChange={(e) => setFSource(e.target.value)}>
            <option value="">All sources</option>
            <option value="PAYSTACK">Paystack</option>
            <option value="ADMIN">Admin</option>
            <option value="SELF_TRIAL_SIGNUP">Self-trial signup</option>
          </select>
        </div>
        <button type="button" className={`filter-toggle${showExpiring ? ' active' : ''}`} onClick={() => setShowExpiring((v) => !v)}>
          ⚠️ Expiring Soon
        </button>
        <div className="filter-actions">
          <button type="button" className="btn btn-ghost" onClick={clearFilters}>Clear</button>
          <button type="button" className="btn btn-ghost" disabled={syncing} onClick={syncStatus}>{syncLabel}</button>
          <button type="button" className="btn btn-primary" onClick={openGrantModal}>+ Grant Subscription</button>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <div className="table-header">
          <h3>All Subscriptions</h3>
          <span className="result-count">{filtered.length} subscription{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        {sorted.length === 0 ? (
          <div className="empty-state">
            <p>No subscriptions match your filters.</p>
            <small>Try adjusting the filters above.</small>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Programme</th>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Start</th>
                  <th>Expires</th>
                  <th>Source</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => {
                  const u = s.users;
                  const name = studentName(u);
                  const first = !seen.has(s.user_id);
                  seen.add(s.user_id);
                  const count = userSubCount[s.user_id];
                  const expiring = isExpiringSoon(s);
                  return (
                    <tr key={s.subscription_id} className={first ? 'group-first' : 'group-continuation'} onClick={() => setPanelId(s.subscription_id)}>
                      {first ? (
                        <td>
                          <div className="cell-name">
                            {name}
                            {count > 1 ? <span className="sub-count-badge">{count} subs</span> : null}
                          </div>
                          <div className="cell-email">{u?.email || '—'}</div>
                        </td>
                      ) : (
                        <td><div className="cell-muted">↳ {name}</div></td>
                      )}
                      <td className={first ? 'cell-13' : 'cell-muted'}>{u?.program_id || '—'}</td>
                      <td className="cell-product">{s.products?.name || s.product_id || '—'}</td>
                      <td>{expiring ? <span className="chip expiring">⚠️ Expiring</span> : <span className={`chip ${s.status}`}>{s.status}</span>}</td>
                      <td className="cell-13">{fmtDate(s.start_utc)}</td>
                      <td className={`cell-13${expiring ? ' cell-expiring' : ''}`}>{fmtDate(s.expires_utc)}</td>
                      <td><span className="source-chip">{s.source || '—'}</span></td>
                      <td>{refCell(s)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BodyPortal>
        <div className="subs-overlay">
          {/* Side panel */}
          <div className={`overlay${panelSub ? ' show' : ''}`} onClick={closePanel} />
          <div className={`side-panel${panelSub ? ' open' : ''}`} aria-hidden={!panelSub}>
            {panelSub ? (
              <>
                <div className="panel-header">
                  <h3>Subscription Details</h3>
                  <button type="button" className="panel-close" onClick={closePanel}>×</button>
                </div>
                <div className="panel-body">
                  <div className="detail-section">
                    <h4>Student</h4>
                    <div className="detail-row"><span className="key">Name</span><span className="val">{panelName}</span></div>
                    <div className="detail-row"><span className="key">Email</span><span className="val">{panelSub.users?.email || '—'}</span></div>
                    <div className="detail-row"><span className="key">Programme</span><span className="val">{panelSub.users?.program_id || '—'}</span></div>
                  </div>
                  <div className="detail-section">
                    <h4>Subscription</h4>
                    <div className="detail-row"><span className="key">Product</span><span className="val">{panelSub.products?.name || panelSub.product_id}</span></div>
                    <div className="detail-row"><span className="key">Status</span><span className="val"><span className={`chip ${panelSub.status}`}>{panelSub.status}</span></span></div>
                    <div className="detail-row"><span className="key">Start</span><span className="val">{fmtDate(panelSub.start_utc)}</span></div>
                    <div className="detail-row"><span className="key">Expires</span><span className="val">{fmtDate(panelSub.expires_utc)}</span></div>
                    <div className="detail-row">
                      <span className="key">Days remaining</span>
                      <span className={`val${panelDaysLeft <= 7 && panelSub.status === 'ACTIVE' ? ' warning' : ''}`}>
                        {panelSub.status === 'ACTIVE' ? (panelDaysLeft > 0 ? `${panelDaysLeft} days` : 'Expired') : '—'}
                      </span>
                    </div>
                    <div className="detail-row"><span className="key">Source</span><span className="val"><span className="source-chip">{panelSub.source || '—'}</span></span></div>
                    {panelSub.source_ref ? (
                      <div className="detail-row"><span className="key">Reference</span><span className="val small">{panelSub.source_ref}</span></div>
                    ) : null}
                  </div>
                </div>
                <div className="panel-actions">
                  <button type="button" className="btn btn-ghost" onClick={closePanel}>Close</button>
                  <button type="button" className="btn btn-primary" onClick={() => openEditModal(panelSub.subscription_id)}>✏️ Edit</button>
                  <button type="button" className="btn btn-success" onClick={() => openGrantForUser(panelSub.user_id, panelName, panelSub.users?.email || '')}>+ Grant Subscription</button>
                  {panelSub.status === 'ACTIVE' ? (
                    <button type="button" className="btn btn-danger" onClick={() => setRevokeTarget({ id: panelSub.subscription_id, name: panelName })}>Cancel Subscription</button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          {/* Grant dialog */}
          <div className={`modal-overlay${grantOpen ? ' show' : ''}`}>
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="grantTitle">
              <div className="modal-header">
                <h3 id="grantTitle">Grant Subscription</h3>
                <button type="button" className="panel-close" onClick={() => setGrantOpen(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="grantUserSearch">Student *</label>
                  <input id="grantUserSearch" type="text" placeholder="Search by name or email…" autoComplete="off" value={grantSearch} onChange={(e) => onGrantSearchChange(e.target.value)} />
                  <div className={`user-search-results${grantHits && !grantUserId ? ' show' : ''}`}>
                    {grantHits && grantHits.length === 0 ? (
                      <div className="user-result-item"><span className="meta">No students found</span></div>
                    ) : (
                      (grantHits || []).map((u) => (
                        <div key={u.user_id} className="user-result-item" onClick={() => selectGrantUser(u)}>
                          <div className="name">{studentName(u)}</div>
                          <div className="meta">{u.email} · {u.program_id || '—'}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className={`selected-user-badge${grantUserId ? ' show' : ''}`}>
                    <span>{grantUserLabel}</span>
                    <button type="button" onClick={clearSelectedUser}>×</button>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="grantProduct">Product *</label>
                  <select id="grantProduct" value={grantProduct} onChange={(e) => setGrantProduct(e.target.value)}>
                    <option value="">Select product</option>
                    {activeProducts.map((p) => <option key={p.product_id} value={p.product_id}>{p.name} ({p.kind})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="grantStartDate">Start Date</label>
                  <input id="grantStartDate" type="date" value={grantStart} onChange={(e) => setGrantStart(e.target.value)} />
                  <p className="form-hint">Leave blank to start from today.</p>
                </div>
                {durationPreview ? <div className="duration-preview">{durationPreview}</div> : null}
                <p className="note">📧 A confirmation email will be sent to the student automatically.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setGrantOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={grantBusy !== 'idle'} onClick={submitGrant}>
                  {grantBusy === 'granting' ? 'Granting…' : grantBusy === 'granted' ? 'Granted ✓' : 'Grant Access'}
                </button>
              </div>
            </div>
          </div>

          {/* Revoke dialog */}
          <div className={`modal-overlay${revokeTarget ? ' show' : ''}`}>
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="revokeTitle">
              <div className="modal-header">
                <h3 id="revokeTitle">Revoke Subscription</h3>
                <button type="button" className="panel-close" onClick={() => setRevokeTarget(null)}>✕</button>
              </div>
              <div className="modal-body">
                <p className="msg">
                  {revokeTarget
                    ? `Are you sure you want to revoke the subscription for ${revokeTarget.name}? This will immediately remove their course access.`
                    : ''}
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setRevokeTarget(null)}>No, keep it</button>
                <button type="button" className="btn btn-danger" disabled={revoking} onClick={confirmRevoke}>{revoking ? 'Revoking…' : 'Yes, revoke it'}</button>
              </div>
            </div>
          </div>

          {/* Edit dialog */}
          <div className={`modal-overlay${editSub ? ' show' : ''}`}>
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="editTitle">
              <div className="modal-header">
                <h3 id="editTitle">Edit Subscription</h3>
                <button type="button" className="panel-close" onClick={() => setEditId(null)}>×</button>
              </div>
              {editSub ? (
                <div className="modal-body">
                  <div className="student-label">{studentName(editSub.users)} · {editSub.users?.email || ''}</div>
                  <div className="form-group">
                    <label htmlFor="editProduct">Product *</label>
                    <select id="editProduct" value={editProduct} onChange={(e) => { setEditProduct(e.target.value); recalcExpiry(e.target.value, editStart); }}>
                      <option value="">Select a product…</option>
                      {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.name} ({p.kind})</option>)}
                    </select>
                  </div>
                  <div className="date-grid">
                    <div className="form-group">
                      <label htmlFor="editStartDate">Start Date *</label>
                      <input id="editStartDate" type="date" value={editStart} onChange={(e) => { setEditStart(e.target.value); recalcExpiry(editProduct, e.target.value); }} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="editExpiryDate">Expiry Date *</label>
                      <input id="editExpiryDate" type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} />
                      <p className="form-hint">Or pick a product — expiry auto-calculates.</p>
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="editStatus">Status *</label>
                    <select id="editStatus" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                      {SUB_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="editSource">Source</label>
                    <select id="editSource" value={editSource} onChange={(e) => setEditSource(e.target.value)}>
                      {(['ADMIN', 'PAYSTACK', 'SELF_TRIAL_SIGNUP'] as const).map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="editSourceRef">Source Reference</label>
                    <input id="editSourceRef" type="text" placeholder="e.g. payment reference or note" value={editSourceRef} onChange={(e) => setEditSourceRef(e.target.value)} />
                    <p className="form-hint">Optional. Links to a payment record when payments are built.</p>
                  </div>
                </div>
              ) : null}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setEditId(null)}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={editBusy !== 'idle'} onClick={submitEdit}>
                  {editBusy === 'saving' ? 'Saving…' : editBusy === 'saved' ? 'Saved ✓' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </BodyPortal>
    </div>
  );
}
