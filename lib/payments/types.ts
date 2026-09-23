// lib/payments/types.ts
//
// The payments row as the app reads it (the legacy `payments` table,
// column for column), the four actions' inputs and replies, and the
// constants. The replies mirror the payments Worker's JSON bodies
// (rebuild.md §7.1) as discriminated unions: what was an HTTP status
// plus an `error` code is now `ok` plus `error`. The confirmation page
// branches on these the way legacy branched on the status codes.
//
// Constants live here, not in the 'use server' modules (AGENTS.md
// workaround: a 'use server' module may export only async functions).

export const PAYMENT_STATUSES = ['INIT', 'PAID', 'SETUP_REQUIRED', 'ACTIVATED', 'FAILED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** 48 hours from setup_created_utc; expired or missing both refuse. */
export const SETUP_TOKEN_LIFETIME_MS = 48 * 60 * 60 * 1000;

/**
 * The confirmation page's poll (D35, Sam 2026-09-23): every 3 s for the
 * first minute, then every 10 s up to three minutes in all. It used to
 * stop at 20 polls — one minute — and a mobile-money buyer approving the
 * prompt on their phone routinely takes longer than that.
 */
export const VERIFY_FAST_POLL_MS = 3000;
export const VERIFY_FAST_POLLS = 20;
export const VERIFY_SLOW_POLL_MS = 10000;
export const VERIFY_SLOW_POLLS = 12;

/** The Worker's own words for a refused call. */
export const RATE_LIMITED_MESSAGE = 'Too many requests. Please wait a moment and try again.';

/** The limiter could not be read, so the action is refused (fails closed, D35). */
export const LIMITER_UNAVAILABLE_MESSAGE = 'Payments are briefly unavailable — please try again in a minute.';

export type Payment = {
  reference: string;
  status: PaymentStatus;
  email: string;
  user_id: string | null;
  product_id: string;
  product_name: string | null;
  amount_minor_expected: number;
  currency: string;
  amount_minor_paid: number | null;
  paid_utc: string | null;
  activated_utc: string | null;
  subscription_id: string | null;
  failure_note: string | null;
  raw: Record<string, unknown> | null;
  setup_token: string | null;
  setup_created_utc: string | null;
  setup_completed_utc: string | null;
  program_id: string | null;
  phone_number: string | null;
};

/** The users columns the Worker read for a payer. */
export type PaymentUser = {
  user_id: string;
  email: string;
  auth_id: string;
  forename: string | null;
  surname: string | null;
  name: string | null;
  active: boolean;
  program_id: string | null;
  phone_number?: string | null;
};

// 'extended' (the Worker's same-product extension) went with 02 C3a: a
// renewal is a receipt of its own whose course rows queue.
export type ActivationMode = 'existing_by_ref' | 'created';

// ── init-public / init-upgrade ─────────────────────────────────────────
export type InitPublicInput = {
  email: string;
  phone_number: string;
  program_id: string;
  product_id: string;
};

export type InitResult =
  | { ok: true; reference: string; authorization_url: string }
  | { ok: false; error: string; message: string };

// ── verify ─────────────────────────────────────────────────────────────
export type VerifyResult =
  | {
      ok: true;
      status: 'ACTIVATED';
      reference: string;
      subscription_id: string;
      activation_mode?: ActivationMode;
      requires_setup: false;
      /**
       * For the confirmation page's receipt (2026-09-23): what was bought
       * and for how much, from the payment row. Nothing personal — the
       * reference alone must never yield the payer's details (D33).
       */
      product_name: string;
      amount_minor_expected: number | null;
      currency: string;
    }
  | {
      ok: true;
      status: 'SETUP_REQUIRED';
      reference: string;
      requires_setup: true;
      setup_token: string;
      email: string;
      product_id: string;
      product_name: string;
      amount_minor_expected: number | null;
      currency: string;
      phone_number: string;
      program_id: string;
    }
  // The Worker's 409: Paystack has not said "success" yet; the row stays
  // INIT and the confirmation page polls on this.
  | { ok: false; error: 'not_ready'; status: string; reference: string; message: string }
  // The Worker's 400 on a FAILED row.
  | { ok: false; error: 'payment_failed'; status: 'FAILED'; reference: string; failure_note: string }
  | {
      ok: false;
      error:
        | 'missing_reference'
        | 'rate_limited'
        | 'limiter_unavailable'
        | 'payment_not_found'
        | 'amount_mismatch'
        | 'currency_mismatch'
        | 'verify_failed';
      reference: string;
      message: string;
    };

// ── setup-complete ─────────────────────────────────────────────────────
// The input is a FormData (reference, setup_token, forename, surname,
// password, phone_number, program_id) — see setup-complete.ts.
export type SetupCompleteResult =
  | {
      ok: true;
      status: 'ACTIVATED';
      reference: string;
      subscription_id: string;
      user_id: string | null;
      activation_mode?: ActivationMode;
    }
  | { ok: false; error: string; message: string };
