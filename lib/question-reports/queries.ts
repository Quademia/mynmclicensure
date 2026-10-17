// lib/question-reports/queries.ts
//
// The admin's Question reports page (06.2): one row per question with
// open reports, newest first, a page at a time — question_report_groups()
// groups and pages in the database (rule 10), so the page never reads the
// reports themselves. Service role; the caller has passed requireAdmin().

import { createServiceRoleClient } from '@/lib/supabase/server';
import { REPORT_GROUPS_PER_PAGE, type ReportGroup, type ReportLine } from './types';

export async function getReportGroups(page: number): Promise<{ ok: true; groups: ReportGroup[]; total: number } | { ok: false }> {
  const offset = Math.max(0, Math.floor(page) - 1) * REPORT_GROUPS_PER_PAGE;
  const { data, error } = await createServiceRoleClient().rpc('question_report_groups', {
    p_limit: REPORT_GROUPS_PER_PAGE,
    p_offset: offset,
  });
  if (error) return { ok: false };
  const rows = (data ?? []) as (Omit<ReportGroup, 'reasons' | 'lines'> & {
    reasons: Record<string, number> | null;
    lines: ReportLine[] | null;
    total: number | string;
  })[];
  return {
    ok: true,
    total: rows.length ? Number(rows[0].total) || 0 : 0,
    groups: rows.map((r) => ({
      item_id: r.item_id,
      course_id: r.course_id,
      course_title: r.course_title,
      stem: r.stem,
      correct: r.correct,
      reports: Number(r.reports) || 0,
      reasons: r.reasons ?? {},
      newest: r.newest,
      lines: r.lines ?? [],
    })),
  };
}
