// lib/announcements/followup-actions.ts
//
// The admin's follow-up (08.11) and the editor's reach line (08.12) —
// Sam, 2026-10-18 — behind the admin gate, with the service role (the
// functions are server only). The follow-up reads every student a notice
// reaches today and everyone with a mark on it, in batches (AGENTS.md rule
// 10: past a thousand students one read would be cut short); the page
// counts and sorts them. The reach line counts the active students the
// editor's scopes match now, saved or not, and how many of their devices
// said yes to news (08.15: the devices switch's hint and Publish's
// question) — the two counted side by side, one trip from the page.

'use server';

import { requireAdmin } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { readAll } from '@/lib/supabase/read-all';
import type { FollowUpResult, FollowUpRow, Reach, ReachScopes } from './types';

export async function getFollowUp(announcementId: string): Promise<FollowUpResult> {
  await requireAdmin();
  const id = String(announcementId || '').trim();
  if (!id) return { ok: false, error: 'Missing announcement.' };
  const db = createServiceRoleClient();
  const { data, error } = await readAll<FollowUpRow>((from, to) => db.rpc('announcement_followup', { p_announcement_id: id }).range(from, to));
  if (error) {
    console.error('getFollowUp:', error);
    return { ok: false, error: 'The follow-up could not be read. Please try again.' };
  }
  return { ok: true, rows: data };
}

function list(values: unknown): string[] | null {
  const clean = [...new Set((Array.isArray(values) ? values : []).map((v) => String(v || '').trim()).filter(Boolean))];
  return clean.length ? clean : null;
}

export async function previewReach(scopes: ReachScopes): Promise<Reach | null> {
  await requireAdmin();
  const db = createServiceRoleClient();
  const args = {
    p_programs: list(scopes.scope_programs),
    p_levels: list(scopes.scope_levels),
    p_cohort: String(scopes.scope_cohort || '').trim() || null,
    p_kind: String(scopes.scope_subscription_kind || '').trim() || null,
    p_products: list(scopes.scope_product_ids),
    p_users: list(scopes.scope_user_ids),
    p_courses: list(scopes.scope_courses),
  };
  const [students, devices] = await Promise.all([
    db.rpc('announcement_reach_preview', args),
    db.rpc('announcement_devices_preview', args),
  ]);
  if (students.error || devices.error) {
    console.error('previewReach:', students.error ?? devices.error);
    return null;
  }
  return { students: Number(students.data) || 0, devices: Number(devices.data) || 0 };
}
