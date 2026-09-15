// app/(app)/student/learning-history/learning-history-client.tsx
//
// The script block of legacy student/learning-history.html (slice 7a):
// the stats bar, the course chip, the six filters, the attempt cards
// twenty at a time with Load more, and Resume / Review / Retake on each
// card. Course, status, mode and the label search go to the database
// (one Server Action per page); the source filter and the sort order
// are applied in the browser over the loaded pages — and the stats bar
// counts the loaded pages, not the whole history — exactly as legacy
// did (carried as is, Sam 2026-09-14; listed under "After the rebuild").
// Any filter or sort change reloads from page 0, as legacy's
// applyFilters did. Retake goes through 5b's action; Resume and Review
// open the runner for the attempt's mode.
//
// The legacy alert() on a failed retake is a toast (UI convention #1).
// The list renders after hydration behind legacy's "Loading your
// history…" line so the dates are formatted with the browser's locale,
// as legacy formatted them.

'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { loadHistoryPage, retakeAttempt } from '@/lib/attempts/actions';
import type { AttemptListRow, AttemptMode, HistoryFilters, HistoryPage } from '@/lib/attempts/types';

type CourseLite = { course_id: string; title: string };

type Props = {
  courses: CourseLite[];
  /** the ?course= pre-filter, already checked against the enrolled courses */
  initialCourseId: string;
  initialPage: HistoryPage;
};

type Msg = { text: string; tone: 'error' | 'success' } | null;
type SortValue = 'newest' | 'oldest' | 'score_high' | 'score_low';

const HISTORY_PATH = '/student/learning-history';

function subscribeNever(): () => void {
  return () => {};
}

function runnerHref(mode: AttemptMode, attemptId: string, review = false): string {
  return `/runner/${mode === 'timed' ? 'timed' : 'instant'}?attempt_id=${encodeURIComponent(attemptId)}${review ? '&review=1' : ''}`;
}

// legacy formatStatus / formatSource — an unknown value shows as it is
function formatStatus(s: string): string {
  if (s === 'in_progress') return 'In Progress';
  if (s === 'completed') return 'Completed';
  if (s === 'abandoned') return 'Abandoned';
  return s;
}

function formatSource(s: string): string {
  if (s === 'fixed') return 'Fixed Quiz';
  if (s === 'builder') return 'Builder';
  if (s === 'retake') return 'Retake';
  return s;
}

// legacy formatDuration — "Xm Ys", "X min" or "Ys"
function formatDuration(secs: number | null): string {
  const t = Number(secs || 0);
  if (!t) return '';
  const m = Math.floor(t / 60);
  const s = t % 60;
  if (m && s) return `${m}m ${s}s`;
  if (m) return `${m} min`;
  return `${s}s`;
}

export function LearningHistoryClient({ courses, initialCourseId, initialPage }: Props) {
  const router = useRouter();

  // false on the server render, true once hydrated — legacy's loading line until then
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  const [msg, setMsg] = useState<Msg>(null);
  const clearMsg = useCallback(() => setMsg(null), []);

  // the four database-side filters
  const [courseId, setCourseId] = useState(initialCourseId);
  const [mode, setMode] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  // the two browser-side ones
  const [source, setSource] = useState('');
  const [sort, setSort] = useState<SortValue>('newest');

  // the loaded pages
  const [attempts, setAttempts] = useState<AttemptListRow[]>(initialPage.attempts);
  const [total, setTotal] = useState(initialPage.total);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(true);
  const [retaking, setRetaking] = useState<string | null>(null);

  const chipCourse = initialCourseId ? courses.find((c) => c.course_id === initialCourseId) : undefined;

  // ── legacy loadAttempts ──
  const requestId = useRef(0);
  async function loadAttempts(filters: HistoryFilters, nextPage: number, append: boolean) {
    const id = ++requestId.current;
    setLoading(true);
    const result = await loadHistoryPage(filters, nextPage);
    if (id !== requestId.current) return; // a newer request has superseded this one
    setTotal(result.total);
    setAttempts((prev) => (append ? prev.concat(result.attempts) : result.attempts));
    setPage(nextPage);
    setLoadedOnce(true);
    setLoading(false);
  }

  // legacy applyFilters — any change reloads from page 0
  function applyFilters(next: Partial<HistoryFilters>) {
    const filters: HistoryFilters = {
      courseId: next.courseId ?? courseId,
      status: next.status ?? status,
      mode: next.mode ?? mode,
      search: (next.search ?? search).trim(),
    };
    void loadAttempts(filters, 0, false);
  }

  // legacy onSearchInput — a 220 ms delay
  const searchTimer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, []);
  function onSearchInput(value: string) {
    setSearch(value);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => applyFilters({ search: value }), 220);
  }

  function loadMore() {
    if (loading) return;
    void loadAttempts({ courseId, status, mode, search: search.trim() }, page + 1, true);
  }

  function clearCourseFilter() {
    router.push(HISTORY_PATH);
  }

  // ── legacy handleRetake ──
  async function handleRetake(a: AttemptListRow) {
    if (retaking) return;
    setRetaking(a.attempt_id);
    const result = await retakeAttempt(a.attempt_id);
    if (!result.ok) {
      setRetaking(null);
      setMsg({ text: `Could not start retake. Please try again. ${result.error || ''}`.trim(), tone: 'error' });
      return;
    }
    router.push(runnerHref(a.mode, result.attemptId));
  }

  // ── legacy renderStats (over the loaded pages) ──
  const completedRows = attempts.filter((a) => a.status === 'completed' && (a.score_total || 0) > 0);
  const statTotal = total || attempts.length;
  const statInstant = attempts.filter((a) => a.mode === 'instant').length;
  const statTimed = attempts.filter((a) => a.mode === 'timed').length;
  let avgPct = '—';
  let bestPct = '—';
  if (completedRows.length) {
    const pcts = completedRows.map((a) => Number(a.score_pct) || 0);
    avgPct = Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length) + '%';
    bestPct = Math.max(...pcts) + '%';
  }

  // ── legacy applyClientFilters ──
  const filtered = attempts
    .filter((a) => !source || a.source === source)
    .sort((a, b) => {
      if (sort === 'oldest') return new Date(a.ts_iso || 0).getTime() - new Date(b.ts_iso || 0).getTime();
      if (sort === 'score_high') return (Number(b.score_pct) || 0) - (Number(a.score_pct) || 0);
      if (sort === 'score_low') return (Number(a.score_pct) || 0) - (Number(b.score_pct) || 0);
      return new Date(b.ts_iso || 0).getTime() - new Date(a.ts_iso || 0).getTime();
    });

  const showLoadMore = filtered.length > 0 && attempts.length < total;

  // ── legacy buildCard ──
  function renderCard(a: AttemptListRow) {
    const isCompleted = a.status === 'completed';
    const isInProgress = a.status === 'in_progress';

    const dateStr = a.ts_iso ? new Date(a.ts_iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const timeStr = a.ts_iso ? new Date(a.ts_iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
    const courseName = courses.find((c) => c.course_id === a.course_id)?.title || a.course_id || '—';
    const title = a.display_label || (a.quiz_id ? 'Fixed Quiz' : 'Custom Quiz');

    let scoreMain: string;
    let scoreSub: string;
    if (isCompleted && (a.score_total || 0) > 0) {
      scoreMain = `${a.score_raw}/${a.score_total} (${Math.round(a.score_pct || 0)}%)`;
      scoreSub = formatDuration(a.time_taken_s);
    } else if (isInProgress) {
      scoreMain = '—';
      scoreSub = 'In progress';
    } else {
      scoreMain = '—';
      scoreSub = 'Abandoned';
    }

    const isRetaking = retaking === a.attempt_id;

    return (
      <div key={a.attempt_id} className="attempt-card">
        <div className="attempt-main">
          <div className="attempt-meta">
            <span className="date">{dateStr}</span>
            {timeStr ? (
              <>
                <span>·</span>
                <span>{timeStr}</span>
              </>
            ) : null}
            <span>·</span>
            <span className="course-name">{courseName}</span>
          </div>
          <div className="attempt-title">{title}</div>
          <div className="chips-row">
            {a.mode ? <span className={`chip mode-${a.mode}`}>{a.mode === 'timed' ? 'Timed' : 'Instant'}</span> : null}
            {a.status ? <span className={`chip status-${a.status}`}>{formatStatus(a.status)}</span> : null}
            {a.source ? <span className={`chip source-${a.source}`}>{formatSource(a.source)}</span> : null}
            {a.n ? <span className="chip">{a.n} Q</span> : null}
          </div>
        </div>

        <div className="attempt-side">
          <div className="score-block">
            <div className={`score-main ${isCompleted ? '' : 'not-done'}`}>{scoreMain}</div>
            <div className="score-sub">{scoreSub}</div>
          </div>
          <div className="attempt-actions">
            <button
              type="button"
              className="act-btn btn-resume"
              disabled={!isInProgress}
              title={isInProgress ? 'Continue this attempt' : 'Only available for in-progress attempts'}
              onClick={() => router.push(runnerHref(a.mode, a.attempt_id))}
            >
              ▶ Resume
            </button>
            <button
              type="button"
              className="act-btn btn-review"
              disabled={!isCompleted}
              title={isCompleted ? 'Review your answers' : 'Complete this attempt first'}
              onClick={() => router.push(runnerHref(a.mode, a.attempt_id, true))}
            >
              👁 Review
            </button>
            <button
              type="button"
              className="act-btn btn-retake"
              disabled={!isCompleted || isRetaking}
              title={isCompleted ? 'Retake with same questions' : 'Complete this attempt first'}
              onClick={() => handleRetake(a)}
            >
              {isRetaking ? '…Starting' : '↩ Retake'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="slh">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={clearMsg} />

      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stat-pill">Total attempts: <strong>{mounted ? statTotal : '—'}</strong></div>
        <div className="stat-pill">Avg score: <strong>{mounted ? avgPct : '—'}</strong></div>
        <div className="stat-pill">Best score: <strong>{mounted ? bestPct : '—'}</strong></div>
        <div className="stat-pill">Instant: <strong>{mounted ? statInstant : '—'}</strong></div>
        <div className="stat-pill">Timed: <strong>{mounted ? statTimed : '—'}</strong></div>
      </div>

      {/* Course filter chip (shows when ?course= is active) */}
      <div className={`filter-chip-bar ${chipCourse ? 'show' : ''}`}>
        Filtering by:
        <span className="filter-chip">
          <span>{chipCourse?.title}</span>
          <button type="button" className="filter-chip-clear" onClick={clearCourseFilter} title="Clear filter" aria-label="Clear filter">✕</button>
        </span>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-field">
          <label htmlFor="courseFilter">Course</label>
          <select id="courseFilter" className="filter-select" value={courseId} onChange={(e) => { setCourseId(e.target.value); applyFilters({ courseId: e.target.value }); }}>
            <option value="">All Courses</option>
            {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.title}</option>)}
          </select>
        </div>
        <div className="toolbar-field">
          <label htmlFor="modeFilter">Mode</label>
          <select id="modeFilter" className="filter-select" value={mode} onChange={(e) => { setMode(e.target.value); applyFilters({ mode: e.target.value }); }}>
            <option value="">All Modes</option>
            <option value="instant">Instant</option>
            <option value="timed">Timed</option>
          </select>
        </div>
        <div className="toolbar-field">
          <label htmlFor="statusFilter">Status</label>
          <select id="statusFilter" className="filter-select" value={status} onChange={(e) => { setStatus(e.target.value); applyFilters({ status: e.target.value }); }}>
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
            <option value="abandoned">Abandoned</option>
          </select>
        </div>
        <div className="toolbar-field">
          <label htmlFor="sourceFilter">Source</label>
          <select id="sourceFilter" className="filter-select" value={source} onChange={(e) => { setSource(e.target.value); applyFilters({}); }}>
            <option value="">All Sources</option>
            <option value="fixed">Fixed Quiz</option>
            <option value="builder">Builder</option>
            <option value="retake">Retake</option>
          </select>
        </div>
        <div className="toolbar-field">
          <label htmlFor="sortFilter">Sort</label>
          <select id="sortFilter" className="filter-select" value={sort} onChange={(e) => { setSort(e.target.value as SortValue); applyFilters({}); }}>
            <option value="newest">Newest → Oldest</option>
            <option value="oldest">Oldest → Newest</option>
            <option value="score_high">Highest Score</option>
            <option value="score_low">Lowest Score</option>
          </select>
        </div>
        <div className="toolbar-field">
          <label htmlFor="searchFilter">Search</label>
          <input id="searchFilter" className="filter-input" type="search" placeholder="Search quiz name…" value={search} onChange={(e) => onSearchInput(e.target.value)} />
        </div>
        <span className="result-count">
          {mounted && loadedOnce ? `Showing ${attempts.length} of ${total} attempt${total !== 1 ? 's' : ''}` : ''}
        </span>
      </div>

      {/* Attempt list */}
      <div className="card list-card">
        <div className="attempt-list">
          {!mounted ? (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <p>Loading your history…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <p>No attempts match your filters.<br />Try adjusting the filters above.</p>
            </div>
          ) : (
            filtered.map(renderCard)
          )}
        </div>

        {/* Load more */}
        <div className={`load-more-wrap ${mounted && showLoadMore ? 'show' : ''}`}>
          <button type="button" className="load-more-btn" disabled={loading} onClick={loadMore}>{loading ? 'Loading…' : 'Load more'}</button>
        </div>
      </div>
    </div>
  );
}
