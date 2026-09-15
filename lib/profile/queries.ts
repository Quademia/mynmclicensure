// lib/profile/queries.ts
//
// The profile page's reads (slice 7e): the active schools grouped by
// region (the register page's query, 2a), and the Subscription panel's
// row — legacy getUserById's activeSubscription: the most recently
// expiring ACTIVE subscription with its product, one row. Each takes
// the caller's per-request client and fails open as legacy did.

import type { ServerSupabaseClient } from '@/lib/access';
import type { ProfileSubscription, SchoolOption } from './types';

export async function getActiveSchools(db: ServerSupabaseClient): Promise<SchoolOption[]> {
  const { data, error } = await db
    .from('schools')
    .select('id, name, region')
    .eq('active', true)
    .order('region', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    console.error('getActiveSchools:', error);
    return [];
  }
  return (data ?? []).map((s) => ({ id: Number(s.id), name: String(s.name), region: String(s.region) }));
}

export async function getProfileSubscription(db: ServerSupabaseClient, userId: string): Promise<ProfileSubscription | null> {
  const { data, error } = await db
    .from('subscriptions')
    .select('subscription_id, product_id, status, expires_utc, products ( name )')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .order('expires_utc', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('getProfileSubscription:', error);
    return null;
  }
  return (data as unknown as ProfileSubscription | null) ?? null;
}
