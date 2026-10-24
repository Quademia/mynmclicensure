// lib/leaderboards/queries.ts
//
// The leaderboards' reads (05 G1b), through the database's own functions
// (05.7) with the service role, for the student the gate names: the
// browser's roles reach none of it. Server-only (the service role) — a
// client component never imports this. Each fails open: a failed read
// leaves the challenge playable, without the leaderboards' parts.

import { createServiceRoleClient } from '@/lib/supabase/server';
import type { JoinChoices, LeaderboardCard, ShownAs, WeekRank } from './types';

type Row = Record<string, unknown>;

function str(v: unknown): string | null {
  return v === null || v === undefined || v === '' ? null : String(v);
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

/** This week's place for the start screen: on the student's school board,
 * or their programme's when they have no school. Null if the read fails. */
export async function getWeekRank(userId: string, hasSchool: boolean): Promise<WeekRank | null> {
  const { data, error } = await createServiceRoleClient().rpc('leaderboard_board', {
    p_user_id: userId,
    p_period: 'week',
    p_view: hasSchool ? 'school' : 'programme',
  });
  if (error || !data || typeof data !== 'object') {
    if (error) console.error('getWeekRank:', error);
    return null;
  }
  const b = data as Row;
  const me = b.me && typeof b.me === 'object' ? (b.me as Row) : null;
  const rank = me && me.rank !== null && me.rank !== undefined ? Number(me.rank) : null;
  const board = (hasSchool ? str(b.school_name) : str(b.program_id)) ?? 'your programme';
  return { rank: Number.isFinite(rank) ? rank : null, board };
}
