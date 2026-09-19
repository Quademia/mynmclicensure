// lib/payments/trim.ts
//
// What of a Paystack reply is allowed onto the payment row (D32, Sam
// 2026-09-18). The port saved the whole reply in `payments.raw`; the
// verify reply carries the card's bin, expiry, bank, brand, a reusable
// authorization_code that can charge the card again, and the payer's
// IP — none of it read by the app, all of it shown by the admin's
// "Show raw payload" toggle and kept forever. Allow-lists, never
// block-lists: a field Paystack adds tomorrow is dropped by default.
//
// Kept from verify: the gateway's transaction id and reference,
// status, amount, currency, channel, paid time, gateway_response, the
// customer's email, and — so an admin can recognise a payment in a
// support conversation — channel, card_type and last4 of the card.
// Kept from initialize: the reference. The migration
// 20260919150000_payments_raw_scrub.sql applies the same shape to the
// rows already stored.
//
// Plain module (no 'use server'): imported by the Server Actions.

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pick(src: Obj, keys: readonly string[]): Obj {
  const out: Obj = {};
  for (const k of keys) {
    if (src[k] !== undefined && src[k] !== null) out[k] = src[k];
  }
  return out;
}

const VERIFY_TOP = ['status', 'message'] as const;
const VERIFY_DATA = ['id', 'reference', 'status', 'amount', 'currency', 'channel', 'paid_at', 'gateway_response'] as const;
const VERIFY_CUSTOMER = ['email'] as const;
const VERIFY_AUTHORIZATION = ['channel', 'card_type', 'last4'] as const;

const INIT_TOP = ['status', 'message'] as const;
const INIT_DATA = ['reference'] as const;

/** The verify reply, trimmed to what the row may hold. */
export function trimVerifyReply(reply: unknown): Obj {
  const r = isObj(reply) ? reply : {};
  const out = pick(r, VERIFY_TOP);
  if (isObj(r.data)) {
    const data = pick(r.data, VERIFY_DATA);
    if (isObj(r.data.customer)) data.customer = pick(r.data.customer, VERIFY_CUSTOMER);
    if (isObj(r.data.authorization)) data.authorization = pick(r.data.authorization, VERIFY_AUTHORIZATION);
    out.data = data;
  }
  return out;
}

/** The initialize reply, trimmed: the checkout address and access code stay out. */
export function trimInitReply(reply: unknown): Obj {
  const r = isObj(reply) ? reply : {};
  const out = pick(r, INIT_TOP);
  if (isObj(r.data)) out.data = pick(r.data, INIT_DATA);
  return out;
}
