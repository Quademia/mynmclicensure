// components/quizzes/quiz-manager.tsx
//
// The script block of legacy admin/fixed-quizzes.html and
// admin/mock-exams.html (slice 5a) — one script twice, forty lines apart,
// so one component with a `kind`. Four panes on one page: the list
// (filters, table, Published toggle), the details form, the question
// picker, the review and save; a breadcrumb across the top that walks
// back. The words that differ by page are in WORDS below; the mock page
// also loads its list whole (the fixed list is fifty at a time with a
// database search), shows a Schedule column, puts Scheduling before the
// settings with a helper line, and makes its ids differently.
//
// Messages are toasts (UI convention #1) where legacy used the inline
// .alert boxes; Archive / Restore asks in the app's own dialog with
// legacy's words (DS4, 2026-09-22 — the native box went with UI
// convention #2's 2026-09-21 change).
//
// Not here, by rebuild.md §12 (slice 5): the Preview button — it never
// worked (§9 #16). The attempt-stats box on the details step (edit mode
// only: Total Attempts, Completed, Avg Score) arrived with slice 5b,
// once `attempts` existed; it loads after the row, as legacy's did.
//
// One legacy defect not carried (logged, not in §9): the fixed-quiz list
// held only the list columns, so opening a quiz from it lost its
// questions, time limit, schedule and notes. The edit step here reads
// the full row (lib/quizzes/actions loadQuiz) for both pages.

'use client';
import { useConfirm } from '@/lib/overlays/shared/confirm-dialog';

import { useCallback, useEffect, useState } from 'react';
import { Toast } from '@/lib/toast/toast';
import {
  loadPickerItems,
  loadQuiz,
  loadQuizAttemptStats,
  loadQuizPage,
  saveQuiz,
  setQuizPublished,
  setQuizStatus,
} from '@/lib/quizzes/actions';
import type { QuizAttemptStats } from '@/lib/attempts/types';
import {
  MODE_LABELS,
  MODE_OPTIONS,
  QUIZ_STATUSES,
  type AllowedModes,
  type QuizKind,
  type QuizListRow,
  type QuizStatus,
} from '@/lib/quizzes/types';
import { DIFFICULTIES, type Item } from '@/lib/bank/types';
import type { Course } from '@/lib/catalogue/types';

type Msg = { text: string; tone: 'error' | 'success' } | null;

// The fixed list carries the list columns only; the mock list is whole.
type ListRow = QuizListRow;

type Pane = 1 | 2 | 3 | 4;

type Form = {
  courseId: string;
  title: string;
  modes: AllowedModes;
  status: QuizStatus;
  timeLimit: string;
  shuffle: boolean;
  published: boolean;
  notes: string;
  publishAt: string;
  unpublishAt: string;
};

const EMPTY_FORM: Form = {
  courseId: '',
  title: '',
  modes: 'BOTH',
  status: 'draft',
  timeLimit: '',
  shuffle: false,
  published: false,
  notes: '',
  publishAt: '',
  unpublishAt: '',
};

const ID_PLACEHOLDER = 'Will be generated when you select a course';

// The strings that differ between the two legacy pages.
const WORDS = {
  fixed: {
    crumb: 'Quizzes',
    newLabel: 'New Quiz',
    editFallback: 'Edit Quiz',
    searchPlaceholder: 'Title or Quiz ID…',
    newButton: '+ New Quiz',
    tableTitle: 'All Quizzes',
    tableCol: 'Quiz',
    empty: 'No quizzes found. Click ',
    idLabel: 'Quiz ID',
    titleLabel: 'Quiz Title *',
    titlePlaceholder: 'e.g. General Paper Practice Quiz 1',
    backToList: '← Back to Quizzes',
    reviewDetails: 'Quiz Details',
    reviewItems: 'Questions in this Quiz',
    saveButton: '💾 Save Quiz',
    noun: 'quiz',
    Noun: 'Quiz',
    confirmArchive: 'Archive this quiz?',
    confirmRestore: 'Restore this quiz?',
  },
  mock: {
    crumb: 'Mock Exams',
    newLabel: 'New Mock Exam',
    editFallback: 'Edit Mock Exam',
    searchPlaceholder: 'Title or Exam ID…',
    newButton: '+ New Mock Exam',
    tableTitle: 'All Mock Exams',
    tableCol: 'Mock Exam',
    empty: 'No mock exams found. Click ',
    idLabel: 'Mock Exam ID',
    titleLabel: 'Mock Exam Title *',
    titlePlaceholder: 'e.g. Mock Exam — Paper 1 March 2026',
    backToList: '← Back to Mock Exams',
    reviewDetails: 'Mock Exam Details',
    reviewItems: 'Questions in this Mock Exam',
    saveButton: '💾 Save Mock Exam',
    noun: 'mock exam',
    Noun: 'Mock exam',
    confirmArchive: 'Archive this mock exam?',
    confirmRestore: 'Restore this mock exam?',
  },
} as const;

// legacy onCourseChange — the id is made in the browser when the course
// is picked, before anything is saved.
function makeQuizId(kind: QuizKind, courseId: string): string {
  if (kind === 'fixed') return courseId + '_Q' + Date.now().toString().slice(-8);
  return 'MOCK_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// legacy formatSchedule — the mock list's Schedule column.
function formatSchedule(q: ListRow): string {
  if (!q.publish_at && !q.unpublish_at) return 'Not scheduled';
  const fmt = (d: string) => {
    const dt = new Date(d);
    return `${dt.getDate()} ${dt.toLocaleString('en-GB', { month: 'short' })}`;
  };
  if (q.publish_at && q.unpublish_at) return `${fmt(q.publish_at)} — ${fmt(q.unpublish_at)}`;
  if (q.publish_at) return `From ${fmt(q.publish_at)}`;
  return `Until ${fmt(q.unpublish_at!)}`;
}

function quizzesWord(n: number, kind: QuizKind): string {
  return kind === 'fixed' ? `quiz${n !== 1 ? 'zes' : ''}` : `mock exam${n !== 1 ? 's' : ''}`;
}

export function QuizManager({
  kind,
  courses,
  initialRows,
  initialTotal,
}: {
  kind: QuizKind;
  courses: Course[];
  initialRows: ListRow[];
  initialTotal: number;
}) {
  const W = WORDS[kind];
  const [msg, setMsg] = useState<Msg>(null);
  const dismiss = useCallback(() => setMsg(null), []);
  const err = (text: string) => setMsg({ text, tone: 'error' });
  const ok = (text: string) => setMsg({ text, tone: 'success' });

  const [pane, setPane] = useState<Pane>(1);

  // ── pane 1: the list ──
  const [rows, setRows] = useState<ListRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [currentSearch, setCurrentSearch] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [fCourse, setFCourse] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fMode, setFMode] = useState('');
  const [fPublished, setFPublished] = useState('');

  // One page from the database (legacy loadQuizList) for both kinds —
  // legacy loaded the mock table whole; since Q2 (D45 f) it pages too.
  const reloadList = useCallback(
    async (term: string, pageIndex: number, append: boolean) => {
      setListLoading(true);
      const result = await loadQuizPage(kind, term, pageIndex);
      setTotal(result.total);
      setRows((prev) => (append ? prev.concat(result.quizzes) : result.quizzes));
      setListLoading(false);
    },
    [kind],
  );

  // legacy applyQuizFilters: the title / id search hits the database after
  // a 300 ms pause; the other filters run in the browser over the loaded page.
  useEffect(() => {
    const term = search.trim();
    if (term === currentSearch) return;
    const id = window.setTimeout(() => {
      setCurrentSearch(term);
      setPage(0);
      void reloadList(term, 0, false);
    }, 300);
    return () => window.clearTimeout(id);
  }, [search, currentSearch, reloadList]);

  const displayed = rows.filter((r) => {
    if (fCourse && r.course_id !== fCourse) return false;
    if (fStatus && r.status !== fStatus) return false;
    if (fMode && r.allowed_modes !== fMode) return false;
    if (fPublished !== '' && String(r.published) !== fPublished) return false;
    return true;
  });

  const resultCount = `Showing ${displayed.length} of ${total} ${quizzesWord(total, kind)}`;

  function clearListFilters() {
    setSearch('');
    setFCourse('');
    setFStatus('');
    setFMode('');
    setFPublished('');
    setCurrentSearch('');
    setPage(0);
    void reloadList('', 0, false);
  }

  function loadMore() {
    const next = page + 1;
    setPage(next);
    void reloadList(currentSearch, next, true);
  }

  async function togglePublish(quizId: string, published: boolean) {
    setRows((prev) => prev.map((r) => (r.quiz_id === quizId ? { ...r, published } : r)));
    const result = await setQuizPublished(kind, quizId, published);
    if (!result.ok) {
      setRows((prev) => prev.map((r) => (r.quiz_id === quizId ? { ...r, published: !published } : r)));
      err(result.error);
    }
  }

  // ── pane 2: the details ──
  const [isEdit, setIsEdit] = useState(false);
  const [currentQuizId, setCurrentQuizId] = useState<string | null>(null);
  const [generatedId, setGeneratedId] = useState<string | null>(null);
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentStatus, setCurrentStatus] = useState<QuizStatus>('draft');
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [opening, setOpening] = useState<string | null>(null);
  const [stats, setStats] = useState<QuizAttemptStats | null>(null);

  function setField<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // ── pane 3: the picker ──
  const [pickerAll, setPickerAll] = useState<Item[]>([]);
  const [pickerCourse, setPickerCourse] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [selected, setSelected] = useState<Item[]>([]);
  const [pMaintopic, setPMaintopic] = useState('');
  const [pSubtopic, setPSubtopic] = useState('');
  const [pDifficulty, setPDifficulty] = useState('');
  const [pType, setPType] = useState('');
  const [pBatch, setPBatch] = useState('');
  const [pKeyword, setPKeyword] = useState('');

  const selectedIds = new Set(selected.map((i) => i.item_id));

  async function fetchPicker(courseId: string): Promise<Item[]> {
    setPickerLoading(true);
    const items = await loadPickerItems(courseId);
    setPickerAll(items);
    setPickerCourse(courseId);
    setPickerLoading(false);
    return items;
  }

  function clearPickerFilters() {
    setPMaintopic('');
    setPSubtopic('');
    setPDifficulty('');
    setPType('');
    setPBatch('');
    setPKeyword('');
  }

  // ── navigation ──
  function goToPane(n: Pane) {
    setPane(n);
    window.scrollTo(0, 0);
  }

  const quizLabel = isEdit ? currentTitle || W.editFallback : W.newLabel;
  const crumbs: { label: string; pane: Pane }[] = [{ label: W.crumb, pane: 1 }];
  if (pane >= 2) crumbs.push({ label: quizLabel, pane: 2 });
  if (pane >= 3) crumbs.push({ label: 'Pick Questions', pane: 3 });
  if (pane >= 4) crumbs.push({ label: 'Review & Save', pane: 4 });

  // legacy startNewQuiz
  function startNew() {
    setIsEdit(false);
    setCurrentQuizId(null);
    setGeneratedId(null);
    setCurrentTitle('');
    setCurrentStatus('draft');
    setSelected([]);
    setPickerAll([]);
    setPickerCourse('');
    setForm(EMPTY_FORM);
    setStats(null);
    goToPane(2);
  }

  // legacy openEditQuiz — the full row, then the picker pre-loaded and
  // pre-selected with the quiz's ids in their order.
  async function openEdit(quizId: string) {
    if (opening) return;
    setOpening(quizId);
    const quiz = await loadQuiz(kind, quizId);
    if (!quiz) {
      setOpening(null);
      return err(`Could not load this ${W.noun}. Please try again.`);
    }
    setIsEdit(true);
    setCurrentQuizId(quizId);
    setGeneratedId(quizId);
    setCurrentTitle(quiz.title);
    setCurrentStatus(quiz.status);
    setForm({
      courseId: quiz.course_id,
      title: quiz.title,
      modes: quiz.allowed_modes,
      status: quiz.status,
      timeLimit: quiz.time_limit_sec ? String(quiz.time_limit_sec) : '',
      shuffle: quiz.shuffle,
      published: quiz.published,
      notes: quiz.notes || '',
      publishAt: quiz.publish_at ? quiz.publish_at.slice(0, 16) : '',
      unpublishAt: quiz.unpublish_at ? quiz.unpublish_at.slice(0, 16) : '',
    });

    // legacy: the attempt stats, then the picker pre-loaded
    setStats(null);
    const [quizStats, items] = await Promise.all([loadQuizAttemptStats(kind, quizId), fetchPicker(quiz.course_id)]);
    setStats(quizStats);
    const byId = new Map(items.map((i) => [i.item_id, i]));
    setSelected((quiz.item_ids || []).map((id) => byId.get(id)).filter((i): i is Item => Boolean(i)));
    setOpening(null);
    goToPane(2);
  }

  // legacy onCourseChange
  function onCourseChange(courseId: string) {
    setField('courseId', courseId);
    if (!courseId) {
      setGeneratedId(null);
      return;
    }
    if (!isEdit) {
      setGeneratedId(makeQuizId(kind, courseId));
      setPickerAll([]);
      setPickerCourse('');
      setSelected([]);
    }
  }

  // legacy validateDetailsAndNext
  async function validateDetailsAndNext() {
    const courseId = form.courseId;
    const title = form.title.trim();
    if (!courseId) return err('Please select a course.');
    if (!title) return err(`Please enter a ${W.noun} title.`);
    if (!generatedId) return err(`${W.idLabel} could not be generated. Please re-select the course.`);

    if (pickerCourse !== courseId) await fetchPicker(courseId);
    clearPickerFilters();
    goToPane(3);
  }

  // legacy archiveCurrentQuiz toggled archived ↔ active, so a restored
  // draft came back active (D45 c). Since Q2: archive from any status,
  // restore lands on draft — active is chosen on the form and saved.
  // Behind a confirm carrying legacy's words, in the app's dialog (DS4).
  const [confirm, confirmDialog] = useConfirm();
  async function archiveOrRestore() {
    if (!currentQuizId) return;
    const newStatus: QuizStatus = currentStatus === 'archived' ? 'draft' : 'archived';
    const goOn = await confirm({
      title: newStatus === 'archived' ? W.confirmArchive : W.confirmRestore,
      confirmLabel: newStatus === 'archived' ? 'Archive' : 'Restore',
    });
    if (!goOn) return;
    const result = await setQuizStatus(kind, currentQuizId, newStatus);
    if (!result.ok) return err(result.error);
    setCurrentStatus(newStatus);
    setField('status', newStatus);
    setRows((prev) => prev.map((r) => (r.quiz_id === currentQuizId ? { ...r, status: newStatus } : r)));
    ok(newStatus === 'archived' ? `${W.Noun} archived successfully.` : `${W.Noun} restored as a draft. Set it Active and save to publish it again.`);
  }

  // ── the picker's filters, in the browser (legacy applyPickerFilters) ──
  const maintopics = [...new Set(pickerAll.map((i) => i.maintopic).filter(Boolean) as string[])].sort();
  const batches = [...new Set(pickerAll.map((i) => i.batch_id).filter(Boolean) as string[])].sort();
  const subtopics = [
    ...new Set(pickerAll.filter((i) => !pMaintopic || i.maintopic === pMaintopic).map((i) => i.subtopic).filter(Boolean) as string[]),
  ].sort();

  const pkw = pKeyword.toLowerCase().trim();
  const pickerFiltered = pickerAll.filter((i) => {
    if (pMaintopic && i.maintopic !== pMaintopic) return false;
    if (pSubtopic && i.subtopic !== pSubtopic) return false;
    if (pDifficulty && i.difficulty !== pDifficulty) return false;
    if (pType && i.question_type !== pType) return false;
    if (pBatch && i.batch_id !== pBatch) return false;
    if (pkw && !JSON.stringify(i).toLowerCase().includes(pkw)) return false;
    return true;
  });

  function toggleItem(item: Item) {
    setSelected((prev) => (prev.some((i) => i.item_id === item.item_id) ? prev.filter((i) => i.item_id !== item.item_id) : [...prev, item]));
  }

  function removeSelected(itemId: string) {
    setSelected((prev) => prev.filter((i) => i.item_id !== itemId));
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const have = new Set(prev.map((i) => i.item_id));
      return [...prev, ...pickerFiltered.filter((i) => !have.has(i.item_id))];
    });
  }

  function validatePickerAndNext() {
    if (selected.length === 0) return err('Please select at least one question before continuing.');
    goToPane(4);
  }

  // legacy removeFromReview
  function removeFromReview(itemId: string) {
    const remaining = selected.filter((i) => i.item_id !== itemId);
    setSelected(remaining);
    if (remaining.length === 0) err('You have removed all questions. Please go back and select at least one.');
  }

  // ── save (legacy saveQuiz) ──
  const [saving, setSaving] = useState(false);

  async function save() {
    if (selected.length === 0) return err(`Cannot save a ${W.noun} with no questions.`);
    if (!generatedId) return err(`${W.idLabel} could not be generated. Please re-select the course.`);

    setSaving(true);
    const result = await saveQuiz({
      kind,
      isEdit,
      quizId: generatedId,
      courseId: form.courseId,
      title: form.title,
      allowedModes: form.modes,
      status: form.status,
      published: form.published,
      shuffle: form.shuffle,
      timeLimitSec: form.timeLimit,
      publishAt: form.publishAt,
      unpublishAt: form.unpublishAt,
      notes: form.notes,
      itemIds: selected.map((i) => i.item_id),
    });
    setSaving(false);
    if (!result.ok) return err(result.error);

    ok(isEdit ? `${W.Noun} updated successfully.` : `${W.Noun} created successfully.`);
    setCurrentTitle(form.title.trim());
    setPage(0);
    await reloadList(currentSearch, 0, false);
    // legacy: back to the list after a short pause.
    window.setTimeout(() => goToPane(1), 1400);
  }

  const courseTitle = (id: string) => courses.find((c) => c.course_id === id)?.title || id;
  const timeLimitText = form.timeLimit
    ? `${form.timeLimit} seconds (${Math.round(Number(form.timeLimit) / 60)} min)`
    : 'Auto — 1 min per question';

  // ── the details form's Scheduling section (placed differently per page) ──
  const scheduling = (
    <>
      <div className="form-section-title">{kind === 'mock' ? 'Scheduling' : 'Scheduling (Optional)'}</div>
      {kind === 'mock' ? (
        <div className="schedule-helper">Mock exams should have both publish and unpublish dates to create a timed exam window.</div>
      ) : null}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="fieldPublishAt">Publish At</label>
          <input id="fieldPublishAt" type="datetime-local" value={form.publishAt} onChange={(e) => setField('publishAt', e.target.value)} />
          <p className="form-hint">Leave blank to publish manually.</p>
        </div>
        <div className="form-group">
          <label htmlFor="fieldUnpublishAt">Unpublish At</label>
          <input id="fieldUnpublishAt" type="datetime-local" value={form.unpublishAt} onChange={(e) => setField('unpublishAt', e.target.value)} />
          <p className="form-hint">Leave blank to keep open indefinitely.</p>
        </div>
      </div>
    </>
  );

  return (
    <div className="qm">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />
      {confirmDialog}

      {/* Breadcrumb */}
      <div className="breadcrumb">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return last ? (
            <span key={c.pane} className="current">{c.label}</span>
          ) : (
            <span key={c.pane} className="crumb-group">
              <span onClick={() => goToPane(c.pane)}>{c.label}</span>
              <span className="sep"> ›</span>
            </span>
          );
        })}
      </div>

      {/* ══ PANE 1: LIST ══ */}
      {pane === 1 ? (
        <div className="pane">
          <div className="filters-bar">
            <div className="filter-group">
              <label htmlFor="qFilterSearch">Search</label>
              <input id="qFilterSearch" type="text" placeholder={W.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="filter-group">
              <label htmlFor="qFilterCourse">Course</label>
              <select id="qFilterCourse" value={fCourse} onChange={(e) => setFCourse(e.target.value)}>
                <option value="">All courses</option>
                {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.title}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="qFilterStatus">Status</label>
              <select id="qFilterStatus" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="qFilterMode">Mode</label>
              <select id="qFilterMode" value={fMode} onChange={(e) => setFMode(e.target.value)}>
                <option value="">All modes</option>
                <option value="BOTH">Both</option>
                <option value="INSTANT_ONLY">Practice only</option>
                <option value="TIMED_ONLY">Exam only</option>
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="qFilterPublished">Published</label>
              <select id="qFilterPublished" value={fPublished} onChange={(e) => setFPublished(e.target.value)}>
                <option value="">All</option>
                <option value="true">Published</option>
                <option value="false">Unpublished</option>
              </select>
            </div>
            <div className="filter-actions">
              <button type="button" className="btn btn-ghost" onClick={clearListFilters}>Clear</button>
              <button type="button" className="btn btn-primary" onClick={startNew}>{W.newButton}</button>
            </div>
          </div>

          <div className="table-wrapper">
            <div className="table-header">
              <h3>{W.tableTitle}</h3>
              <span className="result-count">{listLoading && rows.length === 0 ? 'Loading…' : resultCount}</span>
            </div>
            {displayed.length === 0 ? (
              <div className="empty-state">
                {listLoading ? `Loading ${quizzesWord(2, kind)}…` : <>{W.empty}<strong>{W.newButton}</strong> to create one.</>}
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{W.tableCol}</th>
                      <th>Course</th>
                      <th>Modes</th>
                      <th>Questions</th>
                      {kind === 'mock' ? <th>Schedule</th> : null}
                      <th>Status</th>
                      <th>Published</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((r) => (
                      <tr key={r.quiz_id} className={r.status === 'archived' ? 'archived-row' : ''} onClick={() => openEdit(r.quiz_id)}>
                        <td>
                          <div className="row-title">{opening === r.quiz_id ? 'Opening…' : r.title}</div>
                          <div className="row-id">{r.quiz_id}</div>
                        </td>
                        <td>{courseTitle(r.course_id)}</td>
                        <td><span className={`chip ${r.allowed_modes}`}>{MODE_LABELS[r.allowed_modes] || r.allowed_modes}</span></td>
                        <td className="row-n">{r.n}</td>
                        {kind === 'mock' ? <td className="row-schedule">{formatSchedule(r)}</td> : null}
                        <td><span className={`chip ${r.status}`}>{r.status}</span></td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <label className="toggle">
                            <input type="checkbox" checked={r.published} onChange={(e) => togglePublish(r.quiz_id, e.target.checked)} />
                            <span className="toggle-slider" />
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {rows.length < total ? (
            <div className="load-more-wrap">
              <button type="button" className="btn btn-ghost" disabled={listLoading} onClick={loadMore}>Load More</button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ══ PANE 2: DETAILS ══ */}
      {pane === 2 ? (
        <div className="pane">
          <div className="pane-card">
            <div className="form-group">
              <label>{W.idLabel}</label>
              <div className="quiz-id-display">{generatedId || ID_PLACEHOLDER}</div>
              <p className="form-hint">Auto-generated. Cannot be changed.</p>
            </div>

            <div className="form-section-title">Basic Info</div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fieldCourse">Course *</label>
                <select id="fieldCourse" value={form.courseId} onChange={(e) => onCourseChange(e.target.value)}>
                  <option value="">Select course…</option>
                  {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.title} ({c.course_id})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="fieldTitle">{W.titleLabel}</label>
                <input id="fieldTitle" type="text" placeholder={W.titlePlaceholder} value={form.title} onChange={(e) => setField('title', e.target.value)} />
              </div>
            </div>

            {kind === 'mock' ? scheduling : null}

            <div className="form-section-title">Quiz Settings</div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fieldModes">Allowed Modes</label>
                <select id="fieldModes" value={form.modes} onChange={(e) => setField('modes', e.target.value as AllowedModes)}>
                  {MODE_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="fieldStatus">Status</label>
                <select id="fieldStatus" value={form.status} onChange={(e) => setField('status', e.target.value as QuizStatus)}>
                  {QUIZ_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fieldTimeLimit">Time Limit (seconds)</label>
                <input id="fieldTimeLimit" type="number" min={60} placeholder="Leave blank = 1 min per question" value={form.timeLimit} onChange={(e) => setField('timeLimit', e.target.value)} />
                <p className="form-hint">e.g. 3600 = 1 hour. Leave blank for auto.</p>
              </div>
              <div className="form-group">
                <label className="check-label">
                  <input type="checkbox" checked={form.shuffle} onChange={(e) => setField('shuffle', e.target.checked)} />
                  Shuffle question order
                </label>
                <p className="form-hint after-check">Questions appear in random order for each student.</p>
              </div>
            </div>

            {kind === 'fixed' ? scheduling : null}

            <div className="form-section-title">Other</div>
            <div className="form-group">
              <label htmlFor="fieldNotes">Notes (admin only)</label>
              <textarea id="fieldNotes" placeholder="Internal notes. Students never see this." value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="check-label">
                <input type="checkbox" checked={form.published} onChange={(e) => setField('published', e.target.checked)} />
                Published — visible to students
              </label>
            </div>

            {/* Attempt stats (edit mode only) */}
            {isEdit && stats ? (
              <div>
                <div className="form-section-title">Attempt Stats</div>
                <div className="stats-row">
                  <div className="stat-box"><div className="stat-val">{stats.total}</div><div className="stat-lbl">Total Attempts</div></div>
                  <div className="stat-box"><div className="stat-val">{stats.firstSittings}</div><div className="stat-lbl">First Sittings</div></div>
                  <div className="stat-box"><div className="stat-val">{stats.retakes}</div><div className="stat-lbl">Retakes</div></div>
                  <div className="stat-box"><div className="stat-val">{stats.completed}</div><div className="stat-lbl">Completed</div></div>
                  <div className="stat-box"><div className="stat-val">{stats.abandoned}</div><div className="stat-lbl">Abandoned</div></div>
                  <div className="stat-box"><div className="stat-val">{stats.completed > 0 ? `${stats.avgScore}%` : '—'}</div><div className="stat-lbl">Avg Score</div></div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="pane-actions">
            <button type="button" className="btn btn-ghost" onClick={() => goToPane(1)}>{W.backToList}</button>
            <div className="spacer" />
            {isEdit ? (
              <button type="button" className="btn btn-ghost" onClick={archiveOrRestore}>{currentStatus === 'archived' ? 'Restore' : 'Archive'}</button>
            ) : null}
            <button type="button" className="btn btn-primary" disabled={pickerLoading} onClick={validateDetailsAndNext}>
              {pickerLoading ? 'Loading questions…' : 'Next: Pick Questions →'}
            </button>
          </div>
        </div>
      ) : null}

      {/* ══ PANE 3: QUESTION PICKER ══ */}
      {pane === 3 ? (
        <div className="pane">
          <div className="picker-layout">
            <div className="picker-left">
              <div className="picker-filters">
                <select aria-label="Topic" value={pMaintopic} onChange={(e) => { setPMaintopic(e.target.value); setPSubtopic(''); }}>
                  <option value="">All topics</option>
                  {maintopics.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <select aria-label="Subtopic" value={pSubtopic} onChange={(e) => setPSubtopic(e.target.value)}>
                  <option value="">All subtopics</option>
                  {subtopics.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select aria-label="Difficulty" value={pDifficulty} onChange={(e) => setPDifficulty(e.target.value)}>
                  <option value="">All difficulties</option>
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select aria-label="Type" value={pType} onChange={(e) => setPType(e.target.value)}>
                  <option value="">All types</option>
                  <option value="MCQ">MCQ</option>
                  <option value="TF">True/False</option>
                  <option value="SATA">SATA</option>
                </select>
                <select aria-label="Batch" value={pBatch} onChange={(e) => setPBatch(e.target.value)}>
                  <option value="">All batches</option>
                  {batches.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <input type="text" placeholder="Keyword search…" value={pKeyword} onChange={(e) => setPKeyword(e.target.value)} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearPickerFilters}>Clear</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={selectAllVisible}>+ Select all visible</button>
              </div>

              <div className="picker-table-wrap">
                <div className="picker-table-scroll">
                  <table className="picker-table">
                    <thead>
                      <tr>
                        <th className="col-check"></th>
                        <th>ID</th>
                        <th>Type</th>
                        <th>Stem</th>
                        <th>Topic</th>
                        <th>Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pickerLoading ? (
                        <tr><td colSpan={6} className="picker-empty">Loading questions…</td></tr>
                      ) : pickerFiltered.length === 0 ? (
                        <tr><td colSpan={6} className="picker-empty">No questions match your filters.</td></tr>
                      ) : (
                        pickerFiltered.map((i) => {
                          const sel = selectedIds.has(i.item_id);
                          return (
                            <tr key={i.item_id} className={sel ? 'selected-row' : ''} onClick={() => toggleItem(i)}>
                              <td><input type="checkbox" checked={sel} onClick={(e) => e.stopPropagation()} onChange={() => toggleItem(i)} /></td>
                              <td className="mono">{i.item_id}</td>
                              <td><span className="chip plain">{i.question_type}</span></td>
                              <td><span className="item-stem-short" title={i.stem}>{i.stem}</span></td>
                              <td className="muted">{i.maintopic || '—'}</td>
                              <td><span className="chip plain">{i.difficulty || '—'}</span></td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="picker-footer">
                  <span>Showing <strong>{pickerFiltered.length}</strong> questions</span>
                  <span className="selected-count">{selected.length} selected</span>
                </div>
              </div>
            </div>

            <div className="picker-right">
              <div className="picker-right-header">
                <h4>Selected Questions</h4>
                <span className="selected-count">{selected.length}</span>
              </div>
              <div className="picker-right-body">
                {selected.length === 0 ? (
                  <p className="picker-right-empty">Tick questions from the list to add them here.</p>
                ) : (
                  selected.map((i) => (
                    <div key={i.item_id} className="sel-item">
                      <span className="sel-item-id">{i.item_id}</span>
                      <span className="sel-item-stem" title={i.stem}>{i.stem}</span>
                      <button type="button" className="sel-item-remove" title="Remove" onClick={() => removeSelected(i.item_id)}>×</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="pane-actions">
            <button type="button" className="btn btn-ghost" onClick={() => goToPane(2)}>← Back to Details</button>
            <div className="spacer" />
            <button type="button" className="btn btn-primary" onClick={validatePickerAndNext}>Next: Review &amp; Save →</button>
          </div>
        </div>
      ) : null}

      {/* ══ PANE 4: REVIEW & SAVE ══ */}
      {pane === 4 ? (
        <div className="pane">
          <div className="review-grid">
            <div className="review-card">
              <h4>{W.reviewDetails}</h4>
              <div className="detail-row"><span className="detail-label">{W.idLabel}</span><span className="detail-value mono">{generatedId}</span></div>
              <div className="detail-row"><span className="detail-label">Title</span><span className="detail-value">{form.title}</span></div>
              <div className="detail-row"><span className="detail-label">Course</span><span className="detail-value">{courseTitle(form.courseId)}</span></div>
              <div className="detail-row"><span className="detail-label">Questions</span><span className="detail-value">{selected.length}</span></div>
              {form.notes.trim() ? (
                <div className="detail-row"><span className="detail-label">Notes</span><span className="detail-value">{form.notes.trim()}</span></div>
              ) : null}
            </div>
            <div className="review-card">
              <h4>Settings</h4>
              <div className="detail-row"><span className="detail-label">Allowed Modes</span><span className="detail-value">{MODE_LABELS[form.modes]}</span></div>
              <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value"><span className={`chip ${form.status}`}>{form.status}</span></span></div>
              <div className="detail-row"><span className="detail-label">Published</span><span className="detail-value">{form.published ? 'Yes' : 'No'}</span></div>
              <div className="detail-row"><span className="detail-label">Shuffle</span><span className="detail-value">{form.shuffle ? 'Yes — randomised per attempt' : 'No — fixed order'}</span></div>
              <div className="detail-row"><span className="detail-label">Time Limit</span><span className="detail-value">{timeLimitText}</span></div>
            </div>
          </div>

          <div className="review-items-card">
            <div className="review-items-header">
              <h4>{W.reviewItems}</h4>
              <span className="result-count">{selected.length} questions</span>
            </div>
            <div>
              {selected.map((item, idx) => (
                <div key={item.item_id} className="review-item-row">
                  <span className="review-item-num">{idx + 1}.</span>
                  <span className="review-item-id">{item.item_id}</span>
                  <span className="review-item-stem">{item.stem}</span>
                  <span className="chip plain">{item.question_type}</span>
                  <button type="button" className="review-item-remove" title="Remove" onClick={() => removeFromReview(item.item_id)}>×</button>
                </div>
              ))}
            </div>
          </div>

          <div className="pane-actions">
            <button type="button" className="btn btn-ghost" onClick={() => goToPane(3)}>← Back to Questions</button>
            <div className="spacer" />
            <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : W.saveButton}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
