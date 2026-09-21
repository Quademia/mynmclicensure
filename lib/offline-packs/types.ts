// lib/offline-packs/types.ts
//
// The offline-pack shapes (slice 13a): the `offline_packs` row as
// legacy/db/schema.sql 3b.1 defines it, the watermark object legacy
// createOfflinePack stamped into it, the allowance legacy
// getOfflinePackAllowance returned, and the results of the two Server
// Actions the builder calls. Plain constants and types only — the
// Server Actions live in actions.ts, which may export only async
// functions (AGENTS.md, Known Workarounds).
//
// Config fallbacks equal the seed (rebuild.md §9 #11): legacy's code fell
// back to 50 questions and 3 packs while the seed said 100 and 5; the
// live row is the truth and these match it.

export const OFFLINE_MAX_QUESTIONS_DEFAULT = 100;
export const OFFLINE_PACKS_PER_COURSE_DEFAULT = 5;

// legacy renderer QA.OWNER_MARK_EVERY — the watermark strip after every
// tenth question.
export const OWNER_MARK_EVERY = 10;

import type { Item } from '@/lib/bank/types';

export type SelectionMode = 'topics' | 'concept';

export type OfflinePackWatermark = {
  pack_id: string;
  user_id: string;
  owner_name: string;
  owner_email_mask: string;
  owner_label: string;
};

export type OfflinePack = {
  pack_id: string;
  user_id: string;
  course_id: string;
  pack_name: string;
  selection_mode: SelectionMode;
  maintopics: string[];
  subtopics: string[];
  difficulties: string[];
  question_types: string[];
  concept_query: string | null;
  display_label: string | null;
  question_count: number;
  watermark: Partial<OfflinePackWatermark>;
  status: string;
  created_utc: string;
  updated_utc: string;
};

// One row of offline_pack_items (03 Q4): the question as the bank
// served it when the pack was built — the pack's own copy, so a later
// bank edit or delete never changes a saved pack (D12). Extends Item
// so the renderer takes it unchanged: course_id is the pack's and
// batch_id is null on a snapshot (getOfflinePackForRender fills both).
export type OfflinePackItem = Item & {
  pack_item_id: number;
  pack_id: string;
  position: number;
};

// legacy getOfflinePackAllowance's blocked_reason values, plus the two the
// create step adds and the builder page's own default.
export type BlockedReason =
  | 'not_subscribed'
  | 'renew_required'
  | 'trial_not_allowed'
  | 'allowance_check_failed'
  | 'limit_reached'
  | 'missing_course_id'
  | 'no_items_match'
  | 'question_limit_exceeded'
  | 'not_allowed'
  | 'user_not_found'
  | 'insert_failed'
  | 'create_failed';

export type Allowance = {
  success: boolean;
  allowed: boolean;
  blocked_reason: BlockedReason | null;
  course_id: string;
  downloads_per_course: number;
  used_this_period: number;
  remaining: number;
  period_start: string | null;
  is_trial: boolean;
};

// What the label builders take (legacy buildOfflinePackDisplayLabel meta).
export type PackLabelMeta = {
  n: number;
  selection_mode: SelectionMode;
  maintopics: string[];
  difficulties: string[];
  concepts: string[];
  concept_query: string;
};

// legacy pickOfflinePackItemIds' result.
export type PickResult = {
  item_ids: string[];
  unused_selected: number;
  reused_selected: number;
  pool_size: number;
};

// The builder's "Create pack" click: the allowance check, then the pick
// (legacy openOfflineModal did both from the browser).
export type PrepareResult =
  | { ok: true; allowance: Allowance; pick: PickResult }
  | { ok: false; reason: BlockedReason; allowance: Allowance | null };

// legacy createOfflinePack's payload.
export type CreatePackInput = {
  course_id: string;
  item_ids: string[];
  pack_name: string;
  selection_mode: SelectionMode;
  maintopics: string[];
  subtopics: string[];
  difficulties: string[];
  question_types: string[];
  concepts: string[];
  concept_query: string;
  display_label: string;
};

export type CreatePackResult =
  | { ok: true; pack_id: string; remaining: number }
  | { ok: false; reason: BlockedReason; message: string; allowance: Allowance | null };

// ── My Packs (13b) ─────────────────────────────────────────────────────
// legacy listOfflinePacks' rows: the card's columns plus the course
// title joined from `courses` (the id when the course is gone).
export type OfflinePackListRow = Pick<
  OfflinePack,
  'pack_id' | 'course_id' | 'pack_name' | 'display_label' | 'question_count' | 'status' | 'created_utc'
> & { course_title: string };

export type OfflinePackPage = { ok: true; total: number; items: OfflinePackListRow[] } | { ok: false; message: string };

// legacy PAGE_SIZE on my-offline-packs.html
export const MY_PACKS_PAGE_SIZE = 24;
