// ============================================================
// QAcademy Nurses Hub — Auth Utilities
// js/auth.js
//
// Shared helpers for authentication: hashing, device
// fingerprinting, and event ID generation.
// Used by login.html and future login method pages.
// ============================================================

/**
 * Hashes a string with SHA-256 and returns the first 32 hex chars.
 * Returns null if hashing fails (e.g. insecure context).
 */
async function sha256Hex(input) {
  try {
    const encoded = new TextEncoder().encode(input);
    const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('').slice(0, 32);
  } catch (_) {
    return null;
  }
}

/**
 * Builds a device fingerprint hash from screen, timezone, language,
 * and platform. Not as strong as an IP address, but gives us a
 * second tracking bucket for rate limiting.
 * Returns a 32-char hex string, or null on error.
 */
async function buildFpHash() {
  try {
    const parts = [
      screen.width,
      screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
      navigator.platform
    ].join('|');
    return await sha256Hex(parts);
  } catch (_) {
    return null;
  }
}

/**
 * Generates a unique auth event ID: EVT_ + 16 random hex chars.
 */
function makeEventId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return 'EVT_' + hex;
}

/**
 * Builds a short device label from the user-agent string.
 * Returns something like "Windows · Chrome" or "iPhone · Safari".
 */
function buildDeviceLabel() {
  const ua = navigator.userAgent || '';
  let os = 'Unknown';
  if (/Windows/.test(ua))       os = 'Windows';
  else if (/Macintosh/.test(ua)) os = 'Mac';
  else if (/iPhone/.test(ua))    os = 'iPhone';
  else if (/Android/.test(ua))   os = 'Android';
  else if (/Linux/.test(ua))     os = 'Linux';

  let browser = 'Browser';
  if (/Edg\//.test(ua))          browser = 'Edge';
  else if (/Chrome\//.test(ua))  browser = 'Chrome';
  else if (/Safari\//.test(ua))  browser = 'Safari';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';

  return os + ' \u00B7 ' + browser;
}

/**
 * Creates a session row in the sessions table and stores the
 * session_id in localStorage. This is the shared session-creation
 * logic used by both email/password login and OAuth/magic-link
 * callback flows.
 *
 * @param {string} userId  - The user's user_id from the users table
 * @param {string} loginVia - How they signed in: 'EMAIL', 'GOOGLE', or 'MAGIC_LINK'
 * @returns {Promise<string|null>} The new session_id, or null on failure
 */
async function createLoginSession(userId, loginVia) {
  const now = new Date();
  const expires = new Date(now);
  expires.setDate(expires.getDate() + 7);
  const nowIso     = now.toISOString();
  const expiresIso = expires.toISOString();

  const ua = navigator.userAgent || '';
  const uaHash = await sha256Hex(ua);
  const deviceLabel = buildDeviceLabel();

  // Count active non-expired sessions for this user
  const { count } = await db
    .from('sessions')
    .select('session_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('active', true)
    .gt('expires_utc', nowIso);

  if (count >= 2) {
    // Too many sessions — kick the oldest one
    const { data: oldest } = await db
      .from('sessions')
      .select('session_id')
      .eq('user_id', userId)
      .eq('active', true)
      .order('issued_utc', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (oldest) {
      await db.from('sessions')
        .update({ active: false })
        .eq('session_id', oldest.session_id);
    }
  }

  // Create new session row
  const sessionId = 'SESS_' + crypto.randomUUID()
    .replace(/-/g, '').toUpperCase();

  const { error } = await db.from('sessions').insert({
    session_id:    sessionId,
    user_id:       userId,
    kind:          'LOGIN',
    issued_utc:    nowIso,
    expires_utc:   expiresIso,
    last_seen_utc: nowIso,
    device_label:  deviceLabel,
    ua_hash:       uaHash,
    ip_hash:       null,
    login_via:     loginVia,
    active:        true
  });

  if (error) {
    console.error('Session creation failed:', error.message);
    return null;
  }

  localStorage.setItem('qa_session_id', sessionId);
  return sessionId;
}
