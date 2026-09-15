// app/(app)/admin/courses/courses-client.tsx
//
// The script block of legacy admin/courses.html: two tabs. Programmes —
// a search, a table with the course count per programme and a "View
// courses →" jump, a side panel, a New / Edit modal. Courses — stats,
// three filters, a table, a side panel with Archive / Restore (no
// confirm step, as legacy), a New / Edit modal with the programme-scope
// checklist. Errors and "done" messages are toasts (UI convention #1).

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { saveCourse, saveProgram, setCourseStatus } from '@/lib/catalogue/actions';
import { COURSE_STATUSES, type Course, type CourseStatus, type Program } from '@/lib/catalogue/types';

type Msg = { text: string; tone: 'error' | 'success' } | null;
type Tab = 'programmes' | 'courses';
type Panel = { kind: 'prog'; id: string } | { kind: 'course'; id: string } | null;

const STATUS_LABEL: Record<CourseStatus, string> = { active: 'Active', draft: 'Draft', archived: 'Archived' };

export function CoursesClient({ courses, programs }: { courses: Course[]; programs: Program[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const dismiss = useCallback(() => setMsg(null), []);
  const [tab, setTab] = useState<Tab>('programmes');

  const programName = (id: string) => programs.find((p) => p.program_id === id)?.program_name ?? id;
  const coursesOf = (progId: string) => courses.filter((c) => c.program_scope && c.program_scope.includes(progId));

  // ── shared side panel ──
  const [panel, setPanel] = useState<Panel>(null);
  const closePanel = () => setPanel(null);
  const panelProg = panel?.kind === 'prog' ? programs.find((p) => p.program_id === panel.id) ?? null : null;
  const panelCourse = panel?.kind === 'course' ? courses.find((c) => c.course_id === panel.id) ?? null : null;
  const panelOpen = !!(panelProg || panelCourse);

  // ════ PROGRAMMES ════
  const [pSearch, setPSearch] = useState('');
  const pq = pSearch.toLowerCase().trim();
  const progFiltered = programs.filter(
    (p) => !pq || p.program_name.toLowerCase().includes(pq) || p.program_id.toLowerCase().includes(pq),
  );

  const [progModal, setProgModal] = useState(false);
  const [editingProgId, setEditingProgId] = useState<string | null>(null);
  const [progForm, setProgForm] = useState({ progId: '', name: '' });
  const [progSaving, setProgSaving] = useState(false);

  function openNewProgModal() {
    setEditingProgId(null);
    setProgForm({ progId: '', name: '' });
    setProgModal(true);
  }
  function openEditProgModal(progId: string) {
    const p = programs.find((x) => x.program_id === progId);
    if (!p) return;
    setEditingProgId(progId);
    setProgForm({ progId, name: p.program_name });
    setProgModal(true);
  }
  async function submitProgramme() {
    const isNew = !editingProgId;
    if (isNew && !progForm.progId.trim()) return setMsg({ text: 'Programme ID is required.', tone: 'error' });
    if (!progForm.name.trim()) return setMsg({ text: 'Programme name is required.', tone: 'error' });
    setProgSaving(true);
    const result = await saveProgram({ isNew, programId: isNew ? progForm.progId : editingProgId!, name: progForm.name });
    setProgSaving(false);
    if (!result.ok) return setMsg({ text: result.error, tone: 'error' });
    setMsg({ text: `✅ Programme ${isNew ? 'created' : 'updated'} successfully.`, tone: 'success' });
    setProgModal(false);
    closePanel();
    router.refresh();
  }

  // ════ COURSES ════
  const [cSearch, setCSearch] = useState('');
  const [cStatus, setCStatus] = useState('');
  const [cProg, setCProg] = useState('');
  const cq = cSearch.toLowerCase().trim();
  const courseFiltered = courses.filter((c) => {
    if (cq && !c.title.toLowerCase().includes(cq) && !c.course_id.toLowerCase().includes(cq)) return false;
    if (cStatus && c.status !== cStatus) return false;
    if (cProg && !(c.program_scope || []).includes(cProg)) return false;
    return true;
  });
  function clearCourseFilters() {
    setCSearch('');
    setCStatus('');
    setCProg('');
  }
  // The "View courses →" jump from the programmes tab.
  function filterCoursesByProg(progId: string) {
    setTab('courses');
    setCProg(progId);
  }

  const [courseModal, setCourseModal] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState<{ courseId: string; title: string; status: CourseStatus; slug: string; scope: string[] }>({
    courseId: '',
    title: '',
    status: 'active',
    slug: '',
    scope: [],
  });
  const [courseSaving, setCourseSaving] = useState(false);

  function openNewCourseModal() {
    setEditingCourseId(null);
    setCourseForm({ courseId: '', title: '', status: 'active', slug: '', scope: [] });
    setCourseModal(true);
  }
  function openEditCourseModal(courseId: string) {
    const c = courses.find((x) => x.course_id === courseId);
    if (!c) return;
    setEditingCourseId(courseId);
    setCourseForm({ courseId, title: c.title || '', status: c.status || 'active', slug: c.page_slug || '', scope: c.program_scope || [] });
    setCourseModal(true);
  }
  function toggleProg(progId: string) {
    setCourseForm((f) => ({ ...f, scope: f.scope.includes(progId) ? f.scope.filter((p) => p !== progId) : [...f.scope, progId] }));
  }
  function selectAllProgs() {
    setCourseForm((f) => ({ ...f, scope: programs.map((p) => p.program_id) }));
  }
  async function submitCourse() {
    const isNew = !editingCourseId;
    if (isNew && !courseForm.courseId.trim()) return setMsg({ text: 'Course ID is required.', tone: 'error' });
    if (!courseForm.title.trim()) return setMsg({ text: 'Course title is required.', tone: 'error' });
    setCourseSaving(true);
    const result = await saveCourse({
      isNew,
      courseId: isNew ? courseForm.courseId : editingCourseId!,
      title: courseForm.title,
      status: courseForm.status,
      pageSlug: courseForm.slug,
      programScope: courseForm.scope,
    });
    setCourseSaving(false);
    if (!result.ok) return setMsg({ text: result.error, tone: 'error' });
    setMsg({ text: `✅ Course ${isNew ? 'created' : 'updated'} successfully.`, tone: 'success' });
    setCourseModal(false);
    closePanel();
    router.refresh();
  }
  async function updateCourseStatus(courseId: string, status: CourseStatus) {
    const result = await setCourseStatus(courseId, status);
    if (!result.ok) return setMsg({ text: result.error, tone: 'error' });
    closePanel();
    router.refresh();
  }

  return (
    <div className="cat">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />

      {/* Tabs */}
      <div className="tabs">
        <button type="button" className={`tab-btn${tab === 'programmes' ? ' active' : ''}`} onClick={() => setTab('programmes')}>🎓 Programmes</button>
        <button type="button" className={`tab-btn${tab === 'courses' ? ' active' : ''}`} onClick={() => setTab('courses')}>📚 Courses</button>
      </div>

      {/* ══ PROGRAMMES TAB ══ */}
      <div className={`tab-content${tab === 'programmes' ? ' active' : ''}`}>
        <div className="stats-row">
          <div className="stat-mini"><div className="label">Total</div><div className="value">{programs.length}</div></div>
        </div>

        <div className="filters-bar">
          <div className="filter-group">
            <label htmlFor="pFilterSearch">Search</label>
            <input id="pFilterSearch" type="text" placeholder="Programme name or ID…" value={pSearch} onChange={(e) => setPSearch(e.target.value)} />
          </div>
          <div className="filter-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setPSearch('')}>Clear</button>
            <button type="button" className="btn btn-primary" onClick={openNewProgModal}>+ New Programme</button>
          </div>
        </div>

        <div className="table-wrapper">
          <div className="table-header">
            <h3>All Programmes</h3>
            <span className="result-count">{progFiltered.length} programme{progFiltered.length !== 1 ? 's' : ''}</span>
          </div>
          {progFiltered.length === 0 ? (
            <div className="empty-state"><p>No programmes found.</p></div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Programme</th>
                    <th>Courses</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {progFiltered.map((p) => {
                    const n = coursesOf(p.program_id).length;
                    return (
                      <tr key={p.program_id} onClick={() => setPanel({ kind: 'prog', id: p.program_id })}>
                        <td>
                          <div className="row-title">{p.program_name}</div>
                          <div className="row-id">{p.program_id}</div>
                        </td>
                        <td className="cell-13">{n} course{n !== 1 ? 's' : ''}</td>
                        <td>
                          <button
                            type="button"
                            className="link-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              filterCoursesByProg(p.program_id);
                            }}
                          >
                            View courses →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ══ COURSES TAB ══ */}
      <div className={`tab-content${tab === 'courses' ? ' active' : ''}`}>
        <div className="stats-row">
          <div className="stat-mini"><div className="label">Total</div><div className="value">{courses.length}</div></div>
          <div className="stat-mini"><div className="label">Active</div><div className="value success">{courses.filter((c) => c.status === 'active').length}</div></div>
          <div className="stat-mini"><div className="label">Draft</div><div className="value warning">{courses.filter((c) => c.status === 'draft').length}</div></div>
          <div className="stat-mini"><div className="label">Archived</div><div className="value muted">{courses.filter((c) => c.status === 'archived').length}</div></div>
        </div>

        <div className="filters-bar">
          <div className="filter-group">
            <label htmlFor="cFilterSearch">Search</label>
            <input id="cFilterSearch" type="text" placeholder="Course title or ID…" value={cSearch} onChange={(e) => setCSearch(e.target.value)} />
          </div>
          <div className="filter-group">
            <label htmlFor="cFilterStatus">Status</label>
            <select id="cFilterStatus" value={cStatus} onChange={(e) => setCStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="cFilterProg">Programme Scope</label>
            <select id="cFilterProg" value={cProg} onChange={(e) => setCProg(e.target.value)}>
              <option value="">All programmes</option>
              {programs.map((p) => (
                <option key={p.program_id} value={p.program_id}>{p.program_name}</option>
              ))}
            </select>
          </div>
          <div className="filter-actions">
            <button type="button" className="btn btn-ghost" onClick={clearCourseFilters}>Clear</button>
            <button type="button" className="btn btn-primary" onClick={openNewCourseModal}>+ New Course</button>
          </div>
        </div>

        <div className="table-wrapper">
          <div className="table-header">
            <h3>All Courses</h3>
            <span className="result-count">{courseFiltered.length} course{courseFiltered.length !== 1 ? 's' : ''}</span>
          </div>
          {courseFiltered.length === 0 ? (
            <div className="empty-state"><p>No courses match your filters.</p></div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Programme Scope</th>
                    <th>Status</th>
                    <th>Slug</th>
                  </tr>
                </thead>
                <tbody>
                  {courseFiltered.map((c) => (
                    <tr key={c.course_id} className={c.status === 'archived' ? 'archived-row' : ''} onClick={() => setPanel({ kind: 'course', id: c.course_id })}>
                      <td>
                        <div className="row-title">{c.title}</div>
                        <div className="row-id">{c.course_id}</div>
                      </td>
                      <td>
                        {(c.program_scope || []).length
                          ? (c.program_scope || []).map((p) => <span key={p} className="prog-tag">{p}</span>)
                          : <span className="cell-muted">None</span>}
                      </td>
                      <td><span className={`chip ${c.status}`}>{c.status}</span></td>
                      <td className="cell-mono">{c.page_slug || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <BodyPortal>
        <div className="cat-overlay">
          {/* Shared side panel */}
          <div className={`overlay${panelOpen ? ' show' : ''}`} onClick={closePanel} />
          <div className={`side-panel narrow${panelOpen ? ' open' : ''}`} aria-hidden={!panelOpen}>
            {panelProg && (
              <>
                <div className="panel-header">
                  <h3>{panelProg.program_name}</h3>
                  <button type="button" className="panel-close" onClick={closePanel}>×</button>
                </div>
                <div className="panel-body">
                  <div className="detail-section">
                    <h4>Programme Info</h4>
                    <div className="detail-row"><span className="key">Programme ID</span><span className="val mono">{panelProg.program_id}</span></div>
                    <div className="detail-row"><span className="key">Name</span><span className="val">{panelProg.program_name}</span></div>
                  </div>
                  <div className="detail-section">
                    <h4>Courses in this Programme ({coursesOf(panelProg.program_id).length})</h4>
                    {coursesOf(panelProg.program_id).length ? (
                      coursesOf(panelProg.program_id).map((c) => (
                        <div key={c.course_id} className="detail-course-line">
                          <span>{c.title}</span>
                          <span className={`chip ${c.status}`}>{c.status}</span>
                        </div>
                      ))
                    ) : (
                      <p className="detail-empty">No courses assigned yet.</p>
                    )}
                  </div>
                </div>
                <div className="panel-actions">
                  <button type="button" className="btn btn-ghost" onClick={closePanel}>Close</button>
                  <button type="button" className="btn btn-primary" onClick={() => openEditProgModal(panelProg.program_id)}>✏️ Edit</button>
                </div>
              </>
            )}
            {panelCourse && (
              <>
                <div className="panel-header">
                  <h3>{panelCourse.title}</h3>
                  <button type="button" className="panel-close" onClick={closePanel}>×</button>
                </div>
                <div className="panel-body">
                  <div className="detail-section">
                    <h4>Course Info</h4>
                    <div className="detail-row"><span className="key">Course ID</span><span className="val mono">{panelCourse.course_id}</span></div>
                    <div className="detail-row"><span className="key">Title</span><span className="val">{panelCourse.title}</span></div>
                    <div className="detail-row"><span className="key">Status</span><span className="val"><span className={`chip ${panelCourse.status}`}>{panelCourse.status}</span></span></div>
                    <div className="detail-row"><span className="key">Page Slug</span><span className="val mono">{panelCourse.page_slug || '—'}</span></div>
                  </div>
                  <div className="detail-section">
                    <h4>Programme Scope</h4>
                    <div className="detail-tags">
                      {(panelCourse.program_scope || []).length
                        ? (panelCourse.program_scope || []).map((p) => <span key={p} className="prog-tag">{programName(p)}</span>)
                        : <span className="detail-empty">None</span>}
                    </div>
                  </div>
                </div>
                <div className="panel-actions">
                  <button type="button" className="btn btn-ghost" onClick={closePanel}>Close</button>
                  <button type="button" className="btn btn-primary" onClick={() => openEditCourseModal(panelCourse.course_id)}>✏️ Edit</button>
                  {panelCourse.status !== 'archived' ? (
                    <button type="button" className="btn btn-warning" onClick={() => updateCourseStatus(panelCourse.course_id, 'archived')}>Archive</button>
                  ) : (
                    <button type="button" className="btn btn-success" onClick={() => updateCourseStatus(panelCourse.course_id, 'active')}>Restore</button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ══ PROGRAMME MODAL ══ */}
          <div className={`modal-overlay${progModal ? ' show' : ''}`}>
            <div className="modal modal-520" role="dialog" aria-modal="true" aria-labelledby="progModalTitle">
              <div className="modal-header">
                <h3 id="progModalTitle">{editingProgId ? 'Edit Programme' : 'New Programme'}</h3>
                <button type="button" className="panel-close" onClick={() => setProgModal(false)}>×</button>
              </div>
              <div className="modal-body">
                {!editingProgId && (
                  <div className="form-group">
                    <label htmlFor="fieldProgId">Programme ID *</label>
                    <input
                      id="fieldProgId"
                      type="text"
                      className="upper"
                      placeholder="e.g. RN"
                      value={progForm.progId}
                      onChange={(e) => setProgForm({ ...progForm, progId: e.target.value.toUpperCase().replace(/\s/g, '') })}
                    />
                    <p className="form-hint">Short code. No spaces. Cannot be changed after creation.</p>
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="fieldProgName">Programme Name *</label>
                  <input id="fieldProgName" type="text" placeholder="e.g. Registered Nursing" value={progForm.name} onChange={(e) => setProgForm({ ...progForm, name: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setProgModal(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={progSaving} onClick={submitProgramme}>
                  {progSaving ? 'Saving…' : editingProgId ? 'Save Changes' : 'Save Programme'}
                </button>
              </div>
            </div>
          </div>

          {/* ══ COURSE MODAL ══ */}
          <div className={`modal-overlay${courseModal ? ' show' : ''}`}>
            <div className="modal modal-520" role="dialog" aria-modal="true" aria-labelledby="courseModalTitle">
              <div className="modal-header">
                <h3 id="courseModalTitle">{editingCourseId ? 'Edit Course' : 'New Course'}</h3>
                <button type="button" className="panel-close" onClick={() => setCourseModal(false)}>×</button>
              </div>
              <div className="modal-body">
                {!editingCourseId && (
                  <div className="form-group">
                    <label htmlFor="fieldCourseId">Course ID *</label>
                    <input
                      id="fieldCourseId"
                      type="text"
                      className="upper"
                      placeholder="e.g. RN_EMERGENCY"
                      value={courseForm.courseId}
                      onChange={(e) => setCourseForm({ ...courseForm, courseId: e.target.value.toUpperCase().replace(/\s/g, '_') })}
                    />
                    <p className="form-hint">Unique code. Use underscores. Cannot be changed after creation.</p>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="fieldCourseTitle">Course Title *</label>
                  <input id="fieldCourseTitle" type="text" placeholder="e.g. Emergency Nursing" value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="fieldCourseStatus">Status *</label>
                    <select id="fieldCourseStatus" value={courseForm.status} onChange={(e) => setCourseForm({ ...courseForm, status: e.target.value as CourseStatus })}>
                      {COURSE_STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="fieldCourseSlug">Page Slug</label>
                    <input id="fieldCourseSlug" type="text" placeholder="e.g. emergency-nursing" value={courseForm.slug} onChange={(e) => setCourseForm({ ...courseForm, slug: e.target.value })} />
                    <p className="form-hint">Optional. URL-friendly name.</p>
                  </div>
                </div>

                <div className="form-group">
                  <label>Programme Scope</label>
                  <p className="form-hint before">Tick all programmes this course belongs to. A course can belong to multiple programmes or none.</p>
                  <div className="prog-picker">
                    <div className="select-all-row">
                      <button type="button" onClick={selectAllProgs}>Select all</button>
                    </div>
                    {programs.map((p) => (
                      <div key={p.program_id} className="prog-checkbox-item" onClick={() => toggleProg(p.program_id)}>
                        <input
                          type="checkbox"
                          id={`prog_${p.program_id}`}
                          value={p.program_id}
                          checked={courseForm.scope.includes(p.program_id)}
                          onChange={() => toggleProg(p.program_id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <label htmlFor={`prog_${p.program_id}`} onClick={(e) => e.stopPropagation()}>{p.program_name}</label>
                        <span className="prog-id">{p.program_id}</span>
                      </div>
                    ))}
                  </div>
                  <p className="form-hint after">
                    {courseForm.scope.length > 0 ? `${courseForm.scope.length} programme${courseForm.scope.length !== 1 ? 's' : ''} selected` : ''}
                  </p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setCourseModal(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={courseSaving} onClick={submitCourse}>
                  {courseSaving ? 'Saving…' : editingCourseId ? 'Save Changes' : 'Save Course'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </BodyPortal>
    </div>
  );
}
