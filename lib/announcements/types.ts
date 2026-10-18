// lib/announcements/types.ts
//
// The announcement shapes: the admin's row of `announcements` (every
// column, read through the server), the student's notice as
// announcements_for_me() hands it (no scope column, the student's own
// marks and the kind's icon — A1, 2026-10-18), the admin page's computed
// display status, the marks' counts, and the Server Action inputs and
// results. Plain constants and types only — actions.ts may export only
// async functions (AGENTS.md, Known Workarounds).

// rebuild.md §9 #18: no 'scheduled' — Active plus a start date schedules.
export const ANNOUNCEMENT_STATUSES = ['draft', 'active', 'archived'] as const;

// legacy computeDisplayStatus: what the table's badge and the stats count.
export type DisplayStatus = 'active' | 'scheduled' | 'expired' | 'draft' | 'archived';

// The words the student pieces send recordNoticeState: read (Seen),
// clicked (Tapped), dismissed — each mapped to a mark in actions.ts.
export const NOTICE_STATES = ['read', 'clicked', 'dismissed'] as const;
export type NoticeState = (typeof NOTICE_STATES)[number];

// The marks notice_mark() sets (A2, 2026-10-18): each once, never cleared.
export type NoticeMark = 'seen' | 'tapped' | 'dismissed';

// legacy's fixed level picker
export const LEVELS = ['L100', 'L200', 'L300', 'L400'] as const;

/** The admin's row: every column, read through the server. */
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
  kind: string;
  picture_path: string | null;
  must_see: boolean;
  send_to_devices: boolean;
  sent_at: string | null;
  scope_programs: string[] | null;
  scope_courses: string[] | null;
  scope_level: string[] | null;
  scope_subscription_kind: string | null;
  scope_product_ids: string[] | null;
  scope_audience: string | null;
  scope_cohort: string | null;
  scope_user_ids: string[] | null;
};

/** A student's notice, as announcements_for_me() returns it. */
export type StudentAnnouncement = {
  announcement_id: string;
  title: string;
  body_html: string | null;
  body_text: string | null;
  kind: string;
  kind_icon: string | null;
  picture_path: string | null;
  pinned: boolean;
  priority: number;
  dismissible: boolean;
  must_see: boolean;
  created_at: string | null;
  start_at: string | null;
  end_at: string | null;
  seen_at: string | null;
  tapped_at: string | null;
  dismissed_at: string | null;
};

/** One of the admin's kinds (08.13): `announcement_kinds`. */
export type AnnouncementKind = { name: string; icon: string; position: number; active: boolean };
export const KIND_NAME_MAX = 40;
export const DEFAULT_KIND = 'News';

export type EngageCounts = { seen: number; tapped: number; dismissed: number };
export type EngageMap = Record<string, EngageCounts>;
/** Each notice's reach today: the active students its scopes match (08.11). */
export type ReachMap = Record<string, number>;

/** One student in a notice's follow-up (08.11): reached today, or marked it. */
export type FollowUpRow = {
  user_id: string;
  name: string;
  program_id: string | null;
  sub_kind: string;
  last_sitting: string | null;
  reached: boolean;
  seen_at: string | null;
  tapped_at: string | null;
  dismissed_at: string | null;
};
export type FollowUpResult = { ok: true; rows: FollowUpRow[] } | { ok: false; error: string };

/** The scopes the editor's reach line counts (08.12). */
export type ReachScopes = {
  scope_audience: string;
  scope_programs: string[];
  scope_levels: string[];
  scope_cohort: string;
  scope_subscription_kind: string;
  scope_product_ids: string[];
  scope_user_ids: string[];
  scope_courses: string[];
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
  /** Also pops up once on the dashboard (08.8). */
  must_see: boolean;
  /** One of the admin's kinds (08.13). */
  kind: string;
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

// A notice's picture as it reaches the server (08.10): already made small
// in the admin's browser (picture-maker.ts); these are the ceilings.
export const PICTURE_FULL_MAX_BYTES = 1024 * 1024; // the bucket's own limit
export const PICTURE_LIST_MAX_BYTES = 200 * 1024;
/** A student's mark, with the new number for the bell and the menu row (08.9; null: not read). */
export type MarkResult = { ok: true; newCount: number | null } | { ok: false; error: string };
export type SaveResult = { ok: true; announcement_id: string; created: boolean } | { ok: false; error: string };
