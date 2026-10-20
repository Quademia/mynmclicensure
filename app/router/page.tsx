// app/router/page.tsx — legacy/mynmclicensure/router.html.
//
// The post-login split: no session → /login; no profile or inactive →
// sign out, /login (silently, as legacy); ADMIN → /admin/dashboard;
// STUDENT → /student/dashboard. ⭐ §9 #12: legacy sent "everything
// else" to the student dashboard; here any other role is refused, the
// same way a missing profile is. The device-session check happens on
// the destination page's gate, as it did in legacy (guard.js, not
// router.html).
//
// Legacy painted a "Checking your session…" card while its script ran;
// a server redirect has nothing to paint, so there is no markup here.
// The dashboard it sends to carries ?welcome=1: this is the way in (the
// installed app's icon, signing in), so the welcome screen shows over
// that first page while it loads (09.15, Sam 2026-10-20; the signed-in
// layout draws it).

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { findProfileByAuthId } from '@/lib/auth/profile';
import { GATE_SIGNOUT_PATH } from '@/lib/access/internal';

export const dynamic = 'force-dynamic';

export default async function RouterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await findProfileByAuthId(supabase, user.id);
  if (!profile || !profile.active) redirect(GATE_SIGNOUT_PATH);

  const role = (profile.role ?? '').toUpperCase();
  if (role === 'ADMIN') redirect('/admin/dashboard?welcome=1');
  if (role === 'STUDENT') redirect('/student/dashboard?welcome=1');
  redirect(GATE_SIGNOUT_PATH);
}
