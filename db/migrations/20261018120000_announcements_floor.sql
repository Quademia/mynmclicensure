-- 20261018120000_announcements_floor.sql — 08-help-and-news.md: A1, A2 and
-- 08.1, with the redesign's storage (08.8, 08.10, 08.13, 08.15); ticked by
-- Sam on 2026-09-18 (A1, A2) and 2026-10-18 (the rest) — 12-tables.md,
-- "announcements", "announcement_kinds", "user_notice_state".
--
-- WHY. Every signed-in account could read every notice — drafts, archived
-- ones, other programmes' and the list of named students — and the page
-- hid what was not the student's after it had arrived. Each student's mark
-- on a notice was one word, overwritten: read then dismissed lost the
-- read, so the admin's figures were wrong.
--
-- WHAT.
--   1. Tidy what the new rules rest on (prod cannot be read from here):
--      the status, audience and subscription-kind words trimmed and cased;
--      an unknown status becomes draft; an unknown audience ALL; a notice
--      aimed at an unknown subscription kind (it reached nobody) becomes
--      draft with no kind; the level scope ('L100,L300') becomes a list.
--      Notice marks whose notice is gone, or of another type, are deleted.
--   2. announcement_kinds — the admin's own list (Sam: "the examples given
--      may not be enough"): a name, an icon, a place, retired or not;
--      five to start. A notice's kind is keyed on the name, on update
--      cascade: a rename reaches every notice; a kind in use cannot be
--      deleted, only retired. No browser access.
--   3. announcements gains kind (News by default), picture_path (the
--      picture's place in the new bucket), must_see, send_to_devices and
--      sent_at; checks on the status, audience and subscription-kind
--      words. The browser loses every privilege and policy: the admin's
--      page reads and writes through the server, a student only through
--      announcements_for_me().
--   4. user_notice_state: seen_at, tapped_at, dismissed_at — each set
--      once, never cleared — in place of the overwritten word (state) and
--      updated_at. seen_at, the old last touch, is kept as when the notice
--      was seen (every old row came from a notice on screen); a clicked
--      row gains tapped_at, a dismissed one dismissed_at, from it.
--      item_id keyed to the notice. No browser access: the marks come
--      with the notices, and notice_mark() writes them.
--   5. announcements_for_user(person, course): the notices this person
--      should see now, with their own marks and the kind's icon, every
--      scope checked here — audience, programme, level, cohort,
--      subscription kind and package (the latest live subscription's,
--      FREE when none), named students, and courses: anyone who has held
--      one of them, live or ended, revoked grants apart (08.1). With a
--      course, only that course's news. Server only.
--      announcements_for_me(course): the same for the signed-in caller —
--      the one way a student's browser session reads notices.
--   6. notice_mark(person, ids, mark): seen, tapped (which marks seen
--      too) or dismissed (only where dismissing is allowed), each date set
--      once; only notices the person can see. Returns how many rows it
--      wrote. Server only.
--   7. announcement_marks_counts(): seen, tapped and dismissed counted per
--      notice in the database, for the admin's page. Server only.
--   8. The bucket licensure-gh-announcement-images: public to read, 1 MB
--      a file (the two sizes are made small before the upload), images
--      only; the server writes.
--
-- REACH. Dev now; prod at the next release Sam approves. The dev site
-- runs main's code until the merge: its announcements read nothing for a
-- student (the table is closed to the browser) and the admin's Save
-- fails there. It reaches only Sam, on dev.

set search_path = licensure_gh;

-- ── 1. tidy ─────────────────────────────────────────────────────────────
update announcements set status = lower(btrim(status))
where status is distinct from lower(btrim(status));
update announcements set status = 'draft'
where status not in ('draft', 'active', 'archived');

update announcements set scope_audience = upper(btrim(coalesce(scope_audience, 'ALL')))
where scope_audience is distinct from upper(btrim(coalesce(scope_audience, 'ALL')));
update announcements set scope_audience = 'ALL'
where scope_audience not in ('ALL', 'STUDENTS');

update announcements set scope_subscription_kind = nullif(upper(btrim(scope_subscription_kind)), '')
where scope_subscription_kind is distinct from nullif(upper(btrim(scope_subscription_kind)), '');
update announcements set status = 'draft', scope_subscription_kind = null
where scope_subscription_kind is not null and scope_subscription_kind not in ('PAID', 'TRIAL', 'FREE');

alter table announcements add column if not exists scope_level_list text[];
update announcements set scope_level_list = (
  select nullif(array_agg(btrim(x)) filter (where btrim(x) <> ''), '{}')
  from unnest(string_to_array(scope_level, ',')) as x
)
where nullif(btrim(scope_level), '') is not null;
alter table announcements drop column scope_level;
alter table announcements rename column scope_level_list to scope_level;

delete from user_notice_state s
where s.item_type is distinct from 'ANNOUNCEMENT'
   or not exists (select 1 from announcements a where a.announcement_id = s.item_id);

-- ── 2. announcement_kinds ───────────────────────────────────────────────
create table if not exists announcement_kinds (
  name       text primary key check (name = btrim(name) and name <> '' and char_length(name) <= 40),
  icon       text not null check (icon ~ '^[a-z0-9-]+$'),
  position   integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists announcement_kinds_name_ci on announcement_kinds (lower(name));

insert into announcement_kinds (name, icon, position) values
  ('Exam date', 'calendar', 1),
  ('New questions', 'book', 2),
  ('Offer', 'tag', 3),
  ('Alert', 'alert', 4),
  ('News', 'megaphone', 5)
on conflict (name) do nothing;

alter table announcement_kinds enable row level security;
revoke all on announcement_kinds from anon, authenticated;

-- ── 3. announcements ────────────────────────────────────────────────────
alter table announcements add column if not exists kind text not null default 'News';
alter table announcements add column if not exists picture_path text;
alter table announcements add column if not exists must_see boolean not null default false;
alter table announcements add column if not exists send_to_devices boolean not null default false;
alter table announcements add column if not exists sent_at timestamptz;

alter table announcements drop constraint if exists announcements_kind_fkey;
alter table announcements add constraint announcements_kind_fkey
  foreign key (kind) references announcement_kinds (name) on update cascade;

alter table announcements alter column scope_audience set not null;
alter table announcements drop constraint if exists announcements_status_check;
alter table announcements add constraint announcements_status_check
  check (status in ('draft', 'active', 'archived'));
alter table announcements drop constraint if exists announcements_audience_check;
alter table announcements add constraint announcements_audience_check
  check (scope_audience in ('ALL', 'STUDENTS'));
alter table announcements drop constraint if exists announcements_subscription_kind_check;
alter table announcements add constraint announcements_subscription_kind_check
  check (scope_subscription_kind is null or scope_subscription_kind in ('PAID', 'TRIAL', 'FREE'));

drop index if exists announcements_status_idx;
create index if not exists announcements_live_idx on announcements (status, start_at, end_at);

drop policy if exists announcements_select on announcements;
drop policy if exists announcements_insert on announcements;
drop policy if exists announcements_update on announcements;
drop policy if exists announcements_delete on announcements;
revoke all on announcements from anon, authenticated;

-- ── 4. user_notice_state ────────────────────────────────────────────────
alter table user_notice_state add column if not exists tapped_at timestamptz;
alter table user_notice_state add column if not exists dismissed_at timestamptz;
update user_notice_state set tapped_at = seen_at where state = 'clicked' and tapped_at is null;
update user_notice_state set dismissed_at = seen_at where state = 'dismissed' and dismissed_at is null;
alter table user_notice_state alter column seen_at drop default;
alter table user_notice_state drop column if exists state;
alter table user_notice_state drop column if exists updated_at;

alter table user_notice_state drop constraint if exists user_notice_state_item_type_check;
alter table user_notice_state add constraint user_notice_state_item_type_check
  check (item_type = 'ANNOUNCEMENT');
alter table user_notice_state drop constraint if exists user_notice_state_item_fkey;
alter table user_notice_state add constraint user_notice_state_item_fkey
  foreign key (item_id) references announcements (announcement_id) on update cascade on delete cascade;

drop policy if exists user_notice_state_select on user_notice_state;
drop policy if exists user_notice_state_insert on user_notice_state;
drop policy if exists user_notice_state_update on user_notice_state;
revoke all on user_notice_state from anon, authenticated;
revoke all on sequence user_notice_state_id_seq from anon, authenticated;

-- ── 5. the readers ──────────────────────────────────────────────────────
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
  with me as (
    select u.user_id, u.role, coalesce(u.program_id, '') as program_id,
           coalesce(u.level, '') as level, coalesce(u.cohort, '') as cohort
    from users u
    where u.user_id = p_user_id
  ),
  sub as (
    select s.product_id, p.kind
    from subscriptions s
    join products p on p.product_id = s.product_id
    where s.user_id = p_user_id
      and s.status = 'ACTIVE'
      and s.start_utc <= now()
      and s.expires_utc > now()
    order by s.expires_utc desc
    limit 1
  ),
  held as (
    select distinct ca.course_id
    from course_access ca
    where ca.user_id = p_user_id
      and ca.revoked_utc is null
      and ca.start_utc <= now()
  )
  select a.announcement_id, a.title, a.body_html, a.body_text,
         a.kind, k.icon, a.picture_path,
         a.pinned, a.priority, a.dismissible, a.must_see,
         a.created_at, a.start_at, a.end_at,
         n.seen_at, n.tapped_at, n.dismissed_at
  from announcements a
  cross join me
  left join announcement_kinds k on k.name = a.kind
  left join user_notice_state n
    on n.user_id = me.user_id and n.item_type = 'ANNOUNCEMENT' and n.item_id = a.announcement_id
  where a.status = 'active'
    and (a.start_at is null or a.start_at <= now())
    and (a.end_at is null or a.end_at >= now())
    and (a.scope_audience <> 'STUDENTS' or me.role = 'STUDENT')
    and (coalesce(cardinality(array_remove(a.scope_programs, '')), 0) = 0
         or me.program_id = any (array_remove(a.scope_programs, '')))
    and (coalesce(cardinality(array_remove(a.scope_level, '')), 0) = 0
         or me.level = any (array_remove(a.scope_level, '')))
    and (nullif(btrim(a.scope_cohort), '') is null or me.cohort = btrim(a.scope_cohort))
    and (a.scope_subscription_kind is null
         or a.scope_subscription_kind = coalesce((select sub.kind from sub), 'FREE'))
    and (coalesce(cardinality(array_remove(a.scope_product_ids, '')), 0) = 0
         or coalesce((select sub.product_id from sub), '') = any (array_remove(a.scope_product_ids, '')))
    and (coalesce(cardinality(array_remove(a.scope_user_ids, '')), 0) = 0
         or me.user_id = any (array_remove(a.scope_user_ids, '')))
    and (coalesce(cardinality(array_remove(a.scope_courses, '')), 0) = 0
         or exists (select 1 from held where held.course_id = any (a.scope_courses)))
    and (p_course_id is null or p_course_id = any (a.scope_courses))
  order by a.pinned desc, a.priority desc, a.created_at desc, a.announcement_id
$$;
revoke execute on function announcements_for_user(text, text) from public, anon, authenticated;

create or replace function announcements_for_me(p_course_id text default null)
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
  select * from announcements_for_user(auth_user_id(), p_course_id)
$$;
revoke execute on function announcements_for_me(text) from public, anon;
grant execute on function announcements_for_me(text) to authenticated;

-- ── 6. the marks ────────────────────────────────────────────────────────
create or replace function notice_mark(p_user_id text, p_ids text[], p_mark text)
returns integer
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_count integer;
begin
  if p_mark not in ('seen', 'tapped', 'dismissed') then
    raise exception 'notice_mark: unknown mark %', p_mark;
  end if;

  insert into user_notice_state (user_id, item_type, item_id, seen_at, tapped_at, dismissed_at)
  select p_user_id, 'ANNOUNCEMENT', f.announcement_id,
         case when p_mark in ('seen', 'tapped') then now() end,
         case when p_mark = 'tapped' then now() end,
         case when p_mark = 'dismissed' then now() end
  from announcements_for_user(p_user_id) f
  where f.announcement_id = any (p_ids)
    and (p_mark <> 'dismissed' or f.dismissible)
  on conflict (user_id, item_type, item_id) do update set
    seen_at      = coalesce(user_notice_state.seen_at, excluded.seen_at),
    tapped_at    = coalesce(user_notice_state.tapped_at, excluded.tapped_at),
    dismissed_at = coalesce(user_notice_state.dismissed_at, excluded.dismissed_at);

  get diagnostics v_count = row_count;
  return v_count;
end
$$;
revoke execute on function notice_mark(text, text[], text) from public, anon, authenticated;

-- ── 7. the admin's counts ───────────────────────────────────────────────
create or replace function announcement_marks_counts()
returns table (announcement_id text, seen bigint, tapped bigint, dismissed bigint)
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select n.item_id, count(n.seen_at), count(n.tapped_at), count(n.dismissed_at)
  from user_notice_state n
  where n.item_type = 'ANNOUNCEMENT'
  group by n.item_id
  order by n.item_id
$$;
revoke execute on function announcement_marks_counts() from public, anon, authenticated;

-- ── 8. the pictures' bucket ─────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('licensure-gh-announcement-images', 'licensure-gh-announcement-images', true, 1048576,
        array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
