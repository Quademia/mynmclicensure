-- 20261018200000_announcement_followup.sql — 08-help-and-news.md: 08.11 (the
-- admin's follow-up) and 08.12 (the reach before publishing); Sam,
-- 2026-10-18 ("Yes, as drawn"; "proceed to the next planned"). No table or
-- column changes: read-only functions over the tables A1 and A2 built.
--
-- WHY. The follow-up's numbers are "out of who it reaches today", and the
-- names behind them include those who have not seen it yet; the editor says
-- "This will reach N students today" as the scopes are set. Both need the
-- rule "does this notice reach this student" for every student at once —
-- the same rule announcements_for_user() applies to one. Written once here
-- (notice_scope_ok) and used by all three, so they cannot drift apart.
--
-- WHAT.
--   1. notice_people(person or all): each account's facts the scopes read —
--      role, active, programme, level, cohort, the latest live receipt's
--      kind and package (FREE and none when there is none), and the
--      courses held (live or ended, revoked grants apart: 08.1). Server
--      only.
--   2. notice_scope_ok(scopes…, facts…): the eight scopes, every one set
--      must match; an empty one is no restriction. Pure. Server only.
--   3. announcements_for_user() rewritten on the two (same columns, same
--      order, same answers — proved against the A1 version).
--   4. announcement_reach_counts(): each notice's reach today — the active
--      students its scopes match, whatever its status. Server only.
--   5. announcement_reach_preview(scopes…): the same count for scopes not
--      yet saved (the editor, 08.12). Server only.
--   6. announcement_followup(notice): every student it reaches today and
--      everyone with a mark on it — name, programme, subscription kind,
--      last sitting, reached or not, and the three dates; ordered by name.
--      Server only.
--
-- REACH. Dev now; prod at the next release Sam approves. The student
-- reader's answers do not change; nothing main's code calls changes shape.

set search_path = licensure_gh;

-- ── 1. the people ───────────────────────────────────────────────────────
create or replace function notice_people(p_user_id text default null)
returns table (
  user_id     text,
  role        text,
  active      boolean,
  program_id  text,
  level       text,
  cohort      text,
  sub_kind    text,
  sub_product text,
  held        text[]
)
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select u.user_id, u.role, u.active, u.program_id, u.level, u.cohort,
         l.kind, l.product_id,
         coalesce((select array_agg(distinct ca.course_id)
                   from course_access ca
                   where ca.user_id = u.user_id
                     and ca.revoked_utc is null
                     and ca.start_utc <= now()), '{}')
  from users u
  left join lateral (
    select s.product_id, p.kind
    from subscriptions s
    join products p on p.product_id = s.product_id
    where s.user_id = u.user_id
      and s.status = 'ACTIVE'
      and s.start_utc <= now()
      and s.expires_utc > now()
    order by s.expires_utc desc
    limit 1
  ) l on true
  where p_user_id is null or u.user_id = p_user_id
$$;
revoke execute on function notice_people(text) from public, anon, authenticated;

-- ── 2. the rule ─────────────────────────────────────────────────────────
create or replace function notice_scope_ok(
  p_audience  text,
  p_programs  text[],
  p_levels    text[],
  p_cohort    text,
  p_kind      text,
  p_products  text[],
  p_users     text[],
  p_courses   text[],
  u_user_id   text,
  u_role      text,
  u_program   text,
  u_level     text,
  u_cohort    text,
  u_sub_kind  text,
  u_product   text,
  u_held      text[]
)
returns boolean
language sql
immutable
set search_path = licensure_gh
as $$
  select (p_audience is distinct from 'STUDENTS' or u_role = 'STUDENT')
    and (coalesce(cardinality(array_remove(p_programs, '')), 0) = 0
         or coalesce(u_program, '') = any (array_remove(p_programs, '')))
    and (coalesce(cardinality(array_remove(p_levels, '')), 0) = 0
         or coalesce(u_level, '') = any (array_remove(p_levels, '')))
    and (nullif(btrim(p_cohort), '') is null or coalesce(u_cohort, '') = btrim(p_cohort))
    and (nullif(btrim(p_kind), '') is null or btrim(p_kind) = coalesce(u_sub_kind, 'FREE'))
    and (coalesce(cardinality(array_remove(p_products, '')), 0) = 0
         or coalesce(u_product, '') = any (array_remove(p_products, '')))
    and (coalesce(cardinality(array_remove(p_users, '')), 0) = 0
         or u_user_id = any (array_remove(p_users, '')))
    and (coalesce(cardinality(array_remove(p_courses, '')), 0) = 0
         or coalesce(u_held, '{}') && p_courses)
$$;
revoke execute on function notice_scope_ok(text, text[], text[], text, text, text[], text[], text[], text, text, text, text, text, text, text, text[]) from public, anon, authenticated;

-- ── 3. the student's reader, on the shared rule ─────────────────────────
create or replace function announcements_for_user(p_user_id text, p_course_id text default null)
returns table (
  announcement_id text,
  title           text,
  body_html       text,
  body_text       text,
  kind            text,
  kind_icon       text,
  picture_path    text,
  pinned          boolean,
  priority        integer,
  dismissible     boolean,
  must_see        boolean,
  created_at      timestamptz,
  start_at        timestamptz,
  end_at          timestamptz,
  seen_at         timestamptz,
  tapped_at       timestamptz,
  dismissed_at    timestamptz
)
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select a.announcement_id, a.title, a.body_html, a.body_text,
         a.kind, k.icon, a.picture_path,
         a.pinned, a.priority, a.dismissible, a.must_see,
         a.created_at, a.start_at, a.end_at,
         n.seen_at, n.tapped_at, n.dismissed_at
  from announcements a
  cross join notice_people(p_user_id) me
  left join announcement_kinds k on k.name = a.kind
  left join user_notice_state n
    on n.user_id = me.user_id and n.item_type = 'ANNOUNCEMENT' and n.item_id = a.announcement_id
  where a.status = 'active'
    and (a.start_at is null or a.start_at <= now())
    and (a.end_at is null or a.end_at >= now())
    and notice_scope_ok(a.scope_audience, a.scope_programs, a.scope_level, a.scope_cohort,
                        a.scope_subscription_kind, a.scope_product_ids, a.scope_user_ids, a.scope_courses,
                        me.user_id, me.role, me.program_id, me.level, me.cohort,
                        me.sub_kind, me.sub_product, me.held)
    and (p_course_id is null or p_course_id = any (a.scope_courses))
  order by a.pinned desc, a.priority desc, a.created_at desc, a.announcement_id
$$;
revoke execute on function announcements_for_user(text, text) from public, anon, authenticated;

-- ── 4. each notice's reach today ────────────────────────────────────────
create or replace function announcement_reach_counts()
returns table (announcement_id text, reaches bigint)
language sql
stable
security definer
set search_path = licensure_gh
as $$
  with people as (
    select * from notice_people() p where p.role = 'STUDENT' and p.active
  )
  select a.announcement_id,
         count(p.user_id) filter (
           where notice_scope_ok(a.scope_audience, a.scope_programs, a.scope_level, a.scope_cohort,
                                 a.scope_subscription_kind, a.scope_product_ids, a.scope_user_ids, a.scope_courses,
                                 p.user_id, p.role, p.program_id, p.level, p.cohort,
                                 p.sub_kind, p.sub_product, p.held))
  from announcements a
  cross join people p
  group by a.announcement_id
  order by a.announcement_id
$$;
revoke execute on function announcement_reach_counts() from public, anon, authenticated;

-- ── 5. the reach of scopes not yet saved (the editor, 08.12) ────────────
create or replace function announcement_reach_preview(
  p_audience text,
  p_programs text[],
  p_levels   text[],
  p_cohort   text,
  p_kind     text,
  p_products text[],
  p_users    text[],
  p_courses  text[]
)
returns bigint
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select count(*)
  from notice_people() p
  where p.role = 'STUDENT'
    and p.active
    and notice_scope_ok(p_audience, p_programs, p_levels, p_cohort, p_kind, p_products, p_users, p_courses,
                        p.user_id, p.role, p.program_id, p.level, p.cohort, p.sub_kind, p.sub_product, p.held)
$$;
revoke execute on function announcement_reach_preview(text, text[], text[], text, text, text[], text[], text[]) from public, anon, authenticated;

-- ── 6. the follow-up's people (08.11) ───────────────────────────────────
create or replace function announcement_followup(p_announcement_id text)
returns table (
  user_id      text,
  name         text,
  program_id   text,
  sub_kind     text,
  last_sitting timestamptz,
  reached      boolean,
  seen_at      timestamptz,
  tapped_at    timestamptz,
  dismissed_at timestamptz
)
language sql
stable
security definer
set search_path = licensure_gh
as $$
  with a as (
    select * from announcements where announcement_id = p_announcement_id
  ),
  people as (
    select * from notice_people() p where p.role = 'STUDENT'
  ),
  reached as (
    select p.user_id
    from a cross join people p
    where p.active
      and notice_scope_ok(a.scope_audience, a.scope_programs, a.scope_level, a.scope_cohort,
                          a.scope_subscription_kind, a.scope_product_ids, a.scope_user_ids, a.scope_courses,
                          p.user_id, p.role, p.program_id, p.level, p.cohort,
                          p.sub_kind, p.sub_product, p.held)
  ),
  marked as (
    select n.user_id, n.seen_at, n.tapped_at, n.dismissed_at
    from user_notice_state n
    where n.item_type = 'ANNOUNCEMENT' and n.item_id = p_announcement_id
  ),
  everyone as (
    select r.user_id from reached r
    union
    select m.user_id from marked m
  )
  select e.user_id,
         coalesce(nullif(btrim(concat_ws(' ', u.forename, u.surname)), ''), nullif(btrim(u.name), ''), u.email),
         u.program_id,
         coalesce(p.sub_kind, 'FREE'),
         (select max(t.started_utc) from attempts t where t.user_id = e.user_id),
         exists (select 1 from reached r where r.user_id = e.user_id),
         m.seen_at, m.tapped_at, m.dismissed_at
  from everyone e
  join users u on u.user_id = e.user_id
  left join people p on p.user_id = e.user_id
  left join marked m on m.user_id = e.user_id
  order by 2, e.user_id
$$;
revoke execute on function announcement_followup(text) from public, anon, authenticated;
