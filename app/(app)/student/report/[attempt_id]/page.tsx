// app/(app)/student/report/[attempt_id]/page.tsx — the attempt report
// (03 Q10, Sam 2026-09-30).
//
// A finished sitting's debrief on its own page in the student area:
// the score and the counts, the time where the sitting recorded it,
// where the student slipped (by topic, difficulty, subject, question
// type — each offered only when the sitting has two or more values on
// it), what to practise next, and every question by its number. Reached
// from the results pop-up's main button and each finished Learning
// History card. MyNclex's report (student/bank/session/report there),
// cut to what these questions carry.
//
// The server does the sums (lib/attempts/report.ts) over one read of the
// sitting's rows — no question text, so a 180-question sitting is a few
// KB — and hands the client plain numbers; the client half only switches
// views and filters, with no request.
//
// The gates: the student's own sitting (anyone else's is not found), and
// finished — an unfinished sitting goes back to the quiz, an abandoned
// one to the history. A student whose access to the course has ended
// (03 F2, Sam 2026-10-03/04) keeps the summary; the answer-by-answer
// review and Retake are locked, with one way to a package. A free sitting
// stays open.

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireStudent } from '@/lib/access';
import { getCourseById } from '@/lib/catalogue/queries';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { getOwnAttempt, originSource } from '@/lib/attempts/queries';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { formatResultsAt, formatResultsDay, reviewClosedLine } from '@/lib/quizzes/results-date';
import { retakeOpen } from '@/lib/attempts/runner-load';
import { isFreeSitting } from '@/lib/attempts/free-sitting';
import { modeOf } from '@/lib/attempts/modes';
import { sessionHref } from '@/lib/attempts/links';
import { ENDED_REVIEW_LINE, PACKAGES_HREF } from '@/lib/attempts/types';
import {
  anyTopicJudged,
  fixTopics,
  formatSeconds,
  offeredBreakdowns,
  outcomeCounts,
  readReportRows,
  timeFacts,
  outcomeOf,
} from '@/lib/attempts/report';
import { PageHeader } from '@/components/shell/page-header';
import { AppLink } from '@/components/shell/link-pending';
import { Icon } from '@/components/shell/icons';
import { ReportBody, RetakeButton } from './report-client';
import '@/styles/student-report.css';

export const metadata: Metadata = {
  title: 'Quiz Report | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

const HISTORY_PATH = '/student/learning-history';

export default async function ReportPage({ params }: { params: Promise<{ attempt_id: string }> }) {
  const gate = await requireStudent();
  const { supabase, profile } = gate;
  const { attempt_id } = await params;
  const attemptId = String(attempt_id || '').trim();

  // Through student_attempts() (04.12): the student's own sitting, its score
  // empty while the paper's results are held.
  const attempt = attemptId ? await getOwnAttempt(profile.user_id, attemptId) : null;
  if (!attempt || attempt.user_id !== profile.user_id) notFound();
  if (attempt.status === 'in_progress') redirect(sessionHref(attempt.attempt_id));
  if (attempt.status !== 'completed') redirect(HISTORY_PATH);

  // 04.12: results held — the date, and nothing of the sitting's answers
  // (the database keeps its rows from this client until then).
  if (attempt.held && attempt.results_at) {
    const heldLabel = attempt.display_label || (attempt.quiz_id ? 'Practice Paper' : 'Custom Quiz');
    return (
      <div className="srp">
        <AppLink className="srp-back" href={HISTORY_PATH}>
          ← Learning History
        </AppLink>
        <PageHeader title={heldLabel} />
        <div className="card srp-notice">
          <p className="srp-notice-title">Results on {formatResultsDay(attempt.results_at)}</p>
          <p>
            {attempt.review === 'never' ? 'Your score and your report' : 'Your score, your report and the answers'} come out on{' '}
            {formatResultsAt(attempt.results_at)}.
          </p>
        </div>
      </div>
    );
  }

  const [access, course, rows, retakeAllowed, free] = await Promise.all([
    getStudentCourseAccess(supabase, profile.user_id),
    getCourseById(supabase, attempt.course_id),
    // the service role (04.13): while the review is closed the student's own
    // client cannot read the rows; the sitting is theirs (read above), and
    // only the sums below reach the page
    readReportRows(createServiceRoleClient(), attempt.attempt_id),
    retakeOpen(gate, attempt),
    isFreeSitting(attempt),
  ]);

  const label = attempt.display_label || (attempt.quiz_id ? 'Practice Paper' : 'Custom Quiz');
  const back = (
    <AppLink className="srp-back" href={HISTORY_PATH}>
      ← Learning History
    </AppLink>
  );

  // 03 F2: the access has ended — the summary stays, the review and Retake
  // lock (a free sitting apart, whose review and builder stay open; 04.4).
  const locked = !access[attempt.course_id] && !free;
  if (!rows || !rows.length) {
    return (
      <div className="srp">
        {back}
        <PageHeader title={label} />
        <div className="card srp-notice">
          <p className="srp-notice-title">No Questions</p>
          <p>The questions for this quiz could not be loaded. Please contact support.</p>
        </div>
      </div>
    );
  }

  // 04.13: the review closed (or not allowed) — the summary stays; the
  // review, the question map and its numbers do not reach the page
  const reviewLine = attempt.review_closed
    ? reviewClosedLine(
        attempt.review,
        attempt.review_closes_at,
        (await originSource(attempt, (id) => getOwnAttempt(profile.user_id, id))) === 'mock' ? 'mock' : 'paper',
      )
    : null;
  // Either shuts the review the same way; the closed review's own line
  // first (a package would not open it), then the access ended (03 F2).
  const closedLine = reviewLine ?? (locked ? ENDED_REVIEW_LINE : null);

  const M = modeOf(attempt.mode);
  const when = attempt.ts_iso
    ? new Date(attempt.ts_iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const subtitle = ['Report', course?.title || attempt.course_id, when, M.fullName].filter(Boolean).join(' · ');

  const counts = outcomeCounts(rows);
  const pct = attempt.score_pct !== null ? Math.round(Number(attempt.score_pct)) : Math.round((counts.correct / counts.total) * 100);
  const time = timeFacts(rows);
  const facts: { label: string; value: string }[] = [];
  if (attempt.time_taken_s !== null) facts.push({ label: 'Time', value: formatSeconds(attempt.time_taken_s) });
  if (time?.paceS) facts.push({ label: 'Pace', value: `about ${formatSeconds(time.paceS)} a question` });

  return (
    <div className="srp">
      {back}
      <PageHeader title={label} subtitle={subtitle} />

      <section className="card srp-score" aria-label="Your result">
        <div className="srp-score-top">
          <span className="srp-pct">{pct}%</span>
          <span className="srp-frac">
            {counts.correct} of {counts.total} correct
          </span>
        </div>
        <div className="srp-counts">
          <div className="srp-count correct">
            <span className="n">{counts.correct}</span>Correct
          </div>
          <div className="srp-count wrong">
            <span className="n">{counts.wrong}</span>Wrong
          </div>
          <div className="srp-count unanswered">
            <span className="n">{counts.unanswered}</span>Unanswered
          </div>
        </div>
        {facts.length ? (
          <dl className="srp-facts">
            {facts.map((f) => (
              <div key={f.label} className="srp-fact">
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <div className="srp-actions">
          {closedLine ? null : (
            <AppLink className="btn btn-primary" href={sessionHref(attempt.attempt_id)}>
              <Icon name="book-open" />
              Review answers
            </AppLink>
          )}
          {retakeAllowed && !locked ? <RetakeButton attemptId={attempt.attempt_id} /> : null}
          {/* 03 F2: the one way to open the review again */}
          {locked && !reviewLine ? (
            <AppLink className="btn btn-accent" href={PACKAGES_HREF}>
              Choose a package
            </AppLink>
          ) : null}
        </div>
      </section>

      <ReportBody
        attemptId={attempt.attempt_id}
        courseId={attempt.course_id}
        breakdowns={offeredBreakdowns(rows)}
        fixTopics={fixTopics(rows)}
        anyTopicJudged={anyTopicJudged(rows)}
        outcomes={closedLine ? [] : rows.map(outcomeOf)}
        slowest={closedLine ? [] : time?.slowest ?? []}
        reviewClosed={closedLine}
      />
    </div>
  );
}
