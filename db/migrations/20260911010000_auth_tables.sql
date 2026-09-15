-- 20260911010000_auth_tables.sql — slice 2a
--
-- The auth tables, transcribed from legacy/db/schema.sql, rls.sql and the
-- two rate-limit migrations, into the `licensure_gh` schema: programs,
-- schools, users, sessions, auth_events, reset_requests; the six login /
-- reset functions; the policies. Plus the read-only content copy of
-- programs and schools from the legacy tables (rebuild.md §6.6 — the one
-- sanctioned read of `public.*`, AGENTS.md rule #7).
--
-- Shape changes, each ticked by Sam on 2026-09-11 (rebuild.md §8):
--   S1  users.auth_id is NOT NULL UNIQUE and references auth.users.
--   S4  sessions.user_id → users; users.program_id → programs;
--       users.school_id → schools (the last one legacy already had).
--   S6  sessions.ip_hash is written by the server (column unchanged).
-- Policies rewritten for a server app (rebuild.md §6.4):
--   - users_update gains a WITH CHECK: a non-admin cannot change role,
--     active, user_id or auth_id on their own row (§9 #15); users_insert
--     refuses any role but STUDENT, the same hole by the other door.
--   - sessions has SELECT only. The login Server Action writes sessions
--     with the service role; the browser write path is gone (§9 #5 lives
--     in that action, not here).
--   - auth_events and reset_requests: RLS on, zero policies, reached only
--     through the SECURITY DEFINER functions, as legacy.
-- Every function pins search_path to this schema so a bare table name can
-- never resolve to public.*.

set search_path = licensure_gh;

-- ── programs (moved up from slice 3: the register page's dropdown) ─────
create table if not exists programs (
  program_id       text primary key,
  program_name     text not null,
  trial_product_id text
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

-- ── helper functions for the policies ──────────────────────────────────
-- SECURITY DEFINER so a policy on users can ask about users without
-- recursing into its own policy.
create or replace function auth_user_role()
returns text
language sql
security definer
stable
set search_path = licensure_gh
as $$
  select role from users where auth_id = auth.uid()
$$;

create or replace function auth_user_id()
returns text
language sql
security definer
stable
set search_path = licensure_gh
as $$
  select user_id from users where auth_id = auth.uid()
$$;

-- ── the login / reset functions, unchanged from legacy ────────────────
create or replace function log_auth_event(
  p_event_id     text,
  p_event_type   text,
  p_identifier   text,
  p_user_id      text    default null,
  p_fp_hash      text    default null,
  p_ua_hash      text    default null,
  p_device_label text    default null,
  p_fail_reason  text    default null
)
returns void
language plpgsql
security definer
set search_path = licensure_gh
as $$
begin
  if p_event_type not in ('LOGIN_SUCCESS', 'LOGIN_FAIL') then
    raise exception 'Invalid event_type: %', p_event_type;
  end if;

  insert into auth_events (
    event_id, event_type, identifier, user_id,
    fp_hash, ua_hash, device_label, fail_reason
  ) values (
    p_event_id,
    p_event_type,
    lower(trim(p_identifier)),
    p_user_id,
    p_fp_hash,
    p_ua_hash,
    p_device_label,
    p_fail_reason
  );
end;
$$;

-- 5 fails in 10 min, 10 fails in 24 h, by email and by device
-- fingerprint; RATE_LIMITED fails excluded; the 24-h rule checked first.
create or replace function check_login_rate_limit(
  p_identifier text,
  p_fp_hash    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_identifier   text := lower(trim(p_identifier));
  v_now          timestamptz := now();
  v_10m_ago      timestamptz := v_now - interval '10 minutes';
  v_24h_ago      timestamptz := v_now - interval '24 hours';
  v_id_short     int;
  v_id_long      int;
  v_fp_short     int;
  v_fp_long      int;
  v_oldest_short timestamptz;
  v_oldest_long  timestamptz;
  v_retry        int;
begin
  select count(*), min(created_utc)
  into v_id_short, v_oldest_short
  from auth_events
  where identifier = v_identifier
    and event_type = 'LOGIN_FAIL'
    and fail_reason != 'RATE_LIMITED'
    and created_utc > v_10m_ago;

  select count(*), min(created_utc)
  into v_id_long, v_oldest_long
  from auth_events
  where identifier = v_identifier
    and event_type = 'LOGIN_FAIL'
    and fail_reason != 'RATE_LIMITED'
    and created_utc > v_24h_ago;

  v_fp_short := 0;
  v_fp_long  := 0;
  if p_fp_hash is not null then
    select count(*) into v_fp_short
    from auth_events
    where fp_hash = p_fp_hash
      and event_type = 'LOGIN_FAIL'
      and fail_reason != 'RATE_LIMITED'
      and created_utc > v_10m_ago;

    select count(*) into v_fp_long
    from auth_events
    where fp_hash = p_fp_hash
      and event_type = 'LOGIN_FAIL'
      and fail_reason != 'RATE_LIMITED'
      and created_utc > v_24h_ago;
  end if;

  if v_id_long >= 10 or v_fp_long >= 10 then
    v_retry := greatest(
      extract(epoch from (v_oldest_long + interval '24 hours' - v_now))::int,
      60
    );
    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', v_retry,
      'reason', 'TOO_MANY_ATTEMPTS_24H'
    );
  end if;

  if v_id_short >= 5 or v_fp_short >= 5 then
    v_retry := greatest(
      extract(epoch from (v_oldest_short + interval '10 minutes' - v_now))::int,
      30
    );
    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', v_retry,
      'reason', 'TOO_MANY_ATTEMPTS'
    );
  end if;

  return jsonb_build_object('allowed', true);
end;
$$;

-- 3 reset requests per email per 60 min.
create or replace function check_reset_rate_limit(
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_email   text := lower(trim(p_email));
  v_now     timestamptz := now();
  v_60m_ago timestamptz := v_now - interval '60 minutes';
  v_count   int;
  v_oldest  timestamptz;
  v_retry   int;
begin
  select count(*), min(created_utc)
  into v_count, v_oldest
  from reset_requests
  where email = v_email
    and status != 'RATE_LIMITED'
    and created_utc > v_60m_ago;

  if v_count >= 3 then
    v_retry := greatest(
      extract(epoch from (v_oldest + interval '60 minutes' - v_now))::int,
      60
    );
    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', v_retry,
      'reason', 'TOO_MANY_RESET_REQUESTS'
    );
  end if;

  return jsonb_build_object('allowed', true);
end;
$$;

-- Records a forgot-password submission; resolves user_exists here so the
-- caller never learns it.
create or replace function log_reset_request(
  p_request_id   text,
  p_email        text,
  p_status       text,
  p_fp_hash      text default null,
  p_device_label text default null
)
returns void
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_email       text := lower(trim(p_email));
  v_user_exists boolean;
begin
  if p_status not in ('EMAIL_SENT', 'RATE_LIMITED', 'EMAIL_FAILED') then
    raise exception 'Invalid status: %', p_status;
  end if;

  select exists(
    select 1 from users where lower(email) = v_email
  ) into v_user_exists;

  insert into reset_requests (
    request_id, email, user_exists, status,
    fp_hash, device_label
  ) values (
    p_request_id,
    v_email,
    v_user_exists,
    p_status,
    p_fp_hash,
    p_device_label
  );
end;
$$;

-- After a successful reset: the most recent unused EMAIL_SENT row for
-- that email is marked used.
create or replace function mark_reset_used(
  p_email text
)
returns void
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_email text := lower(trim(p_email));
begin
  update reset_requests
  set used = true,
      used_utc = now()
  where request_id = (
    select request_id
    from reset_requests
    where email = v_email
      and status = 'EMAIL_SENT'
      and used = false
    order by created_utc desc
    limit 1
  );
end;
$$;

-- ── row-level security ─────────────────────────────────────────────────
alter table programs       enable row level security;
alter table schools        enable row level security;
alter table users          enable row level security;
alter table sessions       enable row level security;
alter table auth_events    enable row level security;
alter table reset_requests enable row level security;

-- programs / schools: readable before login (the register page).
drop policy if exists programs_select on programs;
create policy programs_select on programs for select using (true);

drop policy if exists schools_select on schools;
create policy schools_select on schools for select using (true);

-- users: own row, or admin. No delete.
drop policy if exists users_select on users;
create policy users_select on users for select
using (auth.uid() = auth_id or auth_user_role() = 'ADMIN');

drop policy if exists users_insert on users;
create policy users_insert on users for insert
with check (auth.uid() = auth_id and role = 'STUDENT');

drop policy if exists users_update on users;
create policy users_update on users for update
using (auth.uid() = auth_id or auth_user_role() = 'ADMIN')
with check (
  auth_user_role() = 'ADMIN'
  or (
    auth.uid() = auth_id
    and user_id = auth_user_id()
    and role    = auth_user_role()
    and active  = true
  )
);

-- sessions: read own (or admin). Writes come from the server with the
-- service role only — no insert / update policy on purpose (§6.4).
drop policy if exists sessions_select on sessions;
create policy sessions_select on sessions for select
using (user_id = auth_user_id() or auth_user_role() = 'ADMIN');

-- auth_events, reset_requests: RLS on, no policies. Functions only.

-- ── content copy (rebuild.md §6.6; AGENTS.md rule #7 exception) ────────
-- Read-only read of the legacy tables, once per environment, guarded so a
-- re-run on a populated schema changes nothing. schools keeps its ids
-- (identity column) so a school named in a support conversation means
-- the same row on both sides; the identity restarts past the copied max.
insert into programs (program_id, program_name, trial_product_id)
select program_id, program_name, trial_product_id
from public.programs
where not exists (select 1 from programs);

insert into schools (id, name, region, ownership, programmes, active, created_at)
overriding system value
select id, name, region, ownership, programmes, active, created_at
from public.schools
where not exists (select 1 from schools);

select setval(
  pg_get_serial_sequence('licensure_gh.schools', 'id'),
  coalesce((select max(id) from schools), 0) + 1,
  false
);
