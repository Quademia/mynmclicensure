// app/(app)/layout.tsx
//
// The slim auth boundary for /student and /admin (AGENTS.md folder
// convention #6): no user → /login. Everything else — the profile, the
// device session, the role — is the gate's job (lib/access), called by
// each page. The chrome is not rendered here; each audience's layout
// wraps its tree in <AppShell> (slice 2b).
//
// The welcome screen (09.15) is drawn here, after the page, on the way in
// through /router (the middleware's x-qd-welcome header): after, so the
// first page's grey placeholder is already in the document when it
// arrives, and the stylesheet shows it over that placeholder at once.

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WelcomeScreen } from '@/components/shell/welcome-screen';
import '@/styles/shell.css';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const welcome = (await headers()).get('x-qd-welcome') === '1';

  return (
    <>
      {children}
      {welcome ? <WelcomeScreen /> : null}
    </>
  );
}
