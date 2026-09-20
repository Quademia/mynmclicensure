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

import type { ServerSupabaseClient } from '@/lib/access';
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
  let query = db.from('attempts').select(WINDOW_COLUMNS).order('ts_iso', { ascending: false }).limit(cap);
  if (fromIso) query = query.gte('ts_iso', fromIso);
  if (toIso) query = query.lt('ts_iso', toIso);

  const { data, error } = await query;
  if (error) {
    console.error('getAttemptsWindow:', error);
    return { attempts: [], capped: false };
  }
  const attempts = (data ?? []) as unknown as WindowAttemptRow[];
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
