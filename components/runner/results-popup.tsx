// components/runner/results-popup.tsx
//
// The results pop-up (03 Q18, Sam 2026-09-27), in place of legacy's score
// card, which sat inline above the finished questions and came back on
// every open. MyNclex's shape (lib/practice/runner/results-popup.tsx
// there): it opens once, the moment a sitting finishes, over the review;
// the header's score pill opens it again; reopening a finished sitting
// later opens the review without it. It says what finished, the grade's
// emoji and word (kept — Sam, 2026-09-22: a student reading their own
// result), the percentage, how many were correct, wrong and unanswered,
// the time and the mode. Review answers, Retake where the quiz allows it,
// and the way back. The report page with the breakdown is Q10, later.
//
// On the app's one dialog (DS4), so it is portalled to <body> and its
// look sits outside `.runner` in styles/runner.css.

'use client';

import { Dialog } from '@/lib/overlays/shared/dialog';
import { Icon } from '@/components/shell/icons';

export type ResultsSummary = {
  /** "Quiz complete", "Exam complete", "Time is up". */
  heading: string;
  emoji: string;
  gradeLabel: string;
  pct: number;
  correct: number;
  wrong: number;
  unanswered: number;
  total: number;
  timeTakenS: number | null;
  modeName: string;
};

/** 252 → "4 min 12 s"; 58 → "58 s"; 3780 → "1 h 3 min". */
function formatTime(s: number | null): string {
  if (s === null || !Number.isFinite(s) || s < 0) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h) return `${h} h ${m} min`;
  if (m) return sec ? `${m} min ${sec} s` : `${m} min`;
  return `${sec} s`;
}

export function ResultsPopup({
  open,
  summary,
  onReview,
  onClose,
  retake,
  exit,
}: {
  open: boolean;
  summary: ResultsSummary;
  onReview: () => void;
  onClose: () => void;
  /** Shown only where a retake is allowed. */
  retake: { onClick: () => void; pending: boolean } | null;
  exit: { label: string; onClick: () => void };
}) {
  const s = summary;
  return (
    <Dialog open={open} onClose={onClose} title={s.heading}>
      <div className="results-pop">
        <div className="results-pop-grade">
          <span className="results-pop-emoji" aria-hidden="true">{s.emoji}</span>
          {s.gradeLabel}
        </div>
        <div className="results-pop-score">
          <span className="num">{s.pct}</span>
          <span className="unit">%</span>
        </div>
        <div className="results-pop-frac">{s.correct} of {s.total} correct</div>

        <div className="results-pop-counts">
          <div className="c correct"><span className="n">{s.correct}</span>Correct</div>
          <div className="c wrong"><span className="n">{s.wrong}</span>Wrong</div>
          <div className="c unanswered"><span className="n">{s.unanswered}</span>Unanswered</div>
        </div>

        <dl className="results-pop-facts">
          <dt>Mode</dt>
          <dd>{s.modeName}</dd>
          <dt>Time</dt>
          <dd>{formatTime(s.timeTakenS)}</dd>
        </dl>

        <div className="dlg-actions stack">
          <button type="button" className="btn btn-primary" onClick={onReview}>
            <Icon name="book-open" />Review answers
          </button>
          {retake ? (
            <button type="button" className="btn btn-ghost" disabled={retake.pending} onClick={retake.onClick}>
              <Icon name="refresh" />{retake.pending ? 'Starting…' : 'Retake'}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={exit.onClick}>{exit.label}</button>
        </div>
      </div>
    </Dialog>
  );
}
