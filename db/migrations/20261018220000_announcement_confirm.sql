-- 20261018220000_announcement_confirm.sql — 08-help-and-news.md 08.16,
-- confirming a notice was read; ticked by Sam 2026-10-18 (12-tables.md,
-- "announcements" ask_confirm, "user_notice_state" confirmed_at).
--
-- WHY. Seen means "it was on their screen"; people close a pop-up at once.
-- A notice that matters needs the student to say they read it: "I've read
-- this", counted as Read (confirmed). Must-see is the delivery and always
-- asks: it pops up until confirmed.
--
-- WHAT.
--   1. announcements.ask_confirm — the opened notice shows "I've read
--      this"; Must-see implies it (existing Must-see notices set; a check).
--   2. user_notice_state.confirmed_at — when the student pressed it, set
--      once, never cleared.
--   3. announcements_for_user() and announcements_for_me() hand back both
--      (dropped and made again: their columns change; the same answers
--      otherwise — proved).
--   4. notice_mark() takes a fourth mark, `confirmed` — it sets
--      confirmed_at and seen_at, only on a notice that asks to confirm.
--   5. announcement_marks_counts() and announcement_followup() count and
--      list it.
--
-- REACH. Dev now; prod at the next release Sam approves. The dev site runs
-- main's code until the merge: its reader calls keep working (the new
-- columns are only more columns).

set search_path = licensure_gh;

-- ── 1, 2. the columns ───────────────────────────────────────────────────
alter table announcements add column if not exists ask_confirm boolean not null default false;
update announcements set ask_confirm = true where must_see and not ask_confirm;
alter table announcements drop constraint if exists announcements_must_see_confirm_check;
alter table announcements add constraint announcements_must_see_confirm_check
  check (not must_see or ask_confirm);

alter table user_notice_state add column if not exists confirmed_at timestamptz;

-- ── 3. the readers ──────────────────────────────────────────────────────
drop function if exists announcements_for_me(text);
drop function if exists announcements_for_user(text, text);

create function announcements_for_user(p_user_id text, p_course_id text default null)
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
  select a.announcement_id, a.title, a.body_html, a.body_text,
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
    and notice_scope_ok(a.scope_audience, a.scope_programs, a.scope_level, a.scope_cohort,
                        a.scope_subscription_kind, a.scope_product_ids, a.scope_user_ids, a.scope_courses,
                        me.user_id, me.role, me.program_id, me.level, me.cohort,
                        me.sub_kind, me.sub_product, me.held)
    and (p_course_id is null or p_course_id = any (a.scope_courses))
  order by a.pinned desc, a.priority desc, a.created_at desc, a.announcement_id
$$;
revoke execute on function announcements_for_user(text, text) from public, anon, authenticated;

create function announcements_for_me(p_course_id text default null)
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

-- ── 4. the marks ────────────────────────────────────────────────────────
create or replace function notice_mark(p_user_id text, p_ids text[], p_mark text)
returns integer
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_count integer;
begin
  if p_mark not in ('seen', 'tapped', 'dismissed', 'confirmed') then
    raise exception 'notice_mark: unknown mark %', p_mark;
  end if;

  insert into user_notice_state (user_id, item_type, item_id, seen_at, tapped_at, dismissed_at, confirmed_at)
  select p_user_id, 'ANNOUNCEMENT', f.announcement_id,
         case when p_mark in ('seen', 'tapped', 'confirmed') then now() end,
         case when p_mark = 'tapped' then now() end,
         case when p_mark = 'dismissed' then now() end,
         case when p_mark = 'confirmed' then now() end
  from announcements_for_user(p_user_id) f
  where f.announcement_id = any (p_ids)
    and (p_mark <> 'dismissed' or f.dismissible)
    and (p_mark <> 'confirmed' or f.ask_confirm)
  on conflict (user_id, item_type, item_id) do update set
    seen_at      = coalesce(user_notice_state.seen_at, excluded.seen_at),
    tapped_at    = coalesce(user_notice_state.tapped_at, excluded.tapped_at),
    dismissed_at = coalesce(user_notice_state.dismissed_at, excluded.dismissed_at),
    confirmed_at = coalesce(user_notice_state.confirmed_at, excluded.confirmed_at);

  get diagnostics v_count = row_count;
  return v_count;
end
$$;
revoke execute on function notice_mark(text, text[], text) from public, anon, authenticated;

-- ── 5. the admin's counts and the follow-up ─────────────────────────────
drop function if exists announcement_marks_counts();
create function announcement_marks_counts()
returns table (announcement_id text, seen bigint, tapped bigint, dismissed bigint, confirmed bigint)
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select n.item_id, count(n.seen_at), count(n.tapped_at), count(n.dismissed_at), count(n.confirmed_at)
  from user_notice_state n
  where n.item_type = 'ANNOUNCEMENT'
  group by n.item_id
  order by n.item_id
$$;
revoke execute on function announcement_marks_counts() from public, anon, authenticated;

drop function if exists announcement_followup(text);
create function announcement_followup(p_announcement_id text)
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
      and notice_scope_ok(a.scope_audience, a.scope_programs, a.scope_level, a.scope_cohort,
                          a.scope_subscription_kind, a.scope_product_ids, a.scope_user_ids, a.scope_courses,
                          p.user_id, p.role, p.program_id, p.level, p.cohort,
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
