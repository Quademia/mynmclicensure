// app/(app)/student/leaderboards/board-rows.tsx — a board's rows and Show
// more (05.14; Sam, 2026-10-24: "a Show more under the board that loads the
// next 20 players at a time … it should be able to show all the players").
// The page brings the top 10 and, outside it, the student's neighbours;
// each tap adds the next 20 under what shows, until every player does. The
// "· · ·" gap and the neighbours below it fold away as the list reaches
// them, so no line shows twice. A row opens nothing (05). The page keys
// this on the board, so a new board starts from its top 10 again.

'use client';

import { useState } from 'react';
import { Toast } from '@/lib/toast/toast';
import { moreOnBoard } from '@/lib/leaderboards/actions';
import { AnimalAvatar } from '@/components/leaderboards/animal-avatar';
import { clockOf, type BoardLine, type BoardPeriod, type BoardView, type SchoolLine } from '@/lib/leaderboards/types';

type Line = BoardLine | SchoolLine;

function useMore<T extends Line>(period: BoardPeriod, view: BoardView, top: T[], around: T[], total: number) {
  const [more, setMore] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = [...top, ...more];
  const last = shown.length ? shown[shown.length - 1].pos : 0;
  const tail = around.filter((l) => l.pos > last);
  const gap = tail.length > 0 && tail[0].pos > last + 1;
  // more to come while a gap is open or the list stops short of the last player
  const end = tail.length ? tail[tail.length - 1].pos : last;
  const hasMore = gap || end < total;

  async function load() {
    if (loading) return;
    setLoading(true);
    try {
      const r = await moreOnBoard(period, view, last + 1);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMore((m) => [...m, ...(r.lines as T[]).filter((l) => l.pos > last)]);
    } catch {
      setError('Could not load more. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return { shown, tail, gap, hasMore, loading, load, error, clearError: () => setError(null) };
}

function MoreButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button type="button" className="btn btn-ghost lbp-more" disabled={loading} onClick={onClick}>
      {loading ? 'Loading…' : 'Show more'}
    </button>
  );
}

export function PeopleRows({
  period,
  view,
  top,
  around,
  total,
}: {
  period: BoardPeriod;
  view: BoardView;
  top: BoardLine[];
  around: BoardLine[];
  total: number;
}) {
  const m = useMore(period, view, top, around, total);
  return (
    <>
      <Toast message={m.error} onDismiss={m.clearError} />
      <ol className="lbp-rows">
        {m.shown.map((l) => (
          <PersonRow key={l.pos} line={l} period={period} />
        ))}
      </ol>
      {m.tail.length ? (
        <>
          {m.gap ? (
            <p className="lbp-gap" aria-hidden="true">
              · · ·
            </p>
          ) : null}
          <ol className="lbp-rows">
            {m.tail.map((l) => (
              <PersonRow key={l.pos} line={l} period={period} />
            ))}
          </ol>
        </>
      ) : null}
      {m.hasMore ? (
        <MoreButton loading={m.loading} onClick={() => void m.load()} />
      ) : null}
    </>
  );
}

export function SchoolRows({
  period,
  top,
  around,
  total,
}: {
  period: BoardPeriod;
  top: SchoolLine[];
  around: SchoolLine[];
  total: number;
}) {
  const m = useMore(period, 'schools', top, around, total);
  return (
    <>
      <Toast message={m.error} onDismiss={m.clearError} />
      <ol className="lbp-rows">
        {m.shown.map((l) => (
          <SchoolRow key={l.pos} line={l} />
        ))}
      </ol>
      {m.tail.length ? (
        <>
          {m.gap ? (
            <p className="lbp-gap" aria-hidden="true">
              · · ·
            </p>
          ) : null}
          <ol className="lbp-rows">
            {m.tail.map((l) => (
              <SchoolRow key={l.pos} line={l} />
            ))}
          </ol>
        </>
      ) : null}
      {m.hasMore ? (
        <MoreButton loading={m.loading} onClick={() => void m.load()} />
      ) : null}
    </>
  );
}

function PersonRow({ line, period }: { line: BoardLine; period: BoardPeriod }) {
  const score = period === 'all' ? `${(line.average ?? 0).toFixed(1)} · ${line.played}` : `${line.right} · ${clockOf(line.timeS)}`;
  return (
    <li className={`lbp-row${line.isMe ? ' is-me' : ''}`}>
      <span className="lbp-rank">{line.rank}</span>
      <AnimalAvatar animal={line.animal ?? 'Lion'} photo={line.photo} size={32} lazy />
      <span className="lbp-name">
        {line.name}
        {line.isMe ? <span className="lbp-you"> (you)</span> : null}
      </span>
      <span className="lbp-score">{score}</span>
    </li>
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
