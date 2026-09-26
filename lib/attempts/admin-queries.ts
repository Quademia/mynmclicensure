// lib/attempts/admin-queries.ts
//
// The admin Attempts analytics page's reads (slice 14b), transcribed
// from legacy js/mynmclicensure-api.js (the three read-only helpers
// added 2026-06-04): getAttemptsWindow — the lightweight column set,
// never the question rows, newest first, capped at 5,000 rows so
// an "All time" fetch cannot run away — and countAttempts, an exact
// head count within [from, to). The detail read is lib/attempts/queries'
// getAttemptById. Each takes the admin gate's client — the ADMIN SELECT
// policy is the floor — and, as legacy, fails open.
//
// One shape change under the standing S4 tick: the student joins on
// `attempts.user_id` in the same select; legacy fetched the window's
// users in a second call by id.
//
// D52 (2026-09-26): the API cuts any request at 1,000 rows, `.limit(5000)`
// included, so the window read 1,000 and `capped` (which tests 5,000)
// never said so. It reads in batches up to the cap now (rule 10).

import type { ServerSupabaseClient } from '@/lib/access';
import { readAll } from '@/lib/supabase/read-all';
import type { AttemptListRow } from './types';

export const ATTEMPTS_WINDOW_CAP = 5000;

export type WindowAttemptRow = AttemptListRow & {
  users: { user_id: string; name: string | null; forename: string | null; surname: string | null; email: string } | null;
};

export type AttemptsWindow = { attempts: WindowAttemptRow[]; capped: boolean };

const WINDOW_COLUMNS =
  'attempt_id, user_id, quiz_id, course_id, mode, source, status, score_raw, score_total, score_pct, time_taken_s, n, display_label, ts_iso, ' +
  'users ( user_id, name, forename, surname, email )';

/** Attempts within [fromIso, toIso). Either bound may be null = open. */
export async function getAttemptsWindow(
  db: ServerSupabaseClient,
  fromIso: string | null,
  toIso: string | null,
  cap = ATTEMPTS_WINDOW_CAP,
): Promise<AttemptsWindow> {
  const build = () => {
    let query = db.from('attempts').select(WINDOW_COLUMNS);
    if (fromIso) query = query.gte('ts_iso', fromIso);
    if (toIso) query = query.lt('ts_iso', toIso);
    return query.order('ts_iso', { ascending: false }).order('attempt_id');
  };

  const { data, error } = await readAll<unknown>((from, to) => build().range(from, to), { max: cap });
  if (error) {
    console.error('getAttemptsWindow:', error);
    return { attempts: [], capped: false };
  }
  const attempts = data as WindowAttemptRow[];
  return { attempts, capped: attempts.length >= cap };
}

/** Exact count of attempts within [fromIso, toIso). Head only. */
export async function countAttempts(db: ServerSupabaseClient, fromIso: string | null, toIso: string | null): Promise<number> {
  let query = db.from('attempts').select('attempt_id', { count: 'exact', head: true });
  if (fromIso) query = query.gte('ts_iso', fromIso);
  if (toIso) query = query.lt('ts_iso', toIso);

  const { count, error } = await query;
  if (error) {
    console.error('countAttempts:', error);
    return 0;
  }
  return count || 0;
}
