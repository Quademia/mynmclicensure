// components/admin/grant-dialog.tsx
//
// The one Grant dialog (Sam, 2026-09-19): the admin Subscriptions page
// and the Users drawer's Assign both open this. Legacy had two forms —
// a modal on subscriptions.html with a live student search, an inline
// form inside users.html's drawer — calling the same endpoint; the port
// transcribed both, and they drifted (one had a preview and an email
// note, the other neither). Now one form: the student searched, or
// pre-filled when opened from a receipt's panel or the Users drawer;
// the product; an optional start date; and a PREVIEW that shows where
// each course would land under the chain (previewGrant — the same
// packing the writer uses), replacing the old "expires on" line, which
// was wrong whenever the student already held a course.
//
// State starts from `preset`; the parent remounts the dialog with a new
// `key` on each open so it starts clean (no setState in an effect —
// AGENTS.md's React compiler note).

'use client';

import { useEffect, useState } from 'react';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { grantSubscription, previewGrant, searchStudentsAction } from '@/lib/subscriptions/actions';
import type { PreviewRow, StudentHit } from '@/lib/subscriptions/types';
import type { Product } from '@/lib/catalogue/types';

export type GrantPreset = { user_id: string; name: string; email: string };

type Props = {
  open: boolean;
  products: Product[];
  preset?: GrantPreset | null;
  onClose: () => void;
  /** After a successful grant, before the dialog closes itself. */
  onGranted?: () => void;
  /** The page's toast. */
  notify: (text: string, tone: 'error' | 'success') => void;
};

function studentName(u: StudentHit): string {
  return u.name || `${u.forename || ''} ${u.surname || ''}`.trim() || '—';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function GrantDialog({ open, products, preset, onClose, onGranted, notify }: Props) {
  const activeProducts = products.filter((p) => String(p.status || '').toLowerCase() === 'active');

  const [search, setSearch] = useState(preset?.name ?? '');
  const [hits, setHits] = useState<StudentHit[] | null>(null);
  const [userId, setUserId] = useState(preset?.user_id ?? '');
  const [userLabel, setUserLabel] = useState(preset ? `${preset.name} (${preset.email})` : '');
  const [product, setProduct] = useState('');
  const [start, setStart] = useState('');
  const [busy, setBusy] = useState<'idle' | 'granting' | 'granted'>('idle');
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [previewNote, setPreviewNote] = useState('');
  // Whether any course starts later than now — judged when the preview
  // arrives, not in render (react-hooks/purity).
  const [queued, setQueued] = useState(false);

  // legacy searchGrantUser: typing clears the selection; 2+ chars searches.
  useEffect(() => {
    if (!open) return;
    const term = search.trim();
    if (userId || term.length < 2) return;
    const id = window.setTimeout(async () => setHits(await searchStudentsAction(term)), 250);
    return () => window.clearTimeout(id);
  }, [search, open, userId]);

  // The preview follows the three inputs, debounced.
  useEffect(() => {
    if (!open || !userId || !product) return;
    const id = window.setTimeout(async () => {
      const result = await previewGrant(userId, product, start);
      if (result.ok) {
        const soon = Date.now() + 60 * 1000;
        setPreview(result.rows);
        setQueued(result.rows.some((r) => new Date(r.start_utc).getTime() > soon));
        setPreviewNote('');
      } else {
        setPreview(null);
        setPreviewNote(result.error);
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [open, userId, product, start]);

  function onSearchChange(value: string) {
    setSearch(value);
    setUserId('');
    setUserLabel('');
    setPreview(null);
    if (value.trim().length < 2) setHits(null);
  }

  function selectUser(u: StudentHit) {
    const name = studentName(u);
    setUserId(u.user_id);
    setSearch(name);
    setUserLabel(`${name} (${u.email})`);
    setHits(null);
  }

  function clearUser() {
    setUserId('');
    setSearch('');
    setUserLabel('');
    setPreview(null);
  }

  async function submit() {
    if (!userId) return notify('Please select a student.', 'error');
    if (!product) return notify('Please select a product.', 'error');
    setBusy('granting');
    const result = await grantSubscription(userId, product, start || '');
    if (!result.ok) {
      setBusy('idle');
      return notify(result.error, 'error');
    }
    setBusy('granted');
    notify('Subscription granted successfully.', 'success');
    onGranted?.();
    window.setTimeout(onClose, 1500);
  }

  return (
    <BodyPortal>
      <div className="grant-dialog">
        <div className={`modal-overlay${open ? ' show' : ''}`}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="grantTitle">
            <div className="modal-header">
              <h3 id="grantTitle">Grant Subscription</h3>
              <button type="button" className="panel-close" onClick={onClose}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="grantUserSearch">Student *</label>
                <input id="grantUserSearch" type="text" placeholder="Search by name or email…" autoComplete="off" value={search} onChange={(e) => onSearchChange(e.target.value)} />
                <div className={`user-search-results${hits && !userId ? ' show' : ''}`}>
                  {hits && hits.length === 0 ? (
                    <div className="user-result-item"><span className="meta">No students found</span></div>
                  ) : (
                    (hits || []).map((u) => (
                      <div key={u.user_id} className="user-result-item" onClick={() => selectUser(u)}>
                        <div className="name">{studentName(u)}</div>
                        <div className="meta">{u.email} · {u.program_id || '—'}</div>
                      </div>
                    ))
                  )}
                </div>
                <div className={`selected-user-badge${userId ? ' show' : ''}`}>
                  <span>{userLabel}</span>
                  <button type="button" onClick={clearUser}>×</button>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="grantProduct">Product *</label>
                <select id="grantProduct" value={product} onChange={(e) => setProduct(e.target.value)}>
                  <option value="">Select product</option>
                  {activeProducts.map((p) => <option key={p.product_id} value={p.product_id}>{p.name} ({p.kind}, {p.duration_days}d)</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="grantStartDate">Start Date</label>
                <input id="grantStartDate" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                <p className="form-hint">Leave blank to start from today. A course the student already holds starts when their current access ends.</p>
              </div>
              {preview ? (
                <div className="grant-preview">
                  <div className="grant-preview-title">{queued ? 'Access, course by course — some queued behind what they hold' : 'Access, course by course'}</div>
                  {preview.map((r) => (
                    <div className="grant-preview-row" key={r.course_id}>
                      <span className="course" title={r.course_id}>{r.title}</span>
                      <span className="dates">{fmtDate(r.start_utc)} → {fmtDate(r.expires_utc)}</span>
                    </div>
                  ))}
                </div>
              ) : previewNote ? (
                <div className="grant-preview error">{previewNote}</div>
              ) : null}
              <p className="note">A confirmation email will be sent to the student automatically.</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={busy !== 'idle'} onClick={submit}>
                {busy === 'granting' ? 'Granting…' : busy === 'granted' ? 'Granted ✓' : 'Grant Access'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
