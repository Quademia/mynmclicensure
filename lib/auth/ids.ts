// lib/auth/ids.ts
//
// The id makers, transcribed from legacy register.html (makeSecureId) and
// auth.js (makeEventId, createLoginSession). Same prefixes, same lengths,
// same case, so an id in a support conversation reads the same on both
// sides of the rebuild:
//   U_    + 16 hex, UPPER   (users.user_id)
//   SESS_ + 32 hex, UPPER   (sessions.session_id — a UUID with the dashes out)
//   EVT_  + 16 hex, lower   (auth_events.event_id; legacy also used it for
//                            reset_requests.request_id — kept)
//
// Web Crypto only, so the same file runs on the Worker and in Node.

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function makeUserId(): string {
  return 'U_' + randomHex(8).toUpperCase();
}

export function makeSessionId(): string {
  return 'SESS_' + crypto.randomUUID().replace(/-/g, '').toUpperCase();
}

export function makeEventId(): string {
  return 'EVT_' + randomHex(8);
}
