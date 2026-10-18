// app/(app)/admin/announcements/kinds-panel.tsx
//
// The admin's kinds (08.13; Sam, 2026-10-18, the grid approved with all
// thirteen new icons): a side panel beside the editor's, opened by the
// page's Kinds button. Each kind a row — its icon in the square students
// see, its name, how many announcements use it, arrows to move it, Edit
// (rename, pick another icon from the grid) and Retire or Bring back. Add
// a kind at the foot. Every change goes through kind-actions.ts and the
// page is refreshed so the editor's Kind list follows. Only used here.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/shell/icons';
import { addKind, moveKind, setKindActive, updateKind } from '@/lib/announcements/kind-actions';
import { KIND_ICON_GRID, kindIcon } from '@/lib/announcements/display';
import { KIND_NAME_MAX, type AnnouncementKind } from '@/lib/announcements/types';
import type { IconName } from '@/lib/nav/types';

/** The grid of icons a kind may wear; the chosen one outlined. */
export function KindIconGrid({ value, onPick }: { value: string; onPick: (icon: IconName) => void }) {
  return (
    <div className="kind-grid" role="radiogroup" aria-label="Icon">
      {KIND_ICON_GRID.map((icon) => (
        <button
          key={icon}
          type="button"
          role="radio"
          aria-checked={value === icon}
          aria-label={icon.replace('-', ' ')}
          className={`kind-tile${value === icon ? ' is-on' : ''}`}
          onClick={() => onPick(icon)}
        >
          <Icon name={icon} size={20} />
        </button>
      ))}
    </div>
  );
}

type Draft = { was: string | null; name: string; icon: string };

export function KindsPanel({
  open,
  onClose,
  kinds,
  usedBy,
  onError,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  kinds: AnnouncementKind[];
  usedBy: Record<string, number>;
  onError: (text: string) => void;
  onDone: (text: string) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: string) {
    setBusy(true);
    try {
      const r = await work();
      if (!r.ok) return onError(r.error);
      if (done) onDone(done);
      setDraft(null);
      router.refresh();
    } catch {
      onError('Could not save. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  function saveDraft() {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return onError('Give the kind a name.');
    if (draft.was === null) void run(() => addKind(name, draft.icon), `"${name}" added.`);
    else void run(() => updateKind(draft.was!, name, draft.icon), 'Kind saved.');
  }

  function close() {
    setDraft(null);
    onClose();
  }

  const form = draft ? (
    <div className="kind-form">
      <label htmlFor="kindName">Name</label>
      <input
        id="kindName"
        type="text"
        maxLength={KIND_NAME_MAX}
        value={draft.name}
        placeholder="e.g. Exam date"
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
      />
      <label>Icon</label>
      <KindIconGrid value={draft.icon} onPick={(icon) => setDraft({ ...draft, icon })} />
      {draft.was !== null && draft.name.trim() !== draft.was && (usedBy[draft.was] ?? 0) > 0 ? (
        <p className="form-hint">
          The {usedBy[draft.was]} announcement{usedBy[draft.was] === 1 ? '' : 's'} of this kind take the new name.
        </p>
      ) : null}
      <div className="kind-form-actions">
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setDraft(null)}>Cancel</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={saveDraft}>
          {busy ? 'Saving…' : draft.was === null ? 'Add kind' : 'Save kind'}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className={`panel-overlay${open ? ' show' : ''}`} onClick={close} />
      <div className={`side-panel kinds-panel${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="panel-header">
          <div>
            <h2>Kinds</h2>
            <p>What each announcement is about. Students see the icon in their list.</p>
          </div>
          <button type="button" className="panel-close" aria-label="Close" onClick={close}>×</button>
        </div>
        <div className="panel-body">
          <ul className="kind-rows">
            {kinds.map((k, i) => {
              const used = usedBy[k.name] ?? 0;
              const editing = draft?.was === k.name;
              return (
                <li key={k.name} className={`kind-row${k.active ? '' : ' is-retired'}`}>
                  <div className="kind-line">
                    <span className="kind-square" aria-hidden="true"><Icon name={kindIcon(k.icon)} size={20} /></span>
                    <span className="kind-main">
                      <span className="kind-name">{k.name}{k.active ? '' : ' · retired'}</span>
                      <span className="kind-used">{used ? `Used by ${used} announcement${used === 1 ? '' : 's'}` : 'Not used yet'}</span>
                    </span>
                    <span className="kind-actions">
                      <button type="button" className="btn btn-ghost btn-sm" aria-label={`Move ${k.name} up`} disabled={busy || i === 0} onClick={() => void run(() => moveKind(k.name, 'up'))}>↑</button>
                      <button type="button" className="btn btn-ghost btn-sm" aria-label={`Move ${k.name} down`} disabled={busy || i === kinds.length - 1} onClick={() => void run(() => moveKind(k.name, 'down'))}>↓</button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setDraft({ was: k.name, name: k.name, icon: k.icon })}>Edit</button>
                      <button
                        type="button"
                        className="btn-link"
                        disabled={busy}
                        onClick={() => void run(() => setKindActive(k.name, !k.active), k.active ? `"${k.name}" retired.` : `"${k.name}" is back.`)}
                      >
                        {k.active ? 'Retire' : 'Bring back'}
                      </button>
                    </span>
                  </div>
                  {editing ? form : null}
                </li>
              );
            })}
          </ul>
          {draft?.was === null ? (
            form
          ) : (
            <button type="button" className="btn btn-ghost btn-sm kind-add" disabled={busy} onClick={() => setDraft({ was: null, name: '', icon: 'megaphone' })}>
              + Add a kind
            </button>
          )}
          <p className="form-hint kind-note">
            A kind in use cannot be deleted: retire it and it is no longer offered for a new announcement, while the announcements that use it keep it.
          </p>
        </div>
      </div>
    </>
  );
}
