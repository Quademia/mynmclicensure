// components/courses/course-header.tsx
//
// The course's header, shared by the course page and the Practice Papers
// pages inside a course (Sam, 2026-10-12): the row of tabs across the top —
// a way back and the student's courses, the current one underlined (on a
// phone only the way back) — then the title with the days-left chip and
// the end date. "Message us" and the progress card are the course page's
// own and are passed in as `children`. Server Component.

import { AppLink } from '@/components/shell/link-pending';
import { PageHeader } from '@/components/shell/page-header';
import { formatDay } from '@/lib/practice-papers/derive';
import type { PaperAccess } from '@/lib/practice-papers/derive';
import '@/styles/courses.css';

type Ended = { kind: 'trial' | 'package'; on: string } | null;

export function courseChip(access: PaperAccess, days: number | null, ended: Ended): { text: string; tone: 'ok' | 'warn' | 'neutral' } {
  if (access === 'all' && days != null) return { text: `${days} day${days === 1 ? '' : 's'} left`, tone: days <= 7 ? 'warn' : 'ok' };
  if (access === 'trial' && days != null) return { text: `Trial · ${days} day${days === 1 ? '' : 's'} left`, tone: 'warn' };
  if (ended) return { text: `Ended ${formatDay(ended.on)}`, tone: 'neutral' };
  return { text: 'Free', tone: 'neutral' };
}

export function CourseChip({ access, days, ended }: { access: PaperAccess; days: number | null; ended: Ended }) {
  const c = courseChip(access, days, ended);
  const cls = c.tone === 'ok' ? 'badge badge-success' : c.tone === 'warn' ? 'badge badge-warning' : 'badge badge-neutral';
  return <span className={cls}>{c.text}</span>;
}

export function CourseTabs({
  backHref,
  backLabel,
  tabs,
  currentId,
  hrefFor,
}: {
  backHref: string;
  backLabel: string;
  tabs: { course_id: string; title: string }[];
  currentId: string;
  hrefFor: (courseId: string) => string;
}) {
  return (
    <nav className="cp-tabs" aria-label="Your courses">
      <AppLink href={backHref} className="cp-tab-back">‹ {backLabel}</AppLink>
      {tabs.map((t) =>
        t.course_id === currentId ? (
          <span key={t.course_id} className="cp-tab cp-tab-on" aria-current="page">{t.title}</span>
        ) : (
          <AppLink key={t.course_id} href={hrefFor(t.course_id)} className="cp-tab">{t.title}</AppLink>
        ),
      )}
    </nav>
  );
}

export function CourseHeading({
  title,
  access,
  days,
  expires,
  ended,
  children,
}: {
  title: string;
  access: PaperAccess;
  days: number | null;
  expires: string | null;
  ended: Ended;
  children?: React.ReactNode;
}) {
  return (
    <div className="cp-head">
      <PageHeader title={title} />
      <div className="cp-head-line">
        <CourseChip access={access} days={days} ended={ended} />
        {expires && access !== 'none' ? <span className="cp-line">Ends {formatDay(expires)}</span> : null}
        {children}
      </div>
    </div>
  );
}
