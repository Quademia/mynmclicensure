// lib/supabase/client.ts
//
// Browser-side Supabase client. Used inside Client Components ("use client").
//
// Exports a FUNCTION, not an instance (AGENTS.md rule #4). Two things about
// createBrowserClient that are not configurable, verified against
// @supabase/ssr 0.5.2 in the MyNclex repo (2026-08-06):
//   1. `detectSessionInUrl` cannot be turned off — the client always
//      consumes an auth token it finds in the URL and wipes the address bar.
//   2. It is a module-level singleton in the browser: the first call builds
//      it, later calls return that instance and ignore their arguments.
// So a page must let the client do the code exchange and WAIT for the
// session rather than doing the work itself (the two would race for a
// single-use code). Reference: MyNclex app/reset-password/page.tsx.

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'licensure_gh' } }
  );
}
