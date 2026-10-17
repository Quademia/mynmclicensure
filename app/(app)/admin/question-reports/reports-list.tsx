// app/(app)/admin/question-reports/reports-list.tsx — the cards (06.2).
// Each question: its course and id, the start of its stem, its answer in
// the bank, the count and the newest date, the count by reason, the
// reports themselves behind "See the reports", and the three actions.
// Mark fixed and Dismiss close every open report of the question (one
// confirm box each); the page then reads again. The student hears nothing
// back (Sam, 2026-10-17).

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLink } from '@/components/shell/link-pending';
import { useConfirm } from '@/lib/overlays/shared/confirm-dialog';
import { Toast } from '@/lib/toast/toast';
import { closeQuestionReports } from '@/lib/question-reports/actions';
import { REPORT_REASONS, reasonLabel, type ReportGroup } from '@/lib/question-reports/types';

/** "17 Oct 2026" in Ghana's time (UTC), the same on the server and the phone. */
function day(at: string): string {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function plainStem(stem: string | null): string {
  const s = (stem || '').replace(/<[^>]*>?/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length >= 290 ? `${s.slice(0, 280)}…` : s;
}

function letters(v: string | null): string {
  return v ? v.split(',').map((l) => l.trim().toUpperCase()).join(', ') : '';
}

export function ReportsList({ groups }: { groups: ReportGroup[] }) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);
  const dismiss = useCallback(() => setMsg(null), []);

  async function close(g: ReportGroup, status: 'fixed' | 'dismissed') {
    const n = `${g.reports} report${g.reports === 1 ? '' : 's'}`;
    const ok = await confirm(
      status === 'fixed'
        ? { title: 'Mark this question fixed?', body: `This closes its ${n}. The students are not told.`, confirmLabel: 'Mark fixed' }
        : { title: 'Dismiss these reports?', body: `This closes the question's ${n} without a change. The students are not told.`, confirmLabel: 'Dismiss' },
    );
    if (!ok) return;
    setBusy(g.item_id);
    try {
      const r = await closeQuestionReports(g.item_id, status);
      setBusy(null);
      if (!r.ok) return setMsg({ text: r.error, tone: 'error' });
      setMsg({ text: status === 'fixed' ? `Marked fixed — ${r.closed} closed.` : `Dismissed — ${r.closed} closed.`, tone: 'success' });
      router.refresh();
    } catch {
      setBusy(null);
      setMsg({ text: 'Could not close these reports. Please check your connection and try again.', tone: 'error' });
    }
  }

  return (
    <>
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />
      {confirmDialog}
      <ul className="aqr-list">
        {groups.map((g) => (
          <li key={g.item_id} className="card aqr-card">
            <p className="aqr-meta">{g.course_title || g.course_id} · {g.item_id}</p>
            <p className="aqr-stem">{plainStem(g.stem) || '(no question text)'}</p>
            <p className="aqr-meta">
              {g.correct ? <>Answer in the bank: <b>{letters(g.correct)}</b> · </> : null}
              {g.reports} report{g.reports === 1 ? '' : 's'} · newest {day(g.newest)}
            </p>
            <ul className="aqr-reasons" aria-label="Reasons">
              {REPORT_REASONS.filter((r) => g.reasons[r.value]).map((r) => (
                <li key={r.value} className="badge badge-neutral">{r.label} · {g.reasons[r.value]}</li>
              ))}
            </ul>
            <details className="aqr-lines">
              <summary>See the report{g.reports === 1 ? '' : 's'}</summary>
              <ul>
                {g.lines.map((l, i) => (
                  <li key={i}>
                    <p className="aqr-line-head">
                      <b>{reasonLabel(l.reason)}</b> · {l.name || 'A student'} · {day(l.at)}
                    </p>
                    {l.note ? <p className="aqr-note">{l.note}</p> : null}
                    <p className="aqr-meta">{l.chosen ? `Their answer: ${letters(l.chosen)}` : 'Not answered when reported'}</p>
                  </li>
                ))}
                {g.reports > g.lines.length ? <li className="aqr-meta">The newest {g.lines.length} are shown.</li> : null}
              </ul>
            </details>
            <div className="aqr-actions">
              <AppLink
                href={`/admin/question-bank?course=${encodeURIComponent(g.course_id)}&item=${encodeURIComponent(g.item_id)}`}
                className="btn btn-ghost"
              >
                Open in the bank
              </AppLink>
              <button type="button" className="btn btn-ghost" disabled={busy === g.item_id} onClick={() => close(g, 'dismissed')}>
                Dismiss
              </button>
              <button type="button" className="btn btn-primary" disabled={busy === g.item_id} onClick={() => close(g, 'fixed')}>
                {busy === g.item_id ? 'Closing…' : 'Mark fixed'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
