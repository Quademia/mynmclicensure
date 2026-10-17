// components/runner/results-held.tsx
//
// A finished sitting whose results are held (04.12, Sam 2026-10-15: "held
// sitting A"). The paper's or mock's results come out on a date, and until
// then the sitting's page says when — nothing of its questions, answers or
// score reaches it (lib/attempts/runner-load sends none). The runner error
// card's calm sibling: the same card and the same way back, the sitting's
// own home (links.ts), but a pale-teal clock where the card has its alarm.
// The session page shows it on every open until the date; the runner shows
// it the moment a held sitting is submitted, with the held pop-up over it
// (results-popup.tsx), and puts its loader inside (`children`).
//
// A plain component — no client marker, nothing server-only — so the
// server page and the client runner both render it. The clock is drawn
// here: the app's icon set (components/shell/icons.tsx) has none, and the
// set is not added to for one screen.

import type { ReactNode } from 'react';
import type { SessionExit } from '@/lib/attempts/links';
import type { ClosedSitting, HeldSitting } from '@/lib/attempts/runner-load';
import { formatResultsAt, formatResultsDay } from '@/lib/quizzes/results-date';
import { AppLink } from '@/components/shell/link-pending';
import { Icon } from '@/components/shell/icons';

/** The pale-teal circle with a clock: the held screen's mark, and the held pop-up's. */
export function ResultsHeldMark() {
  return (
    <div className="results-held-mark">
      <svg
        width={28}
        height={28}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    </div>
  );
}

/**
 * 04.13: a sitting of a paper or mock whose review is closed (or not
 * allowed). The same calm card: a lock where the clock is, the line the
 * review says ("The review of this mock closed on 4 November."), the
 * report — its summary stays — and the way back. Nothing of the questions.
 */
export function ReviewClosed({ closed, exit, note, children }: { closed: ClosedSitting; exit: SessionExit; note?: string | null; children?: ReactNode }) {
  return (
    <div className="runner">
      {children}
      <div className="runner-wrap">
        <div className="held-screen">
          <div className="results-held-mark">
            <Icon name="lock" size={28} />
          </div>
          <div className="held-title">{closed.displayLabel || 'This sitting'}</div>
          {note ? <p className="held-msg">{note}</p> : null}
          <p className="held-msg">
            {closed.line}
            {closed.reportHref ? ' Your score and your report are kept.' : ''}
          </p>
          <div className="held-actions">
            {closed.reportHref ? (
              <AppLink className="btn btn-primary" href={closed.reportHref}>See your report</AppLink>
            ) : null}
            {/* 03 F2: the access has ended — the one way to open the review */}
            {closed.packageHref ? (
              <AppLink className="btn btn-accent" href={closed.packageHref}>Choose a package</AppLink>
            ) : null}
            <AppLink className={closed.reportHref ? 'btn btn-ghost' : 'btn btn-primary'} href={exit.href}>{exit.label}</AppLink>
          </div>
        </div>
      </div>
    </div>
  );
}

// 04.14: `note` — the sitting was finished just now at its paper's close.
export function ResultsHeld({ held, exit, note, children }: { held: HeldSitting; exit: SessionExit; note?: string | null; children?: ReactNode }) {
  // the submitted sentence only when the end is known
  const submitted = held.endedAt
    ? `You submitted ${held.displayLabel || 'this sitting'} on ${formatResultsDay(held.endedAt)}. `
    : '';
  return (
    <div className="runner">
      {children}
      <div className="runner-wrap">
        <div className="held-screen">
          <ResultsHeldMark />
          <div className="held-title">Results on {formatResultsDay(held.resultsAt)}</div>
          {note ? <p className="held-msg">{note}</p> : null}
          <p className="held-msg">
            {submitted}
            {held.answers ? 'Your score, your report and the answers' : 'Your score and your report'} come out on{' '}
            {formatResultsAt(held.resultsAt)}.
          </p>
          <AppLink className="btn btn-primary" href={exit.href}>{exit.label}</AppLink>
        </div>
      </div>
    </div>
  );
}
