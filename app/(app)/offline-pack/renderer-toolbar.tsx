// app/(app)/offline-pack/renderer-toolbar.tsx
//
// The renderer's top bar (legacy .topbar): the title, the subtitle and
// Back / Print / "Download / Save PDF" / Reload. Print and Save PDF both
// call window.print(), exactly as legacy's printPack and downloadPdf
// did; Reload re-reads the pack (legacy loadPack again). Back goes to
// My Packs (slice 13b's page). Hidden in print.

'use client';

import { useRouter } from 'next/navigation';

export function RendererToolbar() {
  const router = useRouter();
  return (
    <div className="topbar">
      <div className="topbar-left">
        <p className="topbar-title">Offline Pack Renderer</p>
        <p className="topbar-sub">Open a saved pack, print it, or save it as PDF from your browser.</p>
      </div>
      <div className="btnrow">
        <a className="btn" href="/student/offline-packs">Back</a>
        <button className="btn" type="button" onClick={() => window.print()}>Print</button>
        <button className="btn primary" type="button" onClick={() => window.print()}>Download / Save PDF</button>
        <button className="btn primary" type="button" onClick={() => router.refresh()}>Reload</button>
      </div>
    </div>
  );
}
