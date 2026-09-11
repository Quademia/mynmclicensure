// lib/catalogue/types.ts
//
// The catalogue rows as the app reads them (slice 3): programs, courses,
// levels, products, config. Column names are the legacy ones
// (db/schema.sql). The constant lists are the legacy pages' <select>
// options, in their order.

export type Program = {
  program_id: string;
  program_name: string;
  trial_product_id: string | null;
};

export const COURSE_STATUSES = ['active', 'draft', 'archived'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export type Course = {
  course_id: string;
  title: string;
  program_scope: string[];
  status: CourseStatus;
  page_slug: string | null;
};

export const PRODUCT_KINDS = ['PAID', 'TRIAL', 'FREE'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const PRODUCT_STATUSES = ['active', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

// The currency <select> on the legacy Products modal, in its order.
export const CURRENCIES = ['GHS', 'USD', 'GBP', 'NGN'] as const;

export type Product = {
  product_id: string;
  name: string;
  kind: ProductKind;
  status: ProductStatus;
  courses_included: string[];
  price_minor: number;
  currency: string;
  duration_days: number;
  telegram_group_keys: string[] | null;
};

export type ConfigRow = {
  key: string;
  value: string;
  description: string | null;
  updated_at: string | null;
};

// getConfig() as legacy returned it: a numeric string becomes a number.
export type ConfigMap = Record<string, string | number>;

// What every catalogue Server Action returns (lives here, not in the
// 'use server' module — AGENTS.md workaround).
export type ActionResult = { ok: true } | { ok: false; error: string };
