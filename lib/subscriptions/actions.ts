// lib/subscriptions/actions.ts
//
// The four admin subscription writes, re-implemented from the payments
// Worker to the contract in rebuild.md §7.1 (the Worker is what the
// stack retires): grant, update, revoke, sync-expired. Each runs behind
// requireAdmin() and writes as the signed-in admin — the ADMIN insert and
// update policies are the floor. The Worker's own checks, in its order,
// with its messages; the page's own checks stay in the page.
//
// Plus the Grant dialog's student search, which legacy ran from the
// browser against `users`.
//
// Not here yet, by slice: the two emails (SUBSCRIPTION_ASSIGNED after a
// grant, SUBSCRIPTION_REVOKED after a revoke) are slice 10 and are sent
// from these two actions when it lands (§7.2).

'use server';

import { requireAdmin } from '@/lib/access';
import { addDaysIso, dateOnlyToEndIso, dateOnlyToStartIso, isDateOnlyString, nowIso } from './dates';
import { makeSubscriptionId } from './ids';
import { getActiveSubscriptionForUserProduct, getSubscriptionById, searchStudents } from './queries';
import {
  ADMIN_SUB_SOURCES,
  SUB_STATUSES,
  type ActionResult,
  type GrantResult,
  type StudentHit,
  type SyncResult,
  type UpdateSubscriptionInput,
} from './types';

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function upper(v: string): string {
  return String(v || '').trim().toUpperCase();
}

// ── student search (legacy searchGrantUser) ────────────────────────────
export async function searchStudentsAction(q: string): Promise<StudentHit[]> {
  const { supabase } = await requireAdmin();
  return searchStudents(supabase, q);
}

// ── POST /admin/subscriptions/grant ────────────────────────────────────
export async function grantSubscription(userIdIn: string, productIdIn: string, startDateIn: string): Promise<GrantResult> {
  const { supabase } = await requireAdmin();

  const userId = String(userIdIn || '').trim();
  const productId = upper(productIdIn);
  const startDate = String(startDateIn || '').trim();

  if (!userId) return fail('Target user is required');
  if (!productId) return fail('Product is required');

  const { data: targetUser } = await supabase
    .from('users')
    .select('user_id, active')
    .eq('user_id', userId)
    .maybeSingle();
  if (!targetUser) return fail('Target user was not found');
  if (targetUser.active === false) return fail('Target user is inactive');

  // The Worker's getProductById(…, requireActive = true).
  const { data: product } = await supabase
    .from('products')
    .select('product_id, name, duration_days, status')
    .eq('product_id', productId)
    .eq('status', 'active')
    .maybeSingle();
  if (!product) return fail('Product not found or inactive');

  const durationDays = Number(product.duration_days || 0);
  if (!durationDays || durationDays <= 0) return fail('Product duration is invalid');

  // Same product already active and unexpired → EXTEND from its expiry
  // (or from now, if somehow past), never a duplicate row.
  const existing = await getActiveSubscriptionForUserProduct(supabase, userId, productId);
  if (existing) {
    const currentExpiryMs = new Date(existing.expires_utc).getTime();
    const baseIso = currentExpiryMs > Date.now() ? existing.expires_utc : nowIso();
    const { error } = await supabase
      .from('subscriptions')
      .update({ expires_utc: addDaysIso(baseIso, durationDays), status: 'ACTIVE', source: 'ADMIN', source_ref: 'admin_grant' })
      .eq('subscription_id', existing.subscription_id);
    if (error) return fail(error.message);
    return { ok: true, mode: 'extended_existing' };
  }

  // A fresh row: from now, or from midnight UTC of the chosen day.
  let startIso = nowIso();
  if (startDate) {
    startIso = dateOnlyToStartIso(startDate);
    if (!startIso) return fail('Start date must be YYYY-MM-DD');
  }

  const { error } = await supabase.from('subscriptions').insert({
    subscription_id: makeSubscriptionId(),
    user_id: userId,
    product_id: productId,
    start_utc: startIso,
    expires_utc: addDaysIso(startIso, durationDays),
    status: 'ACTIVE',
    source: 'ADMIN',
    source_ref: 'admin_grant',
    expiry_reminded: false,
  });
  if (error) return fail(error.message);
  return { ok: true, mode: 'created_new' };
}

// ── POST /admin/subscriptions/update ───────────────────────────────────
export async function updateSubscription(input: UpdateSubscriptionInput): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const subscriptionId = String(input.subscriptionId || '').trim();
  const productId = upper(input.productId);
  const startDate = String(input.startDate || '').trim();
  const expiryDate = String(input.expiryDate || '').trim();
  const status = upper(input.status);
  const source = upper(input.source);
  const sourceRefInput = String(input.sourceRef || '').trim();

  if (!subscriptionId) return fail('Subscription ID is required');
  if (!productId) return fail('Product is required');
  if (!isDateOnlyString(startDate)) return fail('Start date must be YYYY-MM-DD');
  if (!isDateOnlyString(expiryDate)) return fail('Expiry date must be YYYY-MM-DD');
  if (!(SUB_STATUSES as readonly string[]).includes(status)) return fail(`Allowed statuses: ${SUB_STATUSES.join(', ')}`);
  if (!(ADMIN_SUB_SOURCES as readonly string[]).includes(source)) return fail(`Allowed sources: ${ADMIN_SUB_SOURCES.join(', ')}`);

  const existing = await getSubscriptionById(supabase, subscriptionId);
  if (!existing) return fail('Subscription not found');

  // The Worker's getProductById(…, requireActive = false).
  const { data: product } = await supabase.from('products').select('product_id').eq('product_id', productId).maybeSingle();
  if (!product) return fail('Product not found');

  const startIso = dateOnlyToStartIso(startDate);
  const expiresIso = dateOnlyToEndIso(expiryDate);
  if (!startIso || !expiresIso) return fail('Start and expiry dates are required');
  if (new Date(expiresIso).getTime() <= new Date(startIso).getTime()) return fail('Expiry date must be after start date');

  if (status === 'ACTIVE' && new Date(expiresIso).getTime() > Date.now()) {
    const duplicate = await getActiveSubscriptionForUserProduct(supabase, existing.user_id, productId, subscriptionId);
    if (duplicate) return fail('Another active unexpired subscription already exists for this user and product');
  }

  const finalSourceRef = source === 'ADMIN' ? sourceRefInput || 'admin_grant' : sourceRefInput || null;

  const { error } = await supabase
    .from('subscriptions')
    .update({ product_id: productId, start_utc: startIso, expires_utc: expiresIso, status, source, source_ref: finalSourceRef })
    .eq('subscription_id', subscriptionId);
  if (error) return fail(error.message);
  return { ok: true };
}

// ── POST /admin/subscriptions/revoke ───────────────────────────────────
export async function revokeSubscription(subscriptionIdIn: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const subscriptionId = String(subscriptionIdIn || '').trim();
  if (!subscriptionId) return fail('Subscription ID is required');

  const existing = await getSubscriptionById(supabase, subscriptionId);
  if (!existing) return fail('Subscription not found');

  const { error } = await supabase.from('subscriptions').update({ status: 'REVOKED' }).eq('subscription_id', subscriptionId);
  if (error) return fail(error.message);
  return { ok: true };
}

// ── POST /admin/subscriptions/sync-expired ─────────────────────────────
// One direction only: ACTIVE → EXPIRED where the expiry is past.
export async function syncExpiredSubscriptions(): Promise<SyncResult> {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from('subscriptions')
    .update({ status: 'EXPIRED' })
    .eq('status', 'ACTIVE')
    .lt('expires_utc', nowIso())
    .select('subscription_id');
  if (error) return fail(error.message);
  return { ok: true, updatedCount: (data ?? []).length };
}
