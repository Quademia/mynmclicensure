// lib/overlays/shared/confirm-dialog.tsx
//
// The yes-or-no dialog (DS4), and the hook that makes it a one-liner at
// a call site. The nine window.confirm() boxes were inline questions —
// `if (!window.confirm('…')) return;` — so the hook keeps that shape:
//
//   const [confirm, confirmDialog] = useConfirm();
//   …
//   if (!(await confirm({ title: 'Archive this quiz?', confirmLabel: 'Archive' }))) return;
//   …
//   return (<> {confirmDialog} … </>);
//
// The words stay legacy's (AGENTS.md UI convention #2); only the box is
// ours, with real button labels in place of OK / Cancel. `danger` gives
// the confirming button the danger look; `typeToConfirm` asks the admin
// to type a word first (the rule for delete, revoke and deactivate) and
// keeps the button disabled until it matches, case-insensitively.
// Backdrop and Escape resolve false — the safe option.

'use client';

import { useState } from 'react';
import { Dialog } from './dialog';

export type ConfirmOptions = {
  title: string;
  /** The body — a string (newlines become paragraphs) or nodes. */
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** The destructive look on the confirming button. */
  danger?: boolean;
  /** The word the person must type before the confirming button enables. */
  typeToConfirm?: string;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

function Body({ body }: { body: React.ReactNode }) {
  if (typeof body !== 'string') return <>{body}</>;
  return (
    <>
      {body.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="dlg-text">
          {para}
        </p>
      ))}
    </>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  danger = false,
  typeToConfirm,
  onConfirm,
  onCancel,
}: ConfirmOptions & { open: boolean; onConfirm: () => void; onCancel: () => void }) {
  const [typed, setTyped] = useState('');
  const armed = !typeToConfirm || typed.trim().toLowerCase() === typeToConfirm.trim().toLowerCase();

  function cancel() {
    setTyped('');
    onCancel();
  }
  function confirm() {
    if (!armed) return;
    setTyped('');
    onConfirm();
  }

  return (
    <Dialog open={open} onClose={cancel} title={title} role="alertdialog">
      {body ? <Body body={body} /> : null}
      {typeToConfirm ? (
        <form
          className="dlg-field"
          onSubmit={(e) => {
            e.preventDefault();
            confirm();
          }}
        >
          <label>
            Type <b>{typeToConfirm}</b> to confirm
            <input
              className="dlg-input"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </label>
        </form>
      ) : null}
      <div className="dlg-actions">
        <button type="button" className="btn btn-ghost" onClick={cancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={confirm}
          disabled={!armed}
          autoFocus={!typeToConfirm && !danger}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

/**
 * confirm(options) resolves true on the confirming button, false on
 * Cancel, Escape or the backdrop. Render the returned element once.
 */
export function useConfirm(): [(opts: ConfirmOptions) => Promise<boolean>, React.ReactNode] {
  const [pending, setPending] = useState<Pending | null>(null);

  function confirm(opts: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }

  function settle(ok: boolean) {
    const p = pending;
    setPending(null);
    p?.resolve(ok);
  }

  const element = pending ? (
    <ConfirmDialog
      open
      title={pending.title}
      body={pending.body}
      confirmLabel={pending.confirmLabel}
      cancelLabel={pending.cancelLabel}
      danger={pending.danger}
      typeToConfirm={pending.typeToConfirm}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null;

  return [confirm, element];
}
