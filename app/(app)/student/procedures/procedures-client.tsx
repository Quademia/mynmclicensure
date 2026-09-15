// app/(app)/student/procedures/procedures-client.tsx
//
// The body and script block of legacy student/procedures.html (slice
// 7c): the intro with "Your programme", the Your Programme Procedures
// card (or the NAC/NAP card for NACNAP), the Procedure Viewer — an
// iframe on the NMC website, hidden until View, with Hide viewer and
// the fallback line — and the Other Programme Procedures list with View
// / Open per manual and the Hide list / Show list toggle. The thirteen
// manuals and their addresses are the page's own, as legacy held them
// (a table with an admin page is on the "After the rebuild" list, Sam
// 2026-09-14). "Inside QAcademy" became "Inside Quademia" (UI
// convention #5); nothing else in the copy changed.

'use client';

import { useRef, useState } from 'react';

type Manual = { name: string; url: string };

// legacy `manuals`, in its order
const MANUALS: Record<string, Manual> = {
  RN: { name: 'Registered General Nursing (RGN)', url: 'https://nmc.gov.gh/procedures/view/RGN' },
  RM: { name: 'Registered Midwifery (RM)', url: 'https://nmc.gov.gh/procedures/view/RM' },
  RPHN: { name: 'Public Health Nursing (RPHN)', url: 'https://nmc.gov.gh/procedures/view/PHN' },
  RMHN: { name: 'Mental Health Nursing (RMHN)', url: 'https://nmc.gov.gh/procedures/view/RMN' },
  RCMN: { name: 'Community/CHN/CMCN (RCMN)', url: 'https://nmc.gov.gh/procedures/view/RCMN' },
  PAED: { name: 'Paediatrics (PAED)', url: 'https://nmc.gov.gh/procedures/view/PAED' },
  PM: { name: 'Perioperative / PM', url: 'https://nmc.gov.gh/procedures/view/PM' },
  CCN: { name: 'Critical Care Nursing (Post-Basic)', url: 'https://nmc.gov.gh/pb-procedures/view/CCN' },
  ENT: { name: 'ENT Nursing (Post-Basic)', url: 'https://nmc.gov.gh/pb-procedures/view/ENT' },
  ENUR: { name: 'Emergency Nursing (Post-Basic)', url: 'https://nmc.gov.gh/pb-procedures/view/ENUR' },
  NP: { name: 'Nurse Practitioner (Post-Basic)', url: 'https://nmc.gov.gh/pb-procedures/view/NP' },
  OPN: { name: 'Ophthalmic Nursing (Post-Basic)', url: 'https://nmc.gov.gh/pb-procedures/view/OPN' },
  PON: { name: 'Peri-Operative Nursing (Post-Basic)', url: 'https://nmc.gov.gh/pb-procedures/view/PON' },
};

// legacy normalizeProgramCode
function normalizeProgramCode(raw: string): string {
  if (!raw) return '';
  const t = raw.toUpperCase().replace(/\s+/g, '');
  if (t.startsWith('RN')) return 'RN';
  if (t === 'RMHN' || t === 'RMN' || t === 'MHN' || t.startsWith('RMHN')) return 'RMHN';
  if (t.startsWith('RM')) return 'RM';
  if (t.includes('RPHN') || t === 'PHN') return 'RPHN';
  if (t.includes('RCMN')) return 'RCMN';
  if (t.includes('PAED')) return 'PAED';
  if (t === 'PM') return 'PM';
  if (t.includes('NAC') || t.includes('NAP')) return 'NACNAP';
  if (t === 'CCN') return 'CCN';
  if (t === 'ENT') return 'ENT';
  if (t === 'ENUR') return 'ENUR';
  if (t === 'NP') return 'NP';
  if (t === 'OPN') return 'OPN';
  if (t === 'PON') return 'PON';
  return t;
}

type Props = {
  /** the profile's program_id, as stored */
  programRaw: string;
  /** the programme's display name from `programs`, when found */
  programName: string | null;
};

type Viewer = { shown: false } | { shown: true; manual: Manual | null };

export function ProceduresClient({ programRaw, programName }: Props) {
  const code = normalizeProgramCode(programRaw);
  const mine = MANUALS[code];
  const isNacnap = code === 'NACNAP';

  const [viewer, setViewer] = useState<Viewer>({ shown: false });
  const [listShown, setListShown] = useState(true);
  const viewerRef = useRef<HTMLDivElement>(null);

  function scrollToViewer() {
    // after the render that shows it
    window.setTimeout(() => viewerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  // legacy viewMyProgram
  function viewMyProgram() {
    setViewer({ shown: true, manual: mine ?? null });
    scrollToViewer();
  }

  // legacy switchManual
  function switchManual(k: string) {
    const m = MANUALS[k];
    if (!m) return;
    setViewer({ shown: true, manual: m });
    scrollToViewer();
  }

  const viewerLabel = viewer.shown ? (viewer.manual ? viewer.manual.name : 'Select a programme below to view its procedures.') : '';
  const viewerUrl = viewer.shown && viewer.manual ? viewer.manual.url : '';

  return (
    <div className="spr">
      {/* Intro */}
      <div className="proc-intro">
        <h2>Practical Skills — Procedures</h2>
        <p>
          Official NMC Ghana procedure manuals to support your practical and OSCE preparation.
          This page adapts to your programme and also gives you access to procedures from other programmes.
        </p>
        <p className="programme-label">Your programme: <span>{programName || programRaw || code || '—'}</span></p>
      </div>

      {isNacnap ? (
        /* NAC/NAP block */
        <div className="proc-card">
          <div className="proc-card-header">
            <span className="proc-card-title">NAC/NAP Procedures</span>
          </div>
          <p className="proc-text tight">
            The NAC/NAP programme does <strong>not</strong> include an NMC Practical/OSCE examination,
            and no official procedure manual is provided for NAC/NAP candidates.
          </p>
          <p className="proc-text last">
            You can still explore procedures from other programmes below, especially if you are planning to upgrade in the future.
          </p>
        </div>
      ) : (
        /* Your Programme block */
        <div className="proc-card">
          <div className="proc-card-header">
            <span className="proc-card-title">Your Programme Procedures</span>
          </div>
          <p className="proc-text">
            {mine ? (
              <>Below is the official NMC Procedure Manual mapped for <strong>{mine.name}</strong>.</>
            ) : (
              'No direct procedure manual is mapped for your programme. Please choose one from the list below.'
            )}
          </p>
          <div className="proc-actions">
            <button type="button" className="btn btn-primary" onClick={viewMyProgram}>
              {code ? `View ${code} Inside Quademia` : 'View Inside Quademia'}
            </button>
            <a href={mine ? mine.url : '#'} target="_blank" rel="noopener noreferrer">
              <button type="button" className="btn btn-secondary">Open on NMC Website</button>
            </a>
          </div>
        </div>
      )}

      {/* Viewer (hidden until the student clicks) */}
      {!isNacnap || viewer.shown ? (
        <div className="proc-card" ref={viewerRef} hidden={!viewer.shown}>
          <div className="proc-card-header">
            <span className="proc-card-title">Procedure Viewer</span>
            <button type="button" className="btn-toggle" onClick={() => setViewer({ shown: false })}>Hide viewer</button>
          </div>
          <p className="viewer-label">{viewerLabel}</p>
          <iframe className="proc-viewer" src={viewerUrl || undefined} title="Procedure manual" />
          <p className="proc-fallback">
            If the viewer does not load,{' '}
            <a href={viewerUrl || '#'} target="_blank" rel="noopener noreferrer">open the procedures on the NMC website</a>.
          </p>
        </div>
      ) : null}

      {/* Other Programme Procedures */}
      <div className="proc-card">
        <div className="proc-card-header">
          <span className="proc-card-title">Other Programme Procedures</span>
          <button type="button" className="btn-toggle" onClick={() => setListShown((s) => !s)}>{listShown ? 'Hide list' : 'Show list'}</button>
        </div>
        {listShown ? (
          <>
            <p className="list-desc">
              Explore procedure manuals from other NMC programmes. These are public and useful for reference, comparison, or upgrading.
            </p>
            <div>
              {Object.entries(MANUALS).map(([k, m]) => (
                <div key={k} className="manual-row">
                  <span className="manual-row-name">{m.name}</span>
                  <span className="manual-row-actions">
                    <button type="button" className="btn btn-primary" onClick={() => switchManual(k)}>View</button>
                    <a href={m.url} target="_blank" rel="noopener noreferrer">
                      <button type="button" className="btn btn-secondary">Open</button>
                    </a>
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
