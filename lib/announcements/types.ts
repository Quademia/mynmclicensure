// lib/announcements/types.ts
//
// The announcement shapes (slice 11): the `announcements` row as
// legacy/db/schema.sql 1.8 defines it, the per-student notice state
// (1.9), the admin page's computed display status, the student scope
// the server-side filter matches against, and the Server Action
// inputs and results. Plain constants and types only — actions.ts may
// export only async functions (AGENTS.md, Known Workarounds).

// rebuild.md §9 #18: no 'scheduled' — Active plus a start date schedules.
export const ANNOUNCEMENT_STATUSES = ['draft', 'active', 'archived'] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

// legacy computeDisplayStatus: what the table's pill and the stats count.
export type DisplayStatus = 'active' | 'scheduled' | 'expired' | 'draft' | 'archived';

export const NOTICE_STATES = ['read', 'clicked', 'dismissed'] as const;
export type NoticeState = (typeof NOTICE_STATES)[number];

export const SUBSCRIPTION_KINDS = ['PAID', 'TRIAL', 'FREE'] as const;
export const AUDIENCES = ['ALL', 'STUDENTS'] as const;
export type Audience = (typeof AUDIENCES)[number];

// legacy's fixed level picker
export const LEVELS = ['L100', 'L200', 'L300', 'L400'] as const;

export type Announcement = {
  announcement_id: string;
  title: string;
  body_html: string | null;
  body_text: string | null;
  status: string;
  created_at: string | null;
  start_at: string | null;
  end_at: string | null;
  pinned: boolean;
  priority: number;
  dismissible: boolean;
  scope_programs: string[] | null;
  scope_courses: string[] | null;
  /** 'L100,L300' — comma-joined, as legacy stored it. */
  scope_level: string | null;
  scope_subscription_kind: string | null;
  scope_product_ids: string[] | null;
  scope_audience: string | null;
  scope_cohort: string | null;
  scope_user_ids: string[] | null;
};

export type EngageCounts = { read: number; clicked: number; dismissed: number };
export type EngageMap = Record<string, EngageCounts>;

// What the student-side filter matches against (legacy passed the
// profile, the subscription kind and the active product id; §9 #19
// adds the courses the student's access covers).
export type StudentScope = {
  user_id: string;
  role: string;
  program_id: string | null;
  level: string | null;
  cohort: string | null;
  subscriptionKind: string;
  activeProductId: string;
  courseIds: string[];
};

// legacy saveAnnouncement's payload
export type SaveAnnouncementInput = {
  announcement_id: string | null;
  title: string;
  body_html: string;
  body_text: string;
  status: string;
  priority: number;
  pinned: boolean;
  dismissible: boolean;
  scope_audience: string;
  scope_subscription_kind: string;
  scope_cohort: string;
  scope_programs: string[];
  scope_courses: string[];
  scope_levels: string[];
  scope_product_ids: string[];
  scope_user_ids: string[];
  start_at: string;
  end_at: string;
};

export type ActionResult = { ok: true } | { ok: false; error: string };
export type SaveResult = { ok: true; announcement_id: string; created: boolean } | { ok: false; error: string };

// The student page's view of one announcement's state.
export type StudentNoticeMap = Record<string, NoticeState>;
