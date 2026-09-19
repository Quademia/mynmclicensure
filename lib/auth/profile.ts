// lib/auth/profile.ts
//
// The product's own user row, looked up by the Supabase login id.
// `Profile` is the shape of licensure_gh.users; `findProfileByAuthId`
// is the legacy login page's lookup, including its one retry after
// 500 ms (replication lag right after signup — rebuild.md §10).
//
// Server only.

import type { createClient } from '@/lib/supabase/server';

type Db = Awaited<ReturnType<typeof createClient>>;

export type Role = 'STUDENT' | 'ADMIN';

export type Profile = {
  user_id: string;
  auth_id: string;
  email: string;
  forename: string | null;
  surname: string | null;
  name: string | null;
  phone_number: string | null;
  program_id: string | null;
  cohort: string | null;
  level: string | null;
  role: string;
  active: boolean;
  avatar_url: string | null;
  signup_source: string | null;
  created_utc: string | null;
  last_login_utc: string | null;
  school_id: number | null;
  school_other: string | null;
  referral_source: string | null;
};

export async function findProfileByAuthId(
  db: Db,
  authId: string,
  opts: { retry?: boolean } = {}
): Promise<Profile | null> {
  const attempts = opts.retry ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const { data } = await db
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .maybeSingle();
    if (data) return data as Profile;
    if (attempt === 0 && attempts > 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return null;
}
