// lib/announcements/actions.ts
//
// The announcement writes as Server Actions. The admin ones behind the
// admin gate — legacy saveAnnouncement and confirmArchive — write
// `announcements` with the service role: since A1 (2026-10-18) the
// browser holds nothing on the table, and the database's checks (status,
// audience, subscription kind, the kind's list) are the floor. The
// student search is the Grant dialog's (slice 8). The student one behind
// the student gate — the page's Mark as read, a tap on a notice's button,
// Dismiss and the dashboard's ✕ — goes through notice_mark() with the
// service role, naming the signed-in student (A2): each mark set once,
// never cleared; only the student's own notices; Dismiss only where it is
// allowed.
//
// rebuild.md §9 #18: a status outside draft | active | archived is
// refused. The duplicate-title check legacy ran in the browser over
// the loaded list runs here over the table (same rule: another
// non-archived row with the same title, case-insensitive).

'use server';

import { requireAdmin, requireStudent } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { searchStudents } from '@/lib/subscriptions/queries';
import type { StudentHit } from '@/lib/subscriptions/types';
import { getAllAnnouncements } from './queries';
import { ANNOUNCEMENT_STATUSES, NOTICE_STATES, type ActionResult, type NoticeMark, type NoticeState, type SaveAnnouncementInput, type SaveResult } from './types';

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function cleanList(values: unknown): string[] {
  return [...new Set((Array.isArray(values) ? values : []).map((v) => String(v || '').trim()).filter(Boolean))];
}

// ── admin: save (legacy saveAnnouncement) ─────────────────────────────
export async function saveAnnouncement(input: SaveAnnouncementInput): Promise<SaveResult> {
  await requireAdmin();
  const supabase = createServiceRoleClient();

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
    scope_level: scopeLevels.length ? scopeLevels : null,
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
  await requireAdmin();
  const id = String(announcementId || '').trim();
  if (!id) return fail('Missing announcement.');
  const { error } = await createServiceRoleClient().from('announcements').update({ status: 'archived' }).eq('announcement_id', id);
  if (error) return fail(error.message);
  return { ok: true };
}

// ── admin: the Specific users search (legacy searchUsers) ──────────────
export async function searchStudentsForScope(q: string): Promise<StudentHit[]> {
  const { supabase } = await requireAdmin();
  return searchStudents(supabase, String(q || ''));
}

// ── student: a mark (the page's buttons, the dashboard's ✕) ─────────────
// Today's pages speak in states — read, clicked, dismissed; the database
// keeps marks: seen, tapped (which marks seen too), dismissed.
const MARK_OF: Record<NoticeState, NoticeMark> = { read: 'seen', clicked: 'tapped', dismissed: 'dismissed' };

export async function recordNoticeState(announcementId: string, state: NoticeState): Promise<ActionResult> {
  const { profile } = await requireStudent();
  const id = String(announcementId || '').trim();
  if (!id) return fail('Missing announcement.');
  if (!(NOTICE_STATES as readonly string[]).includes(state)) return fail('Unknown state.');

  const { data, error } = await createServiceRoleClient().rpc('notice_mark', {
    p_user_id: profile.user_id,
    p_ids: [id],
    p_mark: MARK_OF[state],
  });
  if (error) {
    console.error('recordNoticeState:', error);
    return fail('Could not save that. Please try again.');
  }
  // 0 rows: not one of this student's notices, or Dismiss where it is not allowed
  if (!data) return fail(state === 'dismissed' ? 'This announcement cannot be dismissed.' : 'This announcement is no longer available.');
  return { ok: true };
}
