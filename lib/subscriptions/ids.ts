// lib/subscriptions/ids.ts
//
// Two subscription-id makers, because legacy had two (rebuild.md §7):
//   the payments Worker's makeId('SUB')  → 'SUB_' + 10 chars of a UUID, UPPER
//   register.html's makeSecureId('SUB_') → 'SUB_' + 16 hex, UPPER
// Admin grants and Paystack activations use the first; the self-trial at
// registration uses the second. Kept as they were so an id in a support
// conversation reads the same on both sides of the rebuild.

export function makeSubscriptionId(): string {
  const part = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  return `SUB_${part}`;
}

export function makeTrialSubscriptionId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return 'SUB_' + hex.toUpperCase();
}
