// lib/announcements/actions.ts
//
// The announcement writes as Server Actions. The admin ones behind the
// admin gate — legacy saveAnnouncement and confirmArchive on
// admin/announcements.html wrote `announcements` from the browser; the
// student search is the Grant dialog's (slice 8). The student one
// behind the student gate — legacy recordState (announcements page) and
// clearFromStrip (dashboard) upserted `user_notice_state` from the
// browser. Each writes as the signed-in user; the policies are the
// floor.
//
// rebuild.md §9 #18: a status outside draft | active | archived is
// refused. The duplicate-title check legacy ran in the browser over
// the loaded list runs here over the table (same rule: another
// non-archived row with the same title, case-insensitive).

'use server';

import { requireAdmin, requireStudent } from '@/lib/access';
import { searchStudents } from '@/lib/subscriptions/queries';
import type { StudentHit } from '@/lib/subscriptions/types';
import { getAllAnnouncements } from './queries';
import { ANNOUNCEMENT_STATUSES, NOTICE_STATES, type ActionResult, type NoticeState, type SaveAnnouncementInput, type SaveResult } from './types';

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function cleanList(values: unknown): string[] {
  return [...new Set((Array.isArray(values) ? values : []).map((v) => String(v || '').trim()).filter(Boolean))];
}

// ── admin: save (legacy saveAnnouncement) ─────────────────────────────
export async function saveAnnouncement(input: SaveAnnouncementInput): Promise<SaveResult> {
  const { supabase } = await requireAdmin();

  const title = String(input.title || '').trim();
  if (!title) return fail('Title is required.');

  const status = String(input.status || 'draft');
  if (!(ANNOUNCEMENT_STATUSES as readonly string[]).includes(status)) return fail('Unknown status.');

  const scopeLevels = cleanList(input.scope_levels);
  const scopePrograms = cleanList(input.scope_programs);
  const scopeCourses = cleanList(input.scope_courses);
  const scopeProducts = cleanList(input.scope_product_ids);
  const scopeUserIds = cleanList(input.scope_user_ids);

  const payload = {
    title,
    body_html: String(input.body_html || ''),
    body_text: String(input.body_text || ''),
    status,
    priority: Number.parseInt(String(input.priority), 10) || 1,
    pinned: Boolean(input.pinned),
    dismissible: Boolean(input.dismissible),
    scope_audience: input.scope_audience === 'STUDENTS' ? 'STUDENTS' : 'ALL',
    scope_subscription_kind: String(input.scope_subscription_kind || '').trim() || null,
    scope_cohort: String(input.scope_cohort || '').trim() || null,
    scope_programs: scopePrograms.length ? scopePrograms : null,
    scope_courses: scopeCourses.length ? scopeCourses : null,
    scope_level: scopeLevels.length ? scopeLevels.join(',') : null,
    scope_product_ids: scopeProducts.length ? scopeProducts : null,
    scope_user_ids: scopeUserIds.length ? scopeUserIds : null,
    start_at: String(input.start_at || '').trim() || null,
    end_at: String(input.end_at || '').trim() || null,
  };

  const editingId = String(input.announcement_id || '').trim();

  if (editingId) {
    const { error } = await supabase.from('announcements').update(payload).eq('announcement_id', editingId);
    if (error) return fail('Save failed: ' + error.message);
    return { ok: true, announcement_id: editingId, created: false };
  }

  // legacy: refuse a second non-archived announcement with the same title
  const existing = await getAllAnnouncements(supabase);
  const duplicate = existing.find((a) => a.title.trim().toLowerCase() === title.toLowerCase() && a.status !== 'archived');
  if (duplicate) {
    return fail(`An announcement with this title already exists: "${duplicate.title}". Please use a different title or edit the existing one.`);
  }

  const announcementId = 'ANN_' + Date.now();
  const { error } = await supabase.from('announcements').insert({ ...payload, announcement_id: announcementId });
  if (error) return fail('Save failed: ' + error.message);
  return { ok: true, announcement_id: announcementId, created: true };
}

// ── admin: archive (legacy confirmArchive) ────────────────────────────
export async function archiveAnnouncement(announcementId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const id = String(announcementId || '').trim();
  if (!id) return fail('Missing announcement.');
  const { error } = await supabase.from('announcements').update({ status: 'archived' }).eq('announcement_id', id);
  if (error) return fail(error.message);
  return { ok: true };
}

// ── admin: the Specific users search (legacy searchUsers) ──────────────
export async function searchStudentsForScope(q: string): Promise<StudentHit[]> {
  const { supabase } = await requireAdmin();
  return searchStudents(supabase, String(q || ''));
}

// ── student: record a state (legacy recordState / clearFromStrip) ──────
// An upsert on (user_id, item_type, item_id): one row per announcement
// per student, the latest state winning.
export async function recordNoticeState(announcementId: string, state: NoticeState): Promise<ActionResult> {
  const { supabase, profile } = await requireStudent();
  const id = String(announcementId || '').trim();
  if (!id) return fail('Missing announcement.');
  if (!(NOTICE_STATES as readonly string[]).includes(state)) return fail('Unknown state.');

  const nowIso = new Date().toISOString();
  const { error } = await supabase.from('user_notice_state').upsert(
    {
      user_id: profile.user_id,
      item_type: 'ANNOUNCEMENT',
      item_id: id,
      state,
      seen_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: 'user_id,item_type,item_id' },
  );
  if (error) {
    console.error('recordNoticeState:', error);
    return fail(error.message);
  }
  return { ok: true };
}
