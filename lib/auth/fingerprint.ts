// lib/auth/fingerprint.ts
//
// The device fingerprint the rate limit is keyed on, transcribed from
// legacy auth.js buildFpHash(): screen size, timezone, language and
// platform, joined with '|' and hashed. BROWSER ONLY — the server cannot
// see any of these, so the form computes it and posts it as a hidden
// field (rebuild.md §10). Null when the browser refuses (insecure
// context), and the server then rate-limits on the email alone, as legacy.

'use client';

import { sha256Hex } from './hash';

export async function buildFpHash(): Promise<string | null> {
  try {
    const parts = [
      screen.width,
      screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
      navigator.platform,
    ].join('|');
    return await sha256Hex(parts);
  } catch {
    return null;
  }
}
