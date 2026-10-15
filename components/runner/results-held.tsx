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
import type { HeldSitting } from '@/lib/attempts/runner-load';
import { formatResultsAt, formatResultsDay } from '@/lib/quizzes/results-date';
import { AppLink } from '@/components/shell/link-pending';

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

export function ResultsHeld({ held, exit, children }: { held: HeldSitting; exit: SessionExit; children?: ReactNode }) {
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
          <p className="held-msg">
            {submitted}Your score, your report and the answers come out on {formatResultsAt(held.resultsAt)}.
          </p>
          <AppLink className="btn btn-primary" href={exit.href}>{exit.label}</AppLink>
        </div>
      </div>
    </div>
  );
}
