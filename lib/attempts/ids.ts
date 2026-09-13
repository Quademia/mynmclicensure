// lib/attempts/ids.ts
//
// The attempt id, as every legacy spawn made it:
//   'ATT_' + Date.now() + '_' + makeSecureId('').slice(0, 7)
// — the millisecond clock, then seven UPPER hex characters.

export function makeAttemptId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return 'ATT_' + Date.now() + '_' + hex.slice(0, 7);
}
