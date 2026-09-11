// lib/auth/device-label.ts
//
// User-Agent → 'Windows · Chrome'. ONE implementation (rebuild.md §9 #6):
// legacy had two — auth.js and guard.js — with different vocabularies, and
// whichever script loaded last won. This is the auth.js one, because it
// ran on the login page and so is what every row in `sessions` and
// `auth_events` actually carries. Same tests, same order, same words.
//
// The order matters: Chrome's UA contains 'Safari', Edge's contains
// 'Chrome' — so Edge is tested first and Safari last.

export function buildDeviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent ?? '';

  let os = 'Unknown';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Macintosh/.test(ua)) os = 'Mac';
  else if (/iPhone/.test(ua)) os = 'iPhone';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Linux/.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';

  return os + ' · ' + browser;
}
