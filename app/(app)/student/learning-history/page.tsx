// app/(app)/student/learning-history/page.tsx — Learning History,
// redesigned (05.5, 05 Q12; Sam, 2026-10-17; 05-progress.md and
// 11-pages.md "Learning history").
//
// A plain list of every sitting: the course chips (the courses the student
// has sat something in), the figures over the whole history or the chosen
// course (student_history_figures), and the first twenty rows, newest
// first, each worded on the server (lib/history). A chip is a link
// (?course=), so the figures and the list come back together and the way
// back works; Load more is the list's own.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { getHistoryChunk, getHistoryCourses, getHistoryFigures } from '@/lib/history/queries';
import type { HistoryFigures } from '@/lib/history/types';
import { PageHeader } from '@/components/shell/page-header';
import { AppLink } from '@/components/shell/link-pending';
import { HistoryList } from './history-list';
import { renderStamp } from './stamp';
import '@/styles/student-learning-history.css';

export const metadata: Metadata = {
  title: 'Learning History | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

const HISTORY_PATH = '/student/learning-history';

export default async function LearningHistoryPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const { supabase, profile } = await requireStudent();
  const { course } = await searchParams;
  const courseId = String(course || '').trim();

  const access = getStudentCourseAccess(supabase, profile.user_id);
  const [courses, figures, first] = await Promise.all([
    getHistoryCourses(profile.user_id),
    getHistoryFigures(profile.user_id, courseId),
    access.then((a) => getHistoryChunk(profile.user_id, a, courseId, 0)),
  ]);

  return (
    <div className="lh">
      <PageHeader title="Learning History" />

      {courses.length > 1 ? (
        <nav className="lh-chips" aria-label="Courses">
          <Chip href={HISTORY_PATH} on={!courseId} label="All" />
          {courses.map((c) => (
            <Chip key={c.course_id} href={`${HISTORY_PATH}?course=${encodeURIComponent(c.course_id)}`} on={c.course_id === courseId} label={c.title} />
          ))}
        </nav>
      ) : null}

      {figures.sittings > 0 ? <Figures f={figures} /> : null}

      {first.total > 0 ? (
        <HistoryList key={renderStamp()} courseId={courseId} first={first} />
      ) : (
        <div className="card lh-empty">
          <p className="lh-empty-title">Your sittings will show here</p>
          <p className="lh-empty-text">Every paper, mock and quiz you sit is kept, with its score and its report.</p>
          <AppLink href="/student/quiz-builder" className="btn btn-primary btn-lg">
            Build a quiz
          </AppLink>
        </div>
      )}
    </div>
  );
}

function Chip({ href, on, label }: { href: string; on: boolean; label: string }) {
  if (on) {
    return (
      <span className="lh-chip on" aria-current="page">
        {label}
      </span>
    );
  }
  return (
    <AppLink href={href} className="lh-chip">
      {label}
    </AppLink>
  );
}

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;
}

function Figures({ f }: { f: HistoryFigures }) {
  const kinds = [
    f.papers ? plural(f.papers, 'practice paper', 'practice papers') : null,
    f.mocks ? plural(f.mocks, 'mock', 'mocks') : null,
    f.builder ? plural(f.builder, 'builder quiz', 'builder quizzes') : null,
    f.free ? plural(f.free, 'free practice', 'free practice') : null,
  ].filter(Boolean);
  return (
    <section className="lh-figures" aria-label="Your figures">
      <dl className="lh-figure-row">
        <div>
          <dt>Sittings</dt>
          <dd>{f.sittings.toLocaleString('en-GB')}</dd>
        </div>
        <div>
          <dt>Average</dt>
          <dd>{f.averagePct == null ? '—' : `${f.averagePct}%`}</dd>
        </div>
        <div>
          <dt>Best</dt>
          <dd>{f.bestPct == null ? '—' : `${f.bestPct}%`}</dd>
        </div>
      </dl>
      {kinds.length ? <p className="lh-kinds">{kinds.join(' · ')}</p> : null}
    </section>
  );
}
