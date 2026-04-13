// ============================================================
// programmes-panel.js — Self-contained Programmes management component
// Slice 13: Teacher Programmes
//
// Usage:  initProgrammesPanel('containerId', teacherId)
// Requires: db (config.js), /myteacher/js/myteacher-api.js, utils.js (escapeHtml)
// ============================================================

/**
 * Initialise the Programmes panel inside any container element.
 *
 * @param {string} containerId  - ID of the host element
 * @param {string} teacherId    - Current teacher's user ID
 */
window.initProgrammesPanel = function initProgrammesPanel(containerId, teacherId) {

  // ── Refs & state ──────────────────────────────────────────
  const root = document.getElementById(containerId);
  if (!root) { console.error('initProgrammesPanel: container not found:', containerId); return; }

  let programmes   = [];
  let showArchived = false;
  let editingId    = null;

  const esc = typeof escapeHtml === 'function' ? escapeHtml : s => String(s || '');

  // ── Inject styles (once) ──────────────────────────────────
  if (!document.getElementById('pp-styles')) {
    const style = document.createElement('style');
    style.id = 'pp-styles';
    style.textContent = `
      .pp-wrap { font-family: inherit; }

      .pp-head {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px; flex-wrap: wrap; margin-bottom: 16px;
      }
      .pp-head h2 { font-size: 15px; font-weight: 800; color: var(--primary, #1e3a5f); margin: 0; }
      .pp-head-right { display: flex; gap: 8px; align-items: center; }

      .pp-filter-btn {
        font-size: 12px; color: var(--text-muted, #64748b);
        background: none; border: 1px solid var(--border, #e2e8f0);
        border-radius: 8px; padding: 4px 10px; cursor: pointer;
        transition: border-color 0.15s;
      }
      .pp-filter-btn:hover { border-color: var(--accent, #2d7d72); color: var(--accent, #2d7d72); }
      .pp-filter-btn.active { background: rgba(45,125,114,0.06); border-color: var(--accent, #2d7d72); color: var(--accent, #2d7d72); }

      .pp-new-btn {
        font-size: 13px; font-weight: 700; color: #fff;
        background: var(--accent, #2d7d72); border: none;
        border-radius: 10px; padding: 7px 14px; cursor: pointer;
        transition: opacity 0.15s;
      }
      .pp-new-btn:hover { opacity: 0.88; }

      .pp-list { display: flex; flex-direction: column; gap: 8px; }

      .pp-card {
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 12px; padding: 12px; background: #fff;
        cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s;
      }
      .pp-card:hover { border-color: var(--accent, #2d7d72); box-shadow: 0 2px 8px rgba(45,125,114,0.10); }
      .pp-card-title { font-size: 14px; font-weight: 700; color: var(--primary, #1e3a5f); margin: 0 0 6px; }
      .pp-card-meta { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }

      .pp-chip {
        display: inline-flex; align-items: center;
        font-size: 11px; font-weight: 700; border-radius: 999px;
        padding: 3px 8px; border: 1px solid;
      }
      .pp-chip.active   { background: rgba(45,125,114,0.08); color: var(--accent, #2d7d72); border-color: rgba(45,125,114,0.22); }
      .pp-chip.archived { background: rgba(100,116,139,0.08); color: var(--text-muted, #64748b); border-color: var(--border, #e2e8f0); }

      .pp-form {
        border: 1px solid var(--accent, #2d7d72);
        border-radius: 12px; padding: 14px; background: #fff;
        box-shadow: 0 2px 12px rgba(45,125,114,0.08);
      }
      .pp-form label {
        display: block; font-size: 12px; font-weight: 700;
        color: var(--primary, #1e3a5f); margin-bottom: 4px;
      }
      .pp-form input {
        width: 100%; border: 1px solid var(--border, #e2e8f0);
        border-radius: 10px; padding: 8px 10px; font-size: 13px;
        outline: none; background: #fff; color: var(--text, #334155);
        font-family: inherit; box-sizing: border-box;
      }
      .pp-form input:focus {
        border-color: var(--accent, #2d7d72);
        box-shadow: 0 0 0 3px rgba(45,125,114,0.10);
      }
      .pp-form-row { margin-bottom: 10px; }
      .pp-form-actions {
        display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px;
      }
      .pp-form-actions button {
        font-size: 13px; font-weight: 700; border-radius: 10px;
        padding: 7px 14px; cursor: pointer; border: 1px solid var(--border, #e2e8f0);
        background: #fff; color: var(--text, #334155); transition: opacity 0.15s;
      }
      .pp-form-actions .pp-save-btn {
        background: var(--accent, #2d7d72); color: #fff; border-color: transparent;
      }
      .pp-form-actions .pp-save-btn:hover { opacity: 0.88; }

      .pp-action-link {
        font-size: 12px; color: var(--text-muted, #64748b);
        background: none; border: none; cursor: pointer; padding: 0;
        text-decoration: underline; transition: color 0.15s;
      }
      .pp-action-link:hover { color: var(--primary, #1e3a5f); }
      .pp-action-link.danger { color: #b91c1c; }
      .pp-action-link.danger:hover { color: #7f1d1d; }

      .pp-empty {
        text-align: center; padding: 32px 16px;
        color: var(--text-muted, #64748b);
      }
      .pp-empty .pp-empty-icon { font-size: 36px; margin-bottom: 10px; }
      .pp-empty p { font-size: 13px; line-height: 1.55; margin: 0; }

      .pp-loading { text-align: center; padding: 24px; font-size: 13px; color: var(--text-muted, #64748b); }
    `;
    document.head.appendChild(style);
  }

  // ── Inject skeleton HTML ──────────────────────────────────
  root.innerHTML = `
    <div class="pp-wrap">
      <div class="pp-head">
        <h2>Programmes</h2>
        <div class="pp-head-right">
          <button class="pp-filter-btn" id="ppFilterBtn">Show archived</button>
          <button class="pp-new-btn" id="ppNewBtn">+ New</button>
        </div>
      </div>
      <div id="ppFormSlot"></div>
      <div id="ppList" class="pp-list">
        <div class="pp-loading">Loading programmes...</div>
      </div>
    </div>
  `;

  const $list      = root.querySelector('#ppList');
  const $formSlot  = root.querySelector('#ppFormSlot');
  const $filterBtn = root.querySelector('#ppFilterBtn');
  const $newBtn    = root.querySelector('#ppNewBtn');

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

  // ── Render list ───────────────────────────────────────────
  function renderList() {
    const visible = showArchived
      ? programmes
      : programmes.filter(p => p.status === 'ACTIVE');

    if (!visible.length) {
      const msg = showArchived
        ? 'No programmes found.'
        : 'No programmes yet — create your first one.';
      $list.innerHTML = `
        <div class="pp-empty">
          <div class="pp-empty-icon">🎓</div>
          <p>${esc(msg)}</p>
        </div>`;
      return;
    }

    $list.innerHTML = visible.map(p => `
      <div class="pp-card" data-id="${esc(p.programme_id)}">
        <div class="pp-card-title">${esc(p.title)}</div>
        <div class="pp-card-meta">
          <span class="pp-chip ${p.status === 'ACTIVE' ? 'active' : 'archived'}">${esc(p.status)}</span>
        </div>
      </div>
    `).join('');
  }

  // ── Inline form ───────────────────────────────────────────
  function showForm(programme) {
    const isEdit = !!programme;
    editingId = isEdit ? programme.programme_id : null;

    $formSlot.innerHTML = `
      <div class="pp-form" style="margin-bottom:12px;">
        <div class="pp-form-row">
          <label for="ppTitle">${isEdit ? 'Edit' : 'New'} Programme Title *</label>
          <input type="text" id="ppTitle" placeholder="e.g. BSc Nursing" maxlength="120"
                 value="${isEdit ? esc(programme.title) : ''}" />
        </div>
        <div class="pp-form-actions">
          ${isEdit ? `<button class="pp-action-link ${programme.status === 'ACTIVE' ? 'danger' : ''}" id="ppArchiveBtn">${programme.status === 'ACTIVE' ? 'Archive' : 'Restore'}</button>` : ''}
          <button id="ppCancelBtn">Cancel</button>
          <button class="pp-save-btn" id="ppSaveBtn">${isEdit ? 'Save' : 'Create'}</button>
        </div>
      </div>
    `;

    const $title = root.querySelector('#ppTitle');
    $title.focus();

    root.querySelector('#ppCancelBtn').addEventListener('click', () => {
      $formSlot.innerHTML = '';
      editingId = null;
    });

    root.querySelector('#ppSaveBtn').addEventListener('click', () => handleSave());

    const $archBtn = root.querySelector('#ppArchiveBtn');
    if ($archBtn) {
      $archBtn.addEventListener('click', () => handleArchive(programme));
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
    const title = (root.querySelector('#ppTitle')?.value || '').trim();

    if (!title) {
      toast('Missing title', 'Programme title is required.', 'error');
      root.querySelector('#ppTitle')?.focus();
      return;
    }

    const $btn = root.querySelector('#ppSaveBtn');
    if ($btn) { $btn.disabled = true; $btn.textContent = 'Saving...'; }

    if (editingId) {
      const res = await updateProgramme(editingId, teacherId, { title });
      if (!res.success) {
        toast('Error', res.message || 'Could not update programme.', 'error');
        if ($btn) { $btn.disabled = false; $btn.textContent = 'Save'; }
        return;
      }
      toast('Updated', 'Programme updated.', 'ok');
    } else {
      const res = await createProgramme(teacherId, { title });
      if (!res.success) {
        toast('Error', res.message || 'Could not create programme.', 'error');
        if ($btn) { $btn.disabled = false; $btn.textContent = 'Create'; }
        return;
      }
      toast('Created', 'Programme created.', 'ok');
    }

    hideForm();
    await loadProgrammes();
  }

  // ── Archive / Restore handler ─────────────────────────────
  async function handleArchive(programme) {
    const action = programme.status === 'ACTIVE' ? 'ARCHIVE' : 'RESTORE';
    const label  = action === 'ARCHIVE' ? 'Archive' : 'Restore';

    if (action === 'ARCHIVE' && !confirm('Archive this programme? It can be restored later.')) return;

    const res = await archiveProgramme(programme.programme_id, teacherId, action);
    if (!res.success) {
      toast('Error', res.message || `Could not ${label.toLowerCase()} programme.`, 'error');
      return;
    }

    toast(label + 'd', `Programme ${label.toLowerCase()}d.`, 'ok');
    hideForm();
    await loadProgrammes();
  }

  // ── Load programmes from API ──────────────────────────────
  async function loadProgrammes() {
    const opts = showArchived ? { status: 'ALL' } : { status: 'ACTIVE' };
    programmes = await getProgrammes(teacherId, opts);
    renderList();
  }

  // ── Event delegation ──────────────────────────────────────
  $list.addEventListener('click', e => {
    const card = e.target.closest('.pp-card');
    if (!card) return;
    const id = card.dataset.id;
    const programme = programmes.find(p => p.programme_id === id);
    if (programme) showForm(programme);
  });

  $newBtn.addEventListener('click', () => {
    showForm(null);
  });

  $filterBtn.addEventListener('click', () => {
    showArchived = !showArchived;
    $filterBtn.textContent = showArchived ? 'Active only' : 'Show archived';
    $filterBtn.classList.toggle('active', showArchived);
    loadProgrammes();
  });

  // ── Init ──────────────────────────────────────────────────
  loadProgrammes();
};
