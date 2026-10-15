// app/(app)/student/offline-packs/[pack_id]/practise-pack.tsx — Practise
// on a pack's page (07.4; Sam, 2026-10-15): the main button, opening the
// app's dialog with the two ways, as Practise again does on a paper's page
// (components/practice-papers/paper-actions). Each way's Start is a link to
// the player. Single-use, so beside its page.

'use client';

import { useState } from 'react';
import { AppLink } from '@/components/shell/link-pending';
import { Dialog } from '@/lib/overlays/shared/dialog';
import { PACK_WAYS as WAYS } from '@/lib/offline-packs/questions';

export function PractisePack({ packId, title }: { packId: string; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-accent btn-lg" onClick={() => setOpen(true)}>
        Practise
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Practise ${title}`}>
        <p className="dlg-text">Your score shows here only. Nothing is sent to your record.</p>
        <ul className="pp-ways">
          {WAYS.map((w) => (
            <li key={w.way} className="pp-way">
              <div className="pp-way-text">
                <span className="pp-way-name">{w.name}</span>
                <span className="pp-way-blurb">{w.blurb}</span>
              </div>
              <AppLink href={`/pack-practice/${encodeURIComponent(packId)}?way=${w.way}`} className="btn btn-accent">
                Start
              </AppLink>
            </li>
          ))}
        </ul>
        <div className="dlg-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </Dialog>
    </>
  );
}
