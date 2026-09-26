// app/(app)/admin/question-bank/csv-import-modal.tsx
//
// The CSV import modal of legacy admin/question-bank.html (slice 4b):
// download the template, pick a file, see the row-by-row report, import.
// The report is built in the browser from lib/bank/csv (no round trip,
// as legacy); the import is the Server Action. Legacy's copy throughout.
// After an import the result lines replace the report and the modal
// closes itself after 2 s, as legacy did; the caller re-fetches the
// course. Single use, so it sits beside its caller (folder convention #3).
// Portalled to <body> (AGENTS.md workaround) with the `qb-modal` scope
// class for its styles.
//
// 08 B4: two choices per file — publish the new questions now or keep
// them as drafts (the default, as for a question saved by hand), and
// mark them free or not. Both apply to the questions the file creates;
// a question already in the bank keeps its own settings, and the result
// line says how many were new and how many updated.

'use client';

import { useRef, useState } from 'react';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { importItems } from '@/lib/bank/actions';
import { csvTemplate, parseCsv, type CsvParseResult } from '@/lib/bank/csv';
import { Icon } from '@/components/shell/icons';

type Outcome = { successCount: number; failCount: number; errors: string[]; created: number; updated: number };

export function CsvImportModal({
  courseId,
  onClose,
  onImported,
}: {
  courseId: string;
  onClose: () => void;
  /** Called after an import ran, before the modal closes itself. */
  onImported: () => Promise<void> | void;
}) {
  const [parsed, setParsed] = useState<CsvParseResult | null>(null);
  const [phase, setPhase] = useState<'pick' | 'importing' | 'done'>('pick');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishNew, setPublishNew] = useState(false);
  const [freeNew, setFreeNew] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const blob = new Blob([csvTemplate(courseId)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${courseId}_questions_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onCsvSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setParsed(parseCsv(String(ev.target?.result || ''), courseId));
      setOutcome(null);
      setError(null);
    };
    reader.readAsText(file);
  }

  async function runImport() {
    if (!parsed || !parsed.rows.length) return;
    setPhase('importing');
    const result = await importItems(courseId, parsed.rows, { publishNew, freeNew });
    if (!result.ok) {
      setError(result.error);
      setPhase('pick');
      return;
    }
    setOutcome({
      successCount: result.successCount,
      failCount: result.failCount,
      errors: result.errors,
      created: result.created,
      updated: result.updated,
    });
    setPhase('done');
    await onImported();
    window.setTimeout(onClose, 2000);
  }

  const skipped = parsed ? parsed.report.length - parsed.validCount : 0;
  const canImport = phase === 'pick' && !!parsed && parsed.validCount > 0;

  return (
    <BodyPortal>
      <div className="qb-modal">
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="csvModalTitle">
          <div className="modal-card">
            <h3 id="csvModalTitle">Import Questions from CSV</h3>
            <p>Download the template, fill it in with your questions, then upload it here. The system will validate each row and report any errors.</p>

            <div className="modal-template">
              <button type="button" className="btn btn-ghost" onClick={downloadTemplate}><Icon name="download" />Download CSV Template</button>
            </div>

            <div className="form-group">
              <label htmlFor="csvFileInput" className="csv-label">Upload completed CSV</label>
              <input id="csvFileInput" ref={fileRef} type="file" accept=".csv" className="csv-file" onChange={onCsvSelected} />
            </div>

            <div className="csv-report">
              {error ? <div className="csv-report-row err">{error}</div> : null}
              {outcome ? (
                <>
                  <div className="csv-report-row ok">{outcome.successCount} question{outcome.successCount !== 1 ? 's' : ''} imported successfully.</div>
                  {outcome.successCount ? (
                    <div className="csv-report-row ok">
                      {outcome.created} new ({publishNew ? 'published' : 'drafts'}{freeNew ? ', free' : ''}) · {outcome.updated} already in the bank, updated with their own settings kept.
                    </div>
                  ) : null}
                  {outcome.failCount ? (
                    <div className="csv-report-row err">{outcome.failCount} row(s) failed — {outcome.errors.join('; ') || 'see the server log for details.'}</div>
                  ) : null}
                </>
              ) : parsed ? (
                <>
                  <div className="csv-summary">
                    {parsed.validCount} valid row{parsed.validCount !== 1 ? 's' : ''} ready to import.
                    {skipped > 0 ? ` ${skipped} row(s) will be skipped.` : ''}
                  </div>
                  {parsed.report.map((r, i) => (
                    <div key={i} className={`csv-report-row ${r.ok ? 'ok' : 'err'}`}>{r.msg}</div>
                  ))}
                </>
              ) : null}
            </div>

            {parsed && parsed.validCount > 0 && !outcome ? (
              <div className="csv-choices">
                <label className="csv-choice">
                  <input type="checkbox" checked={publishNew} disabled={phase !== 'pick'} onChange={(e) => setPublishNew(e.target.checked)} />
                  Publish the new questions now
                </label>
                <label className="csv-choice">
                  <input type="checkbox" checked={freeNew} disabled={phase !== 'pick'} onChange={(e) => setFreeNew(e.target.checked)} />
                  Mark the new questions as free
                </label>
                <p className="csv-choice-hint">
                  Unticked, new questions are saved as drafts. Both choices apply only to questions this file adds — a question already in the bank keeps its own settings. A question in a mock exam cannot be free.
                </p>
              </div>
            ) : null}

            <div className="modal-actions">
              <button type="button" className="btn btn-primary" disabled={!canImport} onClick={runImport}>
                {phase === 'importing' ? 'Importing…' : phase === 'done' ? 'Done' : 'Import Questions'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
