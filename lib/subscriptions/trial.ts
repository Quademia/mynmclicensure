// lib/subscriptions/trial.ts
//
// The programme trial at registration — legacy register.html's "Step 3:
// Auto-assign programme trial", which the browser inserted directly
// (the policy that allowed it is gone, rebuild.md §9 defect 2). Now the
// registration Server Action calls this with the service role after the
// profile row exists (§10).
//
// Legacy's rules, kept: the programme's trial_product_id names the
// product; its duration_days from today sets the expiry; no product,
// nothing happens; the product's status is not checked; a failure is
// logged and never stops the registration.

import { createServiceRoleClient } from '@/lib/supabase/server';
import { makeTrialSubscriptionId } from './ids';

export async function grantTrialSubscription(userId: string, programId: string): Promise<void> {
  try {
    const db = createServiceRoleClient();

    const { data: program } = await db
      .from('programs')
      .select('trial_product_id')
      .eq('program_id', programId)
      .maybeSingle();
    const trialProductId = program?.trial_product_id || '';
    if (!trialProductId) return;

    const { data: trialProduct } = await db
      .from('products')
      .select('duration_days')
      .eq('product_id', trialProductId)
      .maybeSingle();
    if (!trialProduct) return;

    const start = new Date();
    const expires = new Date(start);
    expires.setDate(expires.getDate() + Number(trialProduct.duration_days || 0));

    const { error } = await db.from('subscriptions').insert({
      subscription_id: makeTrialSubscriptionId(),
      user_id: userId,
      product_id: trialProductId,
      start_utc: start.toISOString(),
      expires_utc: expires.toISOString(),
      status: 'ACTIVE',
      source: 'SELF_TRIAL_SIGNUP',
      source_ref: userId,
      expiry_reminded: false,
    });
    if (error) console.error('[register] trial grant failed for', userId, error.message);
  } catch (err) {
    console.error('[register] trial grant threw for', userId, err);
  }
}
