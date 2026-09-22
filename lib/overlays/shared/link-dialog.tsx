// lib/overlays/shared/link-dialog.tsx
//
// The "Insert link" dialog (DS4): a URL field and a text field in one
// box, in place of the two sequential window.prompt() boxes each of
// Admin → Announcements' Link and Button tools used (four prompts →
// two dialogs). The labels are the prompts' words. Enter submits;
// Cancel, Escape and the backdrop hand back nothing.

'use client';

import { useState } from 'react';
import { Dialog } from './dialog';

export function LinkDialog({
  open,
  title,
  urlLabel,
  textLabel,
  textDefault = '',
  submitLabel = 'Insert',
  onSubmit,
  onCancel,
}: {
  open: boolean;
  title: string;
  urlLabel: string;
  textLabel: string;
  textDefault?: string;
  submitLabel?: string;
  onSubmit: (v: { url: string; text: string }) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState('https://');
  const [text, setText] = useState(textDefault);

  function reset() {
    setUrl('https://');
    setText(textDefault);
  }
  function cancel() {
    reset();
    onCancel();
  }

  return (
    <Dialog open={open} onClose={cancel} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const u = url.trim();
          if (!u || u === 'https://') return;
          onSubmit({ url: u, text: text.trim() });
          reset();
        }}
      >
        <label className="dlg-field">
          {urlLabel}
          <input className="dlg-input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus required />
        </label>
        <label className="dlg-field">
          {textLabel}
          <input className="dlg-input" type="text" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <div className="dlg-actions">
          <button type="button" className="btn btn-ghost" onClick={cancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
