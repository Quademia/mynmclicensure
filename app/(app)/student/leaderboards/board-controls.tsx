// app/(app)/student/leaderboards/board-controls.tsx — the time switch and
// the board's dropdown (05 G1b; Sam, 2026-10-20: B). The switch is three
// links (each with the pressed mark, AGENTS: a tap is never silent); the
// dropdown names each board in full and moves to its address, saying
// "Loading…" while the board is on its way. The page's own pieces, on
// tokens: the design system has no shared tabs or dropdown.

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LinkPending } from '@/components/shell/link-pending';
import { BOARD_PERIODS, BOARD_VIEWS, PERIOD_LABELS, boardHref, type BoardPeriod, type BoardView } from '@/lib/leaderboards/types';

function viewLabel(view: BoardView, programId: string | null, schoolName: string | null): string {
  const prog = programId ?? 'your programme';
  switch (view) {
    case 'school':
      return schoolName ? `My school · ${schoolName} · ${prog}` : 'My school';
    case 'programme':
      return `My programme · ${prog}`;
    case 'ghana':
      return 'All of Ghana';
    case 'schools':
      return `Schools · ${prog}`;
  }
}

export function BoardControls({
  period,
  view,
  programId,
  schoolName,
}: {
  period: BoardPeriod;
  view: BoardView;
  programId: string | null;
  schoolName: string | null;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<BoardView>(view);
  const [pending, startTransition] = useTransition();

  function pick(v: BoardView) {
    setChosen(v);
    startTransition(() => router.push(boardHref(period, v)));
  }

  return (
    <div className="lbp-controls">
      <nav className="lbp-periods" aria-label="Time">
        {BOARD_PERIODS.map((p) => (
          <Link
            key={p}
            href={boardHref(p, view)}
            className={`lbp-period${p === period ? ' is-on' : ''}`}
            aria-current={p === period ? 'page' : undefined}
          >
            {PERIOD_LABELS[p]}
            <LinkPending />
          </Link>
        ))}
      </nav>
      <form className="lbp-board" method="get" action="/student/leaderboards" onSubmit={(e) => e.preventDefault()}>
        <input type="hidden" name="period" value={period} />
        <select name="board" aria-label="Board" value={chosen} aria-busy={pending} onChange={(e) => pick(e.target.value as BoardView)}>
          {BOARD_VIEWS.map((v) => (
            <option key={v} value={v}>
              {viewLabel(v, programId, schoolName)}
            </option>
          ))}
        </select>
        {pending ? <span className="lbp-wait">Loading…</span> : null}
        <noscript>
          <button type="submit" className="btn btn-ghost">
            Show
          </button>
        </noscript>
      </form>
    </div>
  );
}
