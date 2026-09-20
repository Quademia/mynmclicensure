-- db/rls.sql — the readable statement of the current policies and the
-- SECURITY DEFINER functions in `licensure_gh`. Regenerated from
-- db/migrations/ whenever a migration changes one. NEVER applied directly.
-- Last regenerated: 2026-09-15, after 20260915150000_messaging.sql.

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

-- users: own row, or admin. No browser insert or delete (S10): the
-- profile row is inserted by the server; there was never a delete.
-- Update is column-level — the profile page's fields only — with the
-- users_update policy as the floor beneath the grant.
drop policy if exists users_select on users;
create policy users_select on users for select
using (auth.uid() = auth_id or auth_user_role() = 'ADMIN');

revoke insert on users from anon, authenticated;
revoke delete on users from anon, authenticated;
revoke update on users from anon, authenticated;
grant update (forename, surname, name, phone_number, avatar_url, level, cohort, school_id, school_other)
  on users to authenticated;

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

-- auth_events, reset_requests: RLS on, no policies. Functions only —
-- and since S9 the five functions answer to the service role only:
revoke execute on function log_auth_event(text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function check_login_rate_limit(text, text, text)                            from public, anon, authenticated;
revoke execute on function check_reset_rate_limit(text)                                        from public, anon, authenticated;
revoke execute on function log_reset_request(text, text, text, text, text)                     from public, anon, authenticated;
revoke execute on function mark_reset_used(text)                                               from public, anon, authenticated;


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

-- product_courses (02 C1): mirrors products — anyone reads, an ADMIN
-- inserts or deletes; a link row is a pair, never updated.
create policy product_courses_select on product_courses for select
using (true);
create policy product_courses_insert on product_courses for insert
with check (auth_user_role() = 'ADMIN');
create policy product_courses_delete on product_courses for delete
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
-- signed-in user; the signature has not changed. Since 02 C2
-- (2026-09-19) it is one lookup in my_course_access() — the one
-- definition of "live" the pages read too (§8 S8, D13).
--
-- my_course_access(): the caller's courses with the latest end among
-- their live course_access rows — unrevoked, not yet ended, and at
-- least one row already started. EXECUTE revoked from public and anon;
-- authenticated keeps it (the student calls it as themselves).
create or replace function my_course_access()
returns table (course_id text, expires_utc timestamptz)
language sql
security definer
stable
set search_path = licensure_gh
as $$
  select a.course_id, max(a.expires_utc)
  from course_access a
  where a.user_id = auth_user_id()
    and a.revoked_utc is null
    and a.expires_utc > now()
  group by a.course_id
  having bool_or(a.start_utc <= now())
$$;

create or replace function user_has_course(p_course_id text)
returns boolean
language sql
security definer
stable
set search_path = licensure_gh
as $$
  select auth.uid() is not null and (
    auth_user_role() = 'ADMIN'
    or exists (select 1 from my_course_access() m where m.course_id = p_course_id)
  )
$$;

-- question_bank (one table since 08 B1, 2026-09-19; was items_* × 11
-- with `user_has_course('<course>')` per table). The read tests the
-- caller's courses as a set, which Postgres evaluates once per statement
-- rather than once per row; ADMIN insert, update and delete, as legacy.
create policy question_bank_select on question_bank for select
using (
  auth_user_role() = 'ADMIN'
  or course_id in (select m.course_id from my_course_access() m)
);
create policy question_bank_insert on question_bank for insert
with check (auth_user_role() = 'ADMIN');
create policy question_bank_update on question_bank for update
using (auth_user_role() = 'ADMIN');
create policy question_bank_delete on question_bank for delete
using (auth_user_role() = 'ADMIN');

-- ── slice 5a: fixed quizzes and mock exams ─────────────────────────────
-- Any signed-in user reads (the student pages filter published + active
-- themselves); ADMIN inserts and updates; no DELETE, as legacy.
-- Q1 (20260919170000_quiz_floor.sql): a student reads an active,
-- published row of a course they hold; the admin reads all. item_ids
-- and notes are not readable by the browser roles — column-level, the
-- service role reads them behind the gates.
create policy quizzes_select on quizzes for select
using (auth_user_role() = 'ADMIN' or (status = 'active' and published and user_has_course(course_id)));
create policy quizzes_insert on quizzes for insert
with check (auth_user_role() = 'ADMIN');
create policy quizzes_update on quizzes for update
using (auth_user_role() = 'ADMIN');
revoke select on quizzes from anon, authenticated;
grant select (quiz_id, course_id, title, n, allowed_modes, shuffle, time_limit_sec,
              published, publish_at, unpublish_at, status, created_at, updated_at)
  on quizzes to authenticated;

create policy mock_quizzes_select on mock_quizzes for select
using (auth_user_role() = 'ADMIN' or (status = 'active' and published and user_has_course(course_id)));
create policy mock_quizzes_insert on mock_quizzes for insert
with check (auth_user_role() = 'ADMIN');
create policy mock_quizzes_update on mock_quizzes for update
using (auth_user_role() = 'ADMIN');
revoke select on mock_quizzes from anon, authenticated;
grant select (quiz_id, course_id, title, n, allowed_modes, shuffle, time_limit_sec,
              published, publish_at, unpublish_at, status, visibility, created_at, updated_at)
  on mock_quizzes to authenticated;


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

-- course_access (02 C2): a student reads their own rows, an admin every
-- row; no browser write path (the grants, not a policy — the migration
-- revoked insert / update / delete from anon and authenticated).
create policy course_access_select on course_access for select
using (user_id = auth_user_id() or auth_user_role() = 'ADMIN');

-- ── slice 6a: attempts (03 Q5: read only from the browser) ─────────────
-- Own rows or ADMIN read. The own-row INSERT and UPDATE policies of the
-- port went with 03 Q5 (D7): the browser roles hold SELECT alone (the
-- default "grant all" taken back), and every write is a SECURITY
-- DEFINER function the service role calls after the Server Action's
-- gate — create_attempt, start_timed_attempt, save_answers,
-- check_answer, finish_attempt, expire_attempt, abandon_attempt — each
-- taking the caller's user id and refusing a row that is not theirs or
-- an attempt not in progress. Grading is grade_answer() in SQL.
create policy attempts_select on attempts for select
using (attempts.user_id = auth_user_id() or auth_user_role() = 'ADMIN');

-- ── 03 Q4: attempt_items and offline_pack_items ────────────────────────
-- A student reads the rows of their own attempts (the owner tested as a
-- set, once per statement) or an admin every row; no browser write path
-- on either table (the grants: `revoke all`, then SELECT back). On
-- attempt_items the SELECT is column-level and EXCLUDES the secret half
-- — correct, rationale, rationale_img, fb_a–fb_f — so a console query
-- for the key mid-exam is refused by the database; the server reads
-- those columns with the service role after its ownership check.
-- offline_pack_items is readable whole: a pack carries its key by design.
-- Every write is create_attempt() / create_offline_pack() (EXECUTE
-- revoked from the browser roles; the service role calls them) and,
-- since Q5, save_answers() / check_answer() / finish_attempt() /
-- expire_attempt() on the answer group.
create policy attempt_items_select on attempt_items for select
using (
  auth_user_role() = 'ADMIN'
  or attempt_id in (select a.attempt_id from attempts a where a.user_id = auth_user_id())
);
create policy offline_pack_items_select on offline_pack_items for select
using (
  auth_user_role() = 'ADMIN'
  or pack_id in (select p.pack_id from offline_packs p where p.user_id = auth_user_id())
);

-- offline_packs (slice 13a): own rows or ADMIN read; own-row insert and
-- update policies remain from the migration, though since 03 Q4 the
-- only writer is create_offline_pack() through the service role.
create policy offline_packs_select on offline_packs for select
using (offline_packs.user_id = auth_user_id() or auth_user_role() = 'ADMIN');
create policy offline_packs_insert on offline_packs for insert
with check (offline_packs.user_id = auth_user_id());
create policy offline_packs_update on offline_packs for update
using (offline_packs.user_id = auth_user_id());

-- ── slice 9a: payments and the rate limit ──────────────────────────────
-- payments: ADMIN reads; no INSERT or UPDATE policy on purpose — every
-- write comes from the Server Actions in lib/payments/ with the service
-- role (the payer has no session yet). Students cannot read a payment
-- row at all, as legacy.
create policy payments_select on payments for select
using (auth_user_role() = 'ADMIN');

-- rate_limits: RLS on, no policies. The function below is the only
-- reader and writer; the browser cannot call it (EXECUTE revoked).
-- 5 per 60 s per key, a fixed window; the caller fails OPEN on error.
create or replace function check_payment_rate_limit(
  p_key            text,
  p_limit          integer default 5,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_count integer;
begin
  insert into rate_limits (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case
                  when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1
                  else rate_limits.count + 1
                end,
        window_start = case
                  when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now()
                  else rate_limits.window_start
                end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke execute on function check_payment_rate_limit(text, integer, integer) from public, anon, authenticated;

-- ── slice 12a: messaging ───────────────────────────────────────────────
-- A student reads, inserts and updates their own threads and the
-- messages on them; an ADMIN all — the thread INSERT bypass included
-- (legacy's June 2026 fix). No DELETE, as legacy.
create policy messages_threads_select on messages_threads for select
using (auth_user_role() = 'ADMIN' or messages_threads.user_id = auth_user_id());
create policy messages_threads_insert on messages_threads for insert
with check (auth_user_role() = 'ADMIN' or messages_threads.user_id = auth_user_id());
create policy messages_threads_update on messages_threads for update
using (auth_user_role() = 'ADMIN' or messages_threads.user_id = auth_user_id());

create policy messages_select on messages for select
using (auth_user_role() = 'ADMIN' or exists (select 1 from messages_threads t where t.thread_id = messages.thread_id and t.user_id = auth_user_id()));
create policy messages_insert on messages for insert
with check (auth_user_role() = 'ADMIN' or exists (select 1 from messages_threads t where t.thread_id = messages.thread_id and t.user_id = auth_user_id()));
create policy messages_update on messages for update
using (auth_user_role() = 'ADMIN' or exists (select 1 from messages_threads t where t.thread_id = messages.thread_id and t.user_id = auth_user_id()));

-- The realtime feed: messages is in the supabase_realtime publication
-- (the migration adds it when absent); the browser subscribes under
-- messages_select.
