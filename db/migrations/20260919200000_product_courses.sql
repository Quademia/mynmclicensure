-- 20260919200000_product_courses.sql — 02-subscriptions.md C1 (rebuild.md
-- §8 S8, the definition side; D16; Sam, 2026-09-18 the ruling, 2026-09-19
-- the go)
--
-- What a product unlocks becomes a relationship. Until now
-- products.courses_included was a text[] of course-id words with no key:
-- a product could name a course that does not exist, the database could
-- not join on it, and five readers unpacked the list by hand
-- (getStudentCourseAccess, user_has_course, the offline-pack allowance,
-- the messaging admin's two). The catalogue migration's own header said
-- why: "the two TEXT[] columns cannot carry a foreign key".
--
-- Four moves, in this order (the gate must stop reading the column
-- before the column goes — a SQL-language function body is not a
-- tracked dependency, so the drop would succeed and the gate would
-- break on its next call):
--   1. product_courses (product_id → products, course_id → courses),
--      primary key on both: no duplicates, no unknown course. Policies
--      mirror products': anyone reads (the sales doors will list what a
--      product unlocks — D23 item 5), an ADMIN inserts or deletes; a
--      link row is a pair, never updated.
--   2. Filled from every product's list. A word with no courses row
--      fails this file (the runner rolls it back whole). Dev checked
--      2026-09-19: 73 words across 32 products, every one a course.
--      Prod's 31 products name the same eleven ids; Sam runs the
--      one-line check there before the release.
--   3. user_has_course() joins the table. Same name, same signature,
--      same callers (eleven bank policies, the two quiz policies, the
--      attempt spawn and the bank reads).
--   4. courses_included dropped.
-- Nothing a student sees changes; the days-sum (D14) waits for C2.

set search_path = licensure_gh;

-- ── 1. the link table ─────────────────────────────────────────────────
create table if not exists product_courses (
  product_id text not null references products (product_id),
  course_id  text not null references courses (course_id),
  primary key (product_id, course_id)
);
create index if not exists product_courses_course_id_idx on product_courses (course_id);

alter table product_courses enable row level security;
drop policy if exists product_courses_select on product_courses;
create policy product_courses_select on product_courses for select
using (true);
drop policy if exists product_courses_insert on product_courses;
create policy product_courses_insert on product_courses for insert
with check (auth_user_role() = 'ADMIN');
drop policy if exists product_courses_delete on product_courses;
create policy product_courses_delete on product_courses for delete
using (auth_user_role() = 'ADMIN');

-- ── 2. filled from the lists ──────────────────────────────────────────
insert into product_courses (product_id, course_id)
select p.product_id, c
from products p, unnest(p.courses_included) as c
on conflict do nothing;

-- ── 3. the gate joins the table ───────────────────────────────────────
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
      join product_courses pc on pc.product_id = s.product_id
      where s.user_id = auth_user_id()
        and s.status = 'ACTIVE'
        and s.expires_utc > now()
        and pc.course_id = p_course_id
    )
  )
$$;

-- ── 4. the list column goes ───────────────────────────────────────────
alter table products drop column if exists courses_included;

-- PostgREST learns the new table and its keys (the embedded select).
notify pgrst, 'reload schema';
