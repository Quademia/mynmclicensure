// lib/question-reports/queries.ts
//
// The admin's Question reports page (06.2): on Open, one row per question
// with open reports, most reports first; on Closed, one per close, newest
// first (Sam, 2026-10-17) — a page at a time — the whole question
// with each, so a report can be judged on the page. question_report_groups()
// groups and pages in the database (rule 10), so the page never reads the
// reports themselves. Service role; the caller has passed requireAdmin().

import { createServiceRoleClient } from '@/lib/supabase/server';
import { REPORT_GROUPS_PER_PAGE, type ReportGroup, type ReportLine, type ReportView } from './types';

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

type Row = {
  item_id: string;
  course_id: string;
  course_title: string | null;
  question_type: string | null;
  stem: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
  option_f: string | null;
  correct: string | null;
  reports: number;
  reasons: Record<string, number> | null;
  newest: string;
  lines: ReportLine[] | null;
  status: ReportGroup['status'];
  closed_at: string | null;
  closed_by_name: string | null;
  total: number | string;
};

export async function getReportGroups(view: ReportView, page: number): Promise<{ ok: true; groups: ReportGroup[]; total: number } | { ok: false }> {
  const offset = Math.max(0, Math.floor(page) - 1) * REPORT_GROUPS_PER_PAGE;
  const { data, error } = await createServiceRoleClient().rpc('question_report_groups', {
    p_limit: REPORT_GROUPS_PER_PAGE,
    p_offset: offset,
    p_view: view,
  });
  if (error) return { ok: false };
  const rows = (data ?? []) as Row[];
  return {
    ok: true,
    total: rows.length ? Number(rows[0].total) || 0 : 0,
    groups: rows.map((r) => ({
      item_id: r.item_id,
      course_id: r.course_id,
      course_title: r.course_title,
      question_type: r.question_type,
      stem: r.stem,
      options: LETTERS.map((l) => ({ letter: l, text: (r[`option_${l}`] ?? '').trim() })).filter((o) => o.text),
      correct: r.correct,
      reports: Number(r.reports) || 0,
      reasons: r.reasons ?? {},
      newest: r.newest,
      lines: r.lines ?? [],
      status: r.status,
      closed_at: r.closed_at,
      closed_by_name: r.closed_by_name,
    })),
  };
}
