// lib/question-reports/actions.ts
//
// Question reports' Server Actions (06.2; Sam, 2026-10-17). A student's
// report goes through report_question(), which checks the question is in
// the student's own sitting and refuses a second open report on it; the
// admin's Mark fixed / Dismiss goes through close_question_reports(),
// every open report of the question at once. Both with the service role:
// the browser holds nothing on the table.

'use server';

import { requireAdmin, requireStudent } from '@/lib/access';
import { chosenToStored } from '@/lib/attempts/scoring';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { REPORT_NOTE_MAX, type CloseReportsResult, type SendReportResult } from './types';

const REFUSALS: Record<string, string> = {
  bad_reason: 'Choose a reason.',
  note_required: 'Tell us what the issue is.',
  note_too_long: `Your note is too long — ${REPORT_NOTE_MAX.toLocaleString('en-GB')} characters at most.`,
  not_in_sitting: 'This question cannot be reported from here.',
  no_question: 'This question is no longer in the bank.',
};

export async function sendQuestionReport(input: {
  attemptId: string;
  itemId: string;
  reason: string;
  note?: string | null;
  chosen?: string | string[] | null;
}): Promise<SendReportResult> {
  const { profile } = await requireStudent();
  const { data, error } = await createServiceRoleClient().rpc('report_question', {
    p_user_id: profile.user_id,
    p_attempt_id: String(input.attemptId || ''),
    p_item_id: String(input.itemId || ''),
    p_reason: String(input.reason || ''),
    p_note: input.note ? String(input.note).slice(0, REPORT_NOTE_MAX + 1) : null,
    p_chosen: chosenToStored(input.chosen ?? null),
  });
  if (error) return { ok: false, error: 'Could not send your report. Please try again.' };
  const r = (data ?? {}) as { ok?: boolean; code?: string; at?: string };
  if (r.ok) return { ok: true };
  if (r.code === 'already') return { ok: false, already: true, at: String(r.at || '') };
  return { ok: false, error: REFUSALS[r.code ?? ''] ?? 'Could not send your report. Please try again.' };
}

export async function closeQuestionReports(itemId: string, status: 'fixed' | 'dismissed'): Promise<CloseReportsResult> {
  const { profile } = await requireAdmin();
  if (status !== 'fixed' && status !== 'dismissed') return { ok: false, error: 'Unknown status.' };
  const { data, error } = await createServiceRoleClient().rpc('close_question_reports', {
    p_item_id: String(itemId || ''),
    p_status: status,
    p_admin_id: profile.user_id,
  });
  if (error) return { ok: false, error: 'Could not close these reports. Please try again.' };
  return { ok: true, closed: Number(data) || 0 };
}
