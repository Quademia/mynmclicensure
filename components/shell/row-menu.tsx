// components/shell/row-menu.tsx — the row menu (09.10; Sam, 2026-10-17):
// three dots at a row's end that open what that row allows now. First on
// Learning History. The look is the account menu's (the top bar).
//
// Four kinds of line: a link (a Link with the pressed mark; the menu stays
// open until the page changes, so the tap shows), a button (the
// page's own action — Retake, Abandon), a note told in grey with its icon
// ("Review closed on 4 November" — what is closed is said, not hidden),
// and a locked line (a lock and the label), which adds one "Choose a
// package" link at the foot. It closes on a button's tap, a tap outside,
// Escape (focus back on the dots) and when the page changes. It opens
// below its dots, or above when the screen has no room below. It sits in
// the row, not in a portal: it is absolute, not fixed, so a container
// above it does not move it, and the list must not clip its rows.

'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { LinkPending } from '@/components/shell/link-pending';
import { Icon } from '@/components/shell/icons';
import type { IconName } from '@/lib/nav/types';

export type RowMenuItem =
  | { type: 'link'; label: string; href: string; icon?: IconName }
  | { type: 'button'; label: string; onSelect: () => void; icon?: IconName; danger?: boolean }
  | { type: 'note'; label: string; icon?: IconName }
  | { type: 'locked'; label: string };

const LINE_PX = 44;

export function RowMenu({
  label,
  items,
  lockedHref,
  lockedLabel = 'Choose a package',
}: {
  /** What the dots say to a screen reader: "More for Practice Paper 3". */
  label: string;
  items: RowMenuItem[];
  /** Where a locked line's "Choose a package" goes. */
  lockedHref?: string;
  lockedLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const anyLocked = Boolean(lockedHref) && items.some((i) => i.type === 'locked');

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    function onDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    // Room below? Measured from the dots, the menu's height from its lines.
    const rect = buttonRef.current?.getBoundingClientRect();
    const height = (items.length + (anyLocked ? 1 : 0)) * LINE_PX + 16;
    setUp(Boolean(rect && rect.bottom + height > window.innerHeight && rect.top > height));
    setOpen(true);
  }

  if (!items.length) return null;

  return (
    <div className="row-menu" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`row-menu-btn${open ? ' pressed' : ''}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
      >
        <Icon name="dots" size={20} />
      </button>
      {open ? (
        <div id={menuId} ref={menuRef} className={`row-menu-list${up ? ' up' : ''}`} role="menu">
          {items.map((item, i) => {
            if (item.type === 'link') {
              return (
                <Link key={i} href={item.href} role="menuitem" className="row-menu-line">
                  {item.icon ? <Icon name={item.icon} /> : null}
                  {item.label}
                  <LinkPending />
                </Link>
              );
            }
            if (item.type === 'button') {
              return (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  className={`row-menu-line${item.danger ? ' danger' : ''}`}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.icon ? <Icon name={item.icon} /> : null}
                  {item.label}
                </button>
              );
            }
            return (
              <span key={i} className="row-menu-line row-menu-off" role="menuitem" aria-disabled="true">
                <Icon name={item.type === 'locked' ? 'lock' : (item.icon ?? 'lock')} />
                {item.label}
              </span>
            );
          })}
          {anyLocked && lockedHref ? (
            <Link href={lockedHref} role="menuitem" className="row-menu-line row-menu-accent">
              {lockedLabel}
              <LinkPending />
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
