// lib/dashboard/student/types.ts
//
// The redesigned student dashboard's shapes (11-pages.md Dashboard; D2b,
// Sam 2026-10-04): the student's receipts as the top card reads them, the
// top card itself, and the numbers student_dashboard() returns
// (20261004160000_student_dashboard.sql). A plain module — no server or
// client code — so the page and its cards can both import it.

export type ReceiptKind = 'PAID' | 'TRIAL' | 'FREE';

/** One receipt with its package's name and kind — what decides the top card. */
export type DashReceipt = {
  subscription_id: string;
  product_id: string;
  product_name: string;
  kind: ReceiptKind;
  start_utc: string;
  expires_utc: string;
  status: string;
};

/**
 * The top card (Sam, 2026-10-04: A — one dashboard, its top card the
 * student's next step):
 *   trial   a live trial and nothing paid
 *   paid    a live package (paid, or the admin's Free Full Access)
 *   future  nothing live, a package still to start
 *   (a trial's or package's `next` is the receipt queued to start after
 *   it, so its days and the courses' longer days agree on the page)
 *   floor   nothing live or coming: the free account (03). `ended` is the
 *           latest trial or package that ran out — null for a student who
 *           never had one; `recapFull` while it ended under 2 weeks ago
 *           (then one line, Sam 2026-10-04).
 */
export type TopCard =
  | { kind: 'trial'; receipt: DashReceipt; daysLeft: number; totalDays: number; next: DashReceipt | null }
  | { kind: 'paid'; receipt: DashReceipt; daysLeft: number; next: DashReceipt | null }
  | { kind: 'future'; receipt: DashReceipt }
  | { kind: 'floor'; ended: DashReceipt | null; recapFull: boolean };

export type DashStreak = { current: number; best: number; days: boolean[] };

export type DashWeakest = { course_id: string; topic: string; answered: number; correct: number };

export type DashCourseMet = { course_id: string; met: number; bank: number };

export type DashCarryOn = {
  attempt_id: string;
  course_id: string;
  quiz_id: string | null;
  source: string;
  mode: string;
  display_label: string | null;
  n: number;
  answered: number;
};

export type DashRecap = {
  answered: number;
  correct: number;
  quizzes: number;
  topics: { course_id: string; topic: string }[];
};

/** student_dashboard()'s one row. */
export type DashNumbers = {
  streak: DashStreak;
  answered: number;
  mastered: number;
  weakest: DashWeakest | null;
  courses: DashCourseMet[];
  carry_on: DashCarryOn | null;
  recap: DashRecap | null;
};

export const EMPTY_NUMBERS: DashNumbers = {
  streak: { current: 0, best: 0, days: [false, false, false, false, false, false, false] },
  answered: 0,
  mastered: 0,
  weakest: null,
  courses: [],
  carry_on: null,
  recap: null,
};
