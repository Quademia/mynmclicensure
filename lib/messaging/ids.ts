// lib/messaging/ids.ts
//
// Legacy's _msgId(prefix): the prefix, an underscore, and the first 16
// hex of a UUID in upper case — 'THR_…' for a thread, 'MSG_…' for a
// message, 'BULK_…' for a bulk batch (legacy stamped that one with the
// time as well; kept). The schema comment said Date.now() + random; the
// code did this, and the code wins (rebuild.md §3.2).

function hex16(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase();
}

export function makeThreadId(): string {
  return `THR_${hex16()}`;
}

export function makeMessageId(): string {
  return `MSG_${hex16()}`;
}

export function makeBulkBatchId(): string {
  const stamp = new Date().toISOString().replace(/[^0-9TZ]/g, '');
  return `BULK_${stamp}_${hex16().slice(0, 6)}`;
}
