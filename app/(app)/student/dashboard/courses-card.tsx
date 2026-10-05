// app/(app)/student/dashboard/courses-card.tsx
//
// My courses — a compact list: each held course with its days left and
// the questions met out of its bank ("212 of 1,080 met", Sam 2026-10-04),
// a row opening the course. On the floor (Sam, 2026-10-04): the student's
// programme's courses, locked — "Free questions only" — not links until
// the free account's pages (03 F2).

import { AppLink } from '@/components/shell/link-pending';
import { Icon } from '@/components/shell/icons';
import type { DashCourseMet } from '@/lib/dashboard/student/types';
import { fmtNumber, pct, plural } from './format';

export type CourseRow = { course_id: string; title: string; daysLeft: number | null };

export function CoursesCard({ rows, met, locked }: { rows: CourseRow[]; met: DashCourseMet[]; locked: boolean }) {
  const metOf = new Map(met.map((m) => [m.course_id, m]));
  return (
    <div className="card sd-card sd-list-card">
      <p className="sd-label">My courses</p>
      {rows.length === 0 ? (
        <p className="sd-meta sd-empty">No courses yet.</p>
      ) : (
        <ul className="sd-list">
          {rows.map((row) => {
            const m = metOf.get(row.course_id);
            const inner = (
              <>
                <span className="sd-grow">
                  <span className="sd-row-title">{row.title}</span>
                  {locked ? (
                    <span className="sd-meta">Free questions only</span>
                  ) : (
                    <span className="sd-meta">
                      {m ? `${fmtNumber(m.met)} of ${fmtNumber(m.bank)} met` : ''}
                      {row.daysLeft !== null ? ` · ${plural(row.daysLeft, 'day')} left` : ''}
                    </span>
                  )}
                  {!locked && m && m.bank > 0 ? (
                    <span className="sd-bar sd-bar-thin" aria-hidden="true">
                      <i style={{ width: `${Math.min(100, pct(m.met, m.bank))}%` }} />
                    </span>
                  ) : null}
                </span>
                {locked ? <Icon name="lock" className="sd-row-icon" /> : <span className="sd-chevron" aria-hidden="true">›</span>}
              </>
            );
            return (
              <li key={row.course_id}>
                {locked ? (
                  <div className="sd-list-row">{inner}</div>
                ) : (
                  <AppLink href={`/student/course/${encodeURIComponent(row.course_id)}`} className="sd-list-row">
                    {inner}
                  </AppLink>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
