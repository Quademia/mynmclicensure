// app/(app)/admin/config/config-client.tsx
//
// The script block of legacy admin/config.html: the "Handle with care"
// banner, a card per key with its own Value and Description fields, Save
// (flashes "✓ Saved") and Delete (the browser's own confirm box with the
// legacy wording, as legacy), and the Add Config Key modal. The page
// alerts are toasts (UI convention #1).

'use client';
import { useConfirm } from '@/lib/overlays/shared/confirm-dialog';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { Icon } from '@/components/shell/icons';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { addConfigKey, deleteConfigRow, saveConfigRow } from '@/lib/catalogue/actions';
import type { ConfigRow } from '@/lib/catalogue/types';

type Msg = { text: string; tone: 'error' | 'success' } | null;

function fmtUpdated(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ConfigCard({ row, notify, onDeleted }: { row: ConfigRow; notify: (m: Msg) => void; onDeleted: () => void }) {
  const [value, setValue] = useState(row.value);
  const [desc, setDesc] = useState(row.description || '');
  const [updatedAt, setUpdatedAt] = useState(row.updated_at);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function saveRow() {
    if (!value.trim()) {
      notify({ text: `Value for "${row.key}" cannot be empty.`, tone: 'error' });
      return;
    }
    setBusy(true);
    const result = await saveConfigRow({ key: row.key, value, description: desc });
    setBusy(false);
    if (!result.ok) {
      notify({ text: result.error, tone: 'error' });
      return;
    }
    setUpdatedAt(new Date().toISOString());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  // DS4: legacy's three-paragraph warning, in the app's dialog; the key
  // is typed back before Delete enables (a delete cannot be undone).
  const [confirm, confirmDialog] = useConfirm();
  async function deleteRow() {
    const confirmed = await confirm({
      title: `Delete config key "${row.key}"?`,
      body:
        `WARNING: If any part of the platform code references this key it will break silently.\n\n` +
        `Only proceed if you are certain nothing depends on this key.`,
      confirmLabel: 'Delete key',
      danger: true,
      typeToConfirm: row.key,
    });
    if (!confirmed) return;
    setBusy(true);
    const result = await deleteConfigRow(row.key);
    setBusy(false);
    if (!result.ok) {
      notify({ text: result.error, tone: 'error' });
      return;
    }
    notify({ text: `Key "${row.key}" deleted.`, tone: 'success' });
    onDeleted();
  }

  return (
    <div className="config-card">
      {confirmDialog}
      <div className="config-card-header">
        <div className="config-card-left">
          <div className="config-key">{row.key}</div>
          <div className="config-warning">Key is read-only — referenced by platform code</div>
          <div className="config-updated" suppressHydrationWarning>Last updated: {fmtUpdated(updatedAt)}</div>
        </div>
      </div>

      <div className="config-fields">
        <div className="config-field">
          <label htmlFor={`val-${row.key}`}>Value *</label>
          <input id={`val-${row.key}`} type="text" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="config-field">
          <label htmlFor={`desc-${row.key}`}>Description</label>
          <textarea id={`desc-${row.key}`} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
      </div>

      <div className="config-card-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={saveRow}><Icon name="save" />Save</button>
        <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={deleteRow}><Icon name="trash" />Delete</button>
        <span className={`config-save-status${saved ? ' show' : ''}`}>✓ Saved</span>
      </div>
    </div>
  );
}

export function ConfigClient({ rows }: { rows: ConfigRow[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const dismiss = useCallback(() => setMsg(null), []);

  // ── add-key modal ──
  const [addOpen, setAddOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [adding, setAdding] = useState(false);

  function openAddModal() {
    setNewKey('');
    setNewValue('');
    setNewDesc('');
    setAddOpen(true);
    window.setTimeout(() => document.getElementById('newKey')?.focus(), 100);
  }

  async function saveNewKey() {
    const key = newKey.trim().toLowerCase();
    const value = newValue.trim();
    if (!key) return setMsg({ text: 'Key is required.', tone: 'error' });
    if (!value) return setMsg({ text: 'Value is required.', tone: 'error' });
    if (rows.find((r) => r.key === key)) return setMsg({ text: `Key "${key}" already exists.`, tone: 'error' });
    if (!/^[a-z0-9_]+$/.test(key)) {
      return setMsg({ text: 'Key must be lowercase letters, numbers and underscores only.', tone: 'error' });
    }
    setAdding(true);
    const result = await addConfigKey({ key, value, description: newDesc });
    setAdding(false);
    if (!result.ok) return setMsg({ text: result.error, tone: 'error' });
    setAddOpen(false);
    setMsg({ text: `Key "${key}" added successfully.`, tone: 'success' });
    router.refresh();
  }

  return (
    <div className="cfg">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />

      <div className="config-intro">
        <div className="config-intro-icon"><Icon name="alert" size={20} /></div>
        <div className="config-intro-text">
          <strong>Handle with care.</strong> Every key in this table is referenced by the platform&apos;s code.
          Editing a value takes effect immediately. Deleting or renaming a key will cause any code that
          references it to break silently — only do so if you are certain nothing depends on it.
        </div>
      </div>

      <div className="toolbar">
        <span className="result-count">{rows.length} key{rows.length !== 1 ? 's' : ''}</span>
        <button type="button" className="btn btn-primary" onClick={openAddModal}>+ Add Config Key</button>
      </div>

      <div className="config-list">
        {rows.length === 0 ? (
          <div className="empty-state">No config keys found.</div>
        ) : (
          rows.map((row) => (
            <ConfigCard key={`${row.key}|${row.updated_at ?? ''}`} row={row} notify={setMsg} onDeleted={() => router.refresh()} />
          ))
        )}
      </div>

      <BodyPortal>
        <div className="cfg-overlay">
          <div className={`modal-backdrop${addOpen ? ' open' : ''}`}>
            <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="addKeyTitle">
              <h3 id="addKeyTitle">Add Config Key</h3>
              <p>Add a new key-value pair to the config table. Use this to prepare settings for code you are about to write.</p>

              <div className="modal-warning">
                Choose the key name carefully — once code references it, renaming or deleting it will break that feature.
              </div>

              <div className="form-group">
                <label htmlFor="newKey">Key *</label>
                <input id="newKey" type="text" placeholder="e.g. runner_feedback_mode" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
                <p className="form-hint">Lowercase, underscores only. This is what the code will reference.</p>
              </div>
              <div className="form-group">
                <label htmlFor="newValue">Value *</label>
                <input id="newValue" type="text" placeholder="e.g. inline" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="newDescription">Description</label>
                <textarea id="newDescription" rows={2} placeholder="What does this setting control?" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-primary" disabled={adding} onClick={saveNewKey}>Add Key</button>
                <button type="button" className="btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </BodyPortal>
    </div>
  );
}
