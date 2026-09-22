// lib/overlays/shared/dialog.tsx
//
// The one dialog (10-design-system.md DS4, Sam 2026-09-22): a centred
// panel on a dimmed backdrop, built on the browser's own <dialog>
// element opened with showModal(). The browser then does what a
// hand-written box gets subtly wrong — it traps focus inside, closes on
// Escape, makes the rest of the page inert, paints in the top layer
// above every z-index, and hands focus back to the opener on close.
// No package, no focus-trap code of ours.
//
// Two rules from AGENTS.md UI convention #2 are built in: the backdrop
// click and Escape both map to onClose, the SAFE option — a caller
// treats onClose as Cancel, never as Confirm. Every overlay is portalled
// to <body> (Known Workarounds); a top-layer dialog does not strictly
// need it, but the portal keeps the DOM shape every other overlay has.
//
// The look is in styles/components.css (.dlg*). The two kinds the app
// needs sit beside this file: confirm-dialog.tsx and link-dialog.tsx.

'use client';

import { useEffect, useId, useRef } from 'react';
import { BodyPortal } from './body-portal';

export function Dialog({
  open,
  onClose,
  title,
  children,
  role = 'dialog',
}: {
  open: boolean;
  /** Escape, the backdrop, and the caller's Cancel. */
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** 'alertdialog' for a confirm that interrupts (screen readers announce it as such). */
  role?: 'dialog' | 'alertdialog';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Open and close are DOM calls on the element, not state, so an effect
  // is the right place (the compiler's rules forbid a ref write in
  // render and a setState in an effect; this is neither).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  if (!open) return null;

  return (
    <BodyPortal>
      <dialog
        ref={ref}
        className="dlg"
        role={role}
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          // Escape, caught on the way down: routed through onClose so the
          // caller's state follows. (Chrome only fires the element's own
          // `cancel` event with user activation, so it is not relied on.)
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
        onCancel={(e) => {
          e.preventDefault();
          onClose();
        }}
        onClose={() => {
          // The browser closed it by a route of its own (a second Escape
          // under Chrome's close-watcher rules): keep the state in step.
          onClose();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="dlg-body">
          <h2 className="dlg-title" id={titleId}>
            {title}
          </h2>
          {children}
        </div>
      </dialog>
    </BodyPortal>
  );
}
