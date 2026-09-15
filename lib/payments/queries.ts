// lib/payments/queries.ts
//
// The payments Worker's data lookups, transcribed one for one
// (legacy/mynmclicensure/workers/payment-worker/src/index.js): the
// payment by reference, the payer by id / email / login id, the product
// (with or without the active check — activation looks a product up
// without it), and the subscription a reference already produced (the
// replay guard). Every caller passes the service-role client: the payer
// has no session, and the `payments` table has no write policy.
//
// Server only.

import type { createServiceRoleClient } from '@/lib/supabase/server';
import type { Subscription } from '@/lib/subscriptions/types';
import type { Payment, PaymentUser } from './types';

export type ServiceDb = ReturnType<typeof createServiceRoleClient>;

export type PaymentProduct = {
  product_id: string;
  name: string;
  duration_days: number;
  price_minor: number;
  currency: string;
  status: string;
};

const USER_COLUMNS = 'user_id, email, auth_id, forename, surname, name, active, program_id, phone_number';

export async function getPaymentByReference(db: ServiceDb, reference: string): Promise<Payment | null> {
  const { data, error } = await db.from('payments').select('*').eq('reference', reference).maybeSingle();
  if (error) throw new Error(`Supabase select failed on payments: ${error.message}`);
  return (data as Payment | null) ?? null;
}

export async function getProductForPayment(db: ServiceDb, productId: string, requireActive: boolean): Promise<PaymentProduct | null> {
  let query = db.from('products').select('product_id, name, duration_days, price_minor, currency, status').eq('product_id', productId);
  if (requireActive) query = query.eq('status', 'active');
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Supabase select failed on products: ${error.message}`);
  return (data as PaymentProduct | null) ?? null;
}

export async function getUserByEmail(db: ServiceDb, email: string): Promise<PaymentUser | null> {
  const { data, error } = await db.from('users').select(USER_COLUMNS).eq('email', email).limit(1).maybeSingle();
  if (error) throw new Error(`Supabase select failed on users: ${error.message}`);
  return (data as PaymentUser | null) ?? null;
}

export async function getUserById(db: ServiceDb, userId: string): Promise<PaymentUser | null> {
  const { data, error } = await db.from('users').select(USER_COLUMNS).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Supabase select failed on users: ${error.message}`);
  return (data as PaymentUser | null) ?? null;
}

/** The payer for a row: its user_id first, then its email — the Worker's order. */
export async function findPaymentUser(db: ServiceDb, payment: Payment): Promise<PaymentUser | null> {
  if (payment.user_id) {
    const byId = await getUserById(db, payment.user_id);
    if (byId) return byId;
  }
  const email = String(payment.email || '').trim().toLowerCase();
  return email ? getUserByEmail(db, email) : null;
}

export async function getSubscriptionByPaymentRef(db: ServiceDb, reference: string): Promise<Subscription | null> {
  const { data, error } = await db
    .from('subscriptions')
    .select('*')
    .eq('source', 'PAYSTACK')
    .eq('source_ref', reference)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Supabase select failed on subscriptions: ${error.message}`);
  return (data as Subscription | null) ?? null;
}

/** A PATCH … RETURNING on one row, as the Worker's sbPatch. */
export async function patchPayment(db: ServiceDb, reference: string, patch: Partial<Payment>): Promise<Payment> {
  const { data, error } = await db.from('payments').update(patch).eq('reference', reference).select('*').single();
  if (error) throw new Error(`Supabase patch failed on payments: ${error.message}`);
  return data as Payment;
}
