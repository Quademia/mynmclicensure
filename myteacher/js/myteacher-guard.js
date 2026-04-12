// ============================================================
// QAcademy — myteacher-guard.js
// Protects all MyTeacher pages that require login.
// Called as: const profile = await guardPage('STUDENT')
//                         or guardPage('TEACHER')
//                         or guardPage('ADMIN')
//
// Supported roles: STUDENT | TEACHER | ADMIN
//
// Mirror of js/guard.js — differences:
//   - Reads from teacher_users (not users)
//   - Reads/writes sessions to teacher_sessions (not sessions)
//   - Uses mt_session_id in localStorage (not qa_session_id)
//   - Redirects to /myteacher/login.html on auth failure
//   - Redirects to /myteacher/router.html on role mismatch
//
// TEACHER check is two-level:
//   1. teacher_users.role === 'TEACHER'
//   2. teacher_profiles.active === true
// Both must pass. A teacher with active=false is pending/disabled
// and gets redirected to the access request page.
//
// ADMIN bypass: role=ADMIN always passes any guardPage() call
// regardless of requiredRole. Admin can access all pages.
// ============================================================

// ── Session helpers ─────────────────────────────────────────

function buildDeviceLabel() {
  const ua = navigator.userAgent || '';
  let os = 'Unknown OS';
  let browser = 'Unknown Browser';

  if (/windows/i.test(ua))           os = 'Windows';
  else if (/iphone|ipad/i.test(ua))  os = 'iOS';
  else if (/android/i.test(ua))      os = 'Android';
  else if (/mac os/i.test(ua))       os = 'macOS';
  else if (/linux/i.test(ua))        os = 'Linux';

  if (/edg\//i.test(ua))             browser = 'Edge';
  else if (/chrome/i.test(ua))       browser = 'Chrome';
  else if (/firefox/i.test(ua))      browser = 'Firefox';
  else if (/safari/i.test(ua))       browser = 'Safari';
  else if (/opr\//i.test(ua))        browser = 'Opera';

  return os + ' · ' + browser;
}

async function deactivateCurrentSession() {
  try {
    const sessionId = localStorage.getItem('mt_session_id');
    if (!sessionId) return;
    await db
      .from('teacher_sessions')
      .update({ active: false })
      .eq('session_id', sessionId);
    localStorage.removeItem('mt_session_id');
  } catch (err) {
    console.error('deactivateCurrentSession:', err);
  }
}

async function verifySession(userId) {
  try {
    const sessionId = localStorage.getItem('mt_session_id');
    if (!sessionId) return false;

    const now = new Date().toISOString();

    const { data: session, error } = await db
      .from('teacher_sessions')
      .select('session_id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .eq('active', true)
      .gt('expires_utc', now)
      .maybeSingle();

    if (error || !session) {
      localStorage.removeItem('mt_session_id');
      return false;
    }

    // Fire and forget — don't slow down page load
    db.from('teacher_sessions')
      .update({ last_seen_utc: now })
      .eq('session_id', sessionId)
      .then(() => {}).catch(() => {});

    return true;

  } catch (err) {
    console.error('verifySession:', err);
    return false;
  }
}

async function guardPage(requiredRole = null) {

  // ── 1. Check session ──────────────────────────────────────
  const { data: { session } } = await db.auth.getSession();

  if (!session) {
    window.location.href = '/myteacher/login.html';
    return null;
  }

  // ── 2. Get user profile from teacher_users table ────────
  const { data: profile } = await db
    .from('teacher_users')
    .select('*')
    .eq('auth_id', session.user.id)
    .maybeSingle();

  if (!profile) {
    window.location.href = '/myteacher/login.html';
    return null;
  }

  // ── 3. Check account is active ────────────────────────────
  if (!profile.active) {
    await db.auth.signOut();
    window.location.href = '/myteacher/login.html';
    return null;
  }

  // ── 4. Verify device session is still active ──────────────
  const sessionValid = await verifySession(profile.user_id);
  if (!sessionValid) {
    await db.auth.signOut();
    window.location.href = '/myteacher/login.html';
    return null;
  }

  // ── 5. ADMIN bypass ───────────────────────────────────────
  // Admin can access any page regardless of requiredRole
  if (profile.role === 'ADMIN') {
    _notifySidebar(profile);
    return profile;
  }

  // ── 6. Role check ─────────────────────────────────────────
  if (requiredRole) {

    // ── 6a. TEACHER — two-level check ───────────────────────
    if (requiredRole === 'TEACHER') {

      // First level: role must be TEACHER
      if (profile.role !== 'TEACHER') {
        window.location.href = '/myteacher/router.html';
        return null;
      }

      // Second level: teacher_profiles.active must be true
      const { data: teacherProfile } = await db
        .from('teacher_profiles')
        .select('active')
        .eq('teacher_id', profile.user_id)
        .maybeSingle();

      if (!teacherProfile || !teacherProfile.active) {
        // Has TEACHER role but not yet active — send to access request page
        window.location.href = '/myteacher/access-request.html';
        return null;
      }

      // Both checks passed — return full profile
      _notifySidebar(profile);
      return profile;
    }

    // ── 6b. STUDENT check ───────────────────────────────────
    if (requiredRole === 'STUDENT') {
      if (profile.role !== 'STUDENT' && profile.role !== 'TEACHER') {
        // TEACHER can also access student-facing myteacher pages
        // (e.g. /myteacher/student/my-classes.html as a student view)
        window.location.href = '/myteacher/router.html';
        return null;
      }
      _notifySidebar(profile);
      return profile;
    }

    // ── 6c. Any other role mismatch ─────────────────────────
    if (profile.role !== requiredRole) {
      window.location.href = '/myteacher/router.html';
      return null;
    }
  }

  _notifySidebar(profile);
  return profile;
}

// Auto-set avatar in sidebar/nav if the functions exist
function _notifySidebar(profile) {
  if (typeof window.sidebarSetUser === 'function') window.sidebarSetUser(profile);
  if (typeof window.mtSetUser === 'function') window.mtSetUser(profile);

  // Load unread message badge (non-blocking)
  _loadMsgBadge(profile);
}

async function _loadMsgBadge(profile) {
  try {
    if (profile.role === 'ADMIN' && typeof window.adminUpdateMsgBadge === 'function') {
      const count = await getUnreadCountForAdmin();
      window.adminUpdateMsgBadge(count);
    }
    if (typeof window.sidebarUpdateMsgBadge === 'function' && typeof getUnreadCountForUser === 'function') {
      const count = await getUnreadCountForUser(profile.user_id);
      window.sidebarUpdateMsgBadge(count);
    }
  } catch (_) { /* silent — badge is non-critical */ }
}


// ============================================================
// logout()
// Signs out and redirects to MyTeacher login.
// Called by all MyTeacher pages via onclick="logout()"
// ============================================================
async function logout() {
  await deactivateCurrentSession();
  await db.auth.signOut();
  window.location.href = '/myteacher/login.html';
}
