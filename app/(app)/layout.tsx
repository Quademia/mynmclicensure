// app/(app)/layout.tsx
//
// The slim auth boundary for /student and /admin (AGENTS.md folder
// convention #6): no user → /login. Everything else — the profile, the
// device session, the role — is the gate's job (lib/access), called by
// each page. The chrome is not rendered here; each audience's layout
// wraps its tree in <AppShell> (slice 2b).

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import '@/styles/shell.css';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <>{children}</>;
}
