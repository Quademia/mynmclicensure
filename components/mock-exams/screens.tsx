// components/mock-exams/screens.tsx
//
// The Mock exams page, redesigned (04.15; Sam, 2026-10-13: layout A, drawn
// at https://claude.ai/artifact/5QQCWH9ECauT7k69cUUxC3, boards A and B):
// the list by time, and a mock's own page, built as a paper's (04.7).
// Server Components on Practice Papers' stylesheet and the design system's
// card and buttons; what does something is Practice Papers' own buttons
// with kind="mock". No size, time, date or count is written here: each is
// read from the mock.

import { AppLink } from '@/components/shell/link-pending';
import { PageHeader } from '@/components/shell/page-header';
import { MODES } from '@/lib/attempts/modes';
import { reportHref } from '@/lib/attempts/links';
import type { AttemptMode } from '@/lib/attempts/types';
import { formatDay, formatMinutes, paperMinutes, sittingsLine, startable } from '@/lib/practice-papers/derive';
import type { MockExams, MockView } from '@/lib/mock-exams/queries';
import { LaunchButton, PractiseAgain } from '@/components/practice-papers/paper-actions';
import { Sitting, waysOf } from '@/components/practice-papers/screens';
import '@/styles/practice-papers.css';

const LIST = '/student/mock-exams';
const PACKAGE_HREF = '/student/upgrade';
const WITH_PREMIUM = 'With Premium Prep';

function modeName(mode: AttemptMode): string {
  return MODES[mode].name;
}

export function mockHref(quizId: string): string {
  return `${LIST}/${encodeURIComponent(quizId)}`;
}

function untilLine(m: MockView): string {
  return m.unpublish_at ? `until ${formatDay(m.unpublish_at)}` : '';
}

/** "100 questions · 2 hours" — the time only when the first sitting has a clock. */
function factsOf(m: MockView): string {
  return MODES[m.first_mode].clock !== 'none'
    ? `${m.n} questions · ${formatMinutes(paperMinutes(m.n, m.time_limit_sec))}`
    : `${m.n} questions`;
}

function score(m: MockView): string | null {
  const done = m.firstSitting ?? m.sittings.find((a) => a.status === 'completed') ?? null;
  if (!done) return null;
  return done.score_pct != null ? `${Math.round(done.score_pct)}%` : 'Finished';
}

function ChoosePackage() {
  return (
    <AppLink href={PACKAGE_HREF} className="btn btn-accent btn-lg pp-package">
      Choose a package
    </AppLink>
  );
}

function EndedNote({ ended }: { ended: MockExams['ended'] }) {
  if (!ended) return null;
  return (
    <p className="pp-note">
      Your {ended.kind} ended on {formatDay(ended.on)}. Your scores are still here.
    </p>
  );
}

// ── a row: one target, the mock's own page; a line the student cannot open is grey ──
function Row({ m, section }: { m: MockView; section: 'open' | 'coming' | 'past' }) {
  const course = section === 'open' && untilLine(m) ? `${m.course_title} · ${untilLine(m)}` : m.course_title;
  let status: string;
  if (section === 'coming') status = m.publish_at ? `Opens ${formatDay(m.publish_at)}` : 'Not yet open';
  else if (section === 'open' && !m.open) status = WITH_PREMIUM;
  else if (m.inProgress) status = 'In progress';
  else status = score(m) ?? 'Not started';

  const linked = section === 'past' || (section === 'open' && m.open);
  const inner = (
    <>
      <span className="pp-row-main">
        <span className="pp-name">{m.title}</span>
        <span className="pp-line">{course}</span>
      </span>
      <span className="pp-status">
        {status}
        {linked ? <span className="pp-chev" aria-hidden="true">›</span> : null}
      </span>
    </>
  );
  return (
    <li>
      {linked ? (
        <AppLink href={mockHref(m.quiz_id)} className="pp-row">{inner}</AppLink>
      ) : (
        <div className="pp-row pp-row-locked">{inner}</div>
      )}
    </li>
  );
}

function Section({ title, mocks, section }: { title: string; mocks: MockView[]; section: 'open' | 'coming' | 'past' }) {
  if (!mocks.length) return null;
  return (
    <section>
      <h2 className="pp-section">{title}</h2>
      <ul className="card pp-list">
        {mocks.map((m) => (
          <Row key={m.quiz_id} m={m} section={section} />
        ))}
      </ul>
    </section>
  );
}

// ── the list, by time ───────────────────────────────────────────────────
export function MockListScreen({ data }: { data: MockExams }) {
  const { open, coming, past, next, locked, ended } = data;
  const mine = open.filter(startable);
  const anyLocked = open.some((m) => !m.open) || (locked && coming.length > 0);

  let card: React.ReactNode = null;
  if (next) {
    const going = next.inProgress;
    const until = next.unpublish_at ? `Open until ${formatDay(next.unpublish_at)}` : 'Open now';
    card = (
      <div className="card pp-card">
        <span className="pp-eyebrow">{going ? `In progress · ${until}` : until}</span>
        <span className="pp-big">{next.title}</span>
        <span className="pp-line">
          {next.course_title} · {going ? `${going.answered_count} of ${next.n} answered` : factsOf(next)}
        </span>
        {going ? <progress className="pp-progress" max={next.n} value={going.answered_count} aria-label="Answered so far" /> : null}
        <LaunchButton kind="mock" quizId={next.quiz_id} mode={going ? going.mode : next.first_mode} label={going ? 'Resume' : 'Start'} />
      </div>
    );
  } else if (mine.length) {
    card = (
      <div className="card pp-card">
        <span className="pp-big">You have sat every open mock</span>
        <span className="pp-line">Your scores are below. Open a mock to see your report or practise it again.</span>
      </div>
    );
  } else if (locked && !open.length && !coming.length) {
    card = (
      <div className="card pp-card">
        <span className="pp-big">Mock exams come with Premium Prep</span>
        <span className="pp-line">Timed papers like the real exam, opened around each exam period.</span>
        <ChoosePackage />
      </div>
    );
  } else if (!open.length) {
    card = (
      <div className="card pp-card">
        <span className="pp-big">No mock is open right now</span>
        <span className="pp-line">Mocks open around each exam period. The next one shows here as soon as it is set.</span>
      </div>
    );
  }

  return (
    <div className="pp-page">
      <PageHeader title="Mock Exams" />
      <EndedNote ended={ended} />
      {locked && (open.length || coming.length) ? <p className="pp-line">Mock exams come with Premium Prep.</p> : null}
      {card}
      <Section title="Open now" mocks={open} section="open" />
      <Section title="Coming up" mocks={coming} section="coming" />
      <Section title="Past mocks" mocks={past} section="past" />
      {anyLocked ? <ChoosePackage /> : null}
    </div>
  );
}

// ── a mock's own page ───────────────────────────────────────────────────
export function MockScreen({ mock, ended }: { mock: MockView; ended: MockExams['ended'] }) {
  const first = MODES[mock.first_mode];
  const going = mock.inProgress;
  const done = mock.firstSitting;
  const active = mock.availability === 'ACTIVE';
  const limitLine = sittingsLine(mock, 'mock');
  const limit = limitLine ? <span className="pp-line">{limitLine}</span> : null;
  const limited = mock.sittings_allowed != null;
  const until = mock.unpublish_at ? (active ? ` · open until ${formatDay(mock.unpublish_at)}` : '') : '';

  // After the first sitting: Practise again while the mock is open and a
  // sitting is left; with a limit, one at a time, so a sitting going is resumed.
  let again: React.ReactNode = null;
  if (mock.open && active) {
    if (limited && going) {
      again = <LaunchButton kind="mock" quizId={mock.quiz_id} mode={going.mode} label={`Resume ${modeName(going.mode)}`} />;
    } else if (mock.sittingsLeft !== 0) {
      again = <PractiseAgain kind="mock" quizId={mock.quiz_id} title={mock.title} ways={waysOf(mock)} />;
    }
  }

  let card: React.ReactNode;
  if (done) {
    card = (
      <div className="card pp-card">
        <span className="pp-eyebrow">Your first sitting</span>
        <span className="pp-big">
          {done.score_pct != null ? `${Math.round(done.score_pct)}%` : 'Finished'} · {modeName(done.mode)}
        </span>
        <span className="pp-line">{done.ts_iso ? formatDay(done.ts_iso) : ''}</span>
        {!active ? <span className="pp-line">This mock has closed.</span> : mock.open ? limit : null}
        <div className="pp-actions">
          <AppLink href={reportHref(done.attempt_id)} className="btn btn-ghost btn-lg">See your report</AppLink>
          {again}
        </div>
      </div>
    );
  } else if (!mock.open && !going) {
    card = (
      <div className="card pp-card">
        <span className="pp-eyebrow">{WITH_PREMIUM}</span>
        <span className="pp-line">Mock exams come with Premium Prep.</span>
        <ChoosePackage />
      </div>
    );
  } else if (going) {
    card = (
      <div className="card pp-card">
        <span className="pp-eyebrow">{modeName(going.mode)} · in progress</span>
        <span className="pp-big">{going.answered_count} of {mock.n} answered</span>
        <progress className="pp-progress" max={mock.n} value={going.answered_count} aria-label="Answered so far" />
        {limit}
        <LaunchButton kind="mock" quizId={mock.quiz_id} mode={going.mode} label="Resume" />
      </div>
    );
  } else if (!active) {
    card = (
      <div className="card pp-card">
        <span className="pp-eyebrow">{modeName(mock.first_mode)}</span>
        <span className="pp-line">
          {mock.availability === 'UPCOMING' && mock.publish_at ? `Opens ${formatDay(mock.publish_at)}` : 'This mock has closed.'}
        </span>
      </div>
    );
  } else {
    card = (
      <div className="card pp-card">
        <span className="pp-eyebrow">Your first sitting</span>
        <span className="pp-big">{modeName(mock.first_mode)}</span>
        <span className="pp-line">{factsOf(mock)}{until}</span>
        <span className="pp-line">{first.card}</span>
        {limit}
        <LaunchButton kind="mock" quizId={mock.quiz_id} mode={mock.first_mode} label="Start" />
      </div>
    );
  }

  return (
    <div className="pp-page">
      <AppLink href={LIST} className="btn-link pp-back">
        ‹ Mock exams
      </AppLink>
      <PageHeader title={mock.title} subtitle={mock.course_title} />
      {!mock.open ? <EndedNote ended={ended} /> : null}
      <div className="pp-paper-grid">
        {card}
        {mock.sittings.length ? (
          <div className="pp-sittings">
            <h2 className="pp-section">Your sittings</h2>
            <ul className="card pp-list">
              {mock.sittings.map((a) => (
                <li key={a.attempt_id}>
                  <Sitting a={a} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {mock.open && active && !done && mock.allowed_modes.length > 1 ? (
        <p className="pp-hint">More ways to practise this mock open after your first sitting.</p>
      ) : null}
    </div>
  );
}
