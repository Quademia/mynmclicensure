// components/practice-papers/screens.tsx
//
// The three Practice Papers screens (04.7; Sam, 2026-10-12; drawn at
// https://claude.ai/artifact/XyTdnfwmtswW6Xf6Wq69Cg, boards D, E, F):
// the courses, a course, a paper's own page. Server Components — what
// does something (Start, Resume, Practise again) is in paper-actions.tsx.
// No size, time or paper count is written here: each is read from the
// paper (derive.ts). While a paper's results are held (04.12), its date
// stands where a score would, and no report is linked. While its review is
// closed (04.13), the score and the report stay, the card says so, and
// Learning is left out of the ways.

import { AppLink } from '@/components/shell/link-pending';
import { PageHeader } from '@/components/shell/page-header';
import { MODES } from '@/lib/attempts/modes';
import { reportHref, sessionHref } from '@/lib/attempts/links';
import type { AttemptMode, AttemptWithProgress } from '@/lib/attempts/types';
import { formatResultsAt } from '@/lib/quizzes/results-date';
import {
  courseLine,
  formatDay,
  formatMinutes,
  heldUntil,
  learningShut,
  otherModes,
  otherWaysLine,
  paperMinutes,
  resultsLine,
  resumable,
  rowStatus,
  scoredPaper,
  scoreWord,
  segments,
  shortName,
  sittingsLine,
  upNext,
  type CourseView,
  type PaperView,
} from '@/lib/practice-papers/derive';
import type { PracticePapers } from '@/lib/practice-papers/queries';
import { CourseChip, CourseHeading, CourseTabs } from '@/components/courses/course-header';
import { AbandonSitting, LaunchButton, PractiseAgain, type Way } from './paper-actions';
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
    <div className="pp-page pp-page-wide">
      <PageHeader title="Practice Papers" />
      <EndedNote ended={ended} />
      {courses.length ? (
        <ul className="cp-grid">
          {courses.map((c) => (
            <li key={c.course_id}>
              <AppLink href={`${LIST}/${encodeURIComponent(c.course_id)}`} className="card cp-card">
                <span className="cp-row">
                  <span className="cp-name">{c.title}</span>
                  <CourseChip access={c.access} days={c.days} ended={ended} />
                </span>
                <Bar papers={c.papers} />
                {c.papers.length ? (
                  <span className="cp-line">
                    {c.papers.filter((p) => p.state === 'done').length} of {c.papers.length} papers done
                  </span>
                ) : null}
                <span className="cp-next">
                  <span className="cp-next-text">{courseLine(c)}</span>
                  <span className="cp-chev" aria-hidden="true">›</span>
                </span>
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
export function CourseScreen({ course, tabs, ended }: { course: CourseView; tabs: { course_id: string; title: string }[]; ended: PracticePapers['ended'] }) {
  const next = upNext(course.papers);
  const scored = next ? null : scoredPaper(course.papers);
  // 04.12: a held first sitting shows its date, and no report.
  const scoredHeld = heldUntil(scored?.firstSitting);
  const anyLocked = course.papers.some((p) => !p.open);
  return (
    <div className="pp-page">
      <CourseTabs
        backHref={LIST}
        backLabel="Practice papers"
        tabs={tabs}
        currentId={course.course_id}
        hrefFor={(courseId) => `${LIST}/${encodeURIComponent(courseId)}`}
      />
      <CourseHeading title={course.title} access={course.access} days={course.days} expires={course.expires} ended={ended} />
      {course.access === 'none' ? <EndedNote ended={ended} /> : null}

      {next ? <NextCard paper={next} access={course.access} /> : null}
      {scored && scoredHeld ? (
        <div className="card pp-card">
          <span className="pp-eyebrow">Your score</span>
          <span className="pp-big">{shortName(scored.title)}</span>
          <span className="pp-line">Results on {formatResultsAt(scoredHeld)}.</span>
        </div>
      ) : scored ? (
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
  const going = paper.inProgress && resumable(paper, paper.inProgress) ? paper.inProgress : null;
  const mode = going ? going.mode : paper.first_mode;
  const eyebrow = access === 'trial' && paper.in_trial ? 'Included in your trial' : 'Up next';
  const fact = going
    ? `${going.answered_count} of ${paper.n} answered`
    : `${paper.n} questions`;
  const held = resultsLine(paper);
  return (
    <div className="card pp-card">
      <span className="pp-eyebrow">{eyebrow}</span>
      <span className="pp-big">{shortName(paper.title)}</span>
      <span className="pp-line">{fact}</span>
      {held ? <span className="pp-line">{held}</span> : null}
      {paper.reviewNote ? <span className="pp-line">{paper.reviewNote}</span> : null}
      <LaunchButton quizId={paper.quiz_id} mode={mode} label={going ? 'Resume' : 'Start'} />
    </div>
  );
}

// ── 3 · a paper's own page ──────────────────────────────────────────────
export function waysOf(paper: PaperView): Way[] {
  // 04.12: while the results are held, only the first sitting's mode.
  // 04.13: while the review is closed, no Learning (the other modes stay).
  const order = paper.held ? [paper.first_mode] : [paper.first_mode, ...otherModes(paper)];
  return order.filter((mode) => !learningShut(paper, mode)).map((mode) => {
    const going = paper.sittings.find((a) => a.status === 'in_progress' && a.mode === mode);
    const finished = paper.sittings.find((a) => a.status === 'completed' && a.mode === mode);
    const base = { mode, name: modeName(mode), blurb: MODES[mode].card };
    if (going) return { ...base, action: 'resume' as const };
    if (finished) return { ...base, action: 'retake' as const, originId: finished.attempt_id };
    return { ...base, action: 'start' as const };
  });
}

export function Sitting({ a }: { a: AttemptWithProgress }) {
  const done = a.status === 'completed';
  const name = (
    <span className="pp-name">
      {a.ts_iso ? formatDay(a.ts_iso) : ''} · {modeName(a.mode)}
    </span>
  );
  // 04.12: a finished sitting whose results are held is no link — its
  // report would only say "not yet", a wasted trip on slow data.
  if (done && heldUntil(a)) {
    return (
      <div className="pp-row">
        <span className="pp-row-main">
          {name}
          <span className="pp-line">Submitted</span>
        </span>
        <span className="pp-status">{scoreWord(a)}</span>
      </div>
    );
  }
  return (
    <AppLink href={done ? reportHref(a.attempt_id) : sessionHref(a.attempt_id)} className="pp-row">
      <span className="pp-row-main">
        {name}
        <span className="pp-line">{done ? 'See your report' : 'In progress'}</span>
      </span>
      <span className="pp-status">
        {done ? (scoreWord(a) ?? '') : 'Resume'}{' '}
        <span className="pp-chev" aria-hidden="true">›</span>
      </span>
    </AppLink>
  );
}

/** A first sitting's two lines on a card: its score and mode, then its day —
 *  or, while its results are held (04.12), their date where the score was,
 *  then its day and mode. */
export function FirstSittingLines({ a }: { a: AttemptWithProgress }) {
  const held = heldUntil(a);
  const day = a.ts_iso ? formatDay(a.ts_iso) : '';
  if (held) {
    return (
      <>
        <span className="pp-big">Results on {formatResultsAt(held)}</span>
        <span className="pp-line">{day ? `${day} · ` : ''}{modeName(a.mode)}</span>
      </>
    );
  }
  return (
    <>
      <span className="pp-big">
        {a.score_pct != null ? `${Math.round(a.score_pct)}%` : 'Finished'} · {modeName(a.mode)}
      </span>
      <span className="pp-line">{day}</span>
    </>
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
  // 04.13: while the review is closed Learning is no other way; with it the
  // only one, the paper has none.
  const others = otherModes(paper).length > 0;
  // 04.10: the sittings left, when the admin set a limit.
  const limitLine = sittingsLine(paper);
  const limit = limitLine ? <span className="pp-line">{limitLine}</span> : null;
  const limited = paper.sittings_allowed != null;
  // 04.12: while the results are held, their date among the card's lines;
  // only the first mode is sat, so a sitting going in another waits for
  // the date (it can still be abandoned).
  const heldLine = resultsLine(paper);
  const results = heldLine ? <span className="pp-line">{heldLine}</span> : null;
  // 04.13: the review's line beside it — none while the results are held.
  const review = paper.reviewNote ? <span className="pp-line">{paper.reviewNote}</span> : null;
  const waysLine = others && paper.sittingsLeft !== 0 ? otherWaysLine(paper) : null;
  const canResume = going ? resumable(paper, going) : false;
  const ways = waysOf(paper);

  // After the first sitting: Practise again, unless no sitting is left;
  // with a limit, one sitting at a time, so a sitting going is resumed.
  let again: React.ReactNode = null;
  if (paper.availability === 'ACTIVE') {
    if (limited && going) {
      if (canResume) again = <LaunchButton quizId={paper.quiz_id} mode={going.mode} label={`Resume ${modeName(going.mode)}`} />;
    } else if (paper.sittingsLeft !== 0 && ways.length) {
      again = <PractiseAgain quizId={paper.quiz_id} title={shortName(paper.title)} ways={ways} note={waysLine} />;
    }
  }

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
    const report = heldUntil(done) ? null : (
      <AppLink href={reportHref(done.attempt_id)} className="btn btn-ghost btn-lg">See your report</AppLink>
    );
    card = (
      <div className="card pp-card">
        <span className="pp-eyebrow">Your first sitting</span>
        <FirstSittingLines a={done} />
        {limit}
        {review}
        {report || again ? (
          <div className="pp-actions">
            {report}
            {again}
          </div>
        ) : null}
        {going && paper.availability === 'ACTIVE' ? (
          <AbandonSitting
            attemptId={going.attempt_id}
            label={`Abandon the ${modeName(going.mode)} sitting in progress`}
            sittingsAllowed={paper.sittings_allowed}
          />
        ) : null}
      </div>
    );
  } else if (paper.availability !== 'ACTIVE') {
    card = (
      <div className="card pp-card">
        <span className="pp-eyebrow">{modeName(paper.first_mode)}</span>
        <span className="pp-line">{rowStatus(paper)}</span>
        {results}
        {review}
      </div>
    );
  } else if (going) {
    card = (
      <div className="card pp-card">
        <span className="pp-eyebrow">{modeName(going.mode)} · in progress</span>
        <span className="pp-big">{going.answered_count} of {paper.n} answered</span>
        <progress className="pp-progress" max={paper.n} value={going.answered_count} aria-label="Answered so far" />
        {limit}
        {results}
        {review}
        {canResume ? <LaunchButton quizId={paper.quiz_id} mode={going.mode} label="Resume" /> : null}
        <AbandonSitting attemptId={going.attempt_id} sittingsAllowed={paper.sittings_allowed} />
      </div>
    );
  } else {
    card = (
      <div className="card pp-card">
        <span className="pp-eyebrow">Your first sitting</span>
        <span className="pp-big">{modeName(paper.first_mode)}</span>
        <span className="pp-line">{facts}</span>
        <span className="pp-line">{first.card}</span>
        {limit}
        {results}
        {review}
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
      {paper.open && paper.availability === 'ACTIVE' && done && waysLine ? (
        <p className="pp-hint">{waysLine}</p>
      ) : paper.open && !done && others ? (
        <p className="pp-hint">More ways to practise this paper open after your first sitting.</p>
      ) : null}
    </div>
  );
}
