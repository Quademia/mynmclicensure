// ============================================================
// student-panel.js — Student Overview modal component
//
// Usage:  openStudentPanel(userId, teacherId)
// Requires: db (config.js), /myteacher/js/myteacher-api.js (getStudentOverview),
//           utils.js (escapeHtml), paths.js (MYTEACHER)
// ============================================================

(function () {

  const esc = typeof escapeHtml === 'function' ? escapeHtml : s => String(s || '');

  // ── Inject styles (once) ──────────────────────────────────
  if (!document.getElementById('sp-styles')) {
    const style = document.createElement('style');
    style.id = 'sp-styles';
    style.textContent = `
      .sp-backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,0.35);
        display: none; align-items: center; justify-content: center;
        z-index: 600; padding: 16px;
      }
      .sp-backdrop.open { display: flex; }

      .sp-modal {
        background: #fff; border-radius: 18px;
        border: 1px solid var(--border, #e2e8f0);
        box-shadow: 0 20px 60px rgba(30,58,95,0.14);
        width: 100%; max-width: 900px; max-height: 90vh;
        display: flex; flex-direction: column; overflow: hidden;
      }

      /* Top bar */
      .sp-top {
        padding: 18px 20px; border-bottom: 1px solid var(--border, #e2e8f0);
        display: flex; align-items: center; gap: 14px; flex-shrink: 0;
      }
      .sp-avatar {
        width: 44px; height: 44px; border-radius: 50%;
        background: var(--accent, #2d7d72); color: #fff;
        display: flex; align-items: center; justify-content: center;
        font-size: 18px; font-weight: 800; flex-shrink: 0;
      }
      .sp-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
      .sp-identity { flex: 1; min-width: 0; }
      .sp-name { font-size: 15px; font-weight: 800; color: var(--primary, #1e3a5f); margin: 0; }
      .sp-email { font-size: 12px; color: var(--text-muted, #64748b); margin: 0; }
      .sp-close {
        background: none; border: none; font-size: 18px; cursor: pointer;
        color: var(--text-muted, #64748b); padding: 4px 8px; border-radius: 8px;
        flex-shrink: 0;
      }
      .sp-close:hover { background: var(--bg, #f8fafc); }

      /* Stats row */
      .sp-stats {
        display: flex; gap: 16px; padding: 10px 20px;
        border-bottom: 1px solid var(--border, #e2e8f0); flex-shrink: 0;
      }
      .sp-stat { text-align: center; flex: 1; }
      .sp-stat-val { font-size: 18px; font-weight: 800; color: var(--primary, #1e3a5f); }
      .sp-stat-label { font-size: 11px; color: var(--text-muted, #64748b); }

      /* Tabs */
      .sp-tabs {
        display: flex; border-bottom: 1px solid var(--border, #e2e8f0); flex-shrink: 0;
      }
      .sp-tab {
        flex: 1; padding: 10px; text-align: center; font-size: 13px; font-weight: 700;
        color: var(--text-muted, #64748b); cursor: pointer; border: none; background: none;
        border-bottom: 2px solid transparent; transition: color 0.15s, border-color 0.15s;
      }
      .sp-tab:hover { color: var(--primary, #1e3a5f); }
      .sp-tab.active { color: var(--accent, #2d7d72); border-bottom-color: var(--accent, #2d7d72); }

      /* Body */
      .sp-body { flex: 1; overflow-y: auto; padding: 16px 20px; }

      /* Table */
      .sp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .sp-table th {
        text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.3px; color: var(--text-muted, #64748b); padding: 6px 8px;
        border-bottom: 1px solid var(--border, #e2e8f0);
      }
      .sp-table td { padding: 8px; border-bottom: 1px solid var(--border, #e2e8f0); vertical-align: middle; }
      .sp-table tr:last-child td { border-bottom: none; }
      .sp-table tr:hover { background: var(--bg, #f8fafc); }
      .sp-table tr[data-href] { cursor: pointer; }

      /* Chips */
      .sp-chip {
        display: inline-flex; align-items: center; font-size: 11px; font-weight: 700;
        border-radius: 999px; padding: 2px 8px; border: 1px solid;
      }
      .sp-chip.pass { background: rgba(45,125,114,0.08); color: var(--accent, #2d7d72); border-color: rgba(45,125,114,0.22); }
      .sp-chip.fail { background: rgba(220,38,38,0.06); color: #b91c1c; border-color: rgba(220,38,38,0.18); }
      .sp-chip.active { background: rgba(45,125,114,0.08); color: var(--accent, #2d7d72); border-color: rgba(45,125,114,0.22); }
      .sp-chip.pending { background: rgba(234,179,8,0.08); color: #a16207; border-color: rgba(234,179,8,0.22); }
      .sp-chip.archived { background: rgba(100,116,139,0.08); color: var(--text-muted, #64748b); border-color: var(--border, #e2e8f0); }
      .sp-chip.ip { background: rgba(59,130,246,0.08); color: #2563eb; border-color: rgba(59,130,246,0.22); }

      /* Colour dot */
      .sp-cdot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; flex-shrink: 0; }

      /* Fields section */
      .sp-field-group { margin-bottom: 16px; }
      .sp-field-group:last-child { margin-bottom: 0; }
      .sp-field-header { font-size: 13px; font-weight: 700; color: var(--primary, #1e3a5f); margin: 0 0 8px; }
      .sp-field-row { display: flex; gap: 8px; font-size: 13px; padding: 4px 0; }
      .sp-field-key { color: var(--text-muted, #64748b); min-width: 100px; flex-shrink: 0; }
      .sp-field-val { color: var(--text, #334155); }

      /* Empty */
      .sp-empty { text-align: center; padding: 32px 16px; color: var(--text-muted, #64748b); font-size: 13px; }
      .sp-empty-icon { font-size: 32px; margin-bottom: 8px; }

      /* Loading */
      .sp-loading { text-align: center; padding: 32px; font-size: 13px; color: var(--text-muted, #64748b); }

      /* Back button */
      .sp-back {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 13px; font-weight: 700; color: var(--accent, #2d7d72);
        background: none; border: none; cursor: pointer; padding: 0 0 12px;
      }
      .sp-back:hover { text-decoration: underline; }

      /* Attempt detail */
      .sp-attempt-header {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px; flex-wrap: wrap; margin-bottom: 14px;
        padding-bottom: 12px; border-bottom: 1px solid var(--border, #e2e8f0);
      }
      .sp-attempt-title { font-size: 15px; font-weight: 800; color: var(--primary, #1e3a5f); }
      .sp-attempt-meta { font-size: 12px; color: var(--text-muted, #64748b); }

      .sp-question { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--border, #e2e8f0); }
      .sp-question:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
      .sp-q-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
      .sp-q-num { font-size: 12px; font-weight: 800; color: var(--primary, #1e3a5f); }
      .sp-q-stem { font-size: 13px; color: var(--text, #334155); margin-bottom: 8px; line-height: 1.5; }
      .sp-q-options { display: flex; flex-direction: column; gap: 4px; }
      .sp-q-opt {
        display: flex; align-items: flex-start; gap: 8px; padding: 6px 10px;
        border-radius: 8px; font-size: 13px; border: 1px solid var(--border, #e2e8f0);
      }
      .sp-q-opt.correct { background: rgba(45,125,114,0.06); border-color: rgba(45,125,114,0.22); }
      .sp-q-opt.wrong { background: rgba(220,38,38,0.04); border-color: rgba(220,38,38,0.15); }
      .sp-q-opt-letter { font-weight: 800; min-width: 18px; color: var(--text-muted, #64748b); }
      .sp-q-rationale { font-size: 12px; color: var(--text-muted, #64748b); margin-top: 6px; padding: 8px 10px; background: var(--bg, #f8fafc); border-radius: 8px; line-height: 1.5; }

      @media (max-width: 640px) {
        .sp-modal { max-width: 100%; border-radius: 14px; }
        .sp-stats { gap: 8px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Inject modal shell (once) ─────────────────────────────
  let backdrop = document.getElementById('spBackdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'spBackdrop';
    backdrop.className = 'sp-backdrop';
    backdrop.innerHTML = `
      <div class="sp-modal" id="spModal">
        <div class="sp-top">
          <div class="sp-avatar" id="spAvatar"></div>
          <div class="sp-identity">
            <div class="sp-name" id="spName"></div>
            <div class="sp-email" id="spEmail"></div>
          </div>
          <button class="sp-close" id="spClose">&times;</button>
        </div>
        <div class="sp-stats">
          <div class="sp-stat"><div class="sp-stat-val" id="spAttempts">—</div><div class="sp-stat-label">Attempts</div></div>
          <div class="sp-stat"><div class="sp-stat-val" id="spAvgScore">—</div><div class="sp-stat-label">Avg Score</div></div>
          <div class="sp-stat"><div class="sp-stat-val" id="spPassRate">—</div><div class="sp-stat-label">Pass Rate</div></div>
        </div>
        <div class="sp-tabs">
          <button class="sp-tab active" data-tab="attempts">Attempts</button>
          <button class="sp-tab" data-tab="classes">Classes</button>
          <button class="sp-tab" data-tab="fields">Fields</button>
        </div>
        <div class="sp-body" id="spBody">
          <div class="sp-loading">Loading...</div>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    // Close handlers
    document.getElementById('spClose').addEventListener('click', closePanel);
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) closePanel();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && backdrop.classList.contains('open')) closePanel();
    });

    // Tab switching
    backdrop.querySelector('.sp-tabs').addEventListener('click', function (e) {
      const tab = e.target.closest('.sp-tab');
      if (!tab) return;
      backdrop.querySelectorAll('.sp-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderTab(tab.dataset.tab);
    });
  }

  // ── State ─────────────────────────────────────────────────
  let data = null; // { user, classes, attempts, quizMap, classMap }

  // ── Helpers ───────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function initials(user) {
    if (!user) return '?';
    const fn = user.display_name || user.forename || user.name || user.email || '';
    return fn.charAt(0).toUpperCase();
  }

  function statusChip(status) {
    const s = (status || '').toUpperCase();
    const cls = s === 'ACTIVE' ? 'active' : s === 'PENDING' ? 'pending' : s === 'IN_PROGRESS' ? 'ip' : 'archived';
    return '<span class="sp-chip ' + cls + '">' + esc(s) + '</span>';
  }

  function passChip(scorePct, threshold) {
    if (scorePct == null) return '—';
    const pass = scorePct >= (threshold || 50);
    return '<span class="sp-chip ' + (pass ? 'pass' : 'fail') + '">' + (pass ? 'PASS' : 'FAIL') + '</span>';
  }

  // ── Open ──────────────────────────────────────────────────
  function closePanel() {
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
    data = null;
  }

  window.openStudentPanel = async function openStudentPanel(userId, teacherId) {
    // Show modal with loading
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
    $('spBody').innerHTML = '<div class="sp-loading">Loading student data...</div>';
    $('spName').textContent = '';
    $('spEmail').textContent = '';
    $('spAvatar').innerHTML = '';
    $('spAttempts').textContent = '—';
    $('spAvgScore').textContent = '—';
    $('spPassRate').textContent = '—';

    // Reset tabs
    backdrop.querySelectorAll('.sp-tab').forEach(t => t.classList.remove('active'));
    backdrop.querySelector('.sp-tab[data-tab="attempts"]').classList.add('active');

    // Fetch
    data = await getStudentOverview(userId, teacherId);

    if (!data.user) {
      $('spBody').innerHTML = '<div class="sp-empty"><div class="sp-empty-icon">⚠️</div>Student not found.</div>';
      return;
    }

    // Populate top bar
    const u = data.user;
    const displayName = u.display_name || [u.forename, u.surname].filter(Boolean).join(' ') || u.name || u.email || 'Unknown';
    $('spName').textContent = displayName;
    $('spEmail').textContent = u.email || '';

    if (u.avatar_url) {
      $('spAvatar').innerHTML = '<img src="' + esc(u.avatar_url) + '" alt="" />';
    } else {
      $('spAvatar').textContent = initials(u);
    }

    // Stats
    const submitted = data.attempts.filter(a => a.status === 'SUBMITTED' || a.status === 'TIMED_OUT');
    $('spAttempts').textContent = submitted.length;

    if (submitted.length) {
      const avgPct = submitted.reduce((sum, a) => sum + (a.score_pct || 0), 0) / submitted.length;
      $('spAvgScore').textContent = Math.round(avgPct) + '%';

      const passed = submitted.filter(a => (a.score_pct || 0) >= 50).length;
      $('spPassRate').textContent = Math.round((passed / submitted.length) * 100) + '%';
    }

    // Render default tab
    renderTab('attempts');
  };

  // ── Tab renderer ──────────────────────────────────────────
  function renderTab(tab) {
    if (!data) return;
    const body = $('spBody');

    if (tab === 'attempts') renderAttempts(body);
    else if (tab === 'classes') renderClasses(body);
    else if (tab === 'fields') renderFields(body);
  }

  // ── Attempts tab ──────────────────────────────────────────
  function renderAttempts(body) {
    const submitted = data.attempts.filter(a => a.status === 'SUBMITTED' || a.status === 'TIMED_OUT');

    if (!submitted.length) {
      body.innerHTML = '<div class="sp-empty"><div class="sp-empty-icon">📝</div>No submitted attempts yet.</div>';
      return;
    }

    let html = '<table class="sp-table"><thead><tr>';
    html += '<th>Quiz</th><th>Class</th><th>#</th><th>Score</th><th>Result</th><th>Date</th>';
    html += '</tr></thead><tbody>';

    submitted.forEach(a => {
      const quiz = data.quizMap[a.teacher_quiz_id] || {};
      const quizTitle = quiz.title || '—';
      const classTitle = data.classMap[a.class_id] || '—';
      const score = a.score_raw != null ? a.score_raw + '/' + a.score_total + ' (' + Math.round(a.score_pct || 0) + '%)' : '—';

      html += '<tr data-attempt="' + esc(a.attempt_id) + '">';
      html += '<td>' + esc(quizTitle) + '</td>';
      html += '<td>' + esc(classTitle) + '</td>';
      html += '<td>' + (a.attempt_no || 1) + '</td>';
      html += '<td>' + esc(score) + '</td>';
      html += '<td>' + passChip(a.score_pct, 50) + '</td>';
      html += '<td>' + fmtDate(a.submitted_at) + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
    body.innerHTML = html;

    // Click row to drill down into attempt detail
    body.querySelectorAll('tr[data-attempt]').forEach(tr => {
      tr.addEventListener('click', function () {
        openAttemptDetail(this.dataset.attempt);
      });
    });
  }

  // ── Attempt detail drill-down ─────────────────────────────
  async function openAttemptDetail(attemptId) {
    const body = $('spBody');
    body.innerHTML = '<div class="sp-loading">Loading attempt...</div>';

    const result = await getAttemptDetailForTeacher(attemptId);
    if (!result.success) {
      body.innerHTML = '<div class="sp-empty"><div class="sp-empty-icon">⚠️</div>' + esc(result.message || 'Could not load attempt.') + '</div>';
      return;
    }

    const att = result.attempt;
    const questions = result.questions;
    const quiz = data.quizMap[att.teacher_quiz_id] || {};

    let html = '<button class="sp-back" id="spBackBtn">← Back to attempts</button>';

    // Attempt header
    html += '<div class="sp-attempt-header">';
    html += '<div>';
    html += '<div class="sp-attempt-title">' + esc(quiz.title || 'Quiz') + ' — Attempt ' + (att.attempt_no || 1) + '</div>';
    html += '<div class="sp-attempt-meta">';
    html += 'Score: ' + (att.score_raw != null ? att.score_raw + '/' + att.score_total + ' (' + Math.round(att.score_pct || 0) + '%)' : '—');
    html += ' · ' + (att.pass_fail || '—');
    if (att.grade_label) html += ' · ' + esc(att.grade_label);
    html += ' · ' + fmtDate(att.submitted_at);
    html += '</div></div>';
    html += '</div>';

    // Questions
    questions.forEach(q => {
      const correctSet = new Set((q.correct_answer || '').split(',').map(s => s.trim()).filter(Boolean));
      const studentSet = new Set(Array.isArray(q.student_answer) ? q.student_answer : [q.student_answer].filter(Boolean));

      html += '<div class="sp-question">';
      html += '<div class="sp-q-header">';
      html += '<span class="sp-q-num">Q' + q.position + '</span>';
      html += '<span class="sp-chip ' + (q.is_correct ? 'pass' : 'fail') + '">' + (q.is_correct ? 'Correct' : 'Wrong') + '</span>';
      html += '<span style="font-size:11px;color:var(--text-muted)">' + esc(q.question_type) + ' · ' + q.marks + ' mark' + (q.marks !== 1 ? 's' : '') + '</span>';
      html += '</div>';
      html += '<div class="sp-q-stem">' + esc(q.stem) + '</div>';
      html += '<div class="sp-q-options">';

      q.options.forEach(opt => {
        const isCorrect = correctSet.has(opt.letter);
        const isChosen = studentSet.has(opt.letter);
        let cls = '';
        if (isCorrect) cls = 'correct';
        else if (isChosen && !isCorrect) cls = 'wrong';

        html += '<div class="sp-q-opt ' + cls + '">';
        html += '<span class="sp-q-opt-letter">' + esc(opt.letter) + '</span>';
        html += '<span>' + esc(opt.text) + '</span>';
        if (isCorrect) html += '<span style="margin-left:auto;font-size:11px;color:var(--accent)">✓</span>';
        if (isChosen && !isCorrect) html += '<span style="margin-left:auto;font-size:11px;color:#b91c1c">✗</span>';
        html += '</div>';
      });

      html += '</div>';

      if (q.rationale) {
        html += '<div class="sp-q-rationale"><strong>Rationale:</strong> ' + esc(q.rationale) + '</div>';
      }

      html += '</div>';
    });

    body.innerHTML = html;

    // Back button
    document.getElementById('spBackBtn').addEventListener('click', function () {
      renderAttempts($('spBody'));
    });
  }

  // ── Classes tab ───────────────────────────────────────────
  function renderClasses(body) {
    if (!data.classes.length) {
      body.innerHTML = '<div class="sp-empty"><div class="sp-empty-icon">🏫</div>Not a member of any classes.</div>';
      return;
    }

    let html = '<table class="sp-table"><thead><tr>';
    html += '<th>Class</th><th>Semester</th><th>Joined</th><th>Status</th>';
    html += '</tr></thead><tbody>';

    data.classes.forEach(m => {
      const cls = m.teacher_classes || {};
      const colourDot = cls.colour ? '<span class="sp-cdot" style="background:' + esc(cls.colour) + '"></span>' : '';
      const semester = [cls.academic_year, cls.semester].filter(Boolean).join(' · ') || '—';

      html += '<tr>';
      html += '<td>' + colourDot + esc(cls.title || '—') + '</td>';
      html += '<td>' + esc(semester) + '</td>';
      html += '<td>' + fmtDate(m.joined_at) + '</td>';
      html += '<td>' + statusChip(m.status) + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
    body.innerHTML = html;
  }

  // ── Fields tab ────────────────────────────────────────────
  function renderFields(body) {
    const classesWithFields = data.classes.filter(m => {
      const cls = m.teacher_classes || {};
      const cfJson = cls.custom_fields_json;
      let fields = [];
      try {
        const parsed = typeof cfJson === 'object' ? cfJson : JSON.parse(cfJson || '{}');
        fields = parsed.fields || parsed || [];
      } catch (_) {}
      return Array.isArray(fields) && fields.length > 0;
    });

    if (!classesWithFields.length) {
      body.innerHTML = '<div class="sp-empty"><div class="sp-empty-icon">📋</div>No custom fields configured for this student\'s classes.</div>';
      return;
    }

    let html = '';
    classesWithFields.forEach(m => {
      const cls = m.teacher_classes || {};
      const colourDot = cls.colour ? '<span class="sp-cdot" style="background:' + esc(cls.colour) + '"></span>' : '';

      // Parse class field definitions
      let fieldDefs = [];
      try {
        const parsed = typeof cls.custom_fields_json === 'object' ? cls.custom_fields_json : JSON.parse(cls.custom_fields_json || '{}');
        fieldDefs = parsed.fields || parsed || [];
      } catch (_) {}

      // Parse student's field values
      let memberValues = {};
      try {
        const mf = typeof m.member_fields_json === 'object' ? m.member_fields_json : JSON.parse(m.member_fields_json || '{}');
        memberValues = (mf && typeof mf === 'object' && !Array.isArray(mf)) ? mf : (mf?.fields || {});
      } catch (_) {}

      html += '<div class="sp-field-group">';
      html += '<div class="sp-field-header">' + colourDot + esc(cls.title || '—') + '</div>';

      if (Array.isArray(fieldDefs) && fieldDefs.length) {
        fieldDefs.forEach(f => {
          const key = f.key || f.label || '';
          const label = f.label || f.key || '';
          const val = memberValues[key] || memberValues[label] || '—';
          html += '<div class="sp-field-row"><div class="sp-field-key">' + esc(label) + '</div><div class="sp-field-val">' + esc(val) + '</div></div>';
        });
      } else {
        html += '<div class="sp-field-row" style="color:var(--text-muted)">No fields defined</div>';
      }

      html += '</div>';
    });

    body.innerHTML = html;
  }

})();
