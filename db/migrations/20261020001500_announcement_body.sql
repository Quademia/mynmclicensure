-- 20261020001500_announcement_body.sql — 08-help-and-news.md 08.14 (the
-- editor without codes) and 08.18 (the editor page); ticked by Sam
-- 2026-10-19 (12-tables.md, "announcements": `body`, every notice deleted;
-- `scope_audience` dropped).
--
-- WHY. The editor is Tiptap (the shared rich-text editor, 09.13): what is
-- typed is what students see. A notice's words are stored once, as the
-- editor's own document, and drawn by the server — not as HTML beside a
-- plain-text copy, which put an extra line break in at every save (A3).
-- The Audience setting goes: notices are for signed-in students only since
-- 2026-10-18, so "Students only" no longer changed anything.
--
-- WHAT.
--   1. Every notice is deleted, and with it every student's marks on it
--      (user_notice_state, on delete cascade). Sam: "we will assume there
--      is none as it reaches no one"; going live starts announcements empty
--      anyway (10). On prod this runs at the next release Sam approves.
--   2. `body_html` and `body_text` dropped; `body` added: the editor's
--      document (jsonb), checked to be one and under 64 KB. Which pieces it
--      may hold is the server's check at save (lib/editor/doc.ts).
--   3. `scope_audience` dropped (its check goes with it). Every notice
--      behaves as Everyone did: whoever its other scopes match.
--   4. The rule, notice_scope_ok(), loses its first argument; the readers
--      and counts that call it are made again: announcements_for_user()
--      and announcements_for_me() hand back `body` in place of the two;
--      announcement_reach_counts(), announcement_reach_preview() (one
--      argument fewer) and announcement_followup() otherwise as they were.
--   5. The table's grants restated: the browser holds nothing (A1).
--
-- REACH. Dev now; prod at the next release Sam approves. The dev site runs
-- main's code until the merge: its notices show no words and its admin
-- form cannot save, for the length of the session (Sam told, 2026-10-19).

set search_path = licensure_gh;

-- ── 1. every notice goes ────────────────────────────────────────────────
delete from announcements;

-- ── 2, 3. the columns ───────────────────────────────────────────────────
alter table announcements drop column if exists body_html;
alter table announcements drop column if exists body_text;
alter table announcements drop column if exists scope_audience;
alter table announcements add column if not exists body jsonb not null;
alter table announcements drop constraint if exists announcements_body_doc_check;
alter table announcements add constraint announcements_body_doc_check
  -- a missing key reads as null, and a check passes on null: hence coalesce
  check (jsonb_typeof(body) = 'object'
         and coalesce(body ->> 'type', '') = 'doc'
         and coalesce(jsonb_typeof(body -> 'content'), '') = 'array'
         and octet_length(body::text) <= 65536);

-- ── 4. the rule and its callers ─────────────────────────────────────────
drop function if exists announcements_for_me(text);
drop function if exists announcements_for_user(text, text);
drop function if exists announcement_reach_preview(text, text[], text[], text, text, text[], text[], text[]);
drop function if exists notice_scope_ok(text, text[], text[], text, text, text[], text[], text[], text, text, text, text, text, text, text, text[]);

create function notice_scope_ok(
  p_programs  text[],
  p_levels    text[],
  p_cohort    text,
  p_kind      text,
  p_products  text[],
  p_users     text[],
  p_courses   text[],
  u_user_id   text,
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
  select (coalesce(cardinality(array_remove(p_programs, '')), 0) = 0
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
revoke execute on function notice_scope_ok(text[], text[], text, text, text[], text[], text[], text, text, text, text, text, text, text[]) from public, anon, authenticated;

create function announcements_for_user(p_user_id text, p_course_id text default null)
returns table (
  announcement_id text,
  title           text,
  body            jsonb,
  kind            text,
  kind_icon       text,
  picture_path    text,
  pinned          boolean,
  priority        integer,
  dismissible     boolean,
  must_see        boolean,
  ask_confirm     boolean,
  created_at      timestamptz,
  start_at        timestamptz,
  end_at          timestamptz,
  seen_at         timestamptz,
  tapped_at       timestamptz,
  dismissed_at    timestamptz,
  confirmed_at    timestamptz
)
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select a.announcement_id, a.title, a.body,
         a.kind, k.icon, a.picture_path,
         a.pinned, a.priority, a.dismissible, a.must_see, a.ask_confirm,
         a.created_at, a.start_at, a.end_at,
         n.seen_at, n.tapped_at, n.dismissed_at, n.confirmed_at
  from announcements a
  cross join notice_people(p_user_id) me
  left join announcement_kinds k on k.name = a.kind
  left join user_notice_state n
    on n.user_id = me.user_id and n.item_type = 'ANNOUNCEMENT' and n.item_id = a.announcement_id
  where a.status = 'active'
    and (a.start_at is null or a.start_at <= now())
    and (a.end_at is null or a.end_at >= now())
    and notice_scope_ok(a.scope_programs, a.scope_level, a.scope_cohort,
                        a.scope_subscription_kind, a.scope_product_ids, a.scope_user_ids, a.scope_courses,
                        me.user_id, me.program_id, me.level, me.cohort,
                        me.sub_kind, me.sub_product, me.held)
    and (p_course_id is null or p_course_id = any (a.scope_courses))
  order by a.pinned desc, a.priority desc, a.created_at desc, a.announcement_id
$$;
revoke execute on function announcements_for_user(text, text) from public, anon, authenticated;

create function announcements_for_me(p_course_id text default null)
returns table (
  announcement_id text,
  title           text,
  body            jsonb,
  kind            text,
  kind_icon       text,
  picture_path    text,
  pinned          boolean,
  priority        integer,
  dismissible     boolean,
  must_see        boolean,
  ask_confirm     boolean,
  created_at      timestamptz,
  start_at        timestamptz,
  end_at          timestamptz,
  seen_at         timestamptz,
  tapped_at       timestamptz,
  dismissed_at    timestamptz,
  confirmed_at    timestamptz
)
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select * from announcements_for_user(auth_user_id(), p_course_id)
$$;
revoke execute on function announcements_for_me(text) from public, anon;
grant execute on function announcements_for_me(text) to authenticated;

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
           where notice_scope_ok(a.scope_programs, a.scope_level, a.scope_cohort,
                                 a.scope_subscription_kind, a.scope_product_ids, a.scope_user_ids, a.scope_courses,
                                 p.user_id, p.program_id, p.level, p.cohort,
                                 p.sub_kind, p.sub_product, p.held))
  from announcements a
  cross join people p
  group by a.announcement_id
  order by a.announcement_id
$$;
revoke execute on function announcement_reach_counts() from public, anon, authenticated;

create function announcement_reach_preview(
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
    and notice_scope_ok(p_programs, p_levels, p_cohort, p_kind, p_products, p_users, p_courses,
                        p.user_id, p.program_id, p.level, p.cohort, p.sub_kind, p.sub_product, p.held)
$$;
revoke execute on function announcement_reach_preview(text[], text[], text, text, text[], text[], text[]) from public, anon, authenticated;

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
  dismissed_at timestamptz,
  confirmed_at timestamptz
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
      and notice_scope_ok(a.scope_programs, a.scope_level, a.scope_cohort,
                          a.scope_subscription_kind, a.scope_product_ids, a.scope_user_ids, a.scope_courses,
                          p.user_id, p.program_id, p.level, p.cohort,
                          p.sub_kind, p.sub_product, p.held)
  ),
  marked as (
    select n.user_id, n.seen_at, n.tapped_at, n.dismissed_at, n.confirmed_at
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
         m.seen_at, m.tapped_at, m.dismissed_at, m.confirmed_at
  from everyone e
  join users u on u.user_id = e.user_id
  left join people p on p.user_id = e.user_id
  left join marked m on m.user_id = e.user_id
  order by 2, e.user_id
$$;
revoke execute on function announcement_followup(text) from public, anon, authenticated;

-- ── 5. the browser holds nothing on the table (A1) ──────────────────────
revoke all on announcements from anon, authenticated;
