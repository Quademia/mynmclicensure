// app/(app)/student/leaderboards/page.tsx — Leaderboards (05 G1b; Sam,
// 2026-10-20: B, drawn; built 2026-10-24).
//
// One page under Progress, the same for every student: the time switch
// (Today · This week · All time), the board as a dropdown naming it in full
// (My school · St Mary's · RN, My programme · RN, All of Ghana, Schools ·
// RN), the student's own place first, then the top 10 and, outside it,
// their neighbours. It opens on This week · My school. The choice lives in
// the address (?period=…&board=…), so a reload and the way back keep it.
// Each board is worked out by the database as it is asked (05.7): the
// phone receives a dozen lines. Before joining, the card is Join to see
// where you rank (How you'll appear, in place); with no school, My school
// says to add it on Profile (Sam, 2026-10-24). Share on WhatsApp waits on
// the challenge's home page (04).

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getBoard, getJoinChoices, getLeaderboardCard } from '@/lib/leaderboards/queries';
import { BOARD_PERIODS, BOARD_VIEWS, personOf, type BoardPeriod, type BoardView } from '@/lib/leaderboards/types';
import { PageHeader } from '@/components/shell/page-header';
import { BoardControls } from './board-controls';
import { BoardBody } from './board-list';
import '@/styles/leaderboards.css';

export const metadata: Metadata = {
  title: 'Leaderboards | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

export default async function LeaderboardsPage({ searchParams }: { searchParams: Promise<{ period?: string; board?: string }> }) {
  const { profile } = await requireStudent();
  const sp = await searchParams;
  const period: BoardPeriod = (BOARD_PERIODS as readonly string[]).includes(sp.period ?? '') ? (sp.period as BoardPeriod) : 'week';
  const view: BoardView = (BOARD_VIEWS as readonly string[]).includes(sp.board ?? '') ? (sp.board as BoardView) : 'school';
  const noSchool = !profile.school_id;

  const [board, card] = await Promise.all([
    view === 'school' && noSchool ? null : getBoard(profile.user_id, period, view),
    getLeaderboardCard(profile.user_id),
  ]);
  const joined = card?.joined === true;
  const choices = joined ? null : await getJoinChoices(personOf(profile.forename, profile.surname), profile.avatar_url);

  return (
    <div className="lbp">
      <PageHeader title="Leaderboards" />
      <BoardControls
        period={period}
        view={view}
        programId={board?.programId ?? profile.program_id}
        schoolName={noSchool ? null : (board?.schoolName ?? null)}
      />
      <BoardBody view={view} board={board} noSchool={noSchool} joined={joined} choices={choices} />
    </div>
  );
}
