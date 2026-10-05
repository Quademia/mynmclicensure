// app/(app)/student/dashboard/recent-card.tsx
//
// Recent sittings — the last five, short: what it was, the score or how
// far it got, and one action: Resume an unfinished one, the Report of a
// finished one (03 Q10). An abandoned one shows its state and no action.
// "History" opens Learning History, where every sitting is.

import { AppLink } from '@/components/shell/link-pending';
import { Icon } from '@/components/shell/icons';
import { reportHref, sessionHref } from '@/lib/attempts/links';
import type { AttemptListRow } from '@/lib/attempts/types';
import { fmtNumber } from './format';

function iconOf(source: string) {
  if (source === 'builder') return 'wrench' as const;
  if (source === 'mock') return 'target' as const;
  return 'clipboard' as const;
}

export function RecentCard({ attempts, titleOf }: { attempts: AttemptListRow[]; titleOf: (courseId: string) => string }) {
  return (
    <div className="card sd-card sd-list-card">
      <div className="sd-row">
        <p className="sd-label">Recent sittings</p>
        <AppLink href="/student/learning-history" className="sd-link">
          History →
        </AppLink>
      </div>
      {attempts.length === 0 ? (
        <div className="sd-empty">
          <p className="sd-meta">No sittings yet — your first one will show here.</p>
          <AppLink href="/student/fixed-quizzes" className="btn btn-outline">
            Pick a practice paper
          </AppLink>
        </div>
      ) : (
        <ul className="sd-list">
          {attempts.map((a) => {
            const title = a.display_label || `Quiz builder · ${titleOf(a.course_id)}`;
            const score =
              a.status === 'completed'
                ? `${Math.round(a.score_pct ?? 0)}%`
                : a.status === 'in_progress'
                  ? `${fmtNumber(a.n)} questions`
                  : 'Abandoned';
            return (
              <li key={a.attempt_id} className="sd-list-row">
                <Icon name={iconOf(a.source)} className="sd-row-icon" />
                <span className="sd-grow sd-row-title">{title}</span>
                <span className="sd-meta">{score}</span>
                {a.status === 'in_progress' ? (
                  <AppLink href={sessionHref(a.attempt_id)} className="sd-link sd-action">
                    Resume
                  </AppLink>
                ) : a.status === 'completed' ? (
                  <AppLink href={reportHref(a.attempt_id)} className="sd-link sd-action">
                    Report
                  </AppLink>
                ) : (
                  <span className="sd-action" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
