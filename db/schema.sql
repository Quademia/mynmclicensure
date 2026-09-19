-- db/schema.sql — the readable statement of the current tables in `licensure_gh`.
-- Regenerated from db/migrations/ whenever a migration changes a table.
-- NEVER applied directly; the migrations are what run (db/README.md).
-- Last regenerated: 2026-09-15, after 20260915150000_messaging.sql.

-- ── programs (moved up from slice 3: the register page's dropdown) ─────
create table if not exists programs (
  program_id       text primary key,
  program_name     text not null,
  trial_product_id text references products (product_id)  -- S4 (slice 3; products is created below)
);

-- ── schools (legacy migration add_schools_and_signup_capture.sql) ──────
create table if not exists schools (
  id          bigint generated always as identity primary key,
  name        text not null,
  region      text not null,
  ownership   text,                 -- 'State' | 'Private'
  programmes  text[] default '{}',  -- NMC programme codes (RGN, RM, ...)
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── users ──────────────────────────────────────────────────────────────
create table if not exists users (
  user_id              text primary key,                 -- 'U_' + 16 hex
  auth_id              uuid not null unique references auth.users (id) on delete cascade,  -- S1
  email                text not null,                    -- lowercased by trigger, unique on lower(email) (S10)
  phone_number         text,
  name                 text,
  forename             text,
  surname              text,
  program_id           text references programs (program_id),  -- S4
  cohort               text,
  level                text,
  role                 text not null default 'STUDENT',  -- STUDENT | ADMIN
  active               boolean not null default true,
  avatar_url           text,
  signup_source        text default 'SUPABASE_AUTH',     -- SUPABASE_AUTH | PAYSTACK_SETUP
  created_utc          timestamptz default now(),
  last_login_utc       timestamptz,
  school_id            bigint references schools (id),
  school_other         text,
  referral_source      text
);
-- S10 (20260919120000_auth_floor.sql): email lowercased on every write,
-- one account per address. username and must_change_password dropped (S9).
create or replace function users_email_lower()
returns trigger
language plpgsql
set search_path = licensure_gh
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;
create trigger users_email_lower
  before insert or update of email on users
  for each row execute function users_email_lower();
create unique index if not exists users_email_lower_idx on users (lower(email));

-- ── sessions ───────────────────────────────────────────────────────────
-- Device sessions for the concurrent-login cap (2). Never deleted:
-- active = false on logout or kick.
create table if not exists sessions (
  session_id    text primary key,                        -- 'SESS_' + 32 hex
  user_id       text not null references users (user_id) on delete cascade,  -- S4
  kind          text not null default 'LOGIN',
  issued_utc    timestamptz not null default now(),
  expires_utc   timestamptz not null,
  last_seen_utc timestamptz not null default now(),
  device_label  text,
  ua_hash       text,
  ip_hash       text,                                    -- S6: written now
  login_via     text not null default 'EMAIL',           -- EMAIL | GOOGLE | MAGIC_LINK
  active        boolean not null default true
);
create index if not exists sessions_user_id            on sessions (user_id);
create index if not exists sessions_user_active_expiry on sessions (user_id, active, expires_utc);

-- ── auth_events ────────────────────────────────────────────────────────
-- Every login attempt, success and failure. Never deleted. Written only
-- by log_auth_event().
create table if not exists auth_events (
  event_id      text primary key,                        -- 'EVT_' + 16 hex
  event_type    text not null,                           -- LOGIN_SUCCESS | LOGIN_FAIL
  identifier    text not null,                           -- email, lowercased
  user_id       text,                                    -- null when unknown
  fp_hash       text,
  ua_hash       text,
  device_label  text,
  fail_reason   text,                                    -- INVALID_CREDENTIALS | RATE_LIMITED | NO_ACCOUNT
  created_utc   timestamptz not null default now(),
  ip_hash       text                                     -- S9: the limiter's third key
);
create index if not exists auth_events_identifier_created on auth_events (identifier, created_utc);
create index if not exists auth_events_fp_hash_created    on auth_events (fp_hash, created_utc) where fp_hash is not null;
create index if not exists auth_events_ip_hash_created    on auth_events (ip_hash, created_utc) where ip_hash is not null;
create index if not exists auth_events_user_id_created    on auth_events (user_id, created_utc) where user_id is not null;
create index if not exists auth_events_created            on auth_events (created_utc);

-- ── reset_requests ─────────────────────────────────────────────────────
create table if not exists reset_requests (
  request_id    text primary key,                        -- 'RR_' + 16 hex
  email         text not null,                           -- lowercased
  user_exists   boolean not null default false,          -- resolved server-side
  status        text not null,                           -- EMAIL_SENT | RATE_LIMITED | EMAIL_FAILED
  fp_hash       text,
  device_label  text,
  used          boolean not null default false,
  used_utc      timestamptz,
  created_utc   timestamptz not null default now()
);
create index if not exists reset_requests_email_created on reset_requests (email, created_utc);
create index if not exists reset_requests_created       on reset_requests (created_utc);

-- ── courses (slice 3) ──────────────────────────────────────────────────
create table if not exists courses (
  course_id     text primary key,
  title         text not null,
  program_scope text[] not null,
  status        text not null default 'active',   -- active | draft | archived
  page_slug     text
);

-- ── levels (slice 3; unused, kept as legacy) ───────────────────────────
create table if not exists levels (
  level_id   text primary key,
  label      text not null,
  created_at timestamptz default now()
);

-- ── products (slice 3) ─────────────────────────────────────────────────
-- courses_included (a text[] of course-id words, no key) was dropped by
-- 02 C1 (2026-09-19, §8 S8); what a product unlocks is product_courses.
create table if not exists products (
  product_id          text primary key,
  name                text not null,
  kind                text not null default 'PAID',     -- PAID | TRIAL | FREE
  status              text not null default 'active',   -- active | archived
  price_minor         integer not null,
  currency            text not null default 'GHS',
  duration_days       integer not null,
  telegram_group_keys text[]
);

-- ── product_courses (02 C1, §8 S8 the definition side) ─────────────────
-- What a product unlocks, one row per course. No dates, no status — a
-- definition carries no time; the entitlement side (course_access) is C2.
create table if not exists product_courses (
  product_id text not null references products (product_id),
  course_id  text not null references courses (course_id),
  primary key (product_id, course_id)
);
create index if not exists product_courses_course_id_idx on product_courses (course_id);

-- ── config (slice 3) ───────────────────────────────────────────────────
create table if not exists config (
  key         text primary key,
  value       text not null,
  description text,
  updated_at  timestamptz default now()
);

-- ── the question bank (slice 4a) ───────────────────────────────────────
-- Eleven tables of one shape, one per course (rebuild.md §8 S2, kept):
--   items_gp, items_rn_med, items_rn_surg,
--   items_rm_ped_obs_hrn, items_rm_mid,
--   items_rphn_pphn, items_rphn_disease_ctrl,
--   items_rmhn_psych_nurs, items_rmhn_psych_ppharm,
--   items_nac_basic_clin, items_nac_basic_prev
-- The migration creates them in a loop; the shape, written once:
create table if not exists items_gp (
  item_id         text primary key,
  question_type   text not null default 'MCQ',   -- MCQ | TF | SATA
  stem            text not null,
  option_a        text, fb_a text,
  option_b        text, fb_b text,
  option_c        text, fb_c text,
  option_d        text, fb_d text,
  option_e        text, fb_e text,
  option_f        text, fb_f text,
  correct         text not null,   -- "b" for MCQ / TF; "a,c,e" for SATA
  rationale       text,
  rationale_img   text,            -- public URL in licensure-gh-rationale-images
  subject         text,
  maintopic       text,
  subtopic        text,
  difficulty      text,
  marks           numeric not null default 1,
  batch_id        text,
  shuffle_options boolean not null default true   -- false for TF
);
-- Six indexes per table: maintopic, subtopic, subject, difficulty,
-- question_type, batch_id (items_<t>_<column>_idx).

-- Storage bucket (global namespace, hence the prefix):
-- licensure-gh-rationale-images — public read, 2 MB limit, server uploads only.

-- ── quizzes and mock_quizzes (slice 5a) ────────────────────────────────
-- Two tables of one shape, kept as two (D4); mock_quizzes adds
-- `visibility`. No DELETE policy on either: archive is the way out.
create table if not exists quizzes (
  quiz_id        text primary key,
  course_id      text not null references courses (course_id),  -- S4
  title          text not null,
  item_ids       text[] not null default '{}',
  n              integer not null default 0,
  allowed_modes  text not null default 'BOTH' check (allowed_modes in ('BOTH', 'INSTANT_ONLY', 'TIMED_ONLY')),  -- Q1
  shuffle        boolean not null default false,
  time_limit_sec integer,                         -- null = 1 min per question
  published      boolean not null default false,
  publish_at     timestamptz,
  unpublish_at   timestamptz,
  status         text not null default 'draft' check (status in ('draft', 'active', 'archived')),  -- Q1
  notes          text,                            -- admin only; server-only read (Q1)
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists quizzes_course_id_idx on quizzes (course_id);

create table if not exists mock_quizzes (
  quiz_id        text primary key,
  course_id      text not null references courses (course_id),  -- S4
  title          text not null,
  n              integer not null default 0,     -- default since Q1
  item_ids       text[] not null default '{}',   -- server-only read (Q1)
  allowed_modes  text not null default 'BOTH' check (allowed_modes in ('BOTH', 'INSTANT_ONLY', 'TIMED_ONLY')),  -- Q1
  shuffle        boolean not null default false,
  time_limit_sec integer,
  status         text not null default 'draft' check (status in ('draft', 'active', 'archived')),  -- Q1
  published      boolean not null default false,
  visibility     text not null default 'ALL' check (visibility in ('ALL', 'PAID', 'TRIAL')),  -- kept as the premium gate's flag (Sam, 2026-09-18); Q1 CHECK
  publish_at     timestamptz,
  unpublish_at   timestamptz,
  notes          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists mock_quizzes_course_id_idx on mock_quizzes (course_id);

-- ── subscriptions (slice 8) ────────────────────────────────────────────
-- No content copy (D5). expiry_reminded is carried unused: the
-- Sheets-era reminder scan that read it was never rebuilt (BUILD_LIST).
create table if not exists subscriptions (
  subscription_id text primary key,                                    -- 'SUB_' + hex
  user_id         text not null references users (user_id),           -- S4
  product_id      text not null references products (product_id),     -- S4
  start_utc       timestamptz not null default now(),
  expires_utc     timestamptz not null,
  status          text not null default 'ACTIVE',    -- ACTIVE | EXPIRED | REVOKED
  expiry_reminded boolean not null default false,
  source          text not null default 'PAYMENT',   -- PAYMENT | PAYSTACK | ADMIN | SELF_TRIAL_SIGNUP
  source_ref      text
);
create index if not exists subscriptions_user_id_idx on subscriptions (user_id);
create index if not exists subscriptions_user_product_status_idx on subscriptions (user_id, product_id, status);
create index if not exists subscriptions_status_expires_idx on subscriptions (status, expires_utc);

-- ── attempts (slice 6a) ────────────────────────────────────────────────
-- One row per run. item_ids and answers_json stay TEXT (§8 S3 unticked).
-- No content copy (D5). quiz_id names a row in quizzes OR mock_quizzes
-- and is null for the builder, so it carries no key.
create table if not exists attempts (
  attempt_id        text primary key,                                  -- 'ATT_' + ms + '_' + 7 hex
  user_id           text not null references users (user_id),         -- S4
  quiz_id           text,
  course_id         text not null references courses (course_id),     -- S4
  mode              text not null,                                     -- instant | timed
  source            text not null,                                     -- fixed | builder | retake | mock
  item_ids          text not null,                                     -- comma-joined, in the attempt's order
  n                 integer not null,
  seed              text,
  duration_min      integer,
  status            text not null default 'in_progress',               -- in_progress | completed | abandoned
  score_raw         numeric,
  score_total       numeric,
  score_pct         numeric,
  time_taken_s      integer,
  origin_attempt_id text references attempts (attempt_id),             -- S4; the retake chain
  display_label     text,
  answers_json      text not null default '[]',
  ts_iso            timestamptz default now()
);
create index if not exists attempts_user_id_idx   on attempts (user_id);
create index if not exists attempts_quiz_id_idx   on attempts (quiz_id);
create index if not exists attempts_course_id_idx on attempts (course_id);
create index if not exists attempts_status_idx    on attempts (status);
create index if not exists attempts_user_quiz_mode_status_idx on attempts (user_id, quiz_id, mode, status);

-- ── payments (slice 9a) ────────────────────────────────────────────────
-- No content copy (D5). Every write is the server's (service role); an
-- ADMIN reads. setup_token is re-minted on every verify; its 48-hour
-- clock is setup_created_utc.
create table if not exists payments (
  reference             text primary key,                                   -- 'QAC_' + 12 upper hex
  status                text not null,                                      -- INIT | PAID | SETUP_REQUIRED | ACTIVATED | FAILED
  email                 text not null,
  user_id               text references users (user_id),                    -- S4; null until setup on a pay-first row
  product_id            text not null references products (product_id),    -- S4
  product_name          text,
  amount_minor_expected integer not null,
  currency              text not null,
  amount_minor_paid     integer,
  paid_utc              timestamptz,
  activated_utc         timestamptz,
  subscription_id       text references subscriptions (subscription_id),   -- S4; null until activation
  failure_note          text,
  raw                   jsonb,                                              -- { init, verify, setup_complete, flow, … } — init and verify TRIMMED (D32, lib/payments/trim.ts): no card bin / expiry / authorization_code / IP
  setup_token           text,
  setup_created_utc     timestamptz,
  setup_completed_utc   timestamptz,
  program_id            text,
  phone_number          text
);
create index if not exists payments_status_idx   on payments (status);
create index if not exists payments_email_idx    on payments (email);
create index if not exists payments_user_id_idx  on payments (user_id);
create index if not exists payments_paid_utc_idx on payments (paid_utc desc nulls last);

-- ── rate_limits (slice 9a) ─────────────────────────────────────────────
-- The payment actions' 5-per-60-s counter, one row per caller address;
-- read and written only by check_payment_rate_limit() (db/rls.sql).
create table if not exists rate_limits (
  key          text primary key,                       -- 'payments:' + the caller's address
  window_start timestamptz not null default now(),
  count        integer not null default 0
);

-- ── messages_threads and messages (slice 12a) ──────────────────────────
-- No content copy (D5). admin_id keeps legacy's bare default 'admin1';
-- quiz_id, question_id and attempt_id carry no key (two quiz tables,
-- eleven item tables). messages is in the supabase_realtime publication.
create table if not exists messages_threads (
  thread_id        text primary key,                                   -- 'THR_' + 16 upper hex
  user_id          text not null references users (user_id),           -- S4
  admin_id         text not null default 'admin1',
  status           text not null default 'open',                       -- open | closed
  context_type     text not null default 'general',                    -- general | course | question
  subject          text,
  course_id        text references courses (course_id),                -- S4; nullable
  quiz_id          text,
  question_id      text,
  attempt_id       text,
  bulk_batch_id    text,
  ref_text         text,
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz not null default now(),
  last_sender_role text not null default 'student'                     -- student | admin
);
create index if not exists messages_threads_user_id_idx on messages_threads (user_id);
create index if not exists messages_threads_last_message_idx on messages_threads (last_message_at desc);
create index if not exists messages_threads_status_idx on messages_threads (status);

create table if not exists messages (
  message_id    text primary key,                                       -- 'MSG_' + 16 upper hex
  thread_id     text not null references messages_threads (thread_id),  -- S4
  sender_id     text not null,
  sender_role   text not null,                                          -- student | admin
  body_text     text not null,
  read_by_user  boolean not null default false,
  read_by_admin boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists messages_thread_id_idx on messages (thread_id);
create index if not exists messages_thread_created_idx on messages (thread_id, created_at);
create index if not exists messages_unread_admin_idx on messages (read_by_admin) where read_by_admin = false;
