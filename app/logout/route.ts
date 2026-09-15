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

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deactivateCurrentSession } from '@/lib/auth/sessions';

async function signOutAndGo(request: NextRequest): Promise<NextResponse> {
  await deactivateCurrentSession();
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
  return signOutAndGo(request);
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('via') === 'gate') {
    return signOutAndGo(request);
  }
  const url = request.nextUrl.clone();
  url.pathname = '/router';
  url.search = '';
  return NextResponse.redirect(url, { status: 303 });
}
