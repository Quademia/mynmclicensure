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
// and the way back. Since 03 Q10 (Sam, 2026-09-30) the main button is
// "See your report", the page with the breakdown — MyNclex's order.
//
// On the app's one dialog (DS4), so it is portalled to <body> and its
// look sits outside `.runner` in styles/runner.css.
//
// ResultsHeldPopup is its sibling for a sitting whose results are held
// (04.12, Sam 2026-10-15: "pop-up B"): the date they come out instead of
// the score, what is known without the key (the mode, the time, how many
// were answered), and the way back — no review, no report, no retake.
//
// ChallengeResultsPopup is the daily challenge's (04.25; Sam 2026-10-20: A,
// drawn): "Challenge done" or "Time is up", the right answers as a count —
// no percentage, no grade word — the time, a dot per question that opens
// it, and "Answers stay open until midnight"; See answers and the way back.
// No report and no retake. The leaderboards' rank lines come with G1b.

'use client';

import { Dialog } from '@/lib/overlays/shared/dialog';
import { formatSeconds } from '@/lib/attempts/report';
import type { SessionExit } from '@/lib/attempts/links';
import { formatResultsAt } from '@/lib/quizzes/results-date';
import { AppLink } from '@/components/shell/link-pending';
import { Icon } from '@/components/shell/icons';
import { ordinal, type ChallengeRanks } from '@/lib/leaderboards/types';
import { ResultsHeldMark } from './results-held';

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

export function ResultsPopup({
  open,
  summary,
  reportHref,
  onReview,
  onClose,
  retake,
  exit,
}: {
  open: boolean;
  summary: ResultsSummary;
  /** The sitting's report page; null in the admin's preview (the report is the student's own). */
  reportHref: string | null;
  /** null: the review is closed (04.13) — no Review answers. */
  onReview: (() => void) | null;
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
          <dd>{formatSeconds(s.timeTakenS)}</dd>
        </dl>

        <div className="dlg-actions stack">
          {reportHref ? (
            <AppLink className="btn btn-primary" href={reportHref}>
              <Icon name="chart" />See your report
            </AppLink>
          ) : null}
          {onReview ? (
            <button type="button" className={reportHref ? 'btn btn-ghost' : 'btn btn-primary'} onClick={onReview}>
              <Icon name="book-open" />Review answers
            </button>
          ) : null}
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

export type ChallengeDot = { n: number; mark: 'right' | 'wrong' | 'unanswered' | 'voided' };

const DOT_WORDS: Record<ChallengeDot['mark'], string> = {
  right: 'right',
  wrong: 'wrong',
  unanswered: 'not answered',
  voided: 'voided — not counted',
};

export type ChallengeSummary = {
  /** "Challenge done", or "Time is up". */
  heading: string;
  right: number;
  /** The questions counted — a voided one out. */
  outOf: number;
  timeTakenS: number | null;
  dots: ChallengeDot[];
};

export function ChallengeResultsPopup({
  open,
  summary,
  onJump,
  onAnswers,
  onClose,
  exit,
  ranks = null,
  onLeaderboards,
}: {
  open: boolean;
  summary: ChallengeSummary;
  /** A dot: the answers, at that question (1-based). */
  onJump: (n: number) => void;
  onAnswers: () => void;
  onClose: () => void;
  exit: { label: string; onClick: () => void };
  /** 05 G1b: today's and this week's places; null leaves the line out. */
  ranks?: ChallengeRanks | null;
  onLeaderboards?: () => void;
}) {
  const s = summary;
  // "3rd today and 14th this week in St Mary's" (04; Sam, 2026-10-20)
  const places = ranks?.joined
    ? [ranks.today ? `${ordinal(ranks.today)} today` : null, ranks.week ? `${ordinal(ranks.week)} this week` : null]
        .filter(Boolean)
        .join(' and ')
    : '';
  return (
    <Dialog open={open} onClose={onClose} title={s.heading}>
      <div className="results-pop challenge-pop">
        <div className="challenge-pop-count">
          <span className="num">{s.right}</span> of {s.outOf} right
        </div>
        <div className="challenge-pop-time">
          <Icon name="timer" />
          {formatSeconds(s.timeTakenS)}
        </div>
        <ul className="challenge-pop-dots" aria-label="Your answers">
          {s.dots.map((d) => (
            <li key={d.n}>
              <button type="button" className={`challenge-dot ${d.mark}`} aria-label={`Question ${d.n}: ${DOT_WORDS[d.mark]}`} onClick={() => onJump(d.n)}>
                {d.n}
              </button>
            </li>
          ))}
        </ul>
        {ranks && onLeaderboards ? (
          <div className="challenge-pop-rank">
            {places ? (
              <p className="challenge-pop-place">
                <Icon name="trophy" />
                {places} in {ranks.board}
              </p>
            ) : null}
            <button type="button" className="btn-link" onClick={onLeaderboards}>
              {ranks.joined ? 'See the leaderboards ›' : 'Join the leaderboards to see where you rank ›'}
            </button>
          </div>
        ) : null}
        <p className="challenge-pop-note">Answers stay open until midnight.</p>
        <div className="dlg-actions stack">
          <button type="button" className="btn btn-primary" onClick={onAnswers}>
            <Icon name="book-open" />See answers
          </button>
          <button type="button" className="btn btn-ghost" onClick={exit.onClick}>{exit.label}</button>
        </div>
      </div>
    </Dialog>
  );
}

export type HeldSummary = {
  /** "Exam submitted", or "Time is up" when the clock closed it. */
  heading: string;
  resultsAt: string;
  answered: number;
  total: number;
  timeTakenS: number | null;
  modeName: string;
  /** 04.13: false when the review is Not allowed. */
  answers: boolean;
};

export function ResultsHeldPopup({
  open,
  summary,
  onClose,
  exit,
}: {
  open: boolean;
  summary: HeldSummary;
  /** Escape, the backdrop: the held screen stays under it. */
  onClose: () => void;
  /** The sitting's home — the one button. */
  exit: SessionExit;
}) {
  const s = summary;
  return (
    <Dialog open={open} onClose={onClose} title={s.heading}>
      <div className="results-held-pop">
        <ResultsHeldMark />
        <div className="results-held-pop-lead">Your results come out on</div>
        <div className="results-held-pop-date">{formatResultsAt(s.resultsAt)}</div>
        <p className="results-held-pop-note">
          {s.answers ? 'Your score, your report and the answers will be here then.' : 'Your score and your report will be here then.'}
        </p>

        <dl className="results-pop-facts">
          <dt>Mode</dt>
          <dd>{s.modeName}</dd>
          <dt>Time</dt>
          <dd>{formatSeconds(s.timeTakenS)}</dd>
          <dt>Answered</dt>
          <dd>{s.answered} of {s.total}</dd>
        </dl>

        <div className="dlg-actions stack">
          <AppLink className="btn btn-primary" href={exit.href}>{exit.label}</AppLink>
        </div>
      </div>
    </Dialog>
  );
}
