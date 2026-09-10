// lib/supabase/server.ts
//
// Server-side Supabase client.
// Used inside Server Components, Server Actions, and Route Handlers.
//
// AGENTS.md rule #4: create per request (this function is called per
// request), never at module scope; never call getSession() on the server.
// AGENTS.md rule #1: every client is pointed at the `licensure` schema.
// The schema must be listed under Exposed schemas on the Supabase project
// (dashboard → Settings → API) or every query fails with "relation does
// not exist" — see db/README.md.
//
// createServiceRoleClient() bypasses RLS. Use only where the application
// has already verified access at a higher layer. The key never leaves the
// server (rule #5).

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createPlainClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const LICENSURE_SCHEMA = 'licensure';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: LICENSURE_SCHEMA },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware will refresh
            // cookies on the next request instead. Safe to ignore.
          }
        },
      },
    }
  );
}

// Service-role client — bypasses RLS. Per-request creation, no module-scope
// cache, matching createClient() above. The return type is inferred: the
// library's `SupabaseClient` default is typed to the `public` schema, and
// an explicit annotation would refuse a client pointed at `licensure`.
export function createServiceRoleClient() {
  return createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: LICENSURE_SCHEMA },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
