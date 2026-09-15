-- 20260913180000_quiz_tables.sql — slice 5a
--
-- Fixed quizzes and mock exams: `quizzes` and `mock_quizzes`, transcribed
-- from legacy/db/schema.sql and rls.sql into the `licensure_gh` schema
-- with the same columns and defaults. Two tables of one shape, kept as
-- two (rebuild.md D4): they differ only by `visibility`, and legacy's
-- pages, reads and attempts (`source = 'mock'`) tell them apart by table.
--
-- Plus the content copy of both from the legacy tables (rebuild.md §6.6,
-- which names them from 2026-09-13 — the live quizzes must reach the new
-- product; the one sanctioned read of `public.*`, AGENTS.md rule #7). As
-- slice 3 did: guarded on conflict, so each environment is filled by its
-- own run and a re-run is a no-op.
--
-- Shape change, under Sam's standing tick (rebuild.md §8 S4, "as each
-- table lands"): `course_id` references `courses`. Dev's rows were
-- checked read-only before this was written: no quiz points at a missing
-- course. `item_ids` is a TEXT[] and cannot carry a foreign key; it stays
-- as legacy.
--
-- Policies are the legacy ones: any signed-in user reads (the student
-- list pages filter published + active themselves — RLS is the floor,
-- not the filter); ADMIN inserts and updates; NO DELETE policy. Archive
-- (status = 'archived') is the way out, as it was.

set search_path = licensure_gh;

-- ── quizzes (fixed quizzes) ────────────────────────────────────────────
create table if not exists quizzes (
  quiz_id        text primary key,
  course_id      text not null references courses (course_id),  -- S4
  title          text not null,
  item_ids       text[] not null default '{}',
  n              integer not null default 0,
  allowed_modes  text not null default 'BOTH',    -- BOTH | INSTANT_ONLY | TIMED_ONLY
  shuffle        boolean not null default false,
  time_limit_sec integer,                         -- null = 1 min per question
  published      boolean not null default false,
  publish_at     timestamptz,
  unpublish_at   timestamptz,
  status         text not null default 'draft',   -- draft | active | archived
  notes          text,                            -- admin only
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ── mock_quizzes ───────────────────────────────────────────────────────
create table if not exists mock_quizzes (
  quiz_id        text primary key,
  course_id      text not null references courses (course_id),  -- S4
  title          text not null,
  n              integer not null,
  item_ids       text[] not null default '{}',
  allowed_modes  text not null default 'BOTH',    -- BOTH | INSTANT_ONLY | TIMED_ONLY
  shuffle        boolean not null default false,
  time_limit_sec integer,
  status         text not null default 'draft',   -- draft | active | archived
  published      boolean not null default false,
  visibility     text not null default 'ALL',     -- ALL | PAID | TRIAL; stored, never set or checked (legacy)
  publish_at     timestamptz,
  unpublish_at   timestamptz,
  notes          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- The reads name the course (student list pages, course page) and the
-- admin list orders by created_at; legacy had no index on either.
create index if not exists quizzes_course_id_idx      on quizzes (course_id);
create index if not exists mock_quizzes_course_id_idx on mock_quizzes (course_id);

-- ── row-level security ─────────────────────────────────────────────────
alter table quizzes      enable row level security;
alter table mock_quizzes enable row level security;

drop policy if exists quizzes_select on quizzes;
create policy quizzes_select on quizzes for select
using (auth.uid() is not null);

drop policy if exists quizzes_insert on quizzes;
create policy quizzes_insert on quizzes for insert
with check (auth_user_role() = 'ADMIN');

drop policy if exists quizzes_update on quizzes;
create policy quizzes_update on quizzes for update
using (auth_user_role() = 'ADMIN');

drop policy if exists mock_quizzes_select on mock_quizzes;
create policy mock_quizzes_select on mock_quizzes for select
using (auth.uid() is not null);

drop policy if exists mock_quizzes_insert on mock_quizzes;
create policy mock_quizzes_insert on mock_quizzes for insert
with check (auth_user_role() = 'ADMIN');

drop policy if exists mock_quizzes_update on mock_quizzes;
create policy mock_quizzes_update on mock_quizzes for update
using (auth_user_role() = 'ADMIN');

-- ── content copy (rebuild.md §6.6; the sanctioned read of public.*) ────
-- Unguarded on the course: a quiz whose course is missing fails the
-- migration loudly rather than being dropped in silence — the count
-- check in §6.6 must be able to match.
insert into quizzes (quiz_id, course_id, title, item_ids, n, allowed_modes, shuffle,
                     time_limit_sec, published, publish_at, unpublish_at, status, notes,
                     created_at, updated_at)
select quiz_id, course_id, title, item_ids, n, allowed_modes, shuffle,
       time_limit_sec, published, publish_at, unpublish_at, status, notes,
       created_at, updated_at
from public.quizzes
on conflict (quiz_id) do nothing;

insert into mock_quizzes (quiz_id, course_id, title, n, item_ids, allowed_modes, shuffle,
                          time_limit_sec, status, published, visibility, publish_at,
                          unpublish_at, notes, created_at, updated_at)
select quiz_id, course_id, title, n, item_ids, allowed_modes, shuffle,
       time_limit_sec, status, published, visibility, publish_at,
       unpublish_at, notes, created_at, updated_at
from public.mock_quizzes
on conflict (quiz_id) do nothing;
