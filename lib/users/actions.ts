// lib/users/actions.ts
//
// The admin Users page's Server Actions (slice 14a), each behind
// requireAdmin(): a page of users for a filter change or Load More
// (legacy loadUsers re-queried from the browser); the drawer's read;
// Deactivate and Reactivate (legacy deactivateUser / activateUser — a
// bare `active` flip as the signed-in admin, the ADMIN update policy is
// the floor); Send Password Reset Email (legacy sendPasswordReset —
// Supabase's reset mail, sent from the server now through the same
// implicit-flow client the forgot-password page uses, the link on this
// site's own address; no rate limit, as legacy's admin path had none,
// and no reset_requests row — that log is the student-facing page's).
//
// Assign Subscription is not here: the drawer calls slice 8's
// grantSubscription (§9 #24 — one mechanism, no duplicate rows).

'use server';

import { createClient as createPlainClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/access';
import { appOrigin } from '@/lib/site/app-origin';
import { getUserDetail, getUsersPaginated } from './queries';
import type { ActionResult, UserDetail, UserFilters, UsersPage } from './types';

export async function listUsersAction(filters: UserFilters, page: number): Promise<UsersPage> {
  const { supabase } = await requireAdmin();
  return getUsersPaginated(supabase, filters, Math.max(0, Number(page) || 0));
}

export async function getUserDetailAction(userIdIn: string): Promise<UserDetail | null> {
  const { supabase } = await requireAdmin();
  const userId = String(userIdIn || '').trim();
  if (!userId) return null;
  return getUserDetail(supabase, userId);
}

export async function setUserActive(userIdIn: string, active: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const userId = String(userIdIn || '').trim();
  if (!userId) return { ok: false, error: 'User is required' };

  const { error } = await supabase.from('users').update({ active: Boolean(active) }).eq('user_id', userId);
  if (error) {
    console.error('setUserActive:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function sendPasswordResetAction(emailIn: string): Promise<ActionResult> {
  await requireAdmin();
  const email = String(emailIn || '').trim();
  if (!email) return { ok: false, error: 'Email is required' };

  const plain = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { error } = await plain.auth.resetPasswordForEmail(email, { redirectTo: `${appOrigin()}/reset-password` });
  if (error) {
    console.error('sendPasswordResetAction:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
