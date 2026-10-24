// lib/leaderboards/queries.ts
//
// The leaderboards' reads (05 G1b), through the database's own functions
// (05.7) with the service role, for the student the gate names: the
// browser's roles reach none of it. Server-only (the service role) — a
// client component never imports this. Each fails open: a failed read
// leaves the challenge playable, without the leaderboards' parts.

import { createServiceRoleClient } from '@/lib/supabase/server';
import type {
  Board,
  BoardLine,
  BoardPeriod,
  BoardPlace,
  BoardView,
  ChallengeRanks,
  JoinChoices,
  LeaderboardCard,
  SchoolLine,
  ShownAs,
  WeekRank,
} from './types';

type Row = Record<string, unknown>;

function str(v: unknown): string | null {
  return v === null || v === undefined || v === '' ? null : String(v);
}

// The day the username may change again, while it is still to come (the
// database refuses a change before it): "Saturday 31 October".
function renameFromOf(nextChangeUtc: string | null): string | null {
  if (!nextChangeUtc) return null;
  const next = new Date(nextChangeUtc);
  if (!Number.isFinite(next.getTime()) || next.getTime() <= Date.now()) return null;
  return next.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

function cardFrom(data: unknown): LeaderboardCard | null {
  if (!data || typeof data !== 'object') return null;
  const r = data as Row;
  return {
    joined: r.joined === true,
    shownAs: (r.shown_as === 'name' ? 'name' : 'username') as ShownAs,
    word: str(r.word),
    animal: str(r.animal),
    username: str(r.username),
    person: str(r.person),
    photo: str(r.photo),
    renameFrom: renameFromOf(str(r.next_change_utc)),
  };
}

export { cardFrom };

/** The student's card; null before they were first asked (or if the read fails). */
export async function getLeaderboardCard(userId: string): Promise<LeaderboardCard | null> {
  const { data, error } = await createServiceRoleClient().rpc('leaderboard_card', { p_user_id: userId });
  if (error) {
    console.error('getLeaderboardCard:', error);
    return null;
  }
  return cardFrom(data);
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/** The lists and a first card for How you'll appear; null if a read fails. */
export async function getJoinChoices(person: string | null, photo: string | null): Promise<JoinChoices | null> {
  const service = createServiceRoleClient();
  const [w, a] = await Promise.all([service.rpc('leaderboard_words'), service.rpc('leaderboard_animals')]);
  if (w.error || a.error) {
    console.error('getJoinChoices:', w.error ?? a.error);
    return null;
  }
  const words = (Array.isArray(w.data) ? w.data : []).map(String);
  const animals = (Array.isArray(a.data) ? a.data : []).map(String);
  if (!words.length || !animals.length) return null;
  return { words, animals, first: { word: pick(words), animal: pick(animals) }, person, photo };
}

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function nOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

/** A student's place on their own board: the school's, or the programme's
 * when they have no school. Null if the read fails. */
export async function getBoardPlace(userId: string, period: BoardPeriod, hasSchool: boolean): Promise<BoardPlace | null> {
  const { data, error } = await createServiceRoleClient().rpc('leaderboard_board', {
    p_user_id: userId,
    p_period: period,
    p_view: hasSchool ? 'school' : 'programme',
  });
  if (error || !data || typeof data !== 'object') {
    if (error) console.error('getBoardPlace:', error);
    return null;
  }
  const b = data as Row;
  const me = b.me && typeof b.me === 'object' ? (b.me as Row) : null;
  return {
    joined: b.joined === true,
    rank: me ? nOrNull(me.rank) : null,
    board: (hasSchool ? str(b.school_name) : str(b.program_id)) ?? 'your programme',
  };
}

/** This week's place for the start screen's box. */
export async function getWeekRank(userId: string, hasSchool: boolean): Promise<WeekRank | null> {
  const place = await getBoardPlace(userId, 'week', hasSchool);
  return place ? { rank: place.rank, board: place.board } : null;
}

/** The results pop-up's line: today's place and this week's, on the same board. */
export async function getChallengeRanks(userId: string, hasSchool: boolean): Promise<ChallengeRanks | null> {
  const [today, week] = await Promise.all([getBoardPlace(userId, 'today', hasSchool), getBoardPlace(userId, 'week', hasSchool)]);
  if (!today || !week) return null;
  return { joined: week.joined, today: today.rank, week: week.rank, board: week.board };
}

export function lineFrom(r: Row): BoardLine {
  return {
    pos: n(r.pos),
    rank: n(r.rank),
    name: str(r.name) ?? '',
    animal: str(r.animal),
    photo: str(r.photo),
    right: n(r.right),
    timeS: n(r.time_s),
    played: n(r.played),
    average: nOrNull(r.average),
    averageTimeS: nOrNull(r.average_time_s),
    isMe: r.is_me === true,
  };
}

export function schoolLineFrom(r: Row): SchoolLine {
  return {
    pos: n(r.pos),
    rank: n(r.rank),
    school: str(r.school) ?? '',
    players: n(r.players),
    average: n(r.average),
    averageTimeS: n(r.average_time_s),
    isMine: r.is_mine === true,
  };
}

export function rows(v: unknown): Row[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Row[]) : [];
}

/** One board as the database works it out (05.7); null if the read fails. */
export async function getBoard(userId: string, period: BoardPeriod, view: BoardView): Promise<Board | null> {
  const { data, error } = await createServiceRoleClient().rpc('leaderboard_board', {
    p_user_id: userId,
    p_period: period,
    p_view: view,
  });
  if (error || !data || typeof data !== 'object') {
    if (error) console.error('getBoard:', error);
    return null;
  }
  const b = data as Row;
  const head = {
    period,
    view,
    programId: str(b.program_id),
    schoolId: nOrNull(b.school_id),
    schoolName: str(b.school_name),
    schoolSuggested: b.school_suggested === true,
    joined: b.joined === true,
    minPlayed: n(b.min_played) || 10,
    minPlayers: n(b.min_players) || 10,
  };
  if (view === 'schools') {
    const m = b.mine && typeof b.mine === 'object' ? (b.mine as Row) : null;
    return {
      ...head,
      kind: 'schools',
      schools: n(b.schools),
      top: rows(b.top).map(schoolLineFrom),
      mine: m
        ? {
            school: str(m.school) ?? '',
            suggested: m.suggested === true,
            players: n(m.players),
            rank: nOrNull(m.rank),
            of: n(m.of),
            needed: nOrNull(m.needed),
          }
        : null,
      around: rows(b.around).map(schoolLineFrom),
      waiting: rows(b.waiting).map((w) => ({
        school: str(w.school) ?? '',
        players: n(w.players),
        needed: n(w.needed),
        isMine: w.is_mine === true,
      })),
    };
  }
  const me = b.me && typeof b.me === 'object' ? lineFrom(b.me as Row) : null;
  return {
    ...head,
    kind: 'people',
    players: n(b.players),
    top: rows(b.top).map(lineFrom),
    me,
    around: rows(b.around).map(lineFrom),
    mePlayed: n(b.me_played),
  };
}
