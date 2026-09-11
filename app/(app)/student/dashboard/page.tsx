// app/(app)/student/dashboard/page.tsx — placeholder (slice 2a).
//
// Somewhere for /router to land so the login flow can be tested end to
// end. Slice 2b gives it the shell; slice 7 transcribes the real
// dashboard from legacy student/dashboard.html.

import { requireStudent } from '@/lib/access';

export const dynamic = 'force-dynamic';

export default async function StudentDashboardPage() {
  const { profile } = await requireStudent();
  return (
    <main style={{ padding: '3rem' }}>
      <h1>Student dashboard</h1>
      <p>Signed in as {profile.name ?? profile.email}. Slice 2b brings the shell.</p>
      <form method="post" action="/logout">
        <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>
          Sign out
        </button>
      </form>
    </main>
  );
}
