// lib/auth/hash.ts
//
// sha256Hex, transcribed from legacy auth.js: SHA-256, hex, truncated to
// the first 32 characters. Returns null when hashing is unavailable.
// Used for ua_hash, fp_hash and (new, §8 S6) ip_hash — all three columns
// hold the same shape of value, so one function.

export async function sha256Hex(input: string): Promise<string | null> {
  try {
    const encoded = new TextEncoder().encode(input);
    const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32);
  } catch {
    return null;
  }
}
