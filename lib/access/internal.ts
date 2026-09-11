// lib/access/internal.ts
//
// The shared body of requireStudent() and requireAdmin() — legacy
// guard.js guardPage() steps 1–4, run on the server for every request
// to a protected page (rebuild.md §10). NOT re-exported from the barrel.
//
//   1. no auth user            → /login
//   2. no profile row          → sign out, /login
//   3. profile.active = false  → sign out, /login
//   4. device session missing, inactive or expired (the cookie against
//      the sessions table) → sign out, /login. This is where a kicked
//      third device finds out.
//
// ⓘ "Sign out" from a Server Component cannot clear cookies (the
// Supabase client's setAll is swallowed there), and a redirect to /login
// with the auth cookie still set would bounce straight back to /router.
// So the gate sends the browser through /logout?via=gate, a Route
// Handler, which can clear cookies and then lands on /login.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { findProfileByAuthId } from '@/lib/auth/profile';
import { verifySession } from '@/lib/auth/sessions';
import type { AuthGateResult } from './types';

export const GATE_SIGNOUT_PATH = '/logout?via=gate';

export async function loadGate(): Promise<AuthGateResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await findProfileByAuthId(supabase, user.id);
  if (!profile) redirect(GATE_SIGNOUT_PATH);
  if (!profile.active) redirect(GATE_SIGNOUT_PATH);

  const live = await verifySession(profile.user_id);
  if (!live) redirect(GATE_SIGNOUT_PATH);

  return { supabase, user, profile };
}
