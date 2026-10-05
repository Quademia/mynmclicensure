// app/(app)/student/dashboard/streak-card.tsx
//
// The streak and questions mastered (05 G1a, Sam 2026-10-03): private to
// the student; the current streak, the best, the last seven days as a
// strip; "N answered · N mastered · N% right first time", where answered
// means new questions met. Counted by student_dashboard().

import type { DashStreak } from '@/lib/dashboard/student/types';
import { fmtNumber, pct, plural } from './format';

export function StreakCard({
  streak,
  letters,
  answered,
  mastered,
}: {
  streak: DashStreak;
  letters: string[];
  answered: number;
  mastered: number;
}) {
  return (
    <div className="card sd-card sd-streak">
      <div className="sd-streak-main">
        <p className="sd-card-title">{streak.current > 0 ? `${fmtNumber(streak.current)}-day streak` : 'Answer a question to start a streak'}</p>
        <ol className="sd-week" aria-label="The last seven days">
          {streak.days.map((on, i) => (
            <li key={i} className={on ? 'sd-day sd-day-on' : 'sd-day'} aria-label={`${letters[i]}: ${on ? 'studied' : 'not studied'}`}>
              {letters[i]}
            </li>
          ))}
        </ol>
        {streak.best > 0 ? <p className="sd-meta">Best: {plural(streak.best, 'day')}</p> : null}
      </div>
      <div className="sd-streak-side">
        <span className="sd-big">{fmtNumber(mastered)}</span>
        <span className="sd-meta">questions mastered</span>
        <span className="sd-meta">
          {fmtNumber(answered)} answered · {pct(mastered, answered)}% right first time
        </span>
      </div>
    </div>
  );
}
