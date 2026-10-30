// lib/profile/queries.ts
//
// The profile page's reads (slice 7e): the active schools grouped by
// region (the register page's query, 2a), and the Subscription panel's
// row — legacy getUserById's activeSubscription: the most recently
// expiring ACTIVE subscription with its product, one row. Each takes
// the caller's per-request client and fails open as legacy did.

import type { ServerSupabaseClient } from '@/lib/access';
import { nowIso } from '@/lib/subscriptions/dates';
import { isLiveNow, windowNow, type Stretch } from '@/lib/subscriptions/window-now';
import type { ProfileSubscription, SchoolOption } from './types';

export async function getActiveSchools(db: ServerSupabaseClient): Promise<SchoolOption[]> {
  const { data, error } = await db
    .from('schools')
    .select('id, name, region')
    .eq('active', true)
    .eq('status', 'listed')
    .order('region', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    console.error('getActiveSchools:', error);
    return [];
  }
  return (data ?? []).map((s) => ({ id: Number(s.id), name: String(s.name), region: String(s.region) }));
}

// The student's school when it is not on the list — a suggested school
// (01): its name for "My school isn't listed", else null.
export async function getUnlistedSchoolName(db: ServerSupabaseClient, schoolId: number | null): Promise<string | null> {
  if (!schoolId) return null;
  const { data, error } = await db.from('schools').select('name, status').eq('id', schoolId).maybeSingle();
  if (error) {
    console.error('getUnlistedSchoolName:', error);
    return null;
  }
  return data && data.status === 'suggested' ? String(data.name) : null;
}

/**
 * The live package with the latest end. Read with each receipt's access
 * rows, so a Standard paused by Premium (02, Premium goes first) is not
 * taken for the live one through its pause (02.14). One student's rows.
 */
export async function getProfileSubscription(db: ServerSupabaseClient, userId: string): Promise<ProfileSubscription | null> {
  const { data, error } = await db
    .from('subscriptions')
    .select('subscription_id, product_id, status, start_utc, expires_utc, products ( name ), course_access ( start_utc, expires_utc, revoked_utc )')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .gt('expires_utc', nowIso()); // expired is the date's word, not the button's (D20, 02 C2)
  if (error) {
    console.error('getProfileSubscription:', error);
    return null;
  }
  type Row = ProfileSubscription & { start_utc: string; expires_utc: string; course_access: Stretch[] | null };
  const t = (iso: string) => new Date(iso).getTime();
  const all = ((data ?? []) as unknown as Row[]).map((r) => ({ row: r, window: windowNow(r, r.course_access) }));
  // The live one with the latest end; with none live, the next to start.
  const live = all.filter((r) => isLiveNow(r.window)).sort((a, b) => t(b.window.expires_utc) - t(a.window.expires_utc));
  const coming = all.filter((r) => !isLiveNow(r.window)).sort((a, b) => t(a.window.start_utc) - t(b.window.start_utc));
  const pick = live[0] ?? coming[0];
  if (!pick) return null;
  const { row, window } = pick;
  return { subscription_id: row.subscription_id, product_id: row.product_id, status: row.status, expires_utc: window.expires_utc, products: row.products };
}
