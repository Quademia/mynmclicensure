// lib/auth/request-info.ts
//
// What the server knows about the caller from the request itself: the
// user agent (→ ua_hash, device_label), the client IP (→ ip_hash, §8 S6,
// which legacy could never fill because a browser cannot see its own IP),
// and the origin the browser used (→ the redirect target for Google,
// magic-link and reset emails, so a link comes back to the site that
// sent it — localhost in dev, the Worker address on dev, the domain in
// prod).
//
// Server only: reads next/headers.

import { headers } from 'next/headers';
import { sha256Hex } from './hash';
import { buildDeviceLabel } from './device-label';

export type RequestInfo = {
  userAgent: string;
  uaHash: string | null;
  ipHash: string | null;
  deviceLabel: string;
};

export async function requestInfo(): Promise<RequestInfo> {
  const h = await headers();
  const userAgent = h.get('user-agent') ?? '';
  // Cloudflare sets cf-connecting-ip on the Worker; x-forwarded-for covers
  // any other proxy; locally there is neither and the hash is null.
  const ip =
    h.get('cf-connecting-ip') ??
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;

  const [uaHash, ipHash] = await Promise.all([
    sha256Hex(userAgent),
    ip ? sha256Hex(ip) : Promise.resolve(null),
  ]);

  return { userAgent, uaHash, ipHash, deviceLabel: buildDeviceLabel(userAgent) };
}

/**
 * The public origin the browser used for this request, e.g.
 * http://localhost:3000 or https://licensure-dev.qacademynurses.workers.dev.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get('origin');
  if (origin) return origin;
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}
