// lib/overlays/shared/link-dialog.tsx
//
// The "Insert link" dialog (DS4): a URL field and a text field in one
// box, in place of the two sequential window.prompt() boxes each of
// Admin → Announcements' Link and Button tools used (four prompts →
// two dialogs). The labels are the prompts' words. Enter submits;
// Cancel, Escape and the backdrop hand back nothing.
//
// With `pages` (A4, 2026-10-18), a list of the app's own pages sits above
// the address: picking one fills the address with its path
// (/student/mock-exams) and, when the text is empty, the text with its
// name. The address takes a web address (https://…), an email (mailto:)
// or such a path.

'use client';

import { useState } from 'react';
import { Dialog } from './dialog';

export type LinkPageGroup = { group: string; items: { label: string; href: string }[] };

function addressOk(u: string): boolean {
  return /^(https?:\/\/.+|mailto:.+)$/i.test(u) || /^\/(?!\/)\S*$/.test(u);
}

export function LinkDialog({
  open,
  title,
  urlLabel,
  textLabel,
  textDefault = '',
  submitLabel = 'Insert',
  pages,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  title: string;
  urlLabel: string;
  textLabel: string;
  textDefault?: string;
  submitLabel?: string;
  /** The app's pages to pick from (A4). */
  pages?: LinkPageGroup[];
  onSubmit: (v: { url: string; text: string }) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState('https://');
  const [text, setText] = useState(textDefault);
  const [picked, setPicked] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  function reset() {
    setUrl('https://');
    setText(textDefault);
    setPicked('');
    setProblem(null);
  }
  function cancel() {
    reset();
    onCancel();
  }

  function pick(href: string) {
    setPicked(href);
    setProblem(null);
    if (!href) return;
    setUrl(href);
    const page = pages?.flatMap((g) => g.items).find((p) => p.href === href);
    if (page && (!text.trim() || text === textDefault)) setText(page.label);
  }

  return (
    <Dialog open={open} onClose={cancel} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const u = url.trim();
          if (!u || u === 'https://') return setProblem('Pick a page or type an address.');
          if (!addressOk(u)) return setProblem('Use a page from the list, a web address starting https://, or mailto:.');
          onSubmit({ url: u, text: text.trim() });
          reset();
        }}
      >
        {pages?.length ? (
          <label className="dlg-field">
            A page in the app
            <select className="dlg-input" value={picked} onChange={(e) => pick(e.target.value)}>
              <option value="">— or type a web address below —</option>
              {pages.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((p) => (
                    <option key={p.href} value={p.href}>{p.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        ) : null}
        <label className="dlg-field">
          {urlLabel}
          <input
            className="dlg-input"
            type="text"
            inputMode="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setPicked('');
              setProblem(null);
            }}
            autoFocus={!pages?.length}
            required
          />
        </label>
        <label className="dlg-field">
          {textLabel}
          <input className="dlg-input" type="text" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        {problem ? <p className="dlg-text dlg-problem">{problem}</p> : null}
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
