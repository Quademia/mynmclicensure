// app/(app)/student/dashboard/page.tsx — legacy student/dashboard.html
// (slice 7f, the last of slice 7).
//
// The student's landing page, transcribed from legacy's initDashboard in
// its order: the header, the profile nudge, the subscription bar, the
// channels card, the announcements block (slice 11b, already here), the
// course cards, the Quiz Builder and NMC Procedures blocks, the five
// most recent attempts, and the floating Portal Guide bubble.
//
// A Server Component but for the nudge's ✕ and the announcements block:
// nothing else on the page is interactive beyond links. Legacy's
// populateCourseDropdown is not here — the sidebar's My Courses rows are
// the shell's own (slice 2b), filled for every student page, not this
// one.
//
// Dates are formatted on the server. Ghana keeps GMT all year and the
// Worker runs UTC, so the reader sees the same day legacy's browser-side
// formatting gave them; the course page (7d) already does this.
//
// Two notes on what is NOT carried:
//   · Legacy sent Review and Resume to the instant runner for every
//     attempt, timed ones included, so a timed mock resumed in the wrong
//     runner. Learning history (7a) routes on the attempt's own mode;
//     the dashboard now does the same (Sam, 2026-09-16). Not a §9 entry
//     — ruled on in session.
//   · "Expires in N days" comes from the access map's stacked day count
//     rather than a second clock read, as the course page's days box
//     does; the map's expiry is today plus that count, so the two agree.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getCourses } from '@/lib/catalogue/queries';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { getRecentAttempts } from '@/lib/attempts/queries';
import type { AttemptListRow, AttemptMode } from '@/lib/attempts/types';
import { getAnnouncementsForStudent, getStudentNoticeStates } from '@/lib/announcements/queries';
import { AnnouncementsStrip } from '@/components/announcements/announcements-strip';
import { PageHeader, displayNameOf } from '@/components/shell/page-header';
import { ProfileNudge } from './profile-nudge';
import '@/styles/student-dashboard.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Dashboard | MyNMCLicensure' };

// legacy: `expires.toLocaleDateString('en-GB', {day,month,year})`
function fmtExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// legacy's attempt row date — "3 Oct 2026 · 14:05". A row with no
// stamp shows learning history's dash (7a); legacy printed "Invalid Date".
function fmtAttemptDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

// legacy: `⚠️ Expires in N day(s)` under eight days, the date otherwise
function expiryLabel(days: number, expiresIso: string): string {
  return days <= 7 ? `⚠️ Expires in ${days} day${days === 1 ? '' : 's'}` : `Expires ${fmtExpiry(expiresIso)}`;
}

// 7a's runnerHref, on the attempt's own mode (Sam, 2026-09-16)
function runnerHref(mode: AttemptMode, attemptId: string, review = false): string {
  return `/runner/${mode === 'timed' ? 'timed' : 'instant'}?attempt_id=${encodeURIComponent(attemptId)}${review ? '&review=1' : ''}`;
}

function AttemptsTable({ attempts }: { attempts: AttemptListRow[] }) {
  return (
    <table className="attempts-table">
      <thead>
        <tr>
          <th>Quiz</th>
          <th>Mode</th>
          <th>Questions</th>
          <th>Score</th>
          <th>Date</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {attempts.map((a) => {
          const completed = a.status === 'completed';
          return (
            <tr key={a.attempt_id}>
              <td>{a.display_label || a.quiz_id || 'Quiz'}</td>
              <td>{a.mode}</td>
              <td>{a.n} questions</td>
              <td>{completed ? `${a.score_raw}/${a.score_total} (${Math.round(a.score_pct ?? 0)}%)` : '—'}</td>
              <td>{fmtAttemptDate(a.ts_iso)}</td>
              <td>
                <span className={`status-chip ${a.status}`}>{a.status.replace('_', ' ')}</span>
              </td>
              <td>
                <a className="attempt-action" href={runnerHref(a.mode, a.attempt_id, completed)}>
                  {completed ? 'Review' : 'Resume'}
                </a>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default async function StudentDashboardPage() {
  const { supabase, profile } = await requireStudent();

  const [accessMap, courses, attempts, announcements, states] = await Promise.all([
    getStudentCourseAccess(supabase, profile.user_id),
    getCourses(supabase),
    getRecentAttempts(supabase, profile.user_id),
    getAnnouncementsForStudent(supabase, profile),
    getStudentNoticeStates(supabase, profile.user_id),
  ]);

  // legacy checkProfileCompletion: the strip is offered when either is blank
  const hasPhone = Boolean(profile.phone_number && profile.phone_number.trim());
  const hasSchool = Boolean(profile.school_id || (profile.school_other && profile.school_other.trim()));
  const profileComplete = hasPhone && hasSchool;

  // legacy loadSubscriptionBar: the longest expiry across every covered
  // course — the map stacks days, so the largest count is that course
  const accessible = courses.filter((c) => accessMap[c.course_id]);
  const longest = Object.values(accessMap).reduce<{ totalDays: number; expires: string } | null>(
    (best, a) => (!best || a.totalDays > best.totalDays ? a : best),
    null,
  );
  const subWarning = longest !== null && longest.totalDays <= 7;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${profile.forename || 'Student'}!`}
        userName={displayNameOf(profile)}
      />

      <div className="sdash">
        {/* 1. Profile completion nudge */}
        {profileComplete ? null : <ProfileNudge />}

        {/* 2. Subscription status bar */}
        {longest === null ? (
          <div className="subscription-bar expired">
            <div>
              <div className="sub-label">Subscription</div>
              <div className="sub-name">No active subscription</div>
            </div>
            <a href="/student/upgrade" className="btn btn-primary sub-cta">
              Subscribe Now
            </a>
          </div>
        ) : (
          <div className={`subscription-bar${subWarning ? ' warning' : ''}`}>
            <div>
              <div className="sub-label">Platform Access</div>
              <div className="sub-name">Active</div>
            </div>
            <div className={`sub-expiry${subWarning ? ' warning' : ''}`}>
              {expiryLabel(longest.totalDays, longest.expires)}
            </div>
          </div>
        )}

        {/* 3. Stay-connected channels */}
        <div className="channels-card">
          <div className="channels-card-text">
            <span className="channels-card-title">📣 Stay connected</span>
            <span className="channels-card-sub">
              Join our channels for updates, tips &amp; announcements — don&apos;t miss anything.
            </span>
          </div>
          <div className="channels-card-btns">
            <a
              className="channel-btn wa"
              href="https://www.whatsapp.com/channel/0029Vb6ActpBA1ewCfBmAF3O"
              target="_blank"
              rel="noopener"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M20 3.9A9.9 9.9 0 0 0 12.06 2C6.55 2 2 6.55 2 12.06c0 1.77.46 3.46 1.25 4.93L2 22l5.13-1.2a9.9 9.9 0 0 0 4.93 1.25C17.55 22 22 17.45 22 11.94A9.9 9.9 0 0 0 20 3.9Zm-7.94 16.1a8.1 8.1 0 0 1-4.13-1.14l-.3-.18-3.04.7.65-2.96-.2-.31a8.16 8.16 0 1 1 7.02 3.89Zm4.65-6.14c-.25-.12-1.48-.73-1.7-.81-.22-.08-.38-.12-.54.12-.16.25-.62.81-.76.98-.14.16-.28.18-.53.06-.25-.12-1.05-.39-2-1.24-.74-.66-1.24-1.48-1.38-1.73-.14-.25-.02-.39.1-.51.1-.1.25-.28.37-.41.12-.14.16-.23.24-.39.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.48-.4-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.25-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.14 3.64.58.25 1.04.4 1.4.51.59.19 1.12.16 1.54.1.47-.07 1.48-.6 1.69-1.17.21-.57.21-1.06.15-1.17-.06-.1-.23-.16-.48-.28Z"
                />
              </svg>
              Join WhatsApp
            </a>
            <a className="channel-btn tg" href="https://t.me/QAcademynurseshub" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M9.03 15.47 8.9 19.1c.3 0 .44-.13.6-.28l1.44-1.38 2.99 2.2c.55.3.94.14 1.09-.51l1.98-9.32c.18-.84-.3-1.17-.86-.96L4.9 11.2c-.82.32-.8.78-.14.99l3.48 1.09 8.08-5.11-7.3 7.3z"
                />
              </svg>
              Join Telegram
            </a>
          </div>
        </div>

        {/* 4. Announcements (slice 11b) */}
        <AnnouncementsStrip announcements={announcements} states={states} />

        {/* 5. Course cards */}
        <p className="section-title">My Courses</p>
        <div className="card-grid courses-area">
          {accessible.length === 0 ? (
            <p className="empty-line">No courses available yet.</p>
          ) : (
            accessible.map((course) => {
              const access = accessMap[course.course_id];
              const warning = access.totalDays <= 7;
              return (
                <a key={course.course_id} className="course-card" href={`/student/course/${encodeURIComponent(course.course_id)}`}>
                  <div className="course-badge">{(course.program_scope || []).join(', ')}</div>
                  <h3>{course.title}</h3>
                  <p>Click to view quizzes and study materials</p>
                  <div className={`course-expiry ${warning ? 'warning' : 'normal'}`}>
                    {expiryLabel(access.totalDays, access.expires)}
                  </div>
                </a>
              );
            })
          )}
        </div>

        {/* 6. Custom Quiz Builder */}
        <div className="promo-block">
          <h3>Create a Custom Quiz</h3>
          <p>
            Build your own practice session by selecting topics, difficulty levels, and number of questions from your
            enrolled courses. Ideal for targeted revision, weak-area focus, or quick daily drills.
          </p>
          <a href="/student/quiz-builder" className="btn btn-primary promo-btn">
            Launch Quiz Builder &rarr;
          </a>
        </div>

        {/* 7. NMC Procedures */}
        <div className="promo-block">
          <h3>NMC Procedures &amp; Component Tasks</h3>
          <p>
            View the official NMC Ghana procedure manuals (component tasks) for your programme and other programmes. Use
            this page to support your practical skills and OSCE preparation.
          </p>
          <a href="/student/procedures" className="btn btn-primary promo-btn">
            Open NMC Procedures Page &rarr;
          </a>
        </div>

        {/* 8. Recent attempts */}
        <div className="attempts-head">
          <p className="section-title">Recent Quiz Attempts</p>
          <a href="/student/learning-history" className="attempts-head-link">
            View full history &rarr;
          </a>
        </div>
        <div className="card attempts-area">
          {attempts.length === 0 ? (
            <>
              <p className="empty-line attempts-empty">
                No quiz attempts yet. Start a quiz to see your history here.
              </p>
              <div className="attempts-empty-btns">
                <a href="/student/quiz-builder" className="btn btn-primary">
                  Custom Quiz
                </a>
                <a href="/student/fixed-quizzes" className="btn btn-primary">
                  Fixed Quizzes
                </a>
              </div>
            </>
          ) : (
            <div className="attempts-scroll">
              <AttemptsTable attempts={attempts} />
            </div>
          )}
        </div>

        {/* 9. Floating Portal Guide bubble. Legacy put it outside the
            main column; it is fixed to the viewport either way, and
            nothing above it is a transformed or container-type ancestor
            that would become its containing block. */}
        <a href="/student/portal-guide" className="guide-bubble">
          <span className="guide-bubble-mark">?</span>
          <span>Portal Guide</span>
        </a>
      </div>
    </>
  );
}
