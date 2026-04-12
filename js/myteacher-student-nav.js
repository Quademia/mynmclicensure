// ============================================================
// QAcademy — myteacher-student-nav.js
// Injects the topbar into all /myteacher/student/* pages.
// Requires: /js/paths.js (MYTEACHER constant)
// Usage: <div id="myteacher-nav"></div>
//        <script src="/js/paths.js"></script>
//        <script src="/js/myteacher-student-nav.js"></script>
// ============================================================

(function () {
  const container = document.getElementById('myteacher-nav');
  if (!container) return;

  container.innerHTML = `
    <nav class="mt-topbar" id="mtTopbar">
      <div class="mt-topbar-inner">

        <!-- Brand -->
        <div class="mt-brand">
          <a href="${MYTEACHER.student}/dashboard.html" class="mt-brand-link">
            <img src="/images/QAcademy_Logo.png" alt="QAcademy" class="mt-brand-logo" />
            <div class="mt-brand-text">
              <span class="mt-brand-title">QAcademy</span>
              <span class="mt-brand-sub">My Teacher</span>
            </div>
          </a>
        </div>

        <!-- Desktop nav links -->
        <div class="mt-nav-links" id="mtNavLinks">
          <a href="${MYTEACHER.student}/dashboard.html"  class="mt-nav-link">Dashboard</a>
          <a href="${MYTEACHER.student}/my-classes.html" class="mt-nav-link">My Classes</a>
          <a href="${MYTEACHER.student}/my-results.html" class="mt-nav-link">My Results</a>
          <a href="${MYTEACHER.student}/profile.html"  class="mt-nav-link">Profile</a>
        </div>

        <!-- Right side -->
        <div class="mt-topbar-right">
          <span class="mt-user-chip" id="mtUserChip"></span>
          <a href="/mynmclicensure/login.html" class="mt-btn-switch">⇄ Licensure</a>
          <button class="mt-btn-signout" id="mtSignOut">Sign out</button>
          <button class="mt-hamburger" id="mtHamburger" aria-label="Menu">
            <span></span><span></span><span></span>
          </button>
        </div>

      </div>
    </nav>

    <!-- Mobile overlay -->
    <div class="mt-overlay" id="mtOverlay"></div>

    <!-- Mobile drawer -->
    <div class="mt-drawer" id="mtDrawer">
      <div class="mt-drawer-header">
        <span class="mt-brand-title">My Teacher</span>
        <button class="mt-drawer-close" id="mtDrawerClose">✕</button>
      </div>
      <nav class="mt-drawer-nav">
        <a href="${MYTEACHER.student}/dashboard.html"  class="mt-drawer-link">🏠 Dashboard</a>
        <a href="${MYTEACHER.student}/my-classes.html" class="mt-drawer-link">👥 My Classes</a>
        <a href="${MYTEACHER.student}/my-results.html" class="mt-drawer-link">📊 My Results</a>
        <a href="${MYTEACHER.student}/profile.html"  class="mt-drawer-link">👤 Profile</a>
        <div class="mt-drawer-divider"></div>
        <a href="/mynmclicensure/login.html" class="mt-drawer-link">⇄ Switch to Licensure</a>
        <div class="mt-drawer-divider"></div>
        <button class="mt-drawer-link mt-drawer-signout" id="mtDrawerSignOut">↩ Sign out</button>
      </nav>
    </div>
  `;

  // ── Inject styles ───────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .mt-topbar {
      position: sticky; top: 0; z-index: 100;
      background: var(--primary, #1e3a5f);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 2px 16px rgba(0,0,0,0.14);
    }
    .mt-topbar-inner {
      max-width: 1400px; margin: 0 auto;
      padding: 0 20px; height: 56px;
      display: flex; align-items: center; gap: 16px;
    }
    .mt-brand { flex-shrink: 0; }
    .mt-brand-link {
      display: flex; align-items: center; gap: 10px; text-decoration: none;
    }
    .mt-brand-logo { width: 30px; height: 30px; border-radius: 6px; object-fit: contain; }
    .mt-brand-text { display: flex; flex-direction: column; line-height: 1.1; }
    .mt-brand-title { font-size: 14px; font-weight: 800; color: #fff; letter-spacing: 0.2px; }
    .mt-brand-sub {
      font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.55);
      text-transform: uppercase; letter-spacing: 0.08em;
    }
    .mt-nav-links {
      display: flex; align-items: center; gap: 2px; flex: 1; margin-left: 8px;
    }
    .mt-nav-link {
      display: inline-flex; align-items: center;
      padding: 6px 12px; border-radius: 8px;
      font-size: 13px; font-weight: 600;
      color: rgba(255,255,255,0.72); text-decoration: none;
      transition: background 0.15s, color 0.15s; white-space: nowrap;
    }
    .mt-nav-link:hover { background: rgba(255,255,255,0.10); color: #fff; }
    .mt-nav-link.active { background: rgba(255,255,255,0.14); color: #fff; }
    .mt-topbar-right {
      display: flex; align-items: center; gap: 10px;
      flex-shrink: 0; margin-left: auto;
    }
    .mt-user-chip {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(255,255,255,0.10); color: rgba(255,255,255,0.85);
      border: 1px solid rgba(255,255,255,0.14); border-radius: 999px;
      padding: 4px 12px 4px 4px; font-size: 12px; font-weight: 600;
      max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .mt-user-chip-avatar {
      width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
    }
    .mt-user-chip-initials {
      width: 24px; height: 24px; border-radius: 50%;
      background: rgba(255,255,255,0.2); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 700; flex-shrink: 0;
    }
    .mt-user-chip-name {
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .mt-btn-switch {
      background: rgba(45,125,114,0.25);
      border: 1px solid rgba(45,125,114,0.4);
      color: rgba(255,255,255,0.85);
      font-size: 12px; font-weight: 600;
      padding: 5px 12px; border-radius: 8px;
      cursor: pointer; text-decoration: none;
      transition: background 0.15s; white-space: nowrap;
    }
    .mt-btn-switch:hover { background: rgba(45,125,114,0.40); color: #fff; }
    .mt-btn-signout {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.14);
      color: rgba(255,255,255,0.72);
      font-size: 12px; font-weight: 600;
      padding: 5px 12px; border-radius: 8px; cursor: pointer;
      transition: background 0.15s, color 0.15s; white-space: nowrap;
    }
    .mt-btn-signout:hover {
      background: rgba(220,38,38,0.25);
      border-color: rgba(220,38,38,0.35); color: #fca5a5;
    }
    .mt-hamburger {
      display: none; flex-direction: column;
      justify-content: center; gap: 4px;
      width: 36px; height: 36px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 8px; cursor: pointer; padding: 8px;
    }
    .mt-hamburger span {
      display: block; height: 2px;
      background: rgba(255,255,255,0.85);
      border-radius: 2px;
    }
    .mt-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.45); z-index: 200;
    }
    .mt-overlay.open { display: block; }
    .mt-drawer {
      position: fixed; top: 0; left: -280px;
      width: 280px; height: 100vh;
      background: var(--primary, #1e3a5f);
      z-index: 201; transition: left 0.25s ease;
      display: flex; flex-direction: column; overflow-y: auto;
    }
    .mt-drawer.open { left: 0; }
    .mt-drawer-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.10);
    }
    .mt-drawer-close {
      background: none; border: none; color: rgba(255,255,255,0.6);
      font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 6px;
    }
    .mt-drawer-close:hover { color: #fff; }
    .mt-drawer-nav { display: flex; flex-direction: column; padding: 12px 0; }
    .mt-drawer-link {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 20px; font-size: 14px; font-weight: 600;
      color: rgba(255,255,255,0.75); text-decoration: none;
      transition: background 0.15s, color 0.15s;
      background: none; border: none; cursor: pointer;
      text-align: left; width: 100%;
    }
    .mt-drawer-link:hover { background: rgba(255,255,255,0.08); color: #fff; }
    .mt-drawer-link.active { background: rgba(255,255,255,0.12); color: #fff; }
    .mt-drawer-divider { height: 1px; background: rgba(255,255,255,0.10); margin: 8px 0; }
    .mt-drawer-signout { color: rgba(252,165,165,0.85); }
    .mt-drawer-signout:hover { background: rgba(220,38,38,0.18); color: #fca5a5; }
    @media (max-width: 860px) {
      .mt-nav-links { display: none; }
      .mt-btn-switch { display: none; }
      .mt-btn-signout { display: none; }
      .mt-hamburger { display: flex; }
    }
    @media (max-width: 480px) { .mt-user-chip { display: none; } }
  `;
  document.head.appendChild(style);

  // ── Active link ─────────────────────────────────────────
  const path = window.location.pathname;
  document.querySelectorAll('.mt-nav-link, .mt-drawer-link').forEach(link => {
    if (link.href && link.href.includes(path)) link.classList.add('active');
  });

  // ── Set user ────────────────────────────────────────────
  window.mtSetUser = function (profile) {
    const name = profile.forename || profile.name || profile.email || '';
    const chip = document.getElementById('mtUserChip');
    if (!chip) return;
    const avatarUrl = profile.avatar_url;
    const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const avatarHtml = avatarUrl
      ? `<img class="mt-user-chip-avatar" src="${avatarUrl}" alt="" />`
      : `<span class="mt-user-chip-initials">${initials}</span>`;
    // Build avatar safely
    const avatarImg = document.createElement('img');
    avatarImg.className = 'mt-user-chip-avatar';
    const avatarFallback = document.createElement('span');
    avatarFallback.className = 'mt-user-chip-initials';
    safeText(avatarFallback, name ? name.charAt(0).toUpperCase() : '?');
    safeAvatar(avatarImg, avatarUrl, avatarFallback);

    // Build name safely
    const nameSpan = document.createElement('span');
    nameSpan.className = 'mt-user-chip-name';
    safeText(nameSpan, name);

    // Clear chip and append safe elements
    chip.innerHTML = '';
    chip.appendChild(avatarImg);
    chip.appendChild(avatarFallback);
    chip.appendChild(nameSpan);
  };

  // ── Sign out ────────────────────────────────────────────
  async function signOut() {
    await deactivateCurrentSession();
    await db.auth.signOut();
    window.location.href = '/myteacher/login.html';
  }
  document.getElementById('mtSignOut').addEventListener('click', signOut);
  document.getElementById('mtDrawerSignOut').addEventListener('click', signOut);

  // ── Hamburger ───────────────────────────────────────────
  const hamburger   = document.getElementById('mtHamburger');
  const drawer      = document.getElementById('mtDrawer');
  const overlay     = document.getElementById('mtOverlay');
  const drawerClose = document.getElementById('mtDrawerClose');

  function openDrawer()  {
    drawer.classList.add('open'); overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    drawer.classList.remove('open'); overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', openDrawer);
  drawerClose.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);

})();
