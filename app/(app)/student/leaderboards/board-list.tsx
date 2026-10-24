// app/(app)/student/leaderboards/board-list.tsx — the board under the
// controls (05 G1b; Sam, 2026-10-20: B): the student's own place first, a
// small card, then the top 10 and, outside it, the one above, the student
// and the one below. One look for every board (Sam, 2026-10-20). A row
// opens nothing: there are no profiles to visit. The Schools board marks
// the student's school and lists the schools not on it yet with how many
// more players each needs. Before joining, the card is Join (JoinCard).
// Drawn on the server; nothing here is a control but Join and the links.

import { AppLink } from '@/components/shell/link-pending';
import { AnimalAvatar } from '@/components/leaderboards/animal-avatar';
import { CHALLENGE_PLAY_HREF } from '@/lib/challenge/types';
import {
  clockOf,
  longTimeOf,
  ordinal,
  type Board,
  type BoardLine,
  type BoardPeriod,
  type BoardView,
  type JoinChoices,
  type PeopleBoard,
  type SchoolLine,
  type SchoolsBoard,
} from '@/lib/leaderboards/types';
import { JoinCard } from './join-card';

const PROFILE_SCHOOL_HREF = '/student/profile?complete=1';

const NOTES: Record<BoardPeriod, string> = {
  today: 'Right answers first, then time. The board starts again at midnight.',
  week: 'Right answers first, then time. Your best 6 days count; the board starts again on Monday.',
  all: 'The average right answers per challenge, from 10 played; on a level average, more played first.',
};

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;
}

export function BoardBody({
  view,
  board,
  noSchool,
  joined,
  choices,
}: {
  view: BoardView;
  board: Board | null;
  noSchool: boolean;
  joined: boolean;
  choices: JoinChoices | null;
}) {
  if (view === 'school' && noSchool) {
    return (
      <div className="card lbp-card">
        <p className="lbp-card-title">Add your school to see its board</p>
        <p className="lbp-card-text">Your school&apos;s board shows the students of your school in your programme.</p>
        <AppLink href={PROFILE_SCHOOL_HREF} className="btn btn-primary">
          Add your school on Profile
        </AppLink>
      </div>
    );
  }
  if (!board) {
    return (
      <div className="card lbp-card">
        <p className="lbp-card-title">Could not load this board</p>
        <p className="lbp-card-text">Please check your connection and try again.</p>
      </div>
    );
  }
  const join = !joined && choices ? <JoinCard choices={choices} /> : null;
  return board.kind === 'schools' ? (
    <SchoolsBody board={board} join={join} noSchool={noSchool} />
  ) : (
    <PeopleBody board={board} join={join} />
  );
}

// ── a board of students ──

function PeopleBody({ board, join }: { board: PeopleBoard; join: React.ReactNode }) {
  const p = board.period;
  return (
    <>
      {join ?? <MyPlace board={board} />}
      {board.players === 0 ? (
        <p className="lbp-empty">No one is on this board yet.</p>
      ) : (
        <section className="lbp-list" aria-label="The board">
          <div className="lbp-list-head">
            <span>{plural(board.players, 'player', 'players')}</span>
            <span>{p === 'all' ? 'Average · played' : 'Right · time'}</span>
          </div>
          <ol className="lbp-rows">
            {board.top.map((l) => (
              <PersonRow key={`t${l.rank}-${l.name}`} line={l} period={p} />
            ))}
          </ol>
          {board.around.length ? (
            <>
              <p className="lbp-gap" aria-hidden="true">
                · · ·
              </p>
              <ol className="lbp-rows">
                {board.around.map((l) => (
                  <PersonRow key={`a${l.rank}-${l.name}`} line={l} period={p} />
                ))}
              </ol>
            </>
          ) : null}
        </section>
      )}
      <p className="lbp-note">{NOTES[p]}</p>
    </>
  );
}

function MyPlace({ board }: { board: PeopleBoard }) {
  const me = board.me;
  const p = board.period;
  if (me) {
    const detail =
      p === 'all'
        ? `${(me.average ?? 0).toFixed(1)} right a challenge · ${plural(me.played, 'challenge', 'challenges')}`
        : `${plural(me.right, 'right', 'right')} · ${longTimeOf(me.timeS)} · ${p === 'today' ? 'ends at midnight' : 'ends Sunday'}`;
    return (
      <div className="lbp-me">
        <p className="lbp-me-place">
          You&apos;re {ordinal(me.rank)} of {board.players.toLocaleString('en-GB')}
        </p>
        <p className="lbp-me-detail">{detail}</p>
      </div>
    );
  }
  if (p === 'all' && board.mePlayed < board.minPlayed) {
    const toGo = board.minPlayed - board.mePlayed;
    return (
      <div className="lbp-me">
        <p className="lbp-me-place">You&apos;ll appear after {board.minPlayed} challenges</p>
        <p className="lbp-me-detail">
          {board.mePlayed} played · {toGo} to go
        </p>
      </div>
    );
  }
  return (
    <div className="lbp-me lbp-me-off">
      <p className="lbp-me-place">{p === 'today' ? "Play today's challenge to get on this board" : 'Play a challenge to get on this board'}</p>
      <AppLink href={CHALLENGE_PLAY_HREF} className="lbp-me-go">
        Today&apos;s challenge ›
      </AppLink>
    </div>
  );
}

function PersonRow({ line, period }: { line: BoardLine; period: BoardPeriod }) {
  const score =
    period === 'all'
      ? `${(line.average ?? 0).toFixed(1)} · ${line.played}`
      : `${line.right} · ${clockOf(line.timeS)}`;
  return (
    <li className={`lbp-row${line.isMe ? ' is-me' : ''}`}>
      <span className="lbp-rank">{line.rank}</span>
      <AnimalAvatar animal={line.animal ?? 'Lion'} photo={line.photo} size={32} />
      <span className="lbp-name">
        {line.name}
        {line.isMe ? <span className="lbp-you"> (you)</span> : null}
      </span>
      <span className="lbp-score">{score}</span>
    </li>
  );
}

// ── the Schools board ──

function SchoolsBody({ board, join, noSchool }: { board: SchoolsBoard; join: React.ReactNode; noSchool: boolean }) {
  return (
    <>
      {join}
      <MySchool board={board} noSchool={noSchool} />
      {board.top.length === 0 && board.waiting.length === 0 ? (
        <p className="lbp-empty">No school is on this board yet.</p>
      ) : null}
      {board.top.length ? (
        <section className="lbp-list" aria-label="The schools">
          <div className="lbp-list-head">
            <span>{plural(board.schools, 'school', 'schools')}</span>
            <span>Average · players</span>
          </div>
          <ol className="lbp-rows">
            {board.top.map((l) => (
              <SchoolRow key={`t${l.rank}-${l.school}`} line={l} />
            ))}
          </ol>
          {board.around.length ? (
            <>
              <p className="lbp-gap" aria-hidden="true">
                · · ·
              </p>
              <ol className="lbp-rows">
                {board.around.map((l) => (
                  <SchoolRow key={`a${l.rank}-${l.school}`} line={l} />
                ))}
              </ol>
            </>
          ) : null}
        </section>
      ) : null}
      {board.waiting.length ? (
        <section className="lbp-list" aria-label="Not on the board yet">
          <h2 className="lbp-sub">Not on the board yet</h2>
          <ul className="lbp-rows">
            {board.waiting.map((w) => (
              <li key={w.school} className={`lbp-row lbp-row-school${w.isMine ? ' is-me' : ''}`}>
                <span className="lbp-name">
                  {w.school}
                  {w.isMine ? <span className="lbp-you"> (yours)</span> : null}
                </span>
                <span className="lbp-score">needs {w.needed} more</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="lbp-note">
        {NOTES[board.period]} A school joins with {board.minPlayers} players who joined the leaderboards; its score is the
        average of its best {board.minPlayers}.
      </p>
    </>
  );
}

function MySchool({ board, noSchool }: { board: SchoolsBoard; noSchool: boolean }) {
  const m = board.mine;
  if (noSchool || !m) {
    return (
      <div className="lbp-me lbp-me-off">
        <p className="lbp-me-place">Add your school to see it here</p>
        <AppLink href={PROFILE_SCHOOL_HREF} className="lbp-me-go">
          Add your school on Profile ›
        </AppLink>
      </div>
    );
  }
  if (m.suggested) {
    return (
      <div className="lbp-me lbp-me-off">
        <p className="lbp-me-place">{m.school} is not on the list yet</p>
        <p className="lbp-me-detail">It joins this board once Quademia adds it to the list.</p>
      </div>
    );
  }
  if (m.rank) {
    return (
      <div className="lbp-me">
        <p className="lbp-me-place">
          {m.school} is {ordinal(m.rank)} of {m.of.toLocaleString('en-GB')}
        </p>
        <p className="lbp-me-detail">{plural(m.players, 'player', 'players')}</p>
      </div>
    );
  }
  return (
    <div className="lbp-me lbp-me-off">
      <p className="lbp-me-place">
        {m.school} needs {m.needed ?? board.minPlayers} more {m.needed === 1 ? 'player' : 'players'}
      </p>
      <p className="lbp-me-detail">{plural(m.players, 'player', 'players')} so far</p>
    </div>
  );
}

function SchoolRow({ line }: { line: SchoolLine }) {
  return (
    <li className={`lbp-row lbp-row-school${line.isMine ? ' is-me' : ''}`}>
      <span className="lbp-rank">{line.rank}</span>
      <span className="lbp-name">
        {line.school}
        {line.isMine ? <span className="lbp-you"> (yours)</span> : null}
      </span>
      <span className="lbp-score">
        {line.average.toFixed(1)} · {line.players}
      </span>
    </li>
  );
}
