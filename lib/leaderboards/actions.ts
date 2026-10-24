// lib/leaderboards/actions.ts
//
// The leaderboards' writes (05 G1b) as Server Actions behind the student
// gate, each one call to the database's own function (05.7) with the
// service role and the gate's student. The database checks the word and
// the animal against its lists and makes the username unique; its
// messages are written for the student and pass through.

'use server';

import { requireStudent } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { cardFrom, lineFrom, rows, schoolLineFrom } from './queries';
import {
  BOARD_PERIODS,
  BOARD_VIEWS,
  SHOW_MORE_COUNT,
  type BoardPeriod,
  type BoardView,
  type CardResult,
  type JoinResult,
  type MoreResult,
  type NotNowResult,
  type ShownAs,
} from './types';

function rpcError(error: { message?: string } | null, fallback: string): string {
  const msg = String(error?.message || '').trim();
  return msg && !/^[a-z_]+:/.test(msg) && !/violates|duplicate key/i.test(msg) ? msg : fallback;
}

// "Not now, just play": asked once — the card is made, not joined.
export async function notNowLeaderboards(): Promise<NotNowResult> {
  const { profile } = await requireStudent();
  const { error } = await createServiceRoleClient().rpc('leaderboard_not_now', { p_user_id: profile.user_id });
  if (error) {
    console.error('notNowLeaderboards:', error);
    return { ok: false, error: 'Could not save your choice.' };
  }
  return { ok: true };
}

// Done on How you'll appear: joined, shown as chosen; the username is
// given the first time (a number added when the name is taken).
export async function joinLeaderboards(shownAs: ShownAs, word: string, animal: string): Promise<JoinResult> {
  const { profile } = await requireStudent();
  const { data, error } = await createServiceRoleClient().rpc('leaderboard_join', {
    p_user_id: profile.user_id,
    p_shown_as: shownAs === 'name' ? 'name' : 'username',
    p_word: String(word || ''),
    p_animal: String(animal || ''),
  });
  if (error) return { ok: false, error: rpcError(error, 'Could not join the leaderboards. Please try again.') };
  const card = cardFrom(data);
  if (!card) return { ok: false, error: 'Could not join the leaderboards. Please try again.' };
  return { ok: true, card };
}

// Profile's three (05; Sam, 2026-10-24): leave (the username kept for a
// return), how you appear, and a new username once a week.
async function cardCall(fn: string, args: Record<string, unknown>, fallback: string): Promise<CardResult> {
  const { profile } = await requireStudent();
  const { data, error } = await createServiceRoleClient().rpc(fn, { p_user_id: profile.user_id, ...args });
  if (error) return { ok: false, error: rpcError(error, fallback) };
  const card = cardFrom(data);
  if (!card) return { ok: false, error: fallback };
  return { ok: true, card };
}

export async function leaveLeaderboards(): Promise<CardResult> {
  return cardCall('leaderboard_leave', {}, 'Could not take you off the leaderboards. Please try again.');
}

export async function showAsOnLeaderboards(shownAs: ShownAs): Promise<CardResult> {
  return cardCall('leaderboard_show_as', { p_shown_as: shownAs === 'name' ? 'name' : 'username' }, 'Could not save how you appear. Please try again.');
}

// Show more (05.14; Sam, 2026-10-24): the next 20 lines of a board from
// place `from`, ranked as the board is — tap after tap, every player.
export async function moreOnBoard(period: BoardPeriod, view: BoardView, from: number): Promise<MoreResult> {
  const { profile } = await requireStudent();
  const p = (BOARD_PERIODS as readonly string[]).includes(period) ? period : 'week';
  const v = (BOARD_VIEWS as readonly string[]).includes(view) ? view : 'school';
  const { data, error } = await createServiceRoleClient().rpc('leaderboard_board_rows', {
    p_user_id: profile.user_id,
    p_period: p,
    p_view: v,
    p_from: Math.max(1, Math.floor(Number(from) || 1)),
    p_count: SHOW_MORE_COUNT,
  });
  if (error) {
    console.error('moreOnBoard:', error);
    return { ok: false, error: 'Could not load more. Please try again.' };
  }
  return v === 'schools'
    ? { ok: true, kind: 'schools', lines: rows(data).map(schoolLineFrom) }
    : { ok: true, kind: 'people', lines: rows(data).map(lineFrom) };
}

export async function renameOnLeaderboards(word: string, animal: string): Promise<CardResult> {
  return cardCall(
    'leaderboard_rename',
    { p_word: String(word || ''), p_animal: String(animal || '') },
    'Could not change your username. Please try again.',
  );
}
