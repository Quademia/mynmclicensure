// lib/access/types.ts
//
// What a gate hands back when it passes: the per-request Supabase client
// (so the page keeps querying without a second client), the verified auth
// user, and the product's own profile row. Every page in (app)/ starts
// from one of these.

import type { User } from '@supabase/supabase-js';
import type { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/auth/profile';

export type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type AuthGateResult = {
  supabase: ServerSupabaseClient;
  user: User;
  profile: Profile;
};
