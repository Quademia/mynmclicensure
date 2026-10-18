// components/courses/screens.tsx
//
// My courses and the course page (04.8, 04.9; Sam, 2026-10-12; drawn at
// https://claude.ai/artifact/QmaN7QNr2gZ4D62LC1WuER). Server Components.
// The course page is a front door and a progress summary: its three rows
// lead into the stand-alone pages set to this course, and the papers'
// and mocks' own lists stay on their pages. Nothing here writes a count,
// a day or a paper's name: each is read from the student's data and the
// course (lib/courses/queries.ts).

import { AppLink } from '@/components/shell/link-pending';
import { PageHeader } from '@/components/shell/page-header';
import { CourseNews } from '@/components/announcements/course-news';
import { LaunchButton } from '@/components/practice-papers/paper-actions';
import { MessageUsButton } from '@/components/messages/message-us';
import { CourseChip, CourseHeading, CourseTabs } from './course-header';
import { courseLine, formatDay, heldUntil, resultsLine, resumable, scoredPaper, shortName } from '@/lib/practice-papers/derive';
import type { CoursePageData, MyCourses } from '@/lib/courses/queries';
import { reportHref } from '@/lib/attempts/links';
import { formatResultsAt } from '@/lib/quizzes/results-date';
import '@/styles/courses.css';

const PACKAGE_HREF = '/student/upgrade';

function num(n: number): string {
  return n.toLocaleString('en-US');
}

function EndedNote({ ended }: { ended: MyCourses['ended'] }) {
  if (!ended) return null;
  return (
    <p className="cp-note">
      Your {ended.kind} ended on {formatDay(ended.on)}. Your scores are still here.
    </p>
  );
}

function Bar({ met, bank }: { met: number; bank: number }) {
  const pct = bank > 0 ? Math.min(100, (met / bank) * 100) : 0;
  return (
    <span className="cp-bar" aria-hidden="true">
      <span className="cp-bar-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

// ── My courses ──────────────────────────────────────────────────────────
export function MyCoursesScreen({ data }: { data: MyCourses }) {
  const { courses, ended } = data;
  const anyLocked = courses.some((c) => c.course.access !== 'all');
  return (
    <div className="cp-page cp-wide">
      <PageHeader title="My courses" subtitle={courses.length ? `${courses.length} course${courses.length === 1 ? '' : 's'}` : undefined} />
      <EndedNote ended={ended} />
      {courses.length ? (
        <ul className="cp-grid">
          {courses.map((s) => (
            <li key={s.course.course_id}>
              <AppLink href={`/student/course/${encodeURIComponent(s.course.course_id)}`} className="card cp-card">
                <span className="cp-row">
                  <span className="cp-name">{s.course.title}</span>
                  <CourseChip access={s.course.access} days={s.days} ended={ended} />
                </span>
                <Bar met={s.met} bank={s.bank} />
                <span className="cp-line">
                  {num(s.met)} of {num(s.bank)} met{s.course.papers.length ? ` · ${s.papersDone} of ${s.course.papers.length} papers` : ''}
                </span>
                <span className="cp-next">
                  <span className="cp-next-text">{s.carryLine}</span>
                  <span className="cp-chev" aria-hidden="true">›</span>
                </span>
              </AppLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cp-line">Your courses will show here once you have a package.</p>
      )}
      {anyLocked ? (
        <AppLink href={PACKAGE_HREF} className="btn btn-accent btn-lg cp-package">
          Choose a package
        </AppLink>
      ) : null}
    </div>
  );
}

// ── the course page ─────────────────────────────────────────────────────
function Way({ href, name, line, locked }: { href: string; name: string; line: string; locked?: boolean }) {
  const body = (
    <>
      <span className="cp-row-main">
        <span className="cp-name">{name}</span>
        <span className="cp-line">{line}</span>
      </span>
      {locked ? null : <span className="cp-chev" aria-hidden="true">›</span>}
    </>
  );
  return locked ? <div className="cp-way cp-way-locked">{body}</div> : <AppLink href={href} className="cp-way">{body}</AppLink>;
}

export function CourseScreen({ data }: { data: CoursePageData }) {
  const { summary: s, tabs, ended, mocksLine, builderLine, news } = data;
  const c = s.course;
  const id = encodeURIComponent(c.course_id);
  const next = s.next;
  // 04.12: while a paper's results are held, a sitting going in another mode
  // than the first waits, the card carries the date, and a held score shows
  // its date and no report. 04.13: the card carries the review's line too
  // (none while held), and a Learning sitting going waits while it is closed.
  const going = next?.inProgress && resumable(next, next.inProgress) ? next.inProgress : null;
  const nextHeld = next ? resultsLine(next) : null;
  const scored = next ? null : scoredPaper(c.papers);
  const scoredHeld = heldUntil(scored?.firstSitting);
  const papersLine = courseLine(c);
  const papersLocked = papersLine === 'Opens with a package';

  return (
    <div className="cp-page cp-course">
      <CourseTabs
        backHref="/student/courses"
        backLabel="My courses"
        tabs={tabs}
        currentId={c.course_id}
        hrefFor={(courseId) => `/student/course/${encodeURIComponent(courseId)}`}
      />

      <CourseHeading title={c.title} access={c.access} days={s.days} expires={s.expires} ended={ended}>
        <MessageUsButton label="course" courseId={c.course_id} courseTitle={c.title} className="cp-message">
          Message us about this course
        </MessageUsButton>
      </CourseHeading>

      {c.access === 'none' ? <EndedNote ended={ended} /> : null}

      <div className="cp-grid2">
        <div className="cp-main">
          <div className="card cp-card cp-static">
            <span className="cp-line">
              {num(s.met)} of {num(s.bank)} questions met{c.papers.length ? ` · ${s.papersDone} of ${c.papers.length} papers done` : ''}
            </span>
            <Bar met={s.met} bank={s.bank} />
          </div>

          {next ? (
            <div className="card cp-card cp-static">
              <span className="cp-eyebrow">{c.access === 'trial' && next.in_trial ? 'Included in your trial' : 'Up next'}</span>
              <span className="cp-big">{next.title}</span>
              <span className="cp-line">{going ? `${going.answered_count} of ${next.n} answered` : `${num(next.n)} questions`}</span>
              {nextHeld ? <span className="cp-line">{nextHeld}</span> : null}
              {next.reviewNote ? <span className="cp-line">{next.reviewNote}</span> : null}
              <LaunchButton quizId={next.quiz_id} mode={going ? going.mode : next.first_mode} label={going ? 'Resume' : 'Start'} />
            </div>
          ) : null}
          {scored && scored.firstSitting && scoredHeld ? (
            <div className="card cp-card cp-static">
              <span className="cp-eyebrow">Your score</span>
              <span className="cp-big">{shortName(scored.title)}</span>
              <span className="cp-line">Results on {formatResultsAt(scoredHeld)}.</span>
            </div>
          ) : scored && scored.firstSitting ? (
            <div className="card cp-card cp-static">
              <span className="cp-eyebrow">Your score</span>
              <span className="cp-big">
                {shortName(scored.title)} · {Math.round(scored.firstSitting.score_pct ?? 0)}%
              </span>
              <AppLink href={reportHref(scored.firstSitting.attempt_id)} className="btn btn-ghost btn-lg">See your report</AppLink>
            </div>
          ) : null}

          <div className="card cp-ways">
            <Way href={`/student/practice-papers/${id}`} name="Practice papers" line={papersLine} locked={papersLocked} />
            <Way href={mocksLine.href} name="Mock exams" line={mocksLine.text} locked={!mocksLine.open} />
            <Way href={`/student/quiz-builder?course=${id}`} name="Quiz builder" line={builderLine.text} locked={!builderLine.open} />
          </div>

          {c.access !== 'all' ? (
            <AppLink href={PACKAGE_HREF} className="btn btn-accent btn-lg cp-package">Choose a package</AppLink>
          ) : null}
        </div>

        <aside className="cp-side">
          <h2 className="cp-section">Course news</h2>
          <div className="card cp-news">
            {news.length ? (
              <CourseNews
                news={news}
                dayOf={Object.fromEntries(news.map((a) => [a.announcement_id, a.created_at ? formatDay(a.created_at) : '']))}
              />
            ) : (
              <p className="cp-news-empty">No news for this course yet.</p>
            )}
          </div>
          {news.length ? <AppLink href="/student/announcements" className="btn-link">See all announcements</AppLink> : null}
        </aside>
      </div>
    </div>
  );
}
