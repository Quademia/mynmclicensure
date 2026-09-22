// app/(app)/student/course/[id]/page.tsx — legacy student/course.html
// (slice 7d).
//
// One course, opened from the sidebar's My Courses rows, the dashboard's
// course cards (7e) and the builders' access dialogs. A Server
// Component end to end — nothing on the page is interactive beyond
// links — transcribed from legacy's initPage in its order: the gate;
// no course id → the dashboard; no access → the locked "No Access"
// card; an unknown course → "Course Not Found"; then the header (title,
// one badge per programme, the "days left" box), the Message button,
// the Fixed Quizzes and Mock Exams previews (5b's course read and the
// shared availability), the Quiz Builder shortcut, the Course
// Announcements section and the Practical Skills block.
//
// Course Announcements (slice 11b): the announcements this student
// qualifies for whose course scope lists this course. Legacy filtered
// on `a.course_id`, a column that never existed, so its section was
// always empty (rebuild.md §9 #19, fixed in slice 11).
//
// Legacy's "expired" (red) state on the days box can never show: the
// access map skips a subscription with no days left, so a course with
// access always has at least one. Carried.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireStudent } from '@/lib/access';
import { getCourseById } from '@/lib/catalogue/queries';
import { getStudentCourseAccess } from '@/lib/subscriptions/queries';
import { getQuizzesForCourse } from '@/lib/quizzes/queries';
import { getQuizAvailability } from '@/lib/quizzes/availability';
import type { QuizCard } from '@/lib/quizzes/types';
import { PageHeader } from '@/components/shell/page-header';
import { getAnnouncementsForStudent } from '@/lib/announcements/queries';
import { AnnouncementBody } from '@/components/announcements/announcement-body';
import '@/styles/student-course.css';
import { Icon } from '@/components/shell/icons';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

// legacy set document.title = `${course.title} — QAcademy Nurses Hub` only
// once access was confirmed and the course found; before that the title
// stayed the page's own. The gate is cached per request, so the access
// read here and in the page cost one query.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const courseId = String(id || '').trim();
  const { supabase, profile } = await requireStudent();
  const fallback: Metadata = { title: 'Course | MyNMCLicensure' };
  if (!courseId) return fallback;
  const accessMap = await getStudentCourseAccess(supabase, profile.user_id);
  if (!accessMap[courseId]) return fallback;
  const course = await getCourseById(supabase, courseId);
  return course ? { title: `${course.title} | MyNMCLicensure` } : fallback;
}

// legacy fmtDate — "3 Oct"
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// legacy: only ACTIVE and UPCOMING rows reach the previews
function visibleOf(rows: QuizCard[]): QuizCard[] {
  return rows.filter((q) => {
    const a = getQuizAvailability(q);
    return a === 'ACTIVE' || a === 'UPCOMING';
  });
}

function PreviewCard({ quiz, href, meta }: { quiz: QuizCard; href: string; meta: string }) {
  const avail = getQuizAvailability(quiz);
  return (
    <a className="preview-card" href={href}>
      <div>
        <div className="preview-card-title">{quiz.title}</div>
        <div className="preview-card-meta">{meta}</div>
      </div>
      <span className={`preview-badge ${avail}`}>{avail === 'ACTIVE' ? 'Active' : 'Upcoming'}</span>
    </a>
  );
}

export default async function CoursePage({ params }: { params: Params }) {
  const { supabase, profile } = await requireStudent();
  const { id } = await params;
  const courseId = String(id || '').trim();

  if (!courseId) redirect('/student/dashboard');

  // legacy: the access check first, the course read second
  const accessMap = await getStudentCourseAccess(supabase, profile.user_id);
  const access = accessMap[courseId];

  if (!access) {
    return (
      <div className="scp">
        <PageHeader title="Access Denied" />
        <div className="no-access-card">
          <div className="icon"><Icon name="lock" size={36} /></div>
          <h2>No Access</h2>
          <p>You do not have an active subscription for this course.</p>
          <a href="/student/dashboard" className="btn btn-primary">Back to Dashboard</a>
        </div>
      </div>
    );
  }

  const course = await getCourseById(supabase, courseId);
  if (!course) {
    return (
      <div className="scp">
        <PageHeader title="Course Not Found" />
      </div>
    );
  }

  const [fixedRows, mockRows, myAnnouncements] = await Promise.all([
    getQuizzesForCourse(supabase, 'fixed', courseId),
    getQuizzesForCourse(supabase, 'mock', courseId),
    getAnnouncementsForStudent(supabase, profile),
  ]);
  const fixed = visibleOf(fixedRows);
  const mocks = visibleOf(mockRows);
  const courseAnnouncements = myAnnouncements.filter((a) => (a.scope_courses || []).includes(courseId));

  const fixedHref = `/student/fixed-quizzes?course=${encodeURIComponent(courseId)}`;
  const mockHref = `/student/mock-exams?course=${encodeURIComponent(courseId)}`;
  const days = access.totalDays;
  const daysClass = `course-access-badge${days <= 7 ? ' warning' : ''}${days <= 0 ? ' expired' : ''}`;

  return (
    <div className="scp">
      <PageHeader title={course.title} />

      {/* 1. Course header */}
      <div className="course-header">
        <div className="course-header-left">
          <h1>{course.title}</h1>
          <div>
            {(course.program_scope || []).map((prog) => (
              <span key={prog} className="course-programme-badge">{prog}</span>
            ))}
          </div>
        </div>
        <div className={daysClass}>
          <div className="days">{days}</div>
          <div className="days-label">days left</div>
        </div>
      </div>

      {/* Message us button (slice 12's page) */}
      <div className="message-row">
        <a className="btn-message-course" href={`/student/messages?course_id=${encodeURIComponent(courseId)}`}>
          <Icon name="message" />Message us about this course
        </a>
      </div>

      {/* 2. Fixed Quizzes */}
      <div className="section-card">
        <div className="section-card-header">
          <span className="section-card-title"><Icon name="clipboard" />Fixed Quizzes</span>
          <span className="section-card-badge">{fixed.length ? `${fixed.length} available` : ''}</span>
        </div>
        {!fixed.length ? (
          <div className="preview-empty">No fixed quizzes available for this course.</div>
        ) : (
          <>
            {fixed.slice(0, 3).map((q) => (
              <PreviewCard
                key={q.quiz_id}
                quiz={q}
                href={fixedHref}
                meta={`${q.n} questions${q.time_limit_sec ? ' · ' + Math.round(q.time_limit_sec / 60) + ' min' : ''}`}
              />
            ))}
            <a className="view-all-link" href={fixedHref}>View all fixed quizzes →</a>
          </>
        )}
      </div>

      {/* 3. Mock Exams */}
      <div className="section-card">
        <div className="section-card-header">
          <span className="section-card-title"><Icon name="target" />Mock Exams</span>
          <span className="section-card-badge">{mocks.length ? `${mocks.length} available` : ''}</span>
        </div>
        {!mocks.length ? (
          <div className="preview-empty">No mock exams available right now.</div>
        ) : (
          <>
            {mocks.map((q) => {
              const avail = getQuizAvailability(q);
              let schedule = '';
              if (avail === 'UPCOMING' && q.publish_at) schedule = 'Opens ' + fmtDate(q.publish_at);
              if (avail === 'ACTIVE' && q.unpublish_at) schedule = 'Closes ' + fmtDate(q.unpublish_at);
              return <PreviewCard key={q.quiz_id} quiz={q} href={mockHref} meta={`${q.n} questions${schedule ? ' · ' + schedule : ''}`} />;
            })}
            <a className="view-all-link" href={mockHref}>View all mock exams →</a>
          </>
        )}
      </div>

      {/* 4. Quiz Builder shortcut */}
      <div className="section-card">
        <div className="section-card-header">
          <span className="section-card-title"><Icon name="wrench" />Quiz Builder</span>
        </div>
        <a href={`/student/quiz-builder?course=${encodeURIComponent(courseId)}`} className="builder-shortcut">
          <div className="builder-shortcut-icon"><Icon name="wrench" size={22} /></div>
          <div className="builder-shortcut-text">
            <div className="title">Build a Custom Quiz</div>
            <div className="sub">Create a practice quiz filtered to this course</div>
          </div>
        </a>
      </div>

      {/* 4. Course Announcements */}
      <div className="section-card">
        <div className="section-card-header">
          <span className="section-card-title"><Icon name="megaphone" />Course Announcements</span>
          <span className="section-card-badge">
            {courseAnnouncements.length ? `${courseAnnouncements.length} announcement${courseAnnouncements.length !== 1 ? 's' : ''}` : ''}
          </span>
        </div>
        {!courseAnnouncements.length ? (
          <div className="empty-state">No announcements for this course yet.</div>
        ) : (
          courseAnnouncements.map((a) => (
            <div key={a.announcement_id} className="announcement-item">
              <div className="announcement-title">{a.title}</div>
              <AnnouncementBody html={a.body_html || a.body_text || ''} className="announcement-body" />
            </div>
          ))
        )}
      </div>

      {/* 5. NMC Procedures block */}
      <div className="section-card">
        <div className="skills-row">
          <div className="skills-text">
            <div className="skills-title">Practical Skills — Procedures &amp; Component Tasks</div>
            <div className="skills-sub">
              Open the practical skills page to view the official NMC Ghana procedure manuals (component tasks) for your programme and other programmes.
            </div>
          </div>
          <div>
            <a href="/student/procedures" className="btn btn-primary skills-btn">Open Procedures Page &rarr;</a>
          </div>
        </div>
      </div>
    </div>
  );
}
