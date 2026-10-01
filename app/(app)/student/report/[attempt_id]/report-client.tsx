// The attempt report's client half (03 Q10): the parts a tap changes —
// the view tabs, "Show all", the question map's filter, and the fix
// list's "Show them" that sets it — and Retake. Everything arrives
// computed from the server (lib/attempts/report.ts), so no tap here
// waits on the network except the links that leave the page.
//
// The question map's numbers and the slowest questions' links do not
// prefetch: a 180-question sitting would otherwise send a request per
// number on screen (each one a sign-in check in the middleware) on a
// phone's data. The pressed mark shows while the review loads.

'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { retakeAttempt } from '@/lib/attempts/actions';
import { builderTopicHref, sessionHref, sessionQuestionHref } from '@/lib/attempts/links';
import {
  MIN_QUESTIONS_TO_JUDGE,
  ROWS_SHOWN_FIRST,
  formatSeconds,
  type Breakdown,
  type FixTopic,
  type Outcome,
  type ViewKey,
} from '@/lib/attempts/report';
import { AppLink, LinkPending } from '@/components/shell/link-pending';
import { Icon } from '@/components/shell/icons';

type MapFilter = 'all' | 'wrong' | 'unanswered';

const OUTCOME_WORD: Record<Outcome, string> = { correct: 'correct', wrong: 'wrong', unanswered: 'unanswered' };

function barClass(pct: number): string {
  return pct >= 75 ? 'is-ok' : pct >= 50 ? 'is-warn' : 'is-bad';
}

export function ReportBody({
  attemptId,
  courseId,
  breakdowns,
  fixTopics,
  anyTopicJudged,
  outcomes,
  slowest,
}: {
  attemptId: string;
  courseId: string;
  breakdowns: Breakdown[];
  fixTopics: FixTopic[];
  anyTopicJudged: boolean;
  /** each question's outcome, in the sitting's order */
  outcomes: Outcome[];
  slowest: { number: number; seconds: number }[];
}) {
  const [view, setView] = useState<ViewKey | null>(breakdowns[0]?.key ?? null);
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<MapFilter>('all');
  const mapRef = useRef<HTMLElement>(null);

  const current = breakdowns.find((b) => b.key === view) ?? null;
  const shownRows = current ? (expanded ? current.rows : current.rows.slice(0, ROWS_SHOWN_FIRST)) : [];

  const wrongCount = outcomes.filter((o) => o === 'wrong').length;
  const unansweredCount = outcomes.filter((o) => o === 'unanswered').length;
  const numbered = outcomes.map((o, i) => ({ n: i + 1, o }));
  const mapped = filter === 'all' ? numbered : numbered.filter((q) => q.o === filter);

  function pickView(key: ViewKey) {
    setView(key);
    setExpanded(false);
  }

  function showUnanswered() {
    setFilter('unanswered');
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      {/* Where you slipped */}
      <section className="card srp-card" aria-labelledby="srp-slipped-h">
        <h2 id="srp-slipped-h" className="srp-h">Where you slipped</h2>
        {current ? (
          <>
            <p className="srp-sub">Weakest first. Fewer than {MIN_QUESTIONS_TO_JUDGE} questions is too few to judge.</p>
            {breakdowns.length > 1 ? (
              <div className="srp-tabs" role="tablist" aria-label="Break down by">
                {breakdowns.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    role="tab"
                    aria-selected={b.key === current.key}
                    className={`srp-tab${b.key === current.key ? ' on' : ''}`}
                    onClick={() => pickView(b.key)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="srp-view-one">By {current.label.toLowerCase()}</p>
            )}
            <ul className="srp-rows">
              {shownRows.map((r) => (
                <li key={r.value} className={`srp-row${r.judged ? '' : ' is-thin'}${r.notSet ? ' is-notset' : ''}`}>
                  <div className="srp-row-top">
                    <span className="srp-row-name">{r.value}</span>
                    <span className="srp-row-n">
                      {r.correct} of {r.total} · {r.judged ? `${r.pct}%` : 'too few to judge'}
                    </span>
                  </div>
                  {r.judged ? (
                    <div className="srp-track" aria-hidden="true">
                      <span className={`srp-fill ${barClass(r.pct)}`} style={{ width: `${r.pct}%` }} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {current.rows.length > ROWS_SHOWN_FIRST ? (
              <button type="button" className="btn-link srp-more" onClick={() => setExpanded((e) => !e)}>
                {expanded ? 'Show fewer' : `Show all ${current.rows.length} ${current.plural}`}
              </button>
            ) : null}
          </>
        ) : (
          <p className="srp-sub">
            Every question in this sitting shares one topic and one difficulty, so there is nothing to compare.
          </p>
        )}
      </section>

      {/* What to fix next */}
      <section className="card srp-card" aria-labelledby="srp-fix-h">
        <h2 id="srp-fix-h" className="srp-h">What to fix next</h2>
        {fixTopics.length ? (
          <p className="srp-sub">Topics with at least {MIN_QUESTIONS_TO_JUDGE} questions, weakest first.</p>
        ) : (
          <p className="srp-sub">
            {anyTopicJudged
              ? `Every topic with ${MIN_QUESTIONS_TO_JUDGE} or more questions was answered right.`
              : `No topic had ${MIN_QUESTIONS_TO_JUDGE} or more questions in this sitting — too few to judge. A longer quiz gives a clearer picture.`}
          </p>
        )}
        {fixTopics.length || unansweredCount ? (
          <ol className="srp-fix">
            {fixTopics.map((f, i) => (
              <li key={f.topic}>
                <span className="srp-fix-n" aria-hidden="true">{i + 1}</span>
                <div className="srp-fix-body">
                  <p className="srp-fix-title">{f.topic}</p>
                  <p className="srp-fix-detail">
                    {f.correct} of {f.total} right
                  </p>
                </div>
                <AppLink className="btn btn-ghost btn-sm srp-fix-action" href={builderTopicHref(courseId, f.topic)}>
                  Practise this topic
                </AppLink>
              </li>
            ))}
            {unansweredCount ? (
              <li>
                <span className="srp-fix-n" aria-hidden="true">{fixTopics.length + 1}</span>
                <div className="srp-fix-body">
                  <p className="srp-fix-title">
                    {unansweredCount} question{unansweredCount !== 1 ? 's' : ''} left unanswered
                  </p>
                  <p className="srp-fix-detail">An unanswered question scores nothing.</p>
                </div>
                <button type="button" className="btn btn-ghost btn-sm srp-fix-action" onClick={showUnanswered}>
                  Show them
                </button>
              </li>
            ) : null}
          </ol>
        ) : null}
      </section>

      {/* Every question */}
      <section className="card srp-card srp-map-card" aria-labelledby="srp-map-h" ref={mapRef}>
        <h2 id="srp-map-h" className="srp-h">Every question</h2>
        <p className="srp-sub">Tap a number to open it in the review.</p>
        <div className="srp-filters" role="group" aria-label="Show">
          {(
            [
              ['all', `All (${outcomes.length})`],
              ['wrong', `Wrong (${wrongCount})`],
              ['unanswered', `Unanswered (${unansweredCount})`],
            ] as [MapFilter, string][]
          ).map(([key, text]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              className={`srp-filter${filter === key ? ' on' : ''}`}
              onClick={() => setFilter(key)}
            >
              {text}
            </button>
          ))}
        </div>
        {mapped.length ? (
          <div className="srp-map">
            {mapped.map((q) => (
              <Link
                key={q.n}
                prefetch={false}
                href={sessionQuestionHref(attemptId, q.n)}
                className={`srp-q ${q.o}`}
                aria-label={`Question ${q.n}: ${OUTCOME_WORD[q.o]}`}
              >
                {q.n}
                <LinkPending />
              </Link>
            ))}
          </div>
        ) : (
          <p className="srp-empty">{filter === 'wrong' ? 'No wrong answers.' : 'Every question was answered.'}</p>
        )}
        <p className="srp-legend">
          <span className="srp-key correct" aria-hidden="true" />Correct
          <span className="srp-key wrong" aria-hidden="true" />Wrong
          <span className="srp-key unanswered" aria-hidden="true" />Unanswered
        </p>
        {slowest.length ? (
          <p className="srp-slowest">
            <Icon name="timer" />
            Longest:{' '}
            {slowest.map((s, i) => (
              <span key={s.number}>
                {i ? ' · ' : ''}
                <Link prefetch={false} href={sessionQuestionHref(attemptId, s.number)}>
                  Q{s.number}
                  <LinkPending />
                </Link>{' '}
                ({formatSeconds(s.seconds)})
              </span>
            ))}
          </p>
        ) : null}
      </section>
    </>
  );
}

/** Retake, where the quiz allows it (retakeOpen on the server; retakeAttempt checks again). */
export function RetakeButton({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);

  async function retake() {
    if (pending) return;
    setPending(true);
    const result = await retakeAttempt(attemptId);
    if (!result.ok) {
      setPending(false);
      setError(`Could not start retake. Please try again. ${result.error || ''}`.trim());
      return;
    }
    router.push(sessionHref(result.attemptId));
  }

  return (
    <>
      <Toast message={error} tone="error" onDismiss={clearError} />
      <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => void retake()}>
        <Icon name="refresh" />
        {pending ? 'Starting…' : 'Retake'}
      </button>
    </>
  );
}
