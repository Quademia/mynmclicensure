-- db/schema.sql — the readable statement of the current tables in `licensure_gh`.
-- Regenerated from db/migrations/ whenever a migration changes a table.
-- NEVER applied directly; the migrations are what run (db/README.md).
-- Last regenerated: 2026-09-11, after 20260911150000_catalogue_tables.sql.

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
  username             text,
  email                text not null,
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
  must_change_password boolean not null default false,   -- carried, unused (§9 #8)
  signup_source        text default 'SUPABASE_AUTH',     -- SUPABASE_AUTH | PAYSTACK_SETUP
  created_utc          timestamptz default now(),
  last_login_utc       timestamptz,
  school_id            bigint references schools (id),
  school_other         text,
  referral_source      text
);

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
  created_utc   timestamptz not null default now()
);
create index if not exists auth_events_identifier_created on auth_events (identifier, created_utc);
create index if not exists auth_events_fp_hash_created    on auth_events (fp_hash, created_utc) where fp_hash is not null;
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
create table if not exists products (
  product_id          text primary key,
  name                text not null,
  kind                text not null default 'PAID',     -- PAID | TRIAL | FREE
  status              text not null default 'active',   -- active | archived
  courses_included    text[] not null,
  price_minor         integer not null,
  currency            text not null default 'GHS',
  duration_days       integer not null,
  telegram_group_keys text[]
);

-- ── config (slice 3) ───────────────────────────────────────────────────
create table if not exists config (
  key         text primary key,
  value       text not null,
  description text,
  updated_at  timestamptz default now()
);
