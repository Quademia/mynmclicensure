// ============================================================
// QAcademy Nurses Hub — Shared UI Utilities
// js/utils.js
//
// Safe DOM helpers — use these instead of innerHTML whenever
// displaying user-controlled values (names, URLs, free text).
// ============================================================

/**
 * Safely sets text content on an element.
 * Never interprets the value as HTML — prevents XSS.
 * Usage: safeText(element, user.name)
 */
function safeText(element, value) {
  element.textContent = value || '';
}

/**
 * Escapes a string for safe insertion into HTML template literals.
 * Use this when building innerHTML via template strings with user data.
 * Usage: `<div>${escapeHtml(user.name)}</div>`
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Safely sets an avatar image src with URL validation.
 * Only allows http:// and https:// URLs.
 * Falls back to initials element if URL is missing or unsafe.
 * Usage: safeAvatar(imgEl, user.avatar_url, fallbackEl)
 */
function safeAvatar(imgEl, url, fallbackEl) {
  const safe = url
    && typeof url === 'string'
    && (url.startsWith('https://') || url.startsWith('http://'));

  if (safe) {
    imgEl.src = url;
    imgEl.style.display = '';
    if (fallbackEl) fallbackEl.style.display = 'none';
  } else {
    imgEl.style.display = 'none';
    if (fallbackEl) fallbackEl.style.display = '';
  }
}
