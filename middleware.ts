// middleware.ts
//
// Runs on every request before page render.
//
// Two jobs:
//   1. Refresh the Supabase auth cookie if it's close to expiring.
//      (Without this, users get silently signed out after the token TTL.)
//   2. Route guards — redirect based on auth state and path.
//
// Next.js 16 prints a `middleware → proxy` deprecation warning at dev
// startup. We can't rename to proxy.ts yet — see "Known Workarounds" in
// AGENTS.md: proxy.ts is Node-runtime only, and `@opennextjs/cloudflare`
// 1.19.x refuses Node middleware. Re-rename when OpenNext catches up
// (tracking cloudflare/workers-sdk#13755).

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Paths that require an authenticated session. The product has two
// audiences (rebuild.md §4); there is no tutor here.
const AUTH_REQUIRED_PREFIXES = ['/router', '/student', '/admin', '/logout'];

// Paths that should redirect to /router if the user IS already signed in.
const AUTH_FORBIDDEN_PATHS = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // The product's tables live in the `licensure_gh` schema (AGENTS.md
      // rule #1). Middleware only touches auth, but every client in the
      // repo is created the same way so none is ever pointed at `public`.
      db: { schema: 'licensure_gh' },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() forces a revalidation with Supabase's auth server.
  // Never use getSession() here — AGENTS.md rule #4.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Segment-aware match, not a raw string prefix: `/student` is
  // `/student` itself or `/student/...`, never `/students-guide`.
  const needsAuth = AUTH_REQUIRED_PREFIXES.some(
    (p) => path === p || path.startsWith(p + '/')
  );
  if (needsAuth && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // GET only: a Server Action posted to /login by the page that just
  // finished a Google or magic-link return arrives WITH a user, and must
  // reach the action rather than be bounced.
  const shouldBounce = request.method === 'GET' && AUTH_FORBIDDEN_PATHS.includes(path);
  if (shouldBounce && user) {
    const routerUrl = request.nextUrl.clone();
    routerUrl.pathname = '/router';
    return NextResponse.redirect(routerUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
