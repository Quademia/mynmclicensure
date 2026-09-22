// app/(app)/admin/products/products-client.tsx
//
// The script block of legacy admin/products.html: the stats row, the
// four filters, the table, the side panel, the New / Edit modal with the
// course picker and the Telegram key tag input, the Archive modal and
// Restore. The lists arrive as props; after a write the page is
// refreshed so the props carry the new rows (legacy re-fetched). Errors
// and "done" messages are toasts (UI convention #1) where legacy used
// an inline alert or a browser alert().

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { formatMinor } from '@/lib/money/format-minor';
import { saveProduct, setProductStatus } from '@/lib/catalogue/actions';
import {
  CURRENCIES,
  PRODUCT_KINDS,
  PRODUCT_STATUSES,
  type Course,
  type Product,
  type ProductKind,
  type ProductStatus,
  type Program,
} from '@/lib/catalogue/types';
import { Icon } from '@/components/shell/icons';

type Msg = { text: string; tone: 'error' | 'success' } | null;

type Form = {
  productId: string;
  name: string;
  kind: ProductKind;
  status: ProductStatus;
  price: string;
  currency: string;
  duration: string;
  /** Premium Prep marker (§8 S14). A subset of PAID, not a kind. */
  isPremium: boolean;
  courses: string[];
  tgKeys: string[];
};

const EMPTY_FORM: Form = {
  productId: '',
  name: '',
  kind: 'PAID',
  status: 'active',
  price: '',
  currency: 'GHS',
  duration: '',
  isPremium: false,
  courses: [],
  tgKeys: [],
};

function priceCell(p: Product): string {
  return p.kind === 'PAID' ? formatMinor(p.price_minor, p.currency) : '—';
}

export function ProductsClient({
  products,
  courses,
  programs,
}: {
  products: Product[];
  courses: Course[];
  programs: Program[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const dismiss = useCallback(() => setMsg(null), []);

  // ── filters ──
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [currency, setCurrency] = useState('');

  const currencies = [...new Set(products.map((p) => p.currency).filter(Boolean))];

  const q = search.toLowerCase().trim();
  const filtered = products.filter((p) => {
    if (q && !p.name.toLowerCase().includes(q) && !p.product_id.toLowerCase().includes(q)) return false;
    if (kind && p.kind !== kind) return false;
    if (status && p.status !== status) return false;
    if (currency && p.currency !== currency) return false;
    return true;
  });

  function clearFilters() {
    setSearch('');
    setKind('');
    setStatus('');
    setCurrency('');
  }

  // ── side panel ──
  const [panelId, setPanelId] = useState<string | null>(null);
  const panelProduct = panelId ? products.find((p) => p.product_id === panelId) ?? null : null;
  const closePanel = () => setPanelId(null);

  // ── new / edit modal ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [tgInput, setTgInput] = useState('');
  const [saving, setSaving] = useState(false);

  function openNewModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setTgInput('');
    setModalOpen(true);
  }

  function openEditModal(productId: string) {
    const p = products.find((x) => x.product_id === productId);
    if (!p) return;
    setEditingId(productId);
    setForm({
      productId,
      name: p.name || '',
      kind: p.kind || 'PAID',
      status: p.status || 'active',
      price: p.price_minor != null ? (p.price_minor / 100).toFixed(2) : '',
      currency: p.currency || 'GHS',
      duration: p.duration_days ? String(p.duration_days) : '',
      isPremium: p.is_premium === true,
      courses: p.courses,
      tgKeys: [...(p.telegram_group_keys || [])],
    });
    setTgInput('');
    setModalOpen(true);
  }

  const closeModal = () => setModalOpen(false);

  function toggleCourse(courseId: string) {
    setForm((f) => ({
      ...f,
      courses: f.courses.includes(courseId) ? f.courses.filter((c) => c !== courseId) : [...f.courses, courseId],
    }));
  }

  function selectAllInGroup(progId: string) {
    const ids = courses.filter((c) => c.program_scope && c.program_scope.includes(progId)).map((c) => c.course_id);
    setForm((f) => ({ ...f, courses: [...new Set([...f.courses, ...ids])] }));
  }

  // The Telegram key tag input: Enter or comma adds, Backspace on an
  // empty box removes the last one.
  function normaliseKey(raw: string): string {
    return raw.trim().toUpperCase().replace(/\s/g, '_');
  }

  function handleTgKeydown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = normaliseKey(tgInput);
      if (val && !form.tgKeys.includes(val)) setForm((f) => ({ ...f, tgKeys: [...f.tgKeys, val] }));
      setTgInput('');
    }
    if (e.key === 'Backspace' && !tgInput && form.tgKeys.length) {
      setForm((f) => ({ ...f, tgKeys: f.tgKeys.slice(0, -1) }));
    }
  }

  function removeTgKey(key: string) {
    setForm((f) => ({ ...f, tgKeys: f.tgKeys.filter((k) => k !== key) }));
  }

  async function submitProduct() {
    const isNew = !editingId;
    // Legacy's own checks, in its order, before the round trip.
    if (isNew && !form.productId.trim()) return setMsg({ text: 'Product ID is required.', tone: 'error' });
    if (!form.name.trim()) return setMsg({ text: 'Product name is required.', tone: 'error' });
    if (!(parseInt(form.duration, 10) || null)) return setMsg({ text: 'Duration (days) is required.', tone: 'error' });
    if (!form.courses.length) return setMsg({ text: 'Please select at least one course.', tone: 'error' });

    // A key still typed but not confirmed with Enter counts.
    const pending = normaliseKey(tgInput);
    const tgKeys = pending && !form.tgKeys.includes(pending) ? [...form.tgKeys, pending] : form.tgKeys;

    setSaving(true);
    const result = await saveProduct({
      isNew,
      productId: isNew ? form.productId : editingId!,
      name: form.name,
      kind: form.kind,
      status: form.status,
      price: form.price,
      currency: form.currency,
      duration: form.duration,
      isPremium: form.isPremium,
      courses: form.courses,
      telegramKeys: tgKeys,
    });
    setSaving(false);
    if (!result.ok) return setMsg({ text: result.error, tone: 'error' });

    setMsg({ text: `Product ${isNew ? 'created' : 'updated'} successfully.`, tone: 'success' });
    setTgInput('');
    closeModal();
    closePanel();
    router.refresh();
  }

  // ── archive / restore ──
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; name: string } | null>(null);
  const [archiving, setArchiving] = useState(false);

  async function confirmArchive() {
    if (!archiveTarget) return;
    setArchiving(true);
    const result = await setProductStatus(archiveTarget.id, 'archived');
    setArchiving(false);
    if (!result.ok) return setMsg({ text: result.error, tone: 'error' });
    setArchiveTarget(null);
    closePanel();
    router.refresh();
  }

  async function restoreProduct(productId: string) {
    const result = await setProductStatus(productId, 'active');
    if (!result.ok) return setMsg({ text: result.error, tone: 'error' });
    closePanel();
    router.refresh();
  }

  // ── course picker, grouped by the FIRST programme in scope ──
  const grouped: Record<string, Course[]> = {};
  const ungrouped: Course[] = [];
  for (const c of courses) {
    if (c.program_scope && c.program_scope.length > 0) {
      const prog = c.program_scope[0];
      (grouped[prog] ??= []).push(c);
    } else {
      ungrouped.push(c);
    }
  }
  const groupIds = Object.keys(grouped).sort();
  const programName = (id: string) => programs.find((p) => p.program_id === id)?.program_name ?? id;
  const courseTitle = (id: string) => courses.find((c) => c.course_id === id)?.title ?? id;

  const renderCourseItem = (c: Course) => (
    <div key={c.course_id} className="course-checkbox-item" onClick={() => toggleCourse(c.course_id)}>
      <input
        type="checkbox"
        id={`course_${c.course_id}`}
        value={c.course_id}
        checked={form.courses.includes(c.course_id)}
        onChange={() => toggleCourse(c.course_id)}
        onClick={(e) => e.stopPropagation()}
      />
      <label htmlFor={`course_${c.course_id}`} onClick={(e) => e.stopPropagation()}>
        {c.title}
      </label>
      <span className="course-id">{c.course_id}</span>
    </div>
  );

  return (
    <div className="cat">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-mini"><div className="label">Total</div><div className="value">{products.length}</div></div>
        <div className="stat-mini"><div className="label">Active</div><div className="value success">{products.filter((p) => p.status === 'active').length}</div></div>
        <div className="stat-mini"><div className="label">Archived</div><div className="value muted">{products.filter((p) => p.status === 'archived').length}</div></div>
        <div className="stat-mini"><div className="label">Paid</div><div className="value success">{products.filter((p) => p.kind === 'PAID').length}</div></div>
        <div className="stat-mini"><div className="label">Trial</div><div className="value">{products.filter((p) => p.kind === 'TRIAL').length}</div></div>
        <div className="stat-mini"><div className="label">Free</div><div className="value muted">{products.filter((p) => p.kind === 'FREE').length}</div></div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label htmlFor="filterSearch">Search</label>
          <input id="filterSearch" type="text" placeholder="Product name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="filter-group">
          <label htmlFor="filterKind">Kind</label>
          <select id="filterKind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All kinds</option>
            <option value="PAID">Paid</option>
            <option value="TRIAL">Trial</option>
            <option value="FREE">Free</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filterStatus">Status</label>
          <select id="filterStatus" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filterCurrency">Currency</label>
          <select id="filterCurrency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="">All currencies</option>
            {currencies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="filter-actions">
          <button type="button" className="btn btn-ghost" onClick={clearFilters}>Clear</button>
          <button type="button" className="btn btn-primary" onClick={openNewModal}>+ New Product</button>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <div className="table-header">
          <h3>All Products</h3>
          <span className="result-count">{filtered.length} product{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state"><p>No products match your filters.</p></div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Kind</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th>Duration</th>
                  <th>Courses</th>
                  <th>Telegram Groups</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.product_id} className={p.status === 'archived' ? 'archived-row' : ''} onClick={() => setPanelId(p.product_id)}>
                    <td>
                      <div className="row-title">{p.name}</div>
                      <div className="row-id">{p.product_id}</div>
                    </td>
                    <td><span className={`badge ${p.kind}`}>{p.kind}</span></td>
                    <td><span className={`badge ${p.status}`}>{p.status}</span></td>
                    <td className="cell-strong">{priceCell(p)}</td>
                    <td className="cell-13">{p.duration_days ? `${p.duration_days}d` : '—'}</td>
                    <td className="cell-courses">
                      {p.courses.length
                        ? p.courses.map((c) => <span key={c} className="course-tag">{c}</span>)
                        : <span className="cell-muted">None</span>}
                    </td>
                    <td>
                      {(p.telegram_group_keys || []).length
                        ? (p.telegram_group_keys || []).map((k) => <span key={k} className="tg-tag"><Icon name="send" size={12} />{k}</span>)
                        : <span className="cell-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BodyPortal>
        <div className="cat-overlay">
          {/* Side panel */}
          <div className={`overlay${panelProduct ? ' show' : ''}`} onClick={closePanel} />
          <div className={`side-panel${panelProduct ? ' open' : ''}`} aria-hidden={!panelProduct}>
            {panelProduct && (
              <>
                <div className="panel-header">
                  <h3>{panelProduct.name}</h3>
                  <button type="button" className="panel-close" onClick={closePanel}>×</button>
                </div>
                <div className="panel-body">
                  <div className="detail-section">
                    <h4>Product Info</h4>
                    <div className="detail-row"><span className="key">Product ID</span><span className="val mono">{panelProduct.product_id}</span></div>
                    <div className="detail-row"><span className="key">Name</span><span className="val">{panelProduct.name}</span></div>
                    <div className="detail-row"><span className="key">Kind</span><span className="val"><span className={`badge ${panelProduct.kind}`}>{panelProduct.kind}</span></span></div>
                    <div className="detail-row"><span className="key">Status</span><span className="val"><span className={`badge ${panelProduct.status}`}>{panelProduct.status}</span></span></div>
                  </div>
                  <div className="detail-section">
                    <h4>Pricing &amp; Access</h4>
                    <div className="detail-row"><span className="key">Price</span><span className="val">{formatMinor(panelProduct.price_minor, panelProduct.currency)}</span></div>
                    <div className="detail-row"><span className="key">Currency</span><span className="val">{panelProduct.currency || '—'}</span></div>
                    <div className="detail-row"><span className="key">Duration</span><span className="val">{panelProduct.duration_days ? `${panelProduct.duration_days} days` : '—'}</span></div>
                    <div className="detail-row"><span className="key">Price (minor units)</span><span className="val mono">{panelProduct.price_minor ?? '—'}</span></div>
                  </div>
                  <div className="detail-section">
                    <h4>Courses Included ({panelProduct.courses.length})</h4>
                    <div className="detail-tags">
                      {panelProduct.courses.length
                        ? panelProduct.courses.map((c) => <span key={c} className="course-tag">{courseTitle(c)}</span>)
                        : <span className="detail-empty">None assigned</span>}
                    </div>
                  </div>
                  <div className="detail-section">
                    <h4>Telegram Groups</h4>
                    <div className="detail-tags">
                      {(panelProduct.telegram_group_keys || []).length
                        ? (panelProduct.telegram_group_keys || []).map((k) => <span key={k} className="tg-tag"><Icon name="send" size={12} />{k}</span>)
                        : <span className="detail-empty">None</span>}
                    </div>
                  </div>
                </div>
                <div className="panel-actions">
                  <button type="button" className="btn btn-ghost" onClick={closePanel}>Close</button>
                  <button type="button" className="btn btn-primary" onClick={() => openEditModal(panelProduct.product_id)}><Icon name="pencil" />Edit</button>
                  {panelProduct.status === 'active' ? (
                    <button type="button" className="btn btn-warning" onClick={() => setArchiveTarget({ id: panelProduct.product_id, name: panelProduct.name })}>Archive</button>
                  ) : (
                    <button type="button" className="btn btn-success" onClick={() => restoreProduct(panelProduct.product_id)}>Restore</button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* New / Edit Product modal */}
          <div className={`modal-overlay${modalOpen ? ' show' : ''}`}>
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="productModalTitle">
              <div className="modal-header">
                <h3 id="productModalTitle">{editingId ? 'Edit Product' : 'New Product'}</h3>
                <button type="button" className="panel-close" onClick={closeModal}>×</button>
              </div>
              <div className="modal-body">
                {!editingId && (
                  <div className="form-group">
                    <label htmlFor="fieldProductId">Product ID *</label>
                    <input
                      id="fieldProductId"
                      type="text"
                      className="upper"
                      placeholder="e.g. RN_FULL_2027"
                      value={form.productId}
                      onChange={(e) => setForm({ ...form, productId: e.target.value.toUpperCase().replace(/\s/g, '_') })}
                    />
                    <p className="form-hint">Unique code. Use underscores, no spaces. Cannot be changed after creation.</p>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="fieldName">Product Name *</label>
                  <input id="fieldName" type="text" placeholder="e.g. Registered Nursing Full Access 2027" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="fieldKind">Kind *</label>
                    <select id="fieldKind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ProductKind })}>
                      {PRODUCT_KINDS.map((k) => (
                        <option key={k} value={k}>{k === 'PAID' ? 'Paid' : k === 'TRIAL' ? 'Trial' : 'Free'}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="fieldStatus">Status *</label>
                    <select id="fieldStatus" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProductStatus })}>
                      {PRODUCT_STATUSES.map((s) => (
                        <option key={s} value={s}>{s === 'active' ? 'Active' : 'Archived'}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row-3">
                  <div className="form-group">
                    <label htmlFor="fieldPrice">Price</label>
                    <input id="fieldPrice" type="number" placeholder="0.00" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                    <p className="form-hint">Enter in full units (e.g. 150.00)</p>
                  </div>
                  <div className="form-group">
                    <label htmlFor="fieldCurrency">Currency</label>
                    <select id="fieldCurrency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="fieldDuration">Duration (days) *</label>
                    <input id="fieldDuration" type="number" placeholder="365" min="1" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
                    <p className="form-hint">e.g. 365 = 1 year</p>
                  </div>
                </div>

                <div className="form-group">
                  <label className="check-inline" htmlFor="fieldIsPremium">
                    <input
                      id="fieldIsPremium"
                      type="checkbox"
                      checked={form.isPremium}
                      onChange={(e) => setForm({ ...form, isPremium: e.target.checked })}
                    />
                    Premium Prep product
                  </label>
                  <p className="form-hint">
                    Shows this product on the Premium Prep page. Until now that page found its
                    products by reading the id for a <code>_2026_PREP</code> ending, which would
                    have stopped working in 2027.
                  </p>
                </div>

                <div className="form-group">
                  <label>Courses Included *</label>
                  <p className="form-hint before">Tick all courses this product gives access to. Grouped by programme for convenience — you can mix freely.</p>
                  <div className="course-picker">
                    {groupIds.length === 0 && ungrouped.length === 0 ? (
                      <div className="picker-empty">No courses available.</div>
                    ) : (
                      <>
                        {groupIds.map((progId) => (
                          <div key={progId} className="course-group">
                            <div className="course-group-header">
                              <span>{programName(progId)}</span>
                              <button type="button" onClick={() => selectAllInGroup(progId)}>Select all</button>
                            </div>
                            {grouped[progId].map(renderCourseItem)}
                          </div>
                        ))}
                        {ungrouped.length > 0 && (
                          <div className="course-group">
                            <div className="course-group-header"><span>Other / Independent</span></div>
                            {ungrouped.map(renderCourseItem)}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <p className="form-hint after">
                    {form.courses.length > 0 ? `${form.courses.length} course${form.courses.length !== 1 ? 's' : ''} selected` : ''}
                  </p>
                </div>

                <div className="form-group">
                  <label htmlFor="tgTagInput">Telegram Group Keys</label>
                  <div className="tag-input-wrapper" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}>
                    {form.tgKeys.map((k) => (
                      <span key={k} className="tag-item">
                        {k}{' '}
                        <button type="button" className="tag-remove" onClick={() => removeTgKey(k)}>×</button>
                      </span>
                    ))}
                    <input
                      id="tgTagInput"
                      type="text"
                      className="tag-input"
                      placeholder="Type a key and press Enter…"
                      value={tgInput}
                      onChange={(e) => setTgInput(e.target.value)}
                      onKeyDown={handleTgKeydown}
                    />
                  </div>
                  <p className="form-hint">Press Enter after each key. e.g. RN_2026, PREMIUM_2026. Leave empty if no Telegram groups.</p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={saving} onClick={submitProduct}>
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Product'}
                </button>
              </div>
            </div>
          </div>

          {/* Archive confirm modal */}
          <div className={`modal-overlay${archiveTarget ? ' show' : ''}`}>
            <div className="modal modal-420" role="dialog" aria-modal="true" aria-labelledby="archiveModalTitle">
              <div className="modal-header">
                <h3 id="archiveModalTitle">Archive Product</h3>
                <button type="button" className="panel-close" onClick={() => setArchiveTarget(null)}>×</button>
              </div>
              <div className="modal-body">
                <p className="msg">
                  {archiveTarget
                    ? `Archive "${archiveTarget.name}"? It will no longer appear as an option for new subscriptions. Existing subscriptions are not affected.`
                    : ''}
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setArchiveTarget(null)}>Cancel</button>
                <button type="button" className="btn btn-warning" disabled={archiving} onClick={confirmArchive}>
                  {archiving ? 'Archiving…' : 'Archive'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </BodyPortal>
    </div>
  );
}
