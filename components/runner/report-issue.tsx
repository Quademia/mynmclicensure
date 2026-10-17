// components/runner/report-issue.tsx
//
// "Report an issue" under each question (06.2; Sam, 2026-10-17, drawn as
// B): the app's dialog, a reason from a dropdown, an optional note — a
// note required for Something else — and Send. The sitting stays where it
// is; in a timed exam its clock runs on. "I don't understand the answer"
// sends no report: it opens Messages in a new tab with the question
// quoted. A second report on the same question while the first is open
// is refused by the database, and the box then says so — as it does at
// once for a question already reported in this sitting.
//
// The dialog sits outside the runner's wrapper (portalled), so its rules
// in styles/runner.css are unscoped (.rpt-…).

'use client';

import { useState } from 'react';
import { Dialog } from '@/lib/overlays/shared/dialog';
import { sendQuestionReport } from '@/lib/question-reports/actions';
import { DONT_UNDERSTAND, DONT_UNDERSTAND_LABEL, REPORT_NOTE_MAX, REPORT_REASONS } from '@/lib/question-reports/types';

/** "17 October" — the day a report was sent, in Ghana's time (UTC). */
function reportDay(at: string): string {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? 'earlier' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

export function ReportIssueDialog({
  open,
  onClose,
  attemptId,
  itemId,
  chosen,
  messagesHref,
  alreadyAt,
  onSent,
  onAlready,
}: {
  open: boolean;
  onClose: () => void;
  attemptId: string;
  itemId: string;
  chosen: string | string[] | null;
  /** Messages, the course's thread, with the question quoted in the draft. */
  messagesHref: string;
  /** When this question was reported earlier in the sitting (or refused as already). */
  alreadyAt: string | null;
  onSent: () => void;
  onAlready: (at: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function close() {
    setReason('');
    setNote('');
    setError(null);
    setSending(false);
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    if (!reason) return setError('Choose a reason.');
    if (reason === DONT_UNDERSTAND) {
      window.open(messagesHref, '_blank');
      return close();
    }
    if (reason === 'other' && !note.trim()) return setError('Tell us what the issue is.');
    setError(null);
    setSending(true);
    try {
      const r = await sendQuestionReport({ attemptId, itemId, reason, note: note.trim() || null, chosen });
      setSending(false);
      if (r.ok) {
        onSent();
        return close();
      }
      if (r.already) return onAlready(r.at);
      setError(r.error);
    } catch {
      setSending(false);
      setError('Could not send your report. Please check your connection and try again.');
    }
  }

  if (alreadyAt) {
    return (
      <Dialog open={open} onClose={close} title="You've already reported this question">
        <p className="dlg-text">We have your report from {reportDay(alreadyAt)} and we&apos;ll look at it. Thanks for telling us.</p>
        <div className="dlg-actions">
          <button type="button" className="btn btn-primary" onClick={close}>OK</button>
        </div>
      </Dialog>
    );
  }

  const asking = reason === DONT_UNDERSTAND;
  return (
    <Dialog open={open} onClose={close} title="Report an issue with this question">
      <form method="post" onSubmit={submit}>
        <p className="dlg-text">Tell us what&apos;s wrong and we&apos;ll look at it.</p>
        <label className="dlg-field">
          Reason
          <select
            className="dlg-input rpt-select"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
          >
            <option value="" disabled>Choose a reason</option>
            {REPORT_REASONS.filter((r) => r.value !== 'other').map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
            <option value={DONT_UNDERSTAND}>{DONT_UNDERSTAND_LABEL}</option>
            <option value="other">Something else</option>
          </select>
        </label>
        {asking ? (
          <p className="rpt-ask">Ask us in Messages: we&apos;ll open it in a new tab with this question quoted. Your sitting stays here.</p>
        ) : (
          <label className="dlg-field">
            {reason === 'other' ? "What's the issue?" : 'Anything to add? (optional)'}
            <textarea
              className="dlg-input rpt-note"
              value={note}
              maxLength={REPORT_NOTE_MAX}
              rows={3}
              placeholder="Tell us more…"
              onChange={(e) => {
                setNote(e.target.value);
                setError(null);
              }}
            />
          </label>
        )}
        {error ? <p className="rpt-error" role="alert">{error}</p> : null}
        <div className="dlg-actions">
          <button type="button" className="btn btn-ghost" onClick={close}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={sending}>
            {asking ? 'Message us' : sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
