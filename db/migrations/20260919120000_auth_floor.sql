-- 20260919120000_auth_floor.sql — rebuild.md §8 S9 + S10 (Sam, 2026-09-18)
--
-- S9  The five login / reset functions carried the default EXECUTE to
--     public: legacy's browser had to call them, and on the port they
--     answered to the anon key over plain HTTP (D24, proven on dev
--     2026-09-18). Revoked from public, anon and authenticated; the
--     server calls them with the service role, which keeps its own
--     grant from 20260910120000_licensure_gh_schema.sql. The login
--     limiter counts by the caller's IP hash as a third key — the
--     server knows it now (lib/auth/request-info.ts; §8 S6 already
--     stores it on sessions) — and log_auth_event records it.
--     users.username and users.must_change_password, residue of alpha's
--     Create User page that gamma never rebuilt, are dropped; Invite by
--     email replaces that page (auth read-back item 7).
-- S10 The owner could rewrite every column of their own users row but
--     role, active, user_id and auth_id (D25, proven on dev). UPDATE is
--     revoked from the browser roles and granted back on the profile
--     page's fields only; INSERT is revoked outright and users_insert
--     dropped — the profile row is inserted by the server (D27), so
--     registration no longer depends on "Confirm email" being off.
--     email is lowercased by a trigger on every write and unique on
--     lower(email) (D26); the rows already there are lowercased first.
--     The users_update policy stays as the floor beneath the grants.
--
-- ⚠ This schema's default privileges grant EXECUTE on every new routine
-- to anon and authenticated, so each REVOKE below FOLLOWS the CREATE it
-- covers. A function with a new parameter is a new signature: the old
-- one is dropped first so no overload survives with the public grant.
--
-- IP thresholds are wider than the email and fingerprint ones (20 per
-- 10 min, 50 per 24 h against 5 and 10): many students share one
-- address behind a campus router or a mobile carrier, and five
-- mistypes across a dormitory must not lock the whole building out.
-- Two numbers, in one place, Sam's to change.

set search_path = licensure_gh;

-- ── S9: the IP on auth_events ─────────────────────────────────────────
alter table auth_events add column if not exists ip_hash text;
create index if not exists auth_events_ip_hash_created
  on auth_events (ip_hash, created_utc) where ip_hash is not null;

-- ── S9: log_auth_event, now with p_ip_hash ────────────────────────────
drop function if exists log_auth_event(text, text, text, text, text, text, text, text);

create or replace function log_auth_event(
  p_event_id     text,
  p_event_type   text,
  p_identifier   text,
  p_user_id      text    default null,
  p_fp_hash      text    default null,
  p_ua_hash      text    default null,
  p_device_label text    default null,
  p_fail_reason  text    default null,
  p_ip_hash      text    default null
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
    fp_hash, ua_hash, device_label, fail_reason, ip_hash
  ) values (
    p_event_id,
    p_event_type,
    lower(trim(p_identifier)),
    p_user_id,
    p_fp_hash,
    p_ua_hash,
    p_device_label,
    p_fail_reason,
    p_ip_hash
  );
end;
$$;

revoke execute on function log_auth_event(text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;

-- ── S9: check_login_rate_limit, now counting by IP too ────────────────
-- 5 fails in 10 min, 10 in 24 h, by email and by device fingerprint
-- (unchanged); 20 in 10 min, 50 in 24 h by IP hash (new). RATE_LIMITED
-- fails excluded; the 24-h rules checked first, as before.
drop function if exists check_login_rate_limit(text, text);

create or replace function check_login_rate_limit(
  p_identifier text,
  p_fp_hash    text default null,
  p_ip_hash    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  c_ip_short     constant int := 20;
  c_ip_long      constant int := 50;
  v_identifier   text := lower(trim(p_identifier));
  v_now          timestamptz := now();
  v_10m_ago      timestamptz := v_now - interval '10 minutes';
  v_24h_ago      timestamptz := v_now - interval '24 hours';
  v_id_short     int;
  v_id_long      int;
  v_fp_short     int := 0;
  v_fp_long      int := 0;
  v_ip_short     int := 0;
  v_ip_long      int := 0;
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

  if p_ip_hash is not null then
    select count(*) into v_ip_short
    from auth_events
    where ip_hash = p_ip_hash
      and event_type = 'LOGIN_FAIL'
      and fail_reason != 'RATE_LIMITED'
      and created_utc > v_10m_ago;

    select count(*) into v_ip_long
    from auth_events
    where ip_hash = p_ip_hash
      and event_type = 'LOGIN_FAIL'
      and fail_reason != 'RATE_LIMITED'
      and created_utc > v_24h_ago;
  end if;

  if v_id_long >= 10 or v_fp_long >= 10 or v_ip_long >= c_ip_long then
    v_retry := greatest(
      extract(epoch from (coalesce(v_oldest_long, v_now) + interval '24 hours' - v_now))::int,
      60
    );
    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', v_retry,
      'reason', 'TOO_MANY_ATTEMPTS_24H'
    );
  end if;

  if v_id_short >= 5 or v_fp_short >= 5 or v_ip_short >= c_ip_short then
    v_retry := greatest(
      extract(epoch from (coalesce(v_oldest_short, v_now) + interval '10 minutes' - v_now))::int,
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

revoke execute on function check_login_rate_limit(text, text, text)
  from public, anon, authenticated;

-- ── S9: the three reset functions, bodies unchanged, grants revoked ──
revoke execute on function check_reset_rate_limit(text)
  from public, anon, authenticated;
revoke execute on function log_reset_request(text, text, text, text, text)
  from public, anon, authenticated;
revoke execute on function mark_reset_used(text)
  from public, anon, authenticated;

-- ── S9: the two alpha columns ─────────────────────────────────────────
alter table users drop column if exists username;
alter table users drop column if exists must_change_password;

-- ── S10: the users row's browser writes ───────────────────────────────
-- No browser insert: the server inserts the profile row (register,
-- pay-first setup) with the service role.
drop policy if exists users_insert on users;
revoke insert on users from anon, authenticated;

-- Update: only the profile page's fields, and only through the
-- users_update policy (own row, role and active unchanged). Everything
-- else — user_id, auth_id, email, program_id, role, active,
-- signup_source, created_utc, last_login_utc, referral_source — is the
-- server's to write.
revoke update on users from anon, authenticated;
grant update (forename, surname, name, phone_number, avatar_url, level, cohort, school_id, school_other)
  on users to authenticated;

-- No browser delete either; there was never a policy, now no grant.
revoke delete on users from anon, authenticated;

-- ── S10: email lowercased on every write, unique on lower(email) ─────
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

drop trigger if exists users_email_lower on users;
create trigger users_email_lower
  before insert or update of email on users
  for each row execute function users_email_lower();

update users set email = lower(trim(email)) where email <> lower(trim(email));

create unique index if not exists users_email_lower_idx on users (lower(email));
