-- db/rls.sql — the readable statement of the current policies and the
-- SECURITY DEFINER functions in `licensure_gh`. Regenerated from
-- db/migrations/ whenever a migration changes one. NEVER applied directly.
-- Last regenerated: 2026-09-13, after 20260913120000_question_bank_tables.sql.

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


-- ── slice 3: catalogue and config ──────────────────────────────────────
alter table courses  enable row level security;
alter table levels   enable row level security;
alter table products enable row level security;
alter table config   enable row level security;

-- programs: admin writes (the Courses & Programmes page).
create policy programs_insert on programs for insert
with check (auth_user_role() = 'ADMIN');
create policy programs_update on programs for update
using (auth_user_role() = 'ADMIN');

-- courses: any signed-in user reads; admin writes.
create policy courses_select on courses for select
using (auth.uid() is not null);
create policy courses_insert on courses for insert
with check (auth_user_role() = 'ADMIN');
create policy courses_update on courses for update
using (auth_user_role() = 'ADMIN');

-- levels: any signed-in user reads; admin writes.
create policy levels_select on levels for select
using (auth.uid() is not null);
create policy levels_insert on levels for insert
with check (auth_user_role() = 'ADMIN');
create policy levels_update on levels for update
using (auth_user_role() = 'ADMIN');

-- products: readable before login (the public Premium Prep page); admin writes.
create policy products_select on products for select
using (true);
create policy products_insert on products for insert
with check (auth_user_role() = 'ADMIN');
create policy products_update on products for update
using (auth_user_role() = 'ADMIN');

-- config: any signed-in user reads; admin insert, update AND delete.
create policy config_select on config for select
using (auth.uid() is not null);
create policy config_insert on config for insert
with check (auth_user_role() = 'ADMIN');
create policy config_update on config for update
using (auth_user_role() = 'ADMIN');
create policy config_delete on config for delete
using (auth_user_role() = 'ADMIN');

-- ── slice 4a: the question bank ────────────────────────────────────────
-- The entitlement gate (rebuild.md §9 defect 3), filled in by slice 8:
-- an ADMIN, or a student with an ACTIVE, unexpired subscription whose
-- product includes the course. Slice 4a created it allowing any
-- signed-in user; the signature has not changed.
create or replace function user_has_course(p_course_id text)
returns boolean
language sql
security definer
stable
set search_path = licensure_gh
as $$
  select auth.uid() is not null and (
    auth_user_role() = 'ADMIN'
    or exists (
      select 1
      from subscriptions s
      join products p on p.product_id = s.product_id
      where s.user_id = auth_user_id()
        and s.status = 'ACTIVE'
        and s.expires_utc > now()
        and p_course_id = any (p.courses_included)
    )
  )
$$;

-- items_* (all eleven; the migration loops). Read through the gate with
-- the table's own course id; ADMIN insert, update and delete, as legacy.
create policy items_gp_select on items_gp for select
using (user_has_course('GP'));
create policy items_gp_insert on items_gp for insert
with check (auth_user_role() = 'ADMIN');
create policy items_gp_update on items_gp for update
using (auth_user_role() = 'ADMIN');
create policy items_gp_delete on items_gp for delete
using (auth_user_role() = 'ADMIN');
-- … × 11: items_rn_med ('RN_MED'), items_rn_surg, items_rm_ped_obs_hrn,
-- items_rm_mid, items_rphn_pphn, items_rphn_disease_ctrl,
-- items_rmhn_psych_nurs, items_rmhn_psych_ppharm, items_nac_basic_clin,
-- items_nac_basic_prev.

-- ── slice 5a: fixed quizzes and mock exams ─────────────────────────────
-- Any signed-in user reads (the student pages filter published + active
-- themselves); ADMIN inserts and updates; no DELETE, as legacy.
create policy quizzes_select on quizzes for select
using (auth.uid() is not null);
create policy quizzes_insert on quizzes for insert
with check (auth_user_role() = 'ADMIN');
create policy quizzes_update on quizzes for update
using (auth_user_role() = 'ADMIN');

create policy mock_quizzes_select on mock_quizzes for select
using (auth.uid() is not null);
create policy mock_quizzes_insert on mock_quizzes for insert
with check (auth_user_role() = 'ADMIN');
create policy mock_quizzes_update on mock_quizzes for update
using (auth_user_role() = 'ADMIN');


-- ── slice 8: subscriptions ─────────────────────────────────────────────
-- Own rows or ADMIN read; ADMIN inserts and updates; no DELETE. The
-- legacy student self-insert policy is not carried (§9 defect 2): the
-- trial grant is a Server Action with the service role.
create policy subscriptions_select on subscriptions for select
using (subscriptions.user_id = auth_user_id() or auth_user_role() = 'ADMIN');
create policy subscriptions_insert on subscriptions for insert
with check (auth_user_role() = 'ADMIN');
create policy subscriptions_update on subscriptions for update
using (auth_user_role() = 'ADMIN');
