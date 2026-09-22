// components/quizzes/student-quiz-list.tsx
//
// The script block of legacy student/fixed-quizzes.html and
// student/mock-exams.html (slice 5b) — one script twice, a few lines
// apart, so one component with a `kind`. The page (server half) loads
// what legacy's initPage loaded — the enrolled courses, each course's
// published quizzes and the student's attempts — and hands them here;
// this half is the filters, the course accordions, the cards with their
// Practice / Exam sections, and the buttons. The words that differ by
// page are in WORDS below; the mock page also shows a "Closes in N days"
// line on an active exam.
//
// Start / Resume, Retake and Abandon go through Server Actions
// (lib/attempts/actions); legacy wrote from the browser. Review opens
// the runner with ?review=1. The legacy alert() messages are toasts (UI
// convention #1); the Abandon confirm box stays the browser's, with
// legacy's words (Sam, 2026-09-11: dialogs stay as legacy has them).
//
// The accordions render after mount behind legacy's "Loading…" line.
// Since Q2 (03-quiz-system.md, D45 b) availability is computed against
// the SERVER's clock — the page passes the time it rendered at — so the
// card and the Start button that the server judges always agree; the
// date strings still format in the browser's locale, as legacy.

'use client';
import { useConfirm } from '@/lib/overlays/shared/confirm-dialog';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { abandonAttempt, retakeAttempt, spawnQuizAttempt } from '@/lib/attempts/actions';
import type { AttemptWithProgress, AttemptMode } from '@/lib/attempts/types';
import { getQuizAvailability } from '@/lib/quizzes/availability';
import type { AllowedModes, Availability, QuizCard, QuizKind } from '@/lib/quizzes/types';

type CourseLite = { course_id: string; title: string };

type Props = {
  kind: QuizKind;
  /** the enrolled courses, in catalogue order */
  courses: CourseLite[];
  quizzesByCourse: Record<string, QuizCard[]>;
  attemptsByCourse: Record<string, AttemptWithProgress[]>;
  /** the raw `?course=` — the chip shows only when it names an enrolled course */
  activeCourseFilter: string | null;
  /** the server's clock at render (ISO) — the one availability is judged on (Q2) */
  serverNow: string;
};

type Msg = { text: string; tone: 'error' | 'success' } | null;
type AttemptFilter = '' | 'not_started' | 'in_progress' | 'completed';
type StatusFilter = '' | Exclude<Availability, 'HIDDEN'>;
type ModeFilter = '' | AllowedModes;
type LaunchAction = 'start' | 'resume' | 'retake';

const WORDS: Record<
  QuizKind,
  { path: string; emptyIcon: string; countNoun: (n: number) => string; noneForCourse: string }
> = {
  fixed: {
    path: '/student/fixed-quizzes',
    emptyIcon: '📝',
    countNoun: (n) => `${n} quiz${n !== 1 ? 'zes' : ''}`,
    noneForCourse: 'No quizzes available for this course yet.',
  },
  mock: {
    path: '/student/mock-exams',
    emptyIcon: '🎯',
    countNoun: (n) => `${n} exam${n !== 1 ? 's' : ''}`,
    noneForCourse: 'No mock exams available for this course.',
  },
};

const BADGE: Record<Exclude<Availability, 'HIDDEN'>, string> = {
  ACTIVE: 'Active',
  UPCOMING: 'Upcoming',
  CLOSED: 'Closed',
};

function subscribeNever(): () => void {
  return () => {};
}

function runnerHref(mode: AttemptMode, attemptId: string, review = false): string {
  return `/runner/${mode}?attempt_id=${encodeURIComponent(attemptId)}${review ? '&review=1' : ''}`;
}

// legacy getOverallAttemptState — across both modes, for the filter
function getOverallAttemptState(quizId: string, attempts: AttemptWithProgress[]): AttemptFilter {
  const quizAttempts = attempts.filter((a) => a.quiz_id === quizId);
  if (!quizAttempts.length) return 'not_started';
  if (quizAttempts.some((a) => a.status === 'in_progress')) return 'in_progress';
  if (quizAttempts.some((a) => a.status === 'completed')) return 'completed';
  return 'not_started';
}

// legacy countAnswered — since 03 Q5 the count of answered rows, read
// with the attempt.
function countAnswered(attempt: AttemptWithProgress): number {
  return Number(attempt.answered_count) || 0;
}

// legacy formatDate
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function StudentQuizList({ kind, courses, quizzesByCourse, attemptsByCourse, activeCourseFilter, serverNow }: Props) {
  const W = WORDS[kind];
  const router = useRouter();

  // false on the server render, true once hydrated — legacy's 'Loading…' until then
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  const [msg, setMsg] = useState<Msg>(null);
  const clearMsg = useCallback(() => setMsg(null), []);
  const err = (text: string) => setMsg({ text, tone: 'error' });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('');
  const [attemptFilter, setAttemptFilter] = useState<AttemptFilter>('');

  // The target course's accordion opens on load, as legacy.
  const [openCourses, setOpenCourses] = useState<Set<string>>(() => new Set(activeCourseFilter ? [activeCourseFilter] : []));
  // An abandoned attempt drops out at once; router.refresh() then re-reads the truth.
  const [abandonedIds, setAbandonedIds] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const filterCourse = activeCourseFilter ? courses.find((c) => c.course_id === activeCourseFilter) : undefined;

  function toggleAccordion(courseId: string) {
    setOpenCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  function clearFilters() {
    setStatusFilter('');
    setModeFilter('');
    setAttemptFilter('');
  }

  function clearCourseFilter() {
    router.push(W.path);
  }

  function attemptsOf(courseId: string): AttemptWithProgress[] {
    const rows = attemptsByCourse[courseId] || [];
    if (!abandonedIds.size) return rows;
    return rows.map((a) => (abandonedIds.has(a.attempt_id) ? { ...a, status: 'abandoned' as const } : a));
  }

  // ── launch (legacy launchQuiz) ──
  async function launchQuiz(quiz: QuizCard, mode: AttemptMode, action: LaunchAction) {
    if (busy) return;
    const key = `${quiz.quiz_id}:${mode}`;
    setBusy(key);

    if (action === 'retake') {
      const originAttempt = attemptsOf(quiz.course_id).find(
        (a) => a.quiz_id === quiz.quiz_id && a.mode === mode && a.status === 'completed',
      );
      if (!originAttempt) {
        setBusy(null);
        return;
      }
      const result = await retakeAttempt(originAttempt.attempt_id);
      if (!result.ok) {
        setBusy(null);
        return err(result.error || 'Could not create retake. Please try again.');
      }
      router.push(runnerHref(mode, result.attemptId));
      return;
    }

    // Start or Resume — one action handles both
    const result = await spawnQuizAttempt(kind, quiz.quiz_id, mode);
    if (!result.ok) {
      setBusy(null);
      return err(result.error || 'Could not start quiz. Please try again.');
    }
    router.push(runnerHref(mode, result.attemptId));
  }

  // ── review (legacy reviewAttempt) ──
  function reviewAttempt(attemptId: string, mode: AttemptMode) {
    router.push(runnerHref(mode, attemptId, true));
  }

  // ── abandon (legacy abandonAttempt) ──
  const [confirm, confirmDialog] = useConfirm();
  async function abandon(attemptId: string) {
    if (busy) return;
    // legacy's words in the app's dialog (DS4)
    const ok = await confirm({
      title: 'Abandon this attempt?',
      body: 'Are you sure you want to abandon this attempt? Your progress will be lost.',
      confirmLabel: 'Abandon attempt',
      cancelLabel: 'Keep going',
      danger: true,
    });
    if (!ok) return;
    setBusy(attemptId);
    const result = await abandonAttempt(attemptId);
    setBusy(null);
    if (!result.ok) return err('Error abandoning attempt: ' + result.error);
    setAbandonedIds((prev) => new Set(prev).add(attemptId));
    router.refresh();
  }

  // ── a mode section (legacy renderModeSection) ──
  function renderModeSection(quiz: QuizCard, mode: AttemptMode, label: string, avail: Availability, attempts: AttemptWithProgress[]) {
    const modeAttempts = attempts.filter((a) => a.quiz_id === quiz.quiz_id && a.mode === mode);
    const completed = modeAttempts.filter((a) => a.status === 'completed');
    const inProgress = modeAttempts.find((a) => a.status === 'in_progress');

    const attemptCount = completed.length;
    const bestScore = completed.length > 0 ? Math.max(...completed.map((a) => a.score_pct || 0)) : null;
    const lastScore = completed.length > 0 ? completed[0].score_pct : null;
    const key = `${quiz.quiz_id}:${mode}`;
    const isBusy = busy === key;

    let actions: React.ReactNode;
    if (avail === 'UPCOMING') {
      actions = <button type="button" className="btn-start" disabled>Not yet open</button>;
    } else if (avail === 'CLOSED') {
      actions = (
        <>
          <button type="button" className="btn-start" disabled>Closed</button>
          {completed.length > 0 ? (
            <button type="button" className="btn-link" onClick={() => reviewAttempt(completed[0].attempt_id, mode)}>Review last</button>
          ) : null}
        </>
      );
    } else if (inProgress) {
      actions = (
        <>
          <div className="inprogress-bar">
            <span className="dot" />
            In progress — {countAnswered(inProgress)} of {quiz.n} answered
          </div>
          <div className="mode-actions">
            <button type="button" className="btn-start resume" disabled={isBusy} onClick={() => launchQuiz(quiz, mode, 'resume')}>
              ▶ Resume {label.split(' ')[0]}
            </button>
            <button type="button" className="btn-link danger" disabled={busy === inProgress.attempt_id} onClick={() => abandon(inProgress.attempt_id)}>Abandon</button>
          </div>
        </>
      );
    } else if (completed.length > 0) {
      actions = (
        <div className="mode-actions">
          <button type="button" className={`btn-start ${mode === 'instant' ? 'practice' : 'exam'}`} disabled={isBusy} onClick={() => launchQuiz(quiz, mode, 'retake')}>
            🔁 Retake
          </button>
          <button type="button" className="btn-link" onClick={() => reviewAttempt(completed[0].attempt_id, mode)}>Review last</button>
        </div>
      );
    } else {
      actions = (
        <div className="mode-actions">
          <button type="button" className={`btn-start ${mode === 'instant' ? 'practice' : 'exam'}`} disabled={isBusy} onClick={() => launchQuiz(quiz, mode, 'start')}>
            {mode === 'instant' ? '▶ Start Practice' : '🎯 Start Exam'}
          </button>
        </div>
      );
    }

    return (
      <div className="mode-section">
        <div className="mode-section-title">{label}</div>
        <div className="mode-stats">
          <span className="mode-stat">Attempts: <strong>{attemptCount}</strong></span>
          {bestScore !== null ? <span className="mode-stat">Best: <strong>{Math.round(bestScore)}%</strong></span> : null}
          {lastScore !== null && lastScore !== undefined ? <span className="mode-stat">Last: <strong>{Math.round(lastScore)}%</strong></span> : null}
        </div>
        {actions}
      </div>
    );
  }

  // ── a quiz card (legacy renderQuizCard) ──
  function renderQuizCard(quiz: QuizCard, avail: Exclude<Availability, 'HIDDEN'>, attempts: AttemptWithProgress[], now: Date) {
    let scheduleInfo: React.ReactNode = null;
    if (avail === 'UPCOMING' && quiz.publish_at) {
      scheduleInfo = <div className="schedule-info">Opens on {formatDate(quiz.publish_at)}</div>;
    }
    if (avail === 'CLOSED' && quiz.unpublish_at) {
      scheduleInfo = <div className="schedule-info">Closed on {formatDate(quiz.unpublish_at)}</div>;
    }
    if (kind === 'mock' && avail === 'ACTIVE' && quiz.unpublish_at) {
      const closesAt = new Date(quiz.unpublish_at);
      const daysRemaining = Math.max(0, Math.ceil((closesAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      scheduleInfo = <div className="schedule-info">Closes in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</div>;
    }

    const timeLimitSec = quiz.time_limit_sec || quiz.n * 60;
    const timeLimitMin = Math.round(timeLimitSec / 60);

    const showPractice = quiz.allowed_modes === 'BOTH' || quiz.allowed_modes === 'INSTANT_ONLY';
    const showExam = quiz.allowed_modes === 'BOTH' || quiz.allowed_modes === 'TIMED_ONLY';
    const isSingle = !showPractice || !showExam;

    return (
      <div key={quiz.quiz_id} className={`quiz-card ${avail.toLowerCase()}`}>
        <div className="quiz-card-header">
          <div>
            <div className="quiz-card-title">{quiz.title}</div>
            <div className="quiz-card-meta">
              <span className="quiz-meta-item">{quiz.n} questions</span>
              <span className="quiz-meta-item">{timeLimitMin} min</span>
              {quiz.shuffle ? <span className="quiz-meta-item">Shuffled</span> : null}
            </div>
          </div>
          <span className={`avail-badge ${avail}`}>{BADGE[avail]}</span>
        </div>
        {scheduleInfo}
        <div className={`mode-sections ${isSingle ? 'single' : ''}`}>
          {showPractice ? renderModeSection(quiz, 'instant', 'Practice Mode', avail, attempts) : null}
          {showExam ? renderModeSection(quiz, 'timed', 'Exam Mode', avail, attempts) : null}
        </div>
      </div>
    );
  }

  // ── the accordions (legacy renderAccordions) ──
  function renderAccordions() {
    if (!mounted) return <p className="loading-line">Loading…</p>;

    if (!courses.length) {
      return (
        <div className="empty-state">
          <div className="empty-icon">{W.emptyIcon}</div>
          <p>You are not enrolled in any courses yet.</p>
        </div>
      );
    }

    if (kind === 'mock' && !courses.some((c) => (quizzesByCourse[c.course_id] || []).length > 0)) {
      return (
        <div className="empty-state">
          <div className="empty-icon">{W.emptyIcon}</div>
          <p>No mock exams available right now. Mock exams are published during exam periods — check back closer to your exam date.</p>
        </div>
      );
    }

    const now = new Date(serverNow);
    const coursesToShow = activeCourseFilter ? courses.filter((c) => c.course_id === activeCourseFilter) : courses;

    return coursesToShow.map((course) => {
      const quizzes = quizzesByCourse[course.course_id] || [];
      const attempts = attemptsOf(course.course_id);
      const isOpen = openCourses.has(course.course_id);

      let filtered = quizzes
        .map((q) => ({ quiz: q, avail: getQuizAvailability(q, now) }))
        .filter((x): x is { quiz: QuizCard; avail: Exclude<Availability, 'HIDDEN'> } => x.avail !== 'HIDDEN');

      if (statusFilter) filtered = filtered.filter(({ avail }) => avail === statusFilter);
      if (modeFilter) filtered = filtered.filter(({ quiz }) => quiz.allowed_modes === modeFilter);
      if (attemptFilter) filtered = filtered.filter(({ quiz }) => getOverallAttemptState(quiz.quiz_id, attempts) === attemptFilter);

      return (
        <div key={course.course_id} className="accordion">
          <button type="button" className={`accordion-header ${isOpen ? 'open' : ''}`} onClick={() => toggleAccordion(course.course_id)} aria-expanded={isOpen}>
            <div>
              <div className="accordion-title">{course.title}</div>
              <div className="accordion-meta">{course.course_id}</div>
            </div>
            <div className="accordion-right">
              <span className="accordion-count">{W.countNoun(filtered.length)}</span>
              <span className="accordion-arrow">▾</span>
            </div>
          </button>
          <div className={`accordion-body ${isOpen ? 'open' : ''}`}>
            {filtered.length === 0 ? (
              <div className="no-quizzes">{W.noneForCourse}</div>
            ) : (
              filtered.map(({ quiz, avail }) => renderQuizCard(quiz, avail, attempts, now))
            )}
          </div>
        </div>
      );
    });
  }

  return (
    <div className="sqz">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={clearMsg} />
      {confirmDialog}

      {/* Filter chip (shows when ?course= names an enrolled course) */}
      <div className={`filter-chip-bar ${filterCourse ? 'show' : ''}`}>
        Filtering by:
        <span className="filter-chip">
          <span>{filterCourse?.title}</span>
          <button type="button" className="filter-chip-clear" onClick={clearCourseFilter} aria-label="Clear course filter">✕</button>
        </span>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label htmlFor="filterStatus">Status</label>
          <select id="filterStatus" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="">All quizzes</option>
            <option value="ACTIVE">Active</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filterMode">Mode</label>
          <select id="filterMode" value={modeFilter} onChange={(e) => setModeFilter(e.target.value as ModeFilter)}>
            <option value="">All modes</option>
            <option value="INSTANT_ONLY">Practice only</option>
            <option value="TIMED_ONLY">Exam only</option>
            <option value="BOTH">Both</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filterAttemptState">Attempt State</label>
          <select id="filterAttemptState" value={attemptFilter} onChange={(e) => setAttemptFilter(e.target.value as AttemptFilter)}>
            <option value="">All</option>
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="filter-actions">
          <button type="button" className="btn-ghost-sm" onClick={clearFilters}>Clear filters</button>
        </div>
      </div>

      {/* Accordion area */}
      <div>{renderAccordions()}</div>
    </div>
  );
}
