// lib/subscriptions/types.ts
//
// Subscriptions as the app reads them (slice 8): the row (db/schema.sql,
// the legacy nine columns), the admin list's row with its two joins, the
// course-access map legacy getStudentCourseAccess() returned, and the
// lists the Worker validated against. Constants live here, not in
// actions.ts — a 'use server' module exports only async functions.

export const SUB_STATUSES = ['ACTIVE', 'EXPIRED', 'REVOKED'] as const;
export type SubscriptionStatus = (typeof SUB_STATUSES)[number];

// What the admin Edit dialog may set (the Worker's ADMIN_SUB_SOURCES).
// The row default 'PAYMENT' is a legacy value no page writes.
export const ADMIN_SUB_SOURCES = ['SELF_TRIAL_SIGNUP', 'PAYSTACK', 'ADMIN'] as const;
export type SubscriptionSource = (typeof ADMIN_SUB_SOURCES)[number] | 'PAYMENT';

// The receipt (02 C3b, Sam 2026-09-19): start_utc / expires_utc are its
// access window, set from its course rows by the row writer; created_utc
// is when it was made.
export type Subscription = {
  subscription_id: string;
  user_id: string;
  product_id: string;
  start_utc: string;
  expires_utc: string;
  status: SubscriptionStatus;
  expiry_reminded: boolean;
  source: SubscriptionSource;
  source_ref: string | null;
  created_utc: string;
};

// The admin page's list row: the subscription with the student and the
// product joined, exactly the columns legacy selected, plus created_utc.
export type SubscriptionListRow = Pick<
  Subscription,
  'subscription_id' | 'user_id' | 'product_id' | 'start_utc' | 'expires_utc' | 'status' | 'source' | 'source_ref' | 'created_utc'
> & {
  users: {
    user_id: string;
    name: string | null;
    forename: string | null;
    surname: string | null;
    email: string;
    program_id: string | null;
  } | null;
  products: {
    name: string;
    kind: string;
    duration_days: number;
  } | null;
};

// A student as the Grant dialog's search returns it.
export type StudentHit = {
  user_id: string;
  name: string | null;
  forename: string | null;
  surname: string | null;
  email: string;
  program_id: string | null;
};

// A receipt's course rows as the admin panel shows them (02 C3b): the
// course_access row with the course's title joined.
export type AccessRow = {
  access_id: number;
  course_id: string;
  start_utc: string;
  expires_utc: string;
  revoked_utc: string | null;
  courses: { title: string } | null;
};

// legacy getStudentCourseAccess(): { course_id: { totalDays, expires } }.
export type CourseAccess = { totalDays: number; expires: string };
export type CourseAccessMap = Record<string, CourseAccess>;

export type ActionResult = { ok: true } | { ok: false; error: string };

// grant: the Worker said which of its two paths ran; since 02 C3a there
// is one path (a fresh receipt, its rows queued), so the mode went.
export type GrantResult = ActionResult;

// sync-expired: the Worker returned the count.
export type SyncResult = { ok: true; updatedCount: number } | { ok: false; error: string };

export type UpdateSubscriptionInput = {
  subscriptionId: string;
  productId: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  expiryDate: string;
  status: string;
  source: string;
  sourceRef: string;
};

// The student upgrade page's list (slice 9b): legacy
// student/upgrade.html's loadActiveSubscriptions select.
export type ActiveSubscriptionWithProduct = Pick<
  Subscription,
  'subscription_id' | 'user_id' | 'product_id' | 'start_utc' | 'expires_utc' | 'status'
> & { products: { name: string } | null };
