// lib/question-reports/types.ts
//
// Question reports (06.2; Sam, 2026-10-17): the box's reasons, the
// replies, and the admin page's rows. Constants live here, not in the
// 'use server' module (AGENTS.md workaround).

/** The six reasons a report stores, in the box's order, with its words. */
export const REPORT_REASONS = [
  { value: 'answer_wrong', label: 'The answer is wrong' },
  { value: 'unclear', label: 'The question is unclear' },
  { value: 'typo', label: 'A spelling mistake or typo' },
  { value: 'picture', label: 'The picture is missing or wrong' },
  { value: 'explanation', label: 'The explanation is wrong' },
  { value: 'other', label: 'Something else' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

/** The box's seventh line: no report — it opens Messages with the question quoted. */
export const DONT_UNDERSTAND = 'dont_understand';
export const DONT_UNDERSTAND_LABEL = "I don't understand the answer";

export const REPORT_NOTE_MAX = 1000;

export function reasonLabel(value: string): string {
  return REPORT_REASONS.find((r) => r.value === value)?.label ?? value;
}

export type SendReportResult =
  | { ok: true }
  | { ok: false; already: true; at: string }
  | { ok: false; already?: false; error: string };

export type CloseReportsResult = { ok: true; closed: number } | { ok: false; error: string };

/** One report under a question on the admin's page. */
export type ReportLine = {
  reason: string;
  note: string | null;
  chosen: string | null;
  at: string;
  name: string | null;
};

/** One question with open reports. */
export type ReportGroup = {
  item_id: string;
  course_id: string;
  course_title: string | null;
  stem: string | null;
  correct: string | null;
  reports: number;
  reasons: Record<string, number>;
  newest: string;
  lines: ReportLine[];
};

export const REPORT_GROUPS_PER_PAGE = 20;
