// app/(app)/admin/dashboard/page.tsx — legacy admin/dashboard.html
// (slice 2b the chrome, slice 14a the rest).
//
// Header: "Admin Dashboard" / "Welcome back, {forename}!". Then what
// legacy's initDashboard loaded — the four counts (users, active
// subscriptions, students, expiring within 7 days), the eight quick
// links in legacy's order, and Recent Registrations (the last ten, with
// a View link into the Users page that opens the drawer — §9 #23). All
// server-rendered: nothing on the page changes without a reload, as
// legacy's did not. The TEACHER chip colour is gone with the role
// (§9 #12).

import { requireAdmin } from '@/lib/access';
import { getDashboardCounts, getRecentUsers } from '@/lib/users/queries';
import { PageHeader } from '@/components/shell/page-header';
import '@/styles/admin-dashboard.css';

export const dynamic = 'force-dynamic';

const QUICK_LINKS: { href: string; icon: string; label: string }[] = [
  { href: '/admin/users', icon: '👥', label: 'Manage Users' },
  { href: '/admin/subscriptions', icon: '💳', label: 'Subscriptions' },
  { href: '/admin/payments', icon: '💰', label: 'Payments' },
  { href: '/admin/products', icon: '📦', label: 'Products' },
  { href: '/admin/courses', icon: '📚', label: 'Courses' },
  { href: '/admin/announcements', icon: '📢', label: 'Announcements' },
  { href: '/admin/fixed-quizzes', icon: '📝', label: 'Fixed Quizzes' },
  { href: '/admin/config', icon: '⚙️', label: 'Config' },
];

function fmtDay(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function AdminDashboardPage() {
  const { supabase, profile } = await requireAdmin();
  const [counts, recent] = await Promise.all([getDashboardCounts(supabase), getRecentUsers(supabase, 10)]);

  return (
    <div className="adash">
      <PageHeader
        title="Admin Dashboard"
        subtitle={`Welcome back, ${profile.forename || 'Admin'}!`}
      />

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Total Users</div><div className="stat-value">{counts.totalUsers}</div><div className="stat-sub">All registered accounts</div></div>
        <div className="stat-card"><div className="stat-label">Active Subscriptions</div><div className="stat-value">{counts.activeSubscriptions}</div><div className="stat-sub">Currently active</div></div>
        <div className="stat-card"><div className="stat-label">Students</div><div className="stat-value">{counts.students}</div><div className="stat-sub">Registered students</div></div>
        <div className="stat-card"><div className="stat-label">Expiring Soon</div><div className="stat-value">{counts.expiringSoon}</div><div className="stat-sub">Within 7 days</div></div>
      </div>

      <p className="section-title">Quick Actions</p>
      <div className="admin-quick-links">
        {QUICK_LINKS.map((q) => (
          <a key={q.href} href={q.href} className="admin-quick-link">
            <div className="admin-quick-link-icon">{q.icon}</div>
            <div className="admin-quick-link-label">{q.label}</div>
          </a>
        ))}
      </div>

      <p className="section-title">Recent Registrations</p>
      <div className="card">
        {recent.length === 0 ? (
          <p className="muted-14">No users yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="recent-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Programme</th>
                  <th>Role</th>
                  <th>Registered</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((u) => (
                  <tr key={u.user_id}>
                    <td>{u.name || '—'}</td>
                    <td>{u.email}</td>
                    <td>{u.program_id || '—'}</td>
                    <td><span className={`role-chip ${u.role}`}>{u.role}</span></td>
                    <td>{fmtDay(u.created_utc)}</td>
                    <td><a className="view-link" href={`/admin/users?user_id=${encodeURIComponent(u.user_id)}`}>View</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
