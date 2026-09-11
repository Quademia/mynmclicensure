// app/(app)/admin/dashboard/page.tsx — placeholder (slice 2a).
//
// Somewhere for /router to send an ADMIN. Slice 2b gives it the shell;
// slice 14 transcribes the real dashboard from legacy admin/dashboard.html.

import { requireAdmin } from '@/lib/access';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const { profile } = await requireAdmin();
  return (
    <main style={{ padding: '3rem' }}>
      <h1>Admin dashboard</h1>
      <p>Signed in as {profile.name ?? profile.email}. Slice 2b brings the shell.</p>
      <form method="post" action="/logout">
        <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>
          Sign out
        </button>
      </form>
    </main>
  );
}
