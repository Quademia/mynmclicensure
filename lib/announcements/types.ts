// lib/announcements/types.ts
//
// The announcement shapes: the admin's row of `announcements` (every
// column, read through the server), the student's notice as
// announcements_for_me() hands it (no scope column, the student's own
// marks and the kind's icon — A1, 2026-10-18), the admin page's computed
// display status, the marks' counts, and the Server Action inputs and
// results. Plain constants and types only — actions.ts may export only
// async functions (AGENTS.md, Known Workarounds).

import type { RichDoc } from '@/lib/editor/types';

// rebuild.md §9 #18: no 'scheduled' — Active plus a start date schedules.
export const ANNOUNCEMENT_STATUSES = ['draft', 'active', 'archived'] as const;

// legacy computeDisplayStatus: what the table's badge and the stats count.
export type DisplayStatus = 'active' | 'scheduled' | 'expired' | 'draft' | 'archived';

// The words the student pieces send recordNoticeState: read (Seen),
// clicked (Tapped), dismissed — each mapped to a mark in actions.ts.
export const NOTICE_STATES = ['read', 'clicked', 'dismissed'] as const;
export type NoticeState = (typeof NOTICE_STATES)[number];

// The marks notice_mark() sets (A2, 2026-10-18): each once, never cleared.
export type NoticeMark = 'seen' | 'tapped' | 'dismissed' | 'confirmed';

// legacy's fixed level picker
export const LEVELS = ['L100', 'L200', 'L300', 'L400'] as const;

/** The admin's row in the list: every column but the words (08.17). */
export type AnnouncementRow = Omit<Announcement, 'body'>;
export const ANNOUNCEMENT_ROW_COLUMNS =
  'announcement_id, title, status, created_at, start_at, end_at, pinned, priority, dismissible, kind, picture_path, must_see, ask_confirm, send_to_devices, sent_at, scope_programs, scope_courses, scope_level, scope_subscription_kind, scope_product_ids, scope_cohort, scope_user_ids';

/** The admin's notice, read through the server: every column. */
export type Announcement = {
  announcement_id: string;
  title: string;
  /** The words, as the shared editor's document (08.14, 2026-10-19). */
  body: RichDoc;
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
  /** The opened notice shows "I've read this"; Must-see always asks (08.16). */
  ask_confirm: boolean;
  send_to_devices: boolean;
  sent_at: string | null;
  scope_programs: string[] | null;
  scope_courses: string[] | null;
  scope_level: string[] | null;
  scope_subscription_kind: string | null;
  scope_product_ids: string[] | null;
  scope_cohort: string | null;
  scope_user_ids: string[] | null;
};

/** A student's notice, as announcements_for_me() returns it. */
export type StudentAnnouncement = {
  announcement_id: string;
  title: string;
  body: RichDoc | null;
  kind: string;
  kind_icon: string | null;
  picture_path: string | null;
  pinned: boolean;
  priority: number;
  dismissible: boolean;
  must_see: boolean;
  ask_confirm: boolean;
  created_at: string | null;
  start_at: string | null;
  end_at: string | null;
  seen_at: string | null;
  tapped_at: string | null;
  dismissed_at: string | null;
  /** Read (confirmed): pressed "I've read this" (08.16). */
  confirmed_at: string | null;
};

/** One of the admin's kinds (08.13): `announcement_kinds`. */
export type AnnouncementKind = { name: string; icon: string; position: number; active: boolean };
export const KIND_NAME_MAX = 40;
export const DEFAULT_KIND = 'News';

export type EngageCounts = { seen: number; tapped: number; dismissed: number; confirmed: number };
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
  confirmed_at: string | null;
};
export type FollowUpResult = { ok: true; rows: FollowUpRow[] } | { ok: false; error: string };

/** The scopes the editor's reach line counts (08.12); Audience went with 08.18. */
export type ReachScopes = {
  scope_programs: string[];
  scope_levels: string[];
  scope_cohort: string;
  scope_subscription_kind: string;
  scope_product_ids: string[];
  scope_user_ids: string[];
  scope_courses: string[];
};

// the editor page's save (08.18): the status the pressed button means —
// Save draft and Move to drafts 'draft', Publish 'active', Save changes the
// notice's own
export type SaveAnnouncementInput = {
  announcement_id: string | null;
  title: string;
  /** The editor's document; cleaned on the server to the notices' tools. */
  body: RichDoc;
  status: string;
  priority: number;
  pinned: boolean;
  dismissible: boolean;
  /** Also pops up once on the dashboard (08.8). */
  must_see: boolean;
  /** Ask students to confirm (08.16); Must-see implies it. */
  ask_confirm: boolean;
  /** One of the admin's kinds (08.13). */
  kind: string;
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

/** The stored words' ceiling; the database refuses past 64 KB (08.14). */
export const BODY_MAX_BYTES = 60 * 1024;

// A notice's picture as it reaches the server (08.10): already made small
// in the admin's browser (picture-maker.ts); these are the ceilings.
export const PICTURE_FULL_MAX_BYTES = 1024 * 1024; // the bucket's own limit
export const PICTURE_LIST_MAX_BYTES = 200 * 1024;
/** A student's mark, with the new number for the bell and the menu row (08.9; null: not read). */
export type MarkResult = { ok: true; newCount: number | null } | { ok: false; error: string };
export type SaveResult = { ok: true; announcement_id: string; created: boolean } | { ok: false; error: string };
