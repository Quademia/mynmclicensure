// app/logout/route.ts
//
// Sign-out — legacy guard.js logout(): the device session goes inactive,
// the Supabase session is signed out, the browser lands on /login.
//
// POST is the Sign out button (a form, so a link prefetch can never sign
// someone out by accident). GET is accepted only from a gate
// (?via=gate): a Server Component cannot clear cookies, so when a gate
// finds a kicked, expired or profile-less session it redirects here to
// have them cleared (lib/access/internal.ts). Any other GET goes to
// /router and changes nothing.
//
// Offline packs (07.3): a phone signed out here, or bumped by a sign-in
// elsewhere, lands on /login?packs=clear, and the sign-in page clears the
// packs kept on it (app/login/clear-phone-packs.tsx). A sign-in that only
// ran out its week lands on plain /login and keeps them
// (currentSessionEnded).

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { currentSessionEnded, deactivateCurrentSession } from '@/lib/auth/sessions';

async function signOutAndGo(request: NextRequest, clearPacks: boolean): Promise<NextResponse> {
  await deactivateCurrentSession();
  const supabase = await createClient();
  // This device only (2026-10-17): the default, 'global', ended every
  // device the student was signed in on — a phone bumped by a sign-in
  // elsewhere then signed the new phone out too, and Sign out on one
  // device signed out the other.
  await supabase.auth.signOut({ scope: 'local' });

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = clearPacks ? '?packs=clear' : '';
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
  return signOutAndGo(request, true);
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('via') === 'gate') {
    return signOutAndGo(request, await currentSessionEnded());
  }
  const url = request.nextUrl.clone();
  url.pathname = '/router';
  url.search = '';
  return NextResponse.redirect(url, { status: 303 });
}
