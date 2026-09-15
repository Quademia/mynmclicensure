-- 20260911150000_catalogue_tables.sql — slice 3
--
-- The catalogue and config tables, transcribed from legacy/db/schema.sql
-- and rls.sql into the `licensure_gh` schema: courses, levels, products,
-- config. Plus the read-only content copy of all four from the legacy
-- tables (rebuild.md §6.6 — the one sanctioned read of `public.*`,
-- AGENTS.md rule #7), and the admin write policies on programs that the
-- Courses & Programmes page needs (2a gave programs SELECT only).
--
-- Shape change, ticked by Sam on 2026-09-11 (rebuild.md §8 S4, "as each
-- table lands"): programs.trial_product_id references products. Both
-- projects were checked read-only before this was written: no programme
-- points at a missing product. The two TEXT[] columns (courses.program_scope,
-- products.courses_included) cannot carry a foreign key and stay as legacy.
--
-- Policies are the legacy ones: anyone signed in reads courses, levels and
-- config; anyone reads products (the public Premium Prep page); ADMIN
-- writes; config is the one table with a DELETE policy (the Config page's
-- Delete button).

set search_path = licensure_gh;

-- ── courses ────────────────────────────────────────────────────────────
create table if not exists courses (
  course_id     text primary key,
  title         text not null,
  program_scope text[] not null,
  status        text not null default 'active',   -- active | draft | archived
  page_slug     text
);

-- ── levels ─────────────────────────────────────────────────────────────
create table if not exists levels (
  level_id   text primary key,
  label      text not null,
  created_at timestamptz default now()
);

-- ── products ───────────────────────────────────────────────────────────
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

-- ── config ─────────────────────────────────────────────────────────────
create table if not exists config (
  key         text primary key,
  value       text not null,
  description text,
  updated_at  timestamptz default now()
);

-- ── row-level security ─────────────────────────────────────────────────
alter table courses  enable row level security;
alter table levels   enable row level security;
alter table products enable row level security;
alter table config   enable row level security;

-- programs: admin writes (the Courses & Programmes page). SELECT is from 2a.
drop policy if exists programs_insert on programs;
create policy programs_insert on programs for insert
with check (auth_user_role() = 'ADMIN');

drop policy if exists programs_update on programs;
create policy programs_update on programs for update
using (auth_user_role() = 'ADMIN');

-- courses: any signed-in user reads; admin writes.
drop policy if exists courses_select on courses;
create policy courses_select on courses for select
using (auth.uid() is not null);

drop policy if exists courses_insert on courses;
create policy courses_insert on courses for insert
with check (auth_user_role() = 'ADMIN');

drop policy if exists courses_update on courses;
create policy courses_update on courses for update
using (auth_user_role() = 'ADMIN');

-- levels: any signed-in user reads; admin writes. Unused, kept as legacy.
drop policy if exists levels_select on levels;
create policy levels_select on levels for select
using (auth.uid() is not null);

drop policy if exists levels_insert on levels;
create policy levels_insert on levels for insert
with check (auth_user_role() = 'ADMIN');

drop policy if exists levels_update on levels;
create policy levels_update on levels for update
using (auth_user_role() = 'ADMIN');

-- products: readable before login (the public Premium Prep page); admin writes.
drop policy if exists products_select on products;
create policy products_select on products for select
using (true);

drop policy if exists products_insert on products;
create policy products_insert on products for insert
with check (auth_user_role() = 'ADMIN');

drop policy if exists products_update on products;
create policy products_update on products for update
using (auth_user_role() = 'ADMIN');

-- config: any signed-in user reads; admin insert, update AND delete.
drop policy if exists config_select on config;
create policy config_select on config for select
using (auth.uid() is not null);

drop policy if exists config_insert on config;
create policy config_insert on config for insert
with check (auth_user_role() = 'ADMIN');

drop policy if exists config_update on config;
create policy config_update on config for update
using (auth_user_role() = 'ADMIN');

drop policy if exists config_delete on config;
create policy config_delete on config for delete
using (auth_user_role() = 'ADMIN');

-- ── content copy (rebuild.md §6.6; AGENTS.md rule #7 exception) ────────
-- Read-only read of the legacy tables, once per environment, guarded so a
-- re-run on a populated schema changes nothing. The live rows win over
-- legacy/db/seed_data.sql where they differ (§6.6, config seeds).
insert into courses (course_id, title, program_scope, status, page_slug)
select course_id, title, program_scope, status, page_slug
from public.courses
where not exists (select 1 from courses);

insert into levels (level_id, label, created_at)
select level_id, label, created_at
from public.levels
where not exists (select 1 from levels);

insert into products (product_id, name, kind, status, courses_included,
                      price_minor, currency, duration_days, telegram_group_keys)
select product_id, name, kind, status, courses_included,
       price_minor, currency, duration_days, telegram_group_keys
from public.products
where not exists (select 1 from products);

insert into config (key, value, description, updated_at)
select key, value, description, updated_at
from public.config
where not exists (select 1 from config);

-- ── S4: programs.trial_product_id → products ───────────────────────────
-- After the copy, so the rows already in programs (2a) validate.
alter table programs drop constraint if exists programs_trial_product_id_fkey;
alter table programs
  add constraint programs_trial_product_id_fkey
  foreign key (trial_product_id) references products (product_id);
