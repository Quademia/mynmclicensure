// ============================================================
// courses-panel.js — Self-contained Courses management component
// Slice 12: Teacher Courses
//
// Usage:  initCoursesPanel('containerId', teacherId)
// Requires: db (config.js), /myteacher/js/myteacher-api.js, utils.js (escapeHtml)
// ============================================================

/**
 * Initialise the Courses panel inside any container element.
 * Works both embedded on a page and inside a modal body.
 *
 * @param {string} containerId  - ID of the host element
 * @param {string} teacherId    - Current teacher's user ID
 */
window.initCoursesPanel = function initCoursesPanel(containerId, teacherId) {

  // ── Refs & state ──────────────────────────────────────────
  const root = document.getElementById(containerId);
  if (!root) { console.error('initCoursesPanel: container not found:', containerId); return; }

  let courses       = [];
  let showArchived  = false;
  let editingId     = null;   // course_id being edited, or null

  const esc = typeof escapeHtml === 'function' ? escapeHtml : s => String(s || '');

  // ── Inject styles (once) ──────────────────────────────────
  if (!document.getElementById('cp-styles')) {
    const style = document.createElement('style');
    style.id = 'cp-styles';
    style.textContent = `
      .cp-wrap { font-family: inherit; }

      /* Header */
      .cp-head {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px; flex-wrap: wrap; margin-bottom: 16px;
      }
      .cp-head h2 { font-size: 15px; font-weight: 800; color: var(--primary, #1e3a5f); margin: 0; }
      .cp-head-right { display: flex; gap: 8px; align-items: center; }

      /* Filter toggle */
      .cp-filter-btn {
        font-size: 12px; color: var(--text-muted, #64748b);
        background: none; border: 1px solid var(--border, #e2e8f0);
        border-radius: 8px; padding: 4px 10px; cursor: pointer;
        transition: border-color 0.15s;
      }
      .cp-filter-btn:hover { border-color: var(--accent, #2d7d72); color: var(--accent, #2d7d72); }
      .cp-filter-btn.active { background: rgba(45,125,114,0.06); border-color: var(--accent, #2d7d72); color: var(--accent, #2d7d72); }

      /* New button */
      .cp-new-btn {
        font-size: 13px; font-weight: 700; color: #fff;
        background: var(--accent, #2d7d72); border: none;
        border-radius: 10px; padding: 7px 14px; cursor: pointer;
        transition: opacity 0.15s;
      }
      .cp-new-btn:hover { opacity: 0.88; }

      /* List */
      .cp-list { display: flex; flex-direction: column; gap: 8px; }

      /* Card */
      .cp-card {
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 12px; padding: 12px; background: #fff;
        cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s;
      }
      .cp-card:hover { border-color: var(--accent, #2d7d72); box-shadow: 0 2px 8px rgba(45,125,114,0.10); }
      .cp-card-title { font-size: 14px; font-weight: 700; color: var(--primary, #1e3a5f); margin: 0 0 4px; }
      .cp-card-desc { font-size: 12px; color: var(--text-muted, #64748b); margin: 0 0 6px; line-height: 1.4; }
      .cp-card-meta { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }

      /* Status chip */
      .cp-chip {
        display: inline-flex; align-items: center;
        font-size: 11px; font-weight: 700; border-radius: 999px;
        padding: 3px 8px; border: 1px solid;
      }
      .cp-chip.active   { background: rgba(45,125,114,0.08); color: var(--accent, #2d7d72); border-color: rgba(45,125,114,0.22); }
      .cp-chip.archived { background: rgba(100,116,139,0.08); color: var(--text-muted, #64748b); border-color: var(--border, #e2e8f0); }

      /* Inline form */
      .cp-form {
        border: 1px solid var(--accent, #2d7d72);
        border-radius: 12px; padding: 14px; background: #fff;
        box-shadow: 0 2px 12px rgba(45,125,114,0.08);
      }
      .cp-form label {
        display: block; font-size: 12px; font-weight: 700;
        color: var(--primary, #1e3a5f); margin-bottom: 4px;
      }
      .cp-form input,
      .cp-form textarea {
        width: 100%; border: 1px solid var(--border, #e2e8f0);
        border-radius: 10px; padding: 8px 10px; font-size: 13px;
        outline: none; background: #fff; color: var(--text, #334155);
        font-family: inherit; box-sizing: border-box;
      }
      .cp-form input:focus,
      .cp-form textarea:focus {
        border-color: var(--accent, #2d7d72);
        box-shadow: 0 0 0 3px rgba(45,125,114,0.10);
      }
      .cp-form textarea { resize: vertical; min-height: 60px; }
      .cp-form-row { margin-bottom: 10px; }
      .cp-form-actions {
        display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px;
      }
      .cp-form-actions button {
        font-size: 13px; font-weight: 700; border-radius: 10px;
        padding: 7px 14px; cursor: pointer; border: 1px solid var(--border, #e2e8f0);
        background: #fff; color: var(--text, #334155); transition: opacity 0.15s;
      }
      .cp-form-actions .cp-save-btn {
        background: var(--accent, #2d7d72); color: #fff; border-color: transparent;
      }
      .cp-form-actions .cp-save-btn:hover { opacity: 0.88; }

      /* Archive / Restore link */
      .cp-action-link {
        font-size: 12px; color: var(--text-muted, #64748b);
        background: none; border: none; cursor: pointer; padding: 0;
        text-decoration: underline; transition: color 0.15s;
      }
      .cp-action-link:hover { color: var(--primary, #1e3a5f); }
      .cp-action-link.danger { color: #b91c1c; }
      .cp-action-link.danger:hover { color: #7f1d1d; }

      /* Empty state */
      .cp-empty {
        text-align: center; padding: 32px 16px;
        color: var(--text-muted, #64748b);
      }
      .cp-empty .cp-empty-icon { font-size: 36px; margin-bottom: 10px; }
      .cp-empty p { font-size: 13px; line-height: 1.55; margin: 0; }

      /* Loading */
      .cp-loading { text-align: center; padding: 24px; font-size: 13px; color: var(--text-muted, #64748b); }
    `;
    document.head.appendChild(style);
  }

  // ── Inject skeleton HTML ──────────────────────────────────
  root.innerHTML = `
    <div class="cp-wrap">
      <div class="cp-head">
        <h2>Courses</h2>
        <div class="cp-head-right">
          <button class="cp-filter-btn" id="cpFilterBtn">Show archived</button>
          <button class="cp-new-btn" id="cpNewBtn">+ New</button>
        </div>
      </div>
      <div id="cpFormSlot"></div>
      <div id="cpList" class="cp-list">
        <div class="cp-loading">Loading courses...</div>
      </div>
    </div>
  `;

  const $list      = root.querySelector('#cpList');
  const $formSlot  = root.querySelector('#cpFormSlot');
  const $filterBtn = root.querySelector('#cpFilterBtn');
  const $newBtn    = root.querySelector('#cpNewBtn');

  // ── Toast helper (graceful no-op if no toast element) ─────
  function toast(title, msg, type) {
    const t  = document.getElementById('toast');
    const tt = document.getElementById('toastTitle');
    const tm = document.getElementById('toastMsg');
    if (!t || !tt || !tm) return;
    tt.textContent = title;
    tm.textContent = msg;
    t.className = 'toast show ' + (type || 'ok');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.className = 'toast'; }, 3000);
  }

  // ── Render list ───────────────────────────────────────────
  function renderList() {
    const visible = showArchived
      ? courses
      : courses.filter(c => c.status === 'ACTIVE');

    if (!visible.length) {
      const msg = showArchived
        ? 'No courses found.'
        : 'No courses yet — create your first one.';
      $list.innerHTML = `
        <div class="cp-empty">
          <div class="cp-empty-icon">📚</div>
          <p>${esc(msg)}</p>
        </div>`;
      return;
    }

    $list.innerHTML = visible.map(c => `
      <div class="cp-card" data-id="${esc(c.course_id)}">
        <div class="cp-card-title">${esc(c.title)}</div>
        ${c.description ? `<div class="cp-card-desc">${esc(c.description)}</div>` : ''}
        <div class="cp-card-meta">
          <span class="cp-chip ${c.status === 'ACTIVE' ? 'active' : 'archived'}">${esc(c.status)}</span>
        </div>
      </div>
    `).join('');
  }

  // ── Inline form (create or edit) ──────────────────────────
  function showForm(course) {
    const isEdit = !!course;
    editingId = isEdit ? course.course_id : null;

    $formSlot.innerHTML = `
      <div class="cp-form" style="margin-bottom:12px;">
        <div class="cp-form-row">
          <label for="cpTitle">${isEdit ? 'Edit' : 'New'} Course Title *</label>
          <input type="text" id="cpTitle" placeholder="e.g. Pharmacology 1" maxlength="120"
                 value="${isEdit ? esc(course.title) : ''}" />
        </div>
        <div class="cp-form-row">
          <label for="cpDesc">Description (optional)</label>
          <textarea id="cpDesc" placeholder="Brief description..." maxlength="500">${isEdit ? esc(course.description || '') : ''}</textarea>
        </div>
        <div class="cp-form-actions">
          ${isEdit ? `<button class="cp-action-link ${course.status === 'ACTIVE' ? 'danger' : ''}" id="cpArchiveBtn">${course.status === 'ACTIVE' ? 'Archive' : 'Restore'}</button>` : ''}
          <button id="cpCancelBtn">Cancel</button>
          <button class="cp-save-btn" id="cpSaveBtn">${isEdit ? 'Save' : 'Create'}</button>
        </div>
      </div>
    `;

    // Focus title
    const $title = root.querySelector('#cpTitle');
    $title.focus();

    // Cancel
    root.querySelector('#cpCancelBtn').addEventListener('click', () => {
      $formSlot.innerHTML = '';
      editingId = null;
    });

    // Save
    root.querySelector('#cpSaveBtn').addEventListener('click', () => handleSave());

    // Archive / Restore
    const $archBtn = root.querySelector('#cpArchiveBtn');
    if ($archBtn) {
      $archBtn.addEventListener('click', () => handleArchive(course));
    }

    // Enter key on title submits
    $title.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    });
  }

  function hideForm() {
    $formSlot.innerHTML = '';
    editingId = null;
  }

  // ── Save handler (create or update) ───────────────────────
  async function handleSave() {
    const title = (root.querySelector('#cpTitle')?.value || '').trim();
    const desc  = (root.querySelector('#cpDesc')?.value || '').trim();

    if (!title) {
      toast('Missing title', 'Course title is required.', 'error');
      root.querySelector('#cpTitle')?.focus();
      return;
    }

    const $btn = root.querySelector('#cpSaveBtn');
    if ($btn) { $btn.disabled = true; $btn.textContent = 'Saving...'; }

    if (editingId) {
      // Update
      const patch = { title };
      if (desc) patch.description = desc;
      else patch.description = null;

      const res = await updateCourse(editingId, teacherId, patch);
      if (!res.success) {
        toast('Error', res.message || 'Could not update course.', 'error');
        if ($btn) { $btn.disabled = false; $btn.textContent = 'Save'; }
        return;
      }
      toast('Updated', 'Course updated.', 'ok');
    } else {
      // Create
      const payload = { title };
      if (desc) payload.description = desc;

      const res = await createCourse(teacherId, payload);
      if (!res.success) {
        toast('Error', res.message || 'Could not create course.', 'error');
        if ($btn) { $btn.disabled = false; $btn.textContent = 'Create'; }
        return;
      }
      toast('Created', 'Course created.', 'ok');
    }

    hideForm();
    await loadCourses();
  }

  // ── Archive / Restore handler ─────────────────────────────
  async function handleArchive(course) {
    const action = course.status === 'ACTIVE' ? 'ARCHIVE' : 'RESTORE';
    const label  = action === 'ARCHIVE' ? 'Archive' : 'Restore';

    if (action === 'ARCHIVE' && !confirm('Archive this course? It can be restored later.')) return;

    const res = await archiveCourse(course.course_id, teacherId, action);
    if (!res.success) {
      toast('Error', res.message || `Could not ${label.toLowerCase()} course.`, 'error');
      return;
    }

    toast(label + 'd', `Course ${label.toLowerCase()}d.`, 'ok');
    hideForm();
    await loadCourses();
  }

  // ── Load courses from API ─────────────────────────────────
  async function loadCourses() {
    const opts = showArchived ? { status: 'ALL' } : { status: 'ACTIVE' };
    courses = await getCourses(teacherId, opts);
    renderList();
  }

  // ── Event delegation ──────────────────────────────────────
  $list.addEventListener('click', e => {
    const card = e.target.closest('.cp-card');
    if (!card) return;
    const id = card.dataset.id;
    const course = courses.find(c => c.course_id === id);
    if (course) showForm(course);
  });

  $newBtn.addEventListener('click', () => {
    showForm(null);
  });

  $filterBtn.addEventListener('click', () => {
    showArchived = !showArchived;
    $filterBtn.textContent = showArchived ? 'Active only' : 'Show archived';
    $filterBtn.classList.toggle('active', showArchived);
    loadCourses();
  });

  // ── Init ──────────────────────────────────────────────────
  loadCourses();
};
