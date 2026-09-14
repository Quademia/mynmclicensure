// lib/profile/types.ts
//
// The profile page's constants and shapes (slice 7e). Plain values only —
// actions.ts may export only async functions (AGENTS.md, Known
// Workarounds).

export const PROFILE_IMAGE_BUCKET = 'licensure-gh-profile-images';
export const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024; // legacy uploadProfileImage MAX_SIZE
export const PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// legacy's Level dropdown
export const PROFILE_LEVELS = ['L100', 'L200', 'L300', 'L400'] as const;

export type SchoolOption = { id: number; name: string; region: string };

// The Subscription panel's row (legacy getUserById activeSubscription:
// the most recently expiring ACTIVE subscription with its product).
export type ProfileSubscription = {
  subscription_id: string;
  product_id: string;
  status: string;
  expires_utc: string | null;
  products: { name: string | null } | null;
};

export type PersonalInput = {
  forename: string;
  surname: string;
  phone_number: string;
};

export type AcademicInput = {
  level: string;
  cohort: string;
  /** '' = none, '__OTHER__' = typed name, else a school id */
  school: string;
  school_other: string;
};

export type ActionResult = { ok: true } | { ok: false; error: string };
export type PersonalResult = { ok: true; avatar_url: string | null } | { ok: false; error: string };
