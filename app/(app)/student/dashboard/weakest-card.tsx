// app/(app)/student/dashboard/weakest-card.tsx
//
// Your weakest topic — from 20 answers, a topic with at least 5 (Sam,
// 2026-10-04); student_dashboard() returns none below that, and then the
// card is not drawn. One tap opens the Quiz Builder on that course with
// the topic ticked, as the report's "Practise this topic" does.

import { AppLink } from '@/components/shell/link-pending';
import { builderTopicHref } from '@/lib/attempts/links';
import type { DashWeakest } from '@/lib/dashboard/student/types';
import { pct } from './format';

export function WeakestCard({ weakest, courseTitle }: { weakest: DashWeakest; courseTitle: string }) {
  return (
    <div className="card sd-card">
      <p className="sd-label">Your weakest topic</p>
      <div className="sd-row">
        <div className="sd-grow">
          <p className="sd-card-title">{weakest.topic}</p>
          <p className="sd-meta">
            {pct(weakest.correct, weakest.answered)}% correct · {courseTitle}
          </p>
        </div>
        <AppLink href={builderTopicHref(weakest.course_id, weakest.topic)} className="btn btn-outline">
          Practise this topic
        </AppLink>
      </div>
    </div>
  );
}
