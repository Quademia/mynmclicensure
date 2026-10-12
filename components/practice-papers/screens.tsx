// components/practice-papers/screens.tsx
//
// The three Practice Papers screens (04.7; Sam, 2026-10-12; drawn at
// https://claude.ai/artifact/XyTdnfwmtswW6Xf6Wq69Cg, boards D, E, F):
// the courses, a course, a paper's own page. Server Components — what
// does something (Start, Resume, Practise again) is in paper-actions.tsx.
// No size, time or paper count is written here: each is read from the
// paper (derive.ts).

import { AppLink } from '@/components/shell/link-pending';
import { PageHeader } from '@/components/shell/page-header';
import { MODES } from '@/lib/attempts/modes';
import { reportHref, sessionHref } from '@/lib/attempts/links';
import type { AttemptMode, AttemptWithProgress } from '@/lib/attempts/types';
import {
  courseLine,
  formatDay,
  formatMinutes,
  paperMinutes,
  rowStatus,
  scoredPaper,
  segments,
  shortName,
  upNext,
  type CourseView,
  type PaperView,
} from '@/lib/practice-papers/derive';
import type { PracticePapers } from '@/lib/practice-papers/queries';
import { LaunchButton, PractiseAgain, type Way } from './paper-actions';
import '@/styles/practice-papers.css';

const LIST = '/student/practice-papers';
const PACKAGE_HREF = '/student/upgrade';

function modeName(mode: AttemptMode): string {
  return MODES[mode].name;
}

function EndedNote({ ended }: { ended: PracticePapers['ended'] }) {
  if (!ended) return null;
  return (
    <p className="pp-note">
      Your {ended.kind} ended on {formatDay(ended.on)}. Your scores are still here.
    </p>
  );
}

function ChoosePackage() {
  return (
    <AppLink href={PACKAGE_HREF} className="btn btn-accent btn-lg pp-package">
      Choose a package
    </AppLink>
  );
}

function Bar({ papers }: { papers: PaperView[] }) {
  return (
    <span className="pp-bar" aria-hidden="true">
      {segments(papers).map((s, i) => (
        <i key={i} className={`pp-seg pp-seg-${s}`} />
      ))}
    </span>
  );
}

// ── 1 · the courses ─────────────────────────────────────────────────────
export function CoursesScreen({ data }: { data: PracticePapers }) {
  const { courses, ended } = data;
  const anyLocked = courses.some((c) => c.papers.some((p) => !p.open));
  return (
    <div className="pp-page">
      <PageHeader title="Practice Papers" />
      <EndedNote ended={ended} />
      {courses.length ? (
        <ul className="card pp-list">
          {courses.map((c) => (
            <li key={c.course_id}>
              <AppLink href={`${LIST}/${encodeURIComponent(c.course_id)}`} className="pp-row pp-row-course">
                <span className="pp-row-main">
                  <span className="pp-name">{c.title}</span>
                  <span className="pp-line">{courseLine(c)}</span>
                  <Bar papers={c.papers} />
                </span>
                <span className="pp-chev" aria-hidden="true">›</span>
              </AppLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pp-line">Your courses will show here once you have a package.</p>
      )}
      {anyLocked ? <ChoosePackage /> : null}
    </div>
  );
}

// ── 2 · a course ────────────────────────────────────────────────────────
export function CourseScreen({ course, ended }: { course: CourseView; ended: PracticePapers['ended'] }) {
  const next = upNext(course.papers);
  const scored = next ? null : scoredPaper(course.papers);
  const anyLocked = course.papers.some((p) => !p.open);
  return (
    <div className="pp-page">
      <AppLink href={LIST} className="btn-link pp-back">‹ Practice Papers</AppLink>
      <PageHeader title={course.title} />
      {course.access === 'none' ? <EndedNote ended={ended} /> : null}

      {next ? <NextCard paper={next} access={course.access} /> : null}
      {scored ? (
        <div className="card pp-card">
          <span className="pp-eyebrow">Your score</span>
          <span className="pp-big">
            {shortName(scored.title)} · {Math.round(scored.firstSitting?.score_pct ?? 0)}%
          </span>
          <span className="pp-line">Your score and report are still here.</span>
          {scored.firstSitting ? (
            <AppLink href={reportHref(scored.firstSitting.attempt_id)} className="btn btn-ghost btn-lg">
              See your report
            </AppLink>
          ) : null}
        </div>
      ) : null}

      {course.papers.length ? (
        <ul className="card pp-list">
          {course.papers.map((p) => (
            <li key={p.quiz_id}>
              {p.open ? (
                <AppLink
                  href={`${LIST}/${encodeURIComponent(course.course_id)}/${encodeURIComponent(p.quiz_id)}`}
                  className="pp-row"
                >
                  <span className="pp-name">{p.title}</span>
                  <span className="pp-status">
                    {rowStatus(p)} <span className="pp-chev" aria-hidden="true">›</span>
                  </span>
                </AppLink>
              ) : (
                <div className="pp-row pp-row-locked">
                  <span className="pp-name">{p.title}</span>
                  <span className="pp-status">{rowStatus(p)}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="pp-line">No papers in this course yet.</p>
      )}
      {anyLocked ? <ChoosePackage /> : null}
    </div>
  );
}

function NextCard({ paper, access }: { paper: PaperView; access: CourseView['access'] }) {
  const going = paper.inProgress;
  const mode = going ? going.mode : paper.first_mode;
  const eyebrow = access === 'trial' && paper.in_trial ? 'Included in your trial' : 'Up next';
  const fact = going
    ? `${going.answered_count} of ${paper.n} answered`
    : `${paper.n} questions`;
  return (
    <div className="card pp-card">
      <span className="pp-eyebrow">{eyebrow}</span>
      <span className="pp-big">{shortName(paper.title)}</span>
      <span className="pp-line">{fact}</span>
      <LaunchButton quizId={paper.quiz_id} mode={mode} label={going ? 'Resume' : 'Start'} />
    </div>
  );
}

// ── 3 · a paper's own page ──────────────────────────────────────────────
function waysOf(paper: PaperView): Way[] {
  const order = [paper.first_mode, ...paper.allowed_modes.filter((m) => m !== paper.first_mode)];
  return order.map((mode) => {
    const going = paper.sittings.find((a) => a.status === 'in_progress' && a.mode === mode);
    const finished = paper.sittings.find((a) => a.status === 'completed' && a.mode === mode);
    const base = { mode, name: modeName(mode), blurb: MODES[mode].card };
    if (going) return { ...base, action: 'resume' as const };
    if (finished) return { ...base, action: 'retake' as const, originId: finished.attempt_id };
    return { ...base, action: 'start' as const };
  });
}

function Sitting({ a }: { a: AttemptWithProgress }) {
  const done = a.status === 'completed';
  return (
    <AppLink href={done ? reportHref(a.attempt_id) : sessionHref(a.attempt_id)} className="pp-row">
      <span className="pp-row-main">
        <span className="pp-name">
          {a.ts_iso ? formatDay(a.ts_iso) : ''} · {modeName(a.mode)}
        </span>
        <span className="pp-line">{done ? 'See your report' : 'In progress'}</span>
      </span>
      <span className="pp-status">
        {done && a.score_pct != null ? `${Math.round(a.score_pct)}%` : done ? '' : 'Resume'}{' '}
        <span className="pp-chev" aria-hidden="true">›</span>
      </span>
    </AppLink>
  );
}

export function PaperScreen({ course, paper, ended }: { course: CourseView; paper: PaperView; ended: PracticePapers['ended'] }) {
  const first = MODES[paper.first_mode];
  const timed = first.clock !== 'none';
  const facts = timed
    ? `${paper.n} questions · ${formatMinutes(paperMinutes(paper.n, paper.time_limit_sec))}`
    : `${paper.n} questions`;
  const going = paper.inProgress;
  const done = paper.firstSitting;
  const others = paper.allowed_modes.length > 1;

  let card: React.ReactNode;
  if (!paper.open) {
    card = (
      <div className="card pp-card">
        <span className="pp-eyebrow">Locked</span>
        <span className="pp-line">Opens with a package.</span>
        <ChoosePackage />
      </div>
    );
  } else if (done) {
    card = (
      <div className="card pp-card">
        <span className="pp-eyebrow">Your first sitting</span>
        <span className="pp-big">
          {done.score_pct != null ? `${Math.round(done.score_pct)}%` : 'Finished'} · {modeName(done.mode)}
        </span>
        <span className="pp-line">{done.ts_iso ? formatDay(done.ts_iso) : ''}</span>
        <div className="pp-actions">
          <AppLink href={reportHref(done.attempt_id)} className="btn btn-ghost btn-lg">See your report</AppLink>
          {paper.availability === 'ACTIVE' ? (
            <PractiseAgain quizId={paper.quiz_id} title={shortName(paper.title)} ways={waysOf(paper)} />
          ) : null}
        </div>
      </div>
    );
  } else if (paper.availability !== 'ACTIVE') {
    card = (
      <div className="card pp-card">
        <span className="pp-eyebrow">{modeName(paper.first_mode)}</span>
        <span className="pp-line">{rowStatus(paper)}</span>
      </div>
    );
  } else if (going) {
    card = (
      <div className="card pp-card">
        <span className="pp-eyebrow">{modeName(going.mode)} · in progress</span>
        <span className="pp-big">{going.answered_count} of {paper.n} answered</span>
        <progress className="pp-progress" max={paper.n} value={going.answered_count} aria-label="Answered so far" />
        <LaunchButton quizId={paper.quiz_id} mode={going.mode} label="Resume" />
      </div>
    );
  } else {
    card = (
      <div className="card pp-card">
        <span className="pp-eyebrow">Your first sitting</span>
        <span className="pp-big">{modeName(paper.first_mode)}</span>
        <span className="pp-line">{facts}</span>
        <span className="pp-line">{first.card}</span>
        <LaunchButton quizId={paper.quiz_id} mode={paper.first_mode} label="Start" />
      </div>
    );
  }

  return (
    <div className="pp-page">
      <AppLink href={`${LIST}/${encodeURIComponent(course.course_id)}`} className="btn-link pp-back">
        ‹ {course.title}
      </AppLink>
      <PageHeader title={paper.title} subtitle={course.title} />
      {course.access === 'none' ? <EndedNote ended={ended} /> : null}
      <div className="pp-paper-grid">
        {card}
        {paper.sittings.length ? (
          <div className="pp-sittings">
            <h2 className="pp-section">Your sittings</h2>
            <ul className="card pp-list">
              {paper.sittings.map((a) => (
                <li key={a.attempt_id}>
                  <Sitting a={a} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {paper.open && !done && others ? (
        <p className="pp-hint">More ways to practise this paper open after your first sitting.</p>
      ) : null}
    </div>
  );
}
