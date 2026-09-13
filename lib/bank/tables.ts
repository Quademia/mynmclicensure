// lib/bank/tables.ts
//
// The one place a course id becomes an item table name. Legacy did
// `'items_' + courseId.toLowerCase()` in five places; here the eleven
// tables are a fixed list (rebuild.md §8 S2 — one table per course,
// kept), so a course id outside it cannot reach the database as a table
// name. The Supabase client is untyped: a wrong table name never fails a
// build (AGENTS.md workaround), which is why this is checked, not built.
//
// A new course needs a new item table, i.e. a migration and a line here —
// legacy had the same constraint, unstated.

export const BANK_COURSE_IDS = [
  'GP',
  'RN_MED', 'RN_SURG',
  'RM_PED_OBS_HRN', 'RM_MID',
  'RPHN_PPHN', 'RPHN_DISEASE_CTRL',
  'RMHN_PSYCH_NURS', 'RMHN_PSYCH_PPHARM',
  'NAC_BASIC_CLIN', 'NAC_BASIC_PREV',
] as const;

export type BankCourseId = (typeof BANK_COURSE_IDS)[number];

export function isBankCourse(courseId: string): courseId is BankCourseId {
  return (BANK_COURSE_IDS as readonly string[]).includes(courseId);
}

/** `items_<course_id lower-cased>`, or null when the course has no table. */
export function itemsTableFor(courseId: string): string | null {
  const id = String(courseId || '').toUpperCase();
  return isBankCourse(id) ? `items_${id.toLowerCase()}` : null;
}
