// app/(app)/admin/attempts/attempts-client.tsx
//
// The script block of legacy admin/attempts.html (slice 14b): the four
// headline counts; the analytics window (Today / 7d / 30d / All time /
// a custom From–To, the bounds computed on the admin's clock as legacy
// did) loading up to 5,000 rows newest first with the cap note; the
// window summary (attempts, completed, average score, pass rate at 70%
// — legacy's PASS_PCT, its own comment says "confirm with product");
// the breakdowns by type and by status; the per-day strip of the last
// 30 days present in the window; the top ten quizzes and students; the
// table filtered (search, type, status, mode, course) and paged 50 at a
// time in the browser over the loaded window; and the detail modal
// reading the full attempt. Everything below the window is computed
// over the loaded rows, as legacy computed it.
//
// Changed on the way: the student comes joined with each row (legacy
// fetched the window's users in a second call); the modal is portalled
// to <body>; the per-day bar height is the fixed 116px legacy settled on
// after its own fix (production, "attempts per-day graph fix").

'use client';

import { useEffect, useRef, useState } from 'react';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { attemptDetailAction, attemptsWindowAction, headlineCountsAction, type HeadlineCounts } from '@/lib/attempts/admin-actions';
import type { WindowAttemptRow } from '@/lib/attempts/admin-queries';
import type { AttemptDetail } from '@/lib/attempts/types';

const PASS_PCT = 70;
const PAGE_SIZE = 50;
const DAY_MS = 86400000;
const CHART_PX = 116;

type Preset = 'today' | '7d' | '30d' | 'all' | 'custom';
type Filters = { search: string; type: string; status: string; mode: string; course: string };
const EMPTY_FILTERS: Filters = { search: '', type: '', status: '', mode: '', course: '' };

const TYPES: { key: string; label: string }[] = [
  { key: 'mock', label: 'Mock exam' },
  { key: 'fixed', label: 'Fixed quiz' },
  { key: 'builder', label: 'Practice' },
  { key: 'retake', label: 'Retake' },
];
const STATUSES: { key: string; label: string }[] = [
  { key: 'completed', label: 'Completed' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'abandoned', label: 'Abandoned' },
];

function typeLabel(src: string): string {
  return ({ mock: 'Mock exam', fixed: 'Fixed quiz', builder: 'Practice', retake: 'Retake' } as Record<string, string>)[src] || src;
}
function statusLabel(s: string): string {
  return ({ completed: 'Completed', in_progress: 'In progress', abandoned: 'Abandoned' } as Record<string, string>)[s] || s;
}
function fmtNum(n: number | null | undefined): string {
  return (n || 0).toLocaleString('en-GB');
}
function fmtDuration(s: number | null | undefined): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function isoNDaysAgo(n: number): string {
  return new Date(Date.now() - n * DAY_MS).toISOString();
}

type StudentBits = WindowAttemptRow['users'];
function studentName(u: StudentBits, uid: string): string {
  if (!u) return uid || '—';
  return u.name || `${u.forename || ''} ${u.surname || ''}`.trim() || u.email || uid;
}
function studentEmail(u: StudentBits): string {
  return u?.email || '';
}

export function AttemptsClient({ courses, quizTitles }: { courses: { course_id: string; title: string }[]; quizTitles: Record<string, string> }) {
  const courseMap: Record<string, string> = {};
  for (const c of courses) courseMap[c.course_id] = c.title;

  function quizTitle(a: { quiz_id: string | null; display_label: string | null; source: string }): string {
    if (a.quiz_id && quizTitles[a.quiz_id]) return quizTitles[a.quiz_id];
    if (a.display_label) return a.display_label;
    return a.source === 'builder' ? 'Practice (custom)' : a.quiz_id || '—';
  }

  // ── headline counts ──
  const [kpi, setKpi] = useState<HeadlineCounts | null>(null);

  // ── the window ──
  const [preset, setPreset] = useState<Preset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [windowLabel, setWindowLabel] = useState('Last 30 days');
  const [rows, setRows] = useState<WindowAttemptRow[]>([]);
  const [capped, setCapped] = useState(false);
  const [loading, setLoading] = useState(true);
  const loadSeq = useRef(0);

  // ── the table ──
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const tableRef = useRef<HTMLDivElement | null>(null);

  // ── the modal ──
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<AttemptDetail | null | 'loading' | 'failed'>(null);
  const [detailStudent, setDetailStudent] = useState<StudentBits>(null);

  function windowFor(p: Preset, from: string, to: string): { fromIso: string | null; toIso: string | null; label: string } {
    if (p === 'today') return { fromIso: startOfTodayIso(), toIso: null, label: 'Today' };
    if (p === '7d') return { fromIso: isoNDaysAgo(7), toIso: null, label: 'Last 7 days' };
    if (p === '30d') return { fromIso: isoNDaysAgo(30), toIso: null, label: 'Last 30 days' };
    if (p === 'all') return { fromIso: null, toIso: null, label: 'All time' };
    const fromIso = from ? new Date(from + 'T00:00:00').toISOString() : null;
    // include the whole "to" day → exclusive upper bound = next midnight
    const toIso = to ? new Date(new Date(to + 'T00:00:00').getTime() + DAY_MS).toISOString() : null;
    return { fromIso, toIso, label: (from || '…') + ' → ' + (to || 'now') };
  }

  async function loadWindow(p: Preset, from: string, to: string) {
    const win = windowFor(p, from, to);
    const seq = ++loadSeq.current;
    setWindowLabel(win.label);
    setLoading(true);
    try {
      const result = await attemptsWindowAction(win.fromIso, win.toIso);
      if (seq !== loadSeq.current) return;
      setRows(result.attempts);
      setCapped(result.capped);
      setPage(0);
    } catch (err) {
      console.error('loadWindow:', err);
      if (seq === loadSeq.current) {
        setRows([]);
        setCapped(false);
      }
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }

  async function loadHeadline() {
    try {
      setKpi(await headlineCountsAction(startOfTodayIso(), isoNDaysAgo(7), isoNDaysAgo(30)));
    } catch (err) {
      console.error('loadHeadlineKpis:', err);
    }
  }

  // initPage: the counts and the default window, after mount (the
  // bounds come from the admin's clock).
  useEffect(() => {
    const id = window.setTimeout(() => {
      loadHeadline();
      loadWindow('30d', '', '');
    }, 0);
    return () => window.clearTimeout(id);
    // Runs once, as the legacy init did.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choosePreset(p: Exclude<Preset, 'custom'>) {
    setPreset(p);
    setCustomFrom('');
    setCustomTo('');
    loadWindow(p, '', '');
  }

  function chooseCustom(from: string, to: string) {
    setCustomFrom(from);
    setCustomTo(to);
    if (!from && !to) return;
    setPreset('custom');
    loadWindow('custom', from, to);
  }

  // ── summary ──
  const total = rows.length;
  const completed = rows.filter((a) => a.status === 'completed');
  const avg = completed.length ? Math.round(completed.reduce((s, a) => s + (Number(a.score_pct) || 0), 0) / completed.length) : null;
  const passed = completed.filter((a) => (Number(a.score_pct) || 0) >= PASS_PCT).length;
  const passRate = completed.length ? Math.round((passed / completed.length) * 100) : null;

  // ── breakdowns ──
  const denom = rows.length || 1;
  const typeLines = TYPES.map((t) => {
    const n = rows.filter((a) => a.source === t.key).length;
    return { ...t, n, pct: Math.round((n / denom) * 100) };
  });
  const statusLines = STATUSES.map((s) => {
    const n = rows.filter((a) => a.status === s.key).length;
    return { ...s, n, pct: Math.round((n / denom) * 100) };
  });

  // ── per-day trend (the last 30 days present in the window) ──
  const byDay: Record<string, number> = {};
  for (const a of rows) {
    if (!a.ts_iso) continue;
    const d = new Date(a.ts_iso);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    byDay[key] = (byDay[key] || 0) + 1;
  }
  const days = Object.keys(byDay).sort().slice(-30);
  const dayMax = days.length ? Math.max(...days.map((d) => byDay[d])) : 0;

  // ── top lists ──
  const quizCounts: Record<string, { count: number; sample: WindowAttemptRow }> = {};
  for (const a of rows) {
    const key = a.quiz_id || 'label::' + (a.display_label || 'Practice / custom');
    if (!quizCounts[key]) quizCounts[key] = { count: 0, sample: a };
    quizCounts[key].count++;
  }
  const topQuizzes = Object.entries(quizCounts).sort((x, y) => y[1].count - x[1].count).slice(0, 10);

  const studentCounts: Record<string, { count: number; sample: WindowAttemptRow }> = {};
  for (const a of rows) {
    if (!studentCounts[a.user_id]) studentCounts[a.user_id] = { count: 0, sample: a };
    studentCounts[a.user_id].count++;
  }
  const topStudents = Object.entries(studentCounts).sort((x, y) => y[1].count - x[1].count).slice(0, 10);

  // ── the table (filtered + paged in the browser) ──
  const q = filters.search.toLowerCase().trim();
  const filtered = rows.filter((a) => {
    if (filters.type && a.source !== filters.type) return false;
    if (filters.status && a.status !== filters.status) return false;
    if (filters.mode && a.mode !== filters.mode) return false;
    if (filters.course && a.course_id !== filters.course) return false;
    if (q) {
      const hay = (studentName(a.users, a.user_id) + ' ' + studentEmail(a.users) + ' ' + quizTitle(a)).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function applyFilter(patch: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  }

  function changePage(d: number) {
    setPage((p) => Math.max(0, Math.min(pages - 1, p + d)));
    const top = tableRef.current?.offsetTop ?? 0;
    window.scrollTo({ top: top - 20, behavior: 'smooth' });
  }

  // ── the modal ──
  async function openDetail(row: WindowAttemptRow) {
    setModalOpen(true);
    setDetail('loading');
    setDetailStudent(row.users);
    const a = await attemptDetailAction(row.attempt_id);
    setDetail(a ?? 'failed');
  }

  function closeDetail() {
    setModalOpen(false);
  }

  let answerCount: string | number = '—';
  let detailScore = '—';
  if (detail && typeof detail === 'object') {
    answerCount = detail.answered_count;
    if (detail.status === 'completed' && detail.score_pct != null) {
      detailScore = `${detail.score_raw ?? '—'} / ${detail.score_total ?? '—'} (${Math.round(detail.score_pct)}%)`;
    }
  }

  return (
    <div className="att">
      {/* Headline KPIs */}
      <div className="kpi-row">
        <div className="kpi accent"><div className="kpi-val">{kpi ? fmtNum(kpi.total) : '…'}</div><div className="kpi-lbl">Total attempts (all time)</div></div>
        <div className="kpi"><div className="kpi-val">{kpi ? fmtNum(kpi.today) : '…'}</div><div className="kpi-lbl">Today</div></div>
        <div className="kpi"><div className="kpi-val">{kpi ? fmtNum(kpi.week) : '…'}</div><div className="kpi-lbl">Last 7 days</div></div>
        <div className="kpi"><div className="kpi-val">{kpi ? fmtNum(kpi.month) : '…'}</div><div className="kpi-lbl">Last 30 days</div></div>
      </div>

      {/* Period selector */}
      <div className="section-title">Analytics window</div>
      <div className="period-bar">
        <div className="preset-group">
          {(['today', '7d', '30d', 'all'] as const).map((p) => (
            <button key={p} type="button" className={preset === p ? 'active' : ''} onClick={() => choosePreset(p)}>
              {p === 'today' ? 'Today' : p === '7d' ? 'Last 7 days' : p === '30d' ? 'Last 30 days' : 'All time'}
            </button>
          ))}
        </div>
        <div className="period-field">
          <label htmlFor="customFrom">From</label>
          <input type="date" id="customFrom" value={customFrom} onChange={(e) => chooseCustom(e.target.value, customTo)} />
        </div>
        <div className="period-field">
          <label htmlFor="customTo">To</label>
          <input type="date" id="customTo" value={customTo} onChange={(e) => chooseCustom(customFrom, e.target.value)} />
        </div>
        <div className="period-note">Showing: <strong>{windowLabel}</strong></div>
      </div>

      {/* Window summary */}
      <div className="kpi-row">
        <div className="kpi"><div className="kpi-val">{loading ? '…' : fmtNum(total)}</div><div className="kpi-lbl">Attempts in window</div></div>
        <div className="kpi"><div className="kpi-val">{loading ? '…' : fmtNum(completed.length)}</div><div className="kpi-lbl">Completed</div></div>
        <div className="kpi"><div className="kpi-val">{loading ? '…' : avg == null ? '—' : avg + '%'}</div><div className="kpi-lbl">Avg score (completed)</div></div>
        <div className="kpi"><div className="kpi-val">{loading ? '…' : passRate == null ? '—' : passRate + '%'}</div><div className="kpi-lbl">Pass rate (≥{PASS_PCT}%)</div></div>
      </div>

      {/* Breakdowns */}
      <div className="section-title">Breakdown</div>
      <div className="break-row">
        <div className="break-card">
          <h4>By type</h4>
          {typeLines.map((t) => (
            <div key={t.key} className="break-line">
              <span className="bl-label">{t.label}</span>
              <span className="bl-bar"><span className={`bl-fill ${t.key}`} style={{ width: `${t.pct}%` }} /></span>
              <span className="bl-num">{fmtNum(t.n)}</span>
            </div>
          ))}
        </div>
        <div className="break-card">
          <h4>By status</h4>
          {statusLines.map((s) => (
            <div key={s.key} className="break-line">
              <span className="bl-label">{s.label}</span>
              <span className="bl-bar"><span className={`bl-fill ${s.key}`} style={{ width: `${s.pct}%` }} /></span>
              <span className="bl-num">{fmtNum(s.n)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trend */}
      <div className="section-title">Attempts per day</div>
      <div className="trend-card">
        <div className="trend-bars">
          {days.length === 0 ? (
            <div className="trend-empty">{loading ? 'Loading…' : 'No attempts in this window.'}</div>
          ) : (
            days.map((d) => {
              const n = byDay[d];
              const h = Math.max(3, Math.round((n / dayMax) * CHART_PX));
              return (
                <div key={d} className="trend-day" title={`${d}: ${n} attempt${n !== 1 ? 's' : ''}`}>
                  <div className="td-bar" style={{ height: `${h}px` }} />
                  <div className="td-lbl">{d.slice(5)}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Top lists */}
      <div className="section-title">Most active</div>
      <div className="top-row">
        <div className="top-card">
          <h4>Top quizzes &amp; exams</h4>
          {topQuizzes.length === 0 ? (
            <div className="empty-state small">No data.</div>
          ) : (
            topQuizzes.map(([key, v], i) => (
              <div key={key} className="top-item">
                <span className="ti-rank">{i + 1}</span>
                <span className="ti-name" title={quizTitle(v.sample)}>
                  {quizTitle(v.sample)} <span className="ti-sub">· {typeLabel(v.sample.source)}</span>
                </span>
                <span className="ti-count">{fmtNum(v.count)}</span>
              </div>
            ))
          )}
        </div>
        <div className="top-card">
          <h4>Top students</h4>
          {topStudents.length === 0 ? (
            <div className="empty-state small">No data.</div>
          ) : (
            topStudents.map(([uid, v], i) => (
              <div key={uid} className="top-item">
                <span className="ti-rank">{i + 1}</span>
                <span className="ti-name" title={studentEmail(v.sample.users)}>{studentName(v.sample.users, uid)}</span>
                <span className="ti-count">{fmtNum(v.count)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Attempts table */}
      <div className="section-title">All attempts in window</div>

      <div className="filters-bar">
        <div className="filter-group">
          <label htmlFor="fSearch">Search student / quiz</label>
          <input type="text" id="fSearch" placeholder="Name, email or title…" value={filters.search} onChange={(e) => applyFilter({ search: e.target.value })} />
        </div>
        <div className="filter-group">
          <label htmlFor="fType">Type</label>
          <select id="fType" value={filters.type} onChange={(e) => applyFilter({ type: e.target.value })}>
            <option value="">All types</option>
            <option value="mock">Mock exam</option>
            <option value="fixed">Fixed quiz</option>
            <option value="builder">Practice</option>
            <option value="retake">Retake</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="fStatus">Status</label>
          <select id="fStatus" value={filters.status} onChange={(e) => applyFilter({ status: e.target.value })}>
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In progress</option>
            <option value="abandoned">Abandoned</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="fMode">Mode</label>
          <select id="fMode" value={filters.mode} onChange={(e) => applyFilter({ mode: e.target.value })}>
            <option value="">All modes</option>
            <option value="instant">Practice (instant)</option>
            <option value="timed">Exam (timed)</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="fCourse">Course</label>
          <select id="fCourse" value={filters.course} onChange={(e) => applyFilter({ course: e.target.value })}>
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.course_id} value={c.course_id}>{c.title}</option>
            ))}
          </select>
        </div>
        <div className="filter-actions">
          <button type="button" className="btn btn-ghost" onClick={() => applyFilter({ ...EMPTY_FILTERS })}>Clear</button>
        </div>
      </div>

      {capped ? <div className="cap-note">Showing the most recent 5,000 attempts for this window. Narrow the dates for a complete view.</div> : null}

      <div className="table-wrapper" ref={tableRef}>
        <div className="table-header">
          <h3>Attempts</h3>
          <span className="result-count">{loading ? 'Loading…' : `${fmtNum(filtered.length)} attempt${filtered.length !== 1 ? 's' : ''}`}</span>
        </div>
        {loading ? (
          <div className="empty-state">Loading attempts…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No attempts match your filters.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Student</th><th>Type</th><th>Quiz / exam</th><th>Course</th>
                  <th>Mode</th><th>Status</th><th>Score</th><th>Qs</th><th>Time</th><th>When</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((a) => (
                  <tr key={a.attempt_id} onClick={() => openDetail(a)}>
                    <td>
                      <div className="st-name">{studentName(a.users, a.user_id)}</div>
                      <div className="st-email">{studentEmail(a.users)}</div>
                    </td>
                    <td><span className={`chip ${a.source}`}>{typeLabel(a.source)}</span></td>
                    <td>{quizTitle(a)}</td>
                    <td className="cell-muted">{courseMap[a.course_id] || a.course_id}</td>
                    <td className="cell-12">{a.mode === 'timed' ? 'Exam' : 'Practice'}</td>
                    <td><span className={`chip ${a.status}`}>{statusLabel(a.status)}</span></td>
                    <td className="cell-bold">{a.status === 'completed' && a.score_pct != null ? Math.round(a.score_pct) + '%' : '—'}</td>
                    <td>{a.n ?? '—'}</td>
                    <td className="cell-muted">{fmtDuration(a.time_taken_s)}</td>
                    <td className="cell-muted">{fmtDateTime(a.ts_iso)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && pages > 1 ? (
          <div className="pager">
            <button type="button" className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => changePage(-1)}>← Prev</button>
            <span>Page {page + 1} of {pages}</span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages - 1} onClick={() => changePage(1)}>Next →</button>
          </div>
        ) : null}
      </div>

      <BodyPortal>
        <div className="att-overlay">
          <div
            className={`modal-overlay${modalOpen ? ' show' : ''}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeDetail();
            }}
          >
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="attemptDetailTitle">
              <div className="modal-head">
                <h3 id="attemptDetailTitle">Attempt detail</h3>
                <button type="button" className="modal-close" onClick={closeDetail}>×</button>
              </div>
              <div className="modal-body">
                {detail === 'loading' ? (
                  <div className="empty-state">Loading…</div>
                ) : detail === 'failed' || detail === null ? (
                  <div className="empty-state">Could not load this attempt.</div>
                ) : (
                  <>
                    <div className="detail-row"><span className="detail-label">Student</span><span className="detail-value">{studentName(detailStudent, detail.user_id)}</span></div>
                    <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value">{studentEmail(detailStudent)}</span></div>
                    <div className="detail-row"><span className="detail-label">Type</span><span className="detail-value">{typeLabel(detail.source)}</span></div>
                    <div className="detail-row"><span className="detail-label">Quiz / exam</span><span className="detail-value">{quizTitle(detail)}</span></div>
                    <div className="detail-row"><span className="detail-label">Course</span><span className="detail-value">{courseMap[detail.course_id] || detail.course_id}</span></div>
                    <div className="detail-row"><span className="detail-label">Mode</span><span className="detail-value">{detail.mode === 'timed' ? 'Exam (timed)' : 'Practice (instant)'}</span></div>
                    <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value">{statusLabel(detail.status)}</span></div>
                    <div className="detail-row"><span className="detail-label">Score</span><span className="detail-value">{detailScore}</span></div>
                    <div className="detail-row"><span className="detail-label">Questions</span><span className="detail-value">{detail.n ?? '—'}</span></div>
                    <div className="detail-row"><span className="detail-label">Answers recorded</span><span className="detail-value">{answerCount}</span></div>
                    <div className="detail-row"><span className="detail-label">Time taken</span><span className="detail-value">{fmtDuration(detail.time_taken_s)}</span></div>
                    <div className="detail-row"><span className="detail-label">Time allowed</span><span className="detail-value">{detail.duration_min ? detail.duration_min + ' min' : '—'}</span></div>
                    <div className="detail-row"><span className="detail-label">Started</span><span className="detail-value">{fmtDateTime(detail.ts_iso)}</span></div>
                    {detail.origin_attempt_id ? <div className="detail-row"><span className="detail-label">Retake of</span><span className="detail-value">{detail.origin_attempt_id}</span></div> : null}
                    <div className="detail-row"><span className="detail-label">Attempt ID</span><span className="detail-value">{detail.attempt_id}</span></div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </BodyPortal>
    </div>
  );
}
