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
import { cardFrom } from './queries';
import type { JoinResult, NotNowResult, ShownAs } from './types';

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
