// ============================================================
// cohorts-panel.js — Self-contained Cohorts management component
// Slice 13: Teacher Cohorts
//
// Usage:  initCohortsPanel('containerId', teacherId)
// Requires: db (config.js), /myteacher/js/myteacher-api.js, utils.js (escapeHtml)
// ============================================================

/**
 * Initialise the Cohorts panel inside any container element.
 * Loads programmes internally for the dropdown.
 *
 * @param {string} containerId  - ID of the host element
 * @param {string} teacherId    - Current teacher's user ID
 */
window.initCohortsPanel = function initCohortsPanel(containerId, teacherId) {

  // ── Refs & state ──────────────────────────────────────────
  const root = document.getElementById(containerId);
  if (!root) { console.error('initCohortsPanel: container not found:', containerId); return; }

  let cohorts      = [];
  let programmes   = [];   // loaded internally for dropdown
  let showArchived = false;
  let editingId    = null;

  const esc = typeof escapeHtml === 'function' ? escapeHtml : s => String(s || '');

  // ── Inject styles (once) ──────────────────────────────────
  if (!document.getElementById('chp-styles')) {
    const style = document.createElement('style');
    style.id = 'chp-styles';
    style.textContent = `
      .chp-wrap { font-family: inherit; }

      .chp-head {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px; flex-wrap: wrap; margin-bottom: 16px;
      }
      .chp-head h2 { font-size: 15px; font-weight: 800; color: var(--primary, #1e3a5f); margin: 0; }
      .chp-head-right { display: flex; gap: 8px; align-items: center; }

      .chp-filter-btn {
        font-size: 12px; color: var(--text-muted, #64748b);
        background: none; border: 1px solid var(--border, #e2e8f0);
        border-radius: 8px; padding: 4px 10px; cursor: pointer;
        transition: border-color 0.15s;
      }
      .chp-filter-btn:hover { border-color: var(--accent, #2d7d72); color: var(--accent, #2d7d72); }
      .chp-filter-btn.active { background: rgba(45,125,114,0.06); border-color: var(--accent, #2d7d72); color: var(--accent, #2d7d72); }

      .chp-new-btn {
        font-size: 13px; font-weight: 700; color: #fff;
        background: var(--accent, #2d7d72); border: none;
        border-radius: 10px; padding: 7px 14px; cursor: pointer;
        transition: opacity 0.15s;
      }
      .chp-new-btn:hover { opacity: 0.88; }

      .chp-list { display: flex; flex-direction: column; gap: 8px; }

      .chp-card {
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 12px; padding: 12px; background: #fff;
        cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s;
      }
      .chp-card:hover { border-color: var(--accent, #2d7d72); box-shadow: 0 2px 8px rgba(45,125,114,0.10); }
      .chp-card-title { font-size: 14px; font-weight: 700; color: var(--primary, #1e3a5f); margin: 0 0 4px; }
      .chp-card-sub { font-size: 12px; color: var(--text-muted, #64748b); margin: 0 0 6px; }
      .chp-card-meta { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }

      .chp-chip {
        display: inline-flex; align-items: center;
        font-size: 11px; font-weight: 700; border-radius: 999px;
        padding: 3px 8px; border: 1px solid;
      }
      .chp-chip.active   { background: rgba(45,125,114,0.08); color: var(--accent, #2d7d72); border-color: rgba(45,125,114,0.22); }
      .chp-chip.archived { background: rgba(100,116,139,0.08); color: var(--text-muted, #64748b); border-color: var(--border, #e2e8f0); }
      .chp-chip.year     { background: rgba(30,58,95,0.06); color: var(--primary, #1e3a5f); border-color: rgba(30,58,95,0.15); font-weight: 600; }

      .chp-form {
        border: 1px solid var(--accent, #2d7d72);
        border-radius: 12px; padding: 14px; background: #fff;
        box-shadow: 0 2px 12px rgba(45,125,114,0.08);
      }
      .chp-form label {
        display: block; font-size: 12px; font-weight: 700;
        color: var(--primary, #1e3a5f); margin-bottom: 4px;
      }
      .chp-form input,
      .chp-form select {
        width: 100%; border: 1px solid var(--border, #e2e8f0);
        border-radius: 10px; padding: 8px 10px; font-size: 13px;
        outline: none; background: #fff; color: var(--text, #334155);
        font-family: inherit; box-sizing: border-box;
      }
      .chp-form input:focus,
      .chp-form select:focus {
        border-color: var(--accent, #2d7d72);
        box-shadow: 0 0 0 3px rgba(45,125,114,0.10);
      }
      .chp-form-row { margin-bottom: 10px; }
      .chp-form-row-half {
        display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;
      }
      .chp-form-actions {
        display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px;
      }
      .chp-form-actions button {
        font-size: 13px; font-weight: 700; border-radius: 10px;
        padding: 7px 14px; cursor: pointer; border: 1px solid var(--border, #e2e8f0);
        background: #fff; color: var(--text, #334155); transition: opacity 0.15s;
      }
      .chp-form-actions .chp-save-btn {
        background: var(--accent, #2d7d72); color: #fff; border-color: transparent;
      }
      .chp-form-actions .chp-save-btn:hover { opacity: 0.88; }

      .chp-action-link {
        font-size: 12px; color: var(--text-muted, #64748b);
        background: none; border: none; cursor: pointer; padding: 0;
        text-decoration: underline; transition: color 0.15s;
      }
      .chp-action-link:hover { color: var(--primary, #1e3a5f); }
      .chp-action-link.danger { color: #b91c1c; }
      .chp-action-link.danger:hover { color: #7f1d1d; }

      .chp-empty {
        text-align: center; padding: 32px 16px;
        color: var(--text-muted, #64748b);
      }
      .chp-empty .chp-empty-icon { font-size: 36px; margin-bottom: 10px; }
      .chp-empty p { font-size: 13px; line-height: 1.55; margin: 0; }

      .chp-loading { text-align: center; padding: 24px; font-size: 13px; color: var(--text-muted, #64748b); }

      .chp-no-prog {
        text-align: center; padding: 20px 16px;
        color: var(--text-muted, #64748b); font-size: 13px; line-height: 1.5;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Inject skeleton HTML ──────────────────────────────────
  root.innerHTML = `
    <div class="chp-wrap">
      <div class="chp-head">
        <h2>Cohorts</h2>
        <div class="chp-head-right">
          <button class="chp-filter-btn" id="chpFilterBtn">Show archived</button>
          <button class="chp-new-btn" id="chpNewBtn">+ New</button>
        </div>
      </div>
      <div id="chpFormSlot"></div>
      <div id="chpList" class="chp-list">
        <div class="chp-loading">Loading cohorts...</div>
      </div>
    </div>
  `;

  const $list      = root.querySelector('#chpList');
  const $formSlot  = root.querySelector('#chpFormSlot');
  const $filterBtn = root.querySelector('#chpFilterBtn');
  const $newBtn    = root.querySelector('#chpNewBtn');

  // ── Toast helper ──────────────────────────────────────────
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

  // ── Programme lookup helper ───────────────────────────────
  function progTitle(programmeId) {
    const p = programmes.find(pr => pr.programme_id === programmeId);
    return p ? p.title : '—';
  }

  // ── Render list ───────────────────────────────────────────
  function renderList() {
    const visible = showArchived
      ? cohorts
      : cohorts.filter(c => c.status === 'ACTIVE');

    if (!visible.length) {
      const msg = showArchived
        ? 'No cohorts found.'
        : 'No cohorts yet — create your first one.';
      $list.innerHTML = `
        <div class="chp-empty">
          <div class="chp-empty-icon">👥</div>
          <p>${esc(msg)}</p>
        </div>`;
      return;
    }

    $list.innerHTML = visible.map(c => `
      <div class="chp-card" data-id="${esc(c.cohort_id)}">
        <div class="chp-card-title">${esc(c.title)}</div>
        <div class="chp-card-sub">${esc(progTitle(c.programme_id))}</div>
        <div class="chp-card-meta">
          <span class="chp-chip year">${esc(String(c.intake_year))}</span>
          <span class="chp-chip ${c.status === 'ACTIVE' ? 'active' : 'archived'}">${esc(c.status)}</span>
        </div>
      </div>
    `).join('');
  }

  // ── Programme dropdown options ─────────────────────────────
  function progOptions(selectedId) {
    if (!programmes.length) return '<option value="">No programmes — create one first</option>';
    return '<option value="">Select programme *</option>' +
      programmes
        .filter(p => p.status === 'ACTIVE')
        .map(p => `<option value="${esc(p.programme_id)}" ${p.programme_id === selectedId ? 'selected' : ''}>${esc(p.title)}</option>`)
        .join('');
  }

  // ── Inline form ───────────────────────────────────────────
  function showForm(cohort) {
    const isEdit  = !!cohort;
    editingId     = isEdit ? cohort.cohort_id : null;
    const curYear = new Date().getFullYear();

    if (!programmes.length && !isEdit) {
      $formSlot.innerHTML = `
        <div class="chp-no-prog" style="margin-bottom:12px;">
          Create a programme first before adding cohorts.
        </div>`;
      return;
    }

    $formSlot.innerHTML = `
      <div class="chp-form" style="margin-bottom:12px;">
        <div class="chp-form-row">
          <label for="chpProgramme">Programme *</label>
          <select id="chpProgramme" ${isEdit ? 'disabled' : ''}>
            ${progOptions(isEdit ? cohort.programme_id : '')}
          </select>
        </div>
        <div class="chp-form-row-half">
          <div>
            <label for="chpTitle">${isEdit ? 'Edit' : 'Cohort'} Title *</label>
            <input type="text" id="chpTitle" placeholder="e.g. BSc Nursing 2024 Intake" maxlength="120"
                   value="${isEdit ? esc(cohort.title) : ''}" />
          </div>
          <div>
            <label for="chpYear">Intake Year *</label>
            <input type="number" id="chpYear" min="2000" max="2100"
                   value="${isEdit ? cohort.intake_year : curYear}" />
          </div>
        </div>
        <div class="chp-form-actions">
          ${isEdit ? `<button class="chp-action-link ${cohort.status === 'ACTIVE' ? 'danger' : ''}" id="chpArchiveBtn">${cohort.status === 'ACTIVE' ? 'Archive' : 'Restore'}</button>` : ''}
          <button id="chpCancelBtn">Cancel</button>
          <button class="chp-save-btn" id="chpSaveBtn">${isEdit ? 'Save' : 'Create'}</button>
        </div>
      </div>
    `;

    const $title = root.querySelector('#chpTitle');
    if (!isEdit) {
      root.querySelector('#chpProgramme')?.focus();
    } else {
      $title.focus();
    }

    root.querySelector('#chpCancelBtn').addEventListener('click', () => {
      $formSlot.innerHTML = '';
      editingId = null;
    });

    root.querySelector('#chpSaveBtn').addEventListener('click', () => handleSave());

    const $archBtn = root.querySelector('#chpArchiveBtn');
    if ($archBtn) {
      $archBtn.addEventListener('click', () => handleArchive(cohort));
    }

    $title.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    });
  }

  function hideForm() {
    $formSlot.innerHTML = '';
    editingId = null;
  }

  // ── Save handler ──────────────────────────────────────────
  async function handleSave() {
    const programmeId = (root.querySelector('#chpProgramme')?.value || '').trim();
    const title       = (root.querySelector('#chpTitle')?.value || '').trim();
    const year        = root.querySelector('#chpYear')?.value;

    if (!editingId && !programmeId) {
      toast('Missing programme', 'Select a programme for this cohort.', 'error');
      root.querySelector('#chpProgramme')?.focus();
      return;
    }
    if (!title) {
      toast('Missing title', 'Cohort title is required.', 'error');
      root.querySelector('#chpTitle')?.focus();
      return;
    }
    if (!year || isNaN(parseInt(year, 10))) {
      toast('Missing year', 'Intake year is required.', 'error');
      root.querySelector('#chpYear')?.focus();
      return;
    }

    const $btn = root.querySelector('#chpSaveBtn');
    if ($btn) { $btn.disabled = true; $btn.textContent = 'Saving...'; }

    if (editingId) {
      const patch = { title, intake_year: year };
      const res = await updateCohort(editingId, teacherId, patch);
      if (!res.success) {
        toast('Error', res.message || 'Could not update cohort.', 'error');
        if ($btn) { $btn.disabled = false; $btn.textContent = 'Save'; }
        return;
      }
      toast('Updated', 'Cohort updated.', 'ok');
    } else {
      const payload = { programme_id: programmeId, title, intake_year: year };
      const res = await createCohort(teacherId, payload);
      if (!res.success) {
        toast('Error', res.message || 'Could not create cohort.', 'error');
        if ($btn) { $btn.disabled = false; $btn.textContent = 'Create'; }
        return;
      }
      toast('Created', 'Cohort created.', 'ok');
    }

    hideForm();
    await loadCohorts();
  }

  // ── Archive / Restore handler ─────────────────────────────
  async function handleArchive(cohort) {
    const action = cohort.status === 'ACTIVE' ? 'ARCHIVE' : 'RESTORE';
    const label  = action === 'ARCHIVE' ? 'Archive' : 'Restore';

    if (action === 'ARCHIVE' && !confirm('Archive this cohort? It can be restored later.')) return;

    const res = await archiveCohort(cohort.cohort_id, teacherId, action);
    if (!res.success) {
      toast('Error', res.message || `Could not ${label.toLowerCase()} cohort.`, 'error');
      return;
    }

    toast(label + 'd', `Cohort ${label.toLowerCase()}d.`, 'ok');
    hideForm();
    await loadCohorts();
  }

  // ── Load data from API ────────────────────────────────────
  async function loadCohorts() {
    const statusOpts = showArchived ? { status: 'ALL' } : { status: 'ACTIVE' };
    [cohorts, programmes] = await Promise.all([
      getCohorts(teacherId, statusOpts),
      getProgrammes(teacherId, { status: 'ACTIVE' })
    ]);
    renderList();
  }

  // ── Event delegation ──────────────────────────────────────
  $list.addEventListener('click', e => {
    const card = e.target.closest('.chp-card');
    if (!card) return;
    const id = card.dataset.id;
    const cohort = cohorts.find(c => c.cohort_id === id);
    if (cohort) showForm(cohort);
  });

  $newBtn.addEventListener('click', () => {
    showForm(null);
  });

  $filterBtn.addEventListener('click', () => {
    showArchived = !showArchived;
    $filterBtn.textContent = showArchived ? 'Active only' : 'Show archived';
    $filterBtn.classList.toggle('active', showArchived);
    loadCohorts();
  });

  // ── Init ──────────────────────────────────────────────────
  loadCohorts();
};
