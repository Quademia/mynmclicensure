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
// The two emails legacy's page fired after a grant and a revoke
// (SUBSCRIPTION_ASSIGNED, SUBSCRIPTION_REVOKED) are sent from these two
// actions once the write has succeeded (slice 10, §7.2). The grant's goes
// out wherever the grant is called, so the Users page's Assign — silent
// in legacy — sends it too (Sam, 2026-09-16). Neither email can fail the
// action: a failure is logged.

'use server';

import { requireAdmin, type ServerSupabaseClient } from '@/lib/access';
import { sendEmail } from '@/lib/email/send';
import { subscriptionAssignedEmail } from '@/lib/email/templates/subscription-assigned';
import { subscriptionRevokedEmail } from '@/lib/email/templates/subscription-revoked';
import { appOrigin } from '@/lib/site/app-origin';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revokeAccessRows, syncAccessRows, writeAccessRows } from './access-rows';
import { addDaysIso, dateOnlyToEndIso, dateOnlyToStartIso, isDateOnlyString, nowIso } from './dates';
import { makeSubscriptionId } from './ids';
import { getActiveSubscriptionForUserProduct, getSubscriptionById, searchStudents } from './queries';
import {
  ADMIN_SUB_SOURCES,
  SUB_STATUSES,
  type ActionResult,
  type GrantResult,
  type StudentHit,
  type Subscription,
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
    .select('user_id, active, email, name, forename, surname')
    .eq('user_id', userId)
    .maybeSingle();
  if (!targetUser) return fail('Target user was not found');
  if (targetUser.active === false) return fail('Target user is inactive');

  // The Worker's getProductById(…, requireActive = true).
  const { data: product } = await supabase
    .from('products')
    .select('product_id, name, kind, duration_days, status')
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
    const newExpiry = addDaysIso(baseIso, durationDays);
    const { error } = await supabase
      .from('subscriptions')
      .update({ expires_utc: newExpiry, status: 'ACTIVE', source: 'ADMIN', source_ref: 'admin_grant' })
      .eq('subscription_id', existing.subscription_id);
    if (error) return fail(error.message);
    // The receipt's course rows take the new end (02 C2).
    try {
      await syncAccessRows(createServiceRoleClient(), { ...existing, expires_utc: newExpiry, status: 'ACTIVE' }, false);
    } catch (err) {
      return fail(`Subscription extended, but its course access rows failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    await sendAssignedEmail(supabase, targetUser, product, existing.subscription_id);
    return { ok: true, mode: 'extended_existing' };
  }

  // A fresh row: from now, or from midnight UTC of the chosen day.
  let startIso = nowIso();
  if (startDate) {
    startIso = dateOnlyToStartIso(startDate);
    if (!startIso) return fail('Start date must be YYYY-MM-DD');
  }

  const subscriptionId = makeSubscriptionId();
  const receipt = {
    subscription_id: subscriptionId,
    user_id: userId,
    product_id: productId,
    start_utc: startIso,
    expires_utc: addDaysIso(startIso, durationDays),
    status: 'ACTIVE',
  };
  const { error } = await supabase.from('subscriptions').insert({
    ...receipt,
    source: 'ADMIN',
    source_ref: 'admin_grant',
    expiry_reminded: false,
  });
  if (error) return fail(error.message);
  // One course row per course of the product, the receipt's dates (02 C2).
  try {
    await writeAccessRows(createServiceRoleClient(), receipt);
  } catch (err) {
    return fail(`Subscription saved, but its course access rows failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  await sendAssignedEmail(supabase, targetUser, product, subscriptionId);
  return { ok: true, mode: 'created_new' };
}

// SUBSCRIPTION_ASSIGNED — legacy submitGrant's email: the student's name
// and email from the chosen student, the product as the Grant dropdown
// labelled it (`name (KIND)`), the login page, and the expiry — read back
// from the saved row, where legacy's page recomputed it from the start
// date and was wrong whenever the grant extended (§7.2).
async function sendAssignedEmail(
  db: ServerSupabaseClient,
  student: { email: string | null; name: string | null; forename: string | null; surname: string | null },
  product: { name: string | null; kind: string | null },
  subscriptionId: string,
): Promise<void> {
  try {
    const row = await getSubscriptionById(db, subscriptionId);
    await sendEmail(
      student.email ?? '',
      subscriptionAssignedEmail({
        name: student.name || `${student.forename || ''} ${student.surname || ''}`.trim(),
        loginUrl: `${appOrigin()}/login`,
        productName: `${product.name ?? ''} (${product.kind ?? ''})`,
        expiresUtc: row?.expires_utc ?? '',
      }),
    );
  } catch (err) {
    console.error('[subscriptions] grant email failed for', subscriptionId, err);
  }
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
  // The receipt's course rows follow the edit: its dates and status; a
  // changed product replaces the course set (02 C2).
  try {
    await syncAccessRows(
      createServiceRoleClient(),
      { subscription_id: subscriptionId, user_id: existing.user_id, product_id: productId, start_utc: startIso, expires_utc: expiresIso, status },
      productId !== existing.product_id,
    );
  } catch (err) {
    return fail(`Subscription updated, but its course access rows failed: ${err instanceof Error ? err.message : String(err)}`);
  }
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
  // The receipt's live course rows are stamped; the course closes at once (02 C2).
  try {
    await revokeAccessRows(createServiceRoleClient(), subscriptionId);
  } catch (err) {
    return fail(`Subscription revoked, but its course access rows failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  await sendRevokedEmail(supabase, existing);
  return { ok: true };
}

// SUBSCRIPTION_REVOKED — legacy confirmCancel's email: the student's name
// (else the forename) and email, the product's name, and the site's own
// address as the Renew link (legacy's window.location.origin).
async function sendRevokedEmail(db: ServerSupabaseClient, sub: Subscription): Promise<void> {
  try {
    const [{ data: student }, { data: product }] = await Promise.all([
      db.from('users').select('email, name, forename').eq('user_id', sub.user_id).maybeSingle(),
      db.from('products').select('name').eq('product_id', sub.product_id).maybeSingle(),
    ]);
    await sendEmail(
      student?.email ?? '',
      subscriptionRevokedEmail({
        name: student?.name || student?.forename || '',
        productName: product?.name || '',
        renewUrl: appOrigin(),
      }),
    );
  } catch (err) {
    console.error('[subscriptions] revoke email failed for', sub.subscription_id, err);
  }
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
