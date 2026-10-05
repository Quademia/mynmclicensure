// app/(app)/student/dashboard/top-card.tsx
//
// The top card — the student's next step, by status (Sam, 2026-10-04: A;
// 11-pages.md Dashboard): a trial's days left and Carry on; a package and
// its days left with Carry on; a package still to start; on the floor, the
// recap (full for 2 weeks after the end, then one line) and the free
// practice card. "Pick a practice paper" stands in for Carry on when
// nothing is unfinished (Sam, 2026-10-04). All words new, Sam's to change.

import { AppLink } from '@/components/shell/link-pending';
import { sessionHref } from '@/lib/attempts/links';
import type { DashCarryOn, DashReceipt, DashRecap, TopCard } from '@/lib/dashboard/student/types';
import { fmtDate, fmtNumber, pct, plural } from './format';

const PACKAGES_HREF = '/student/upgrade';
const PAPERS_HREF = '/student/fixed-quizzes';
const BUILDER_HREF = '/student/quiz-builder';

/** A package queued after this one: "Then RM Free Full Access until 17 Jun 2027". */
function Then({ next }: { next: DashReceipt | null }) {
  if (!next) return null;
  return (
    <p className="sd-meta">
      Then {next.product_name} until {fmtDate(next.expires_utc)}
    </p>
  );
}

function CarryOn({ carry, titleOf }: { carry: DashCarryOn | null; titleOf: (courseId: string) => string }) {
  if (!carry) {
    return (
      <div className="sd-carry">
        <div>
          <p className="sd-label">Ready when you are</p>
          <p className="sd-carry-title">Start a practice paper</p>
        </div>
        <AppLink href={PAPERS_HREF} className="btn btn-primary">
          Pick a practice paper
        </AppLink>
      </div>
    );
  }
  const title = carry.display_label || `Quiz builder · ${titleOf(carry.course_id)}`;
  return (
    <div className="sd-carry">
      <div className="sd-carry-text">
        <p className="sd-label">Carry on</p>
        <p className="sd-carry-title">{title}</p>
        <p className="sd-meta">
          {fmtNumber(carry.answered)} of {fmtNumber(carry.n)} answered
        </p>
      </div>
      <AppLink href={sessionHref(carry.attempt_id)} className="btn btn-primary">
        Continue
      </AppLink>
    </div>
  );
}

function Recap({ card, recap }: { card: Extract<TopCard, { kind: 'floor' }>; recap: DashRecap | null }) {
  const ended = card.ended;
  if (!ended) return null;
  const isTrial = ended.kind === 'TRIAL';
  const heading = isTrial ? `Your trial ended on ${fmtDate(ended.expires_utc)}` : `Your ${ended.product_name} ended on ${fmtDate(ended.expires_utc)}`;
  const action = isTrial ? 'Choose a package' : 'Renew your package';

  if (!card.recapFull) {
    return (
      <div className="card sd-card sd-recap-line">
        <p className="sd-recap-line-text">{heading}</p>
        <AppLink href={PACKAGES_HREF} className="sd-link">
          {action} →
        </AppLink>
      </div>
    );
  }

  const r = recap ?? { answered: 0, correct: 0, quizzes: 0, topics: [] };
  return (
    <div className="card sd-card sd-recap">
      <p className="sd-label">{heading}</p>
      <p className="sd-card-title">{isTrial ? 'Your 14 days in numbers' : 'Your package in numbers'}</p>
      <div className="sd-stats">
        <div className="sd-stat">
          <span className="sd-stat-num">{fmtNumber(r.answered)}</span>
          <span className="sd-stat-label">answered</span>
        </div>
        <div className="sd-stat">
          <span className="sd-stat-num">{pct(r.correct, r.answered)}%</span>
          <span className="sd-stat-label">correct</span>
        </div>
        <div className="sd-stat">
          <span className="sd-stat-num">{fmtNumber(r.quizzes)}</span>
          <span className="sd-stat-label">{r.quizzes === 1 ? 'quiz' : 'quizzes'}</span>
        </div>
      </div>
      {r.topics.length ? <p className="sd-meta">Work on: {r.topics.map((t) => t.topic).join(', ')}</p> : null}
      <AppLink href={PACKAGES_HREF} className="btn btn-primary sd-wide">
        {action}
      </AppLink>
      <p className="sd-meta sd-forever">Your account and free practice stay, forever.</p>
    </div>
  );
}

function FreePractice() {
  return (
    <div className="card sd-card sd-top">
      <p className="sd-label sd-label-accent">Free practice · forever</p>
      <p className="sd-meta">Build a quiz from the free questions of your courses.</p>
      <div className="sd-row">
        <AppLink href={BUILDER_HREF} className="btn btn-primary">
          Build a free quiz
        </AppLink>
        <AppLink href={PACKAGES_HREF} className="sd-link">
          Choose a package →
        </AppLink>
      </div>
    </div>
  );
}

export function TopCardView({
  card,
  carry,
  recap,
  titleOf,
}: {
  card: TopCard;
  carry: DashCarryOn | null;
  recap: DashRecap | null;
  titleOf: (courseId: string) => string;
}) {
  if (card.kind === 'trial') {
    const used = Math.min(100, Math.max(0, pct(card.totalDays - card.daysLeft, card.totalDays)));
    const lastDays = card.daysLeft <= 3;
    return (
      <div className="card sd-card sd-top">
        <div className="sd-row">
          <p className="sd-label sd-label-accent">Trial · limited access</p>
          <span className={lastDays ? 'sd-days sd-days-warn' : 'sd-days'}>{plural(card.daysLeft, 'day')} left</span>
        </div>
        <div className={lastDays ? 'sd-bar sd-bar-warn' : 'sd-bar'} aria-hidden="true">
          <i style={{ width: `${used}%` }} />
        </div>
        <Then next={card.next} />
        <CarryOn carry={carry} titleOf={titleOf} />
        <AppLink href={PACKAGES_HREF} className="sd-link">
          Choose a package →
        </AppLink>
      </div>
    );
  }

  if (card.kind === 'paid') {
    return (
      <div className="card sd-card sd-top">
        <div className="sd-row">
          <p className="sd-label sd-label-accent">{card.receipt.product_name}</p>
          <span className={card.daysLeft <= 7 ? 'sd-days sd-days-warn' : 'sd-days'}>{plural(card.daysLeft, 'day')} left</span>
        </div>
        <Then next={card.next} />
        <CarryOn carry={carry} titleOf={titleOf} />
        <AppLink href={PACKAGES_HREF} className="sd-link">
          Upgrade or extend →
        </AppLink>
      </div>
    );
  }

  if (card.kind === 'future') {
    return (
      <div className="card sd-card sd-top">
        <p className="sd-label sd-label-accent">{card.receipt.product_name}</p>
        <p className="sd-card-title">Starts {fmtDate(card.receipt.start_utc)}</p>
        <p className="sd-meta">Until then, practise on the free questions of your courses.</p>
        <AppLink href={BUILDER_HREF} className="btn btn-primary">
          Build a free quiz
        </AppLink>
      </div>
    );
  }

  return (
    <>
      <Recap card={card} recap={recap} />
      <FreePractice />
    </>
  );
}
