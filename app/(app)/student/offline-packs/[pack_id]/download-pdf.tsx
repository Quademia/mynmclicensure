// app/(app)/student/offline-packs/[pack_id]/download-pdf.tsx — Download PDF
// on a pack's page (07.5; Sam, 2026-10-15). The button opens the app's
// dialog with the two places for the answers, as Practise opens its two
// ways: on the last page (first, the default) or after each question. A
// choice's Download fetches the pack (one request), makes the PDF on this
// phone (lib/offline-packs/pdf) and hands it to the browser to save. The
// first time, the PDF maker and its font come too, so the button says what
// is happening. A failure says so and gives the buttons back. Single-use,
// so beside its page.

'use client';

import { useState } from 'react';
import { Icon } from '@/components/shell/icons';
import { Dialog } from '@/lib/overlays/shared/dialog';
import { Toast } from '@/lib/toast/toast';
import { getPackForPhone } from '@/lib/offline-packs/actions';
import type { PdfAnswers } from '@/lib/offline-packs/pdf-doc';

const PLACES: readonly { answers: PdfAnswers; name: string; blurb: string }[] = [
  { answers: 'end', name: 'Answers on the last page', blurb: 'Answer them all first, then check your work.' },
  { answers: 'each', name: 'Answers after each question', blurb: 'Each question ends with its answer.' },
];

export function DownloadPdf({ packId, title }: { packId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [making, setMaking] = useState<PdfAnswers | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function make(answers: PdfAnswers) {
    setMaking(answers);
    try {
      const load = await getPackForPhone(packId);
      if (!load.ok) {
        setError(load.message);
        return;
      }
      const { downloadPackPdf } = await import('@/lib/offline-packs/pdf');
      await downloadPackPdf({
        packId: load.pack.pack_id,
        packName: load.pack.pack_name,
        courseTitle: load.pack.course_title,
        picked: load.pack.picked,
        createdUtc: load.pack.created_utc,
        ownerName: load.pack.owner_name,
        ownerEmailMask: load.pack.owner_email_mask,
        questions: load.questions,
        answers,
      });
      setOpen(false);
    } catch {
      setError('Could not make the PDF. Please check your connection and try again.');
    } finally {
      setMaking(null);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost btn-lg opk-pdf" onClick={() => setOpen(true)}>
        <Icon name="download" />
        Download PDF
      </button>
      <Dialog open={open} onClose={() => (making ? undefined : setOpen(false))} title={`Download ${title}`}>
        <p className="dlg-text">A PDF to print or keep. Every page carries your name.</p>
        <ul className="pp-ways">
          {PLACES.map((p) => (
            <li key={p.answers} className="pp-way">
              <div className="pp-way-text">
                <span className="pp-way-name">{p.name}</span>
                <span className="pp-way-blurb">{p.blurb}</span>
              </div>
              <button type="button" className="btn btn-accent" disabled={making !== null} onClick={() => void make(p.answers)}>
                {making === p.answers ? 'Making…' : 'Download'}
              </button>
            </li>
          ))}
        </ul>
        <div className="dlg-actions">
          <button type="button" className="btn btn-ghost" disabled={making !== null} onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </Dialog>
      <Toast message={error} tone="error" onDismiss={() => setError(null)} />
    </>
  );
}
