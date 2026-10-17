// app/(app)/admin/question-reports/reports-list.tsx — the list (06.2;
// Sam, 2026-10-17: drawn as B with C's detail). A quiet list, most reports
// first: a line per question — the count, the start of the question, its
// course and reasons, the newest date. A tap opens the line in place onto
// the whole question: its options with the bank's answer marked, each
// student's report with their own answer, and Open in the bank, Dismiss,
// Mark fixed — the last two close every open report of the question (one
// confirm box each), and the page then reads again. The student hears
// nothing back. <details> does the opening: no script, and the keyboard
// and screen readers know it.

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLink } from '@/components/shell/link-pending';
import { useConfirm } from '@/lib/overlays/shared/confirm-dialog';
import { Toast } from '@/lib/toast/toast';
import { closeQuestionReports } from '@/lib/question-reports/actions';
import { REPORT_REASONS, reasonLabel, type ReportGroup } from '@/lib/question-reports/types';

/** "17 Oct" or "17 Oct 2026", in Ghana's time (UTC) — the same on the server and the browser. */
function day(at: string, withYear = false): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' });
}

function plain(html: string | null): string {
  return (html || '').replace(/<[^>]*>?/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function upper(letters: string | null): string {
  return letters ? letters.split(',').map((l) => l.trim().toUpperCase()).join(', ') : '';
}

/** "The answer is wrong ×3, Something else" — the reasons, most given first. */
function reasonsLine(reasons: Record<string, number>): string {
  return REPORT_REASONS.filter((r) => reasons[r.value])
    .sort((x, y) => reasons[y.value] - reasons[x.value])
    .map((r) => (reasons[r.value] > 1 ? `${r.label} ×${reasons[r.value]}` : r.label))
    .join(', ');
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
      <ul className="card aqr-list">
        {groups.map((g) => {
          const key = new Set((g.correct || '').split(',').map((l) => l.trim().toLowerCase()).filter(Boolean));
          const stem = plain(g.stem);
          return (
            <li key={g.item_id}>
              <details className="aqr-row">
                <summary>
                  <span className={g.reports > 1 ? 'aqr-count aqr-count-many' : 'aqr-count'} aria-label={`${g.reports} report${g.reports === 1 ? '' : 's'}`}>
                    {g.reports}
                  </span>
                  <span className="aqr-line">
                    <span className="aqr-stem-one">{stem || '(no question text)'}</span>
                    <span className="aqr-meta">{g.course_title || g.course_id} · {reasonsLine(g.reasons)}</span>
                  </span>
                  <span className="aqr-day">{day(g.newest)}</span>
                </summary>

                <div className="aqr-open">
                  <p className="aqr-meta">
                    {g.course_title || g.course_id} · {g.item_id} · {g.reports} report{g.reports === 1 ? '' : 's'}
                  </p>
                  <p className="aqr-stem">{stem || '(no question text)'}</p>
                  <ul className="aqr-options" aria-label="Options">
                    {g.options.map((o) => (
                      <li key={o.letter} className={key.has(o.letter) ? 'aqr-option aqr-option-key' : 'aqr-option'}>
                        <b>{o.letter.toUpperCase()}</b>
                        <span>{plain(o.text)}{key.has(o.letter) ? <span className="aqr-key"> · the bank&apos;s answer</span> : null}</span>
                      </li>
                    ))}
                  </ul>
                  {g.options.length === 0 && g.correct ? <p className="aqr-meta">The bank&apos;s answer: {upper(g.correct)}</p> : null}

                  <ul className="aqr-reports" aria-label="Reports">
                    {g.lines.map((l, i) => (
                      <li key={i}>
                        <p className="aqr-meta">
                          <b>{reasonLabel(l.reason)}</b> · {l.name || 'A student'} · {day(l.at, true)} ·{' '}
                          {l.chosen ? `their answer: ${upper(l.chosen)}` : 'not answered'}
                        </p>
                        {l.note ? <p className="aqr-note">{l.note}</p> : null}
                      </li>
                    ))}
                    {g.reports > g.lines.length ? <li className="aqr-meta">The newest {g.lines.length} are shown.</li> : null}
                  </ul>

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
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </>
  );
}
