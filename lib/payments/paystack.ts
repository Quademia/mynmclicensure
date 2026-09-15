// lib/payments/paystack.ts
//
// The two Paystack calls the Worker made, transcribed: initialize a
// transaction (returns the hosted checkout address) and verify one by
// reference. The secret key is read INSIDE each call, never at module
// scope (AGENTS.md, Known Workarounds), and never leaves the server.
// A non-OK reply or a `status: false` body throws with Paystack's own
// message, as legacy — the caller records it on the row and answers the
// browser with a generic message (rebuild.md §7.1: no `err.message` to
// the client).
//
// Server only.

export type PaystackResponse = {
  status: boolean;
  message?: string;
  data?: Record<string, unknown>;
};

export type PaystackInitPayload = {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callback_url: string;
  metadata: Record<string, unknown>;
};

function secretKey(): string {
  const key = String(process.env.PAYSTACK_SECRET_KEY || '').trim();
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set');
  return key;
}

export async function paystackInitialize(payload: PaystackInitPayload): Promise<PaystackResponse> {
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => null)) as PaystackResponse | null;
  if (!res.ok || !data?.status) {
    throw new Error(data?.message || 'Paystack initialize failed');
  }
  return data;
}

export async function paystackVerify(reference: string): Promise<PaystackResponse> {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => null)) as PaystackResponse | null;
  if (!res.ok || !data?.status) {
    throw new Error(data?.message || 'Paystack verify failed');
  }
  return data;
}
