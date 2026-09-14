-- 20260914220000_announcements.sql — slice 11a
--
-- Announcements and the per-student notice state, transcribed from
-- legacy/db/schema.sql (1.8, 1.9) into the `licensure_gh` schema with
-- the same columns and defaults. No content copy: D5 — announcements
-- do not move; dev starts empty and the admin page creates them.
--
-- Shape change, under Sam's standing tick (§8 S4, "as each table
-- lands"): `user_notice_state.user_id` references `users`.
-- `announcements` carries no key: its scope arrays name programmes,
-- courses, products and users loosely, as legacy did.
--
-- Policies are the legacy ones (rls.sql §19, §20): any signed-in user
-- reads announcements, ADMIN inserts, updates and deletes (no page
-- deletes; the policy is carried); a student reads, inserts and
-- updates their own notice rows, ADMIN reads all (the engagement
-- counts), no DELETE. Under the new stack the browser never writes
-- either table — the Server Actions do, as the signed-in user, so the
-- policies are the floor.
--
-- rebuild.md §9 #18: `status` is draft | active | archived. Legacy's
-- form also saved 'scheduled', which no student read ever fetched; the
-- option is gone from the form and the column keeps its TEXT type.

set search_path = licensure_gh;

create table if not exists announcements (
  announcement_id         text primary key,                 -- 'ANN_' + ms
  title                   text not null,
  body_html               text,
  body_text               text,
  status                  text not null default 'draft',    -- draft | active | archived
  created_at              timestamptz default now(),
  start_at                timestamptz,
  end_at                  timestamptz,
  pinned                  boolean not null default false,
  priority                integer not null default 0,
  dismissible             boolean not null default true,
  scope_programs          text[],
  scope_courses           text[],
  scope_level             text,                             -- 'L100,L300' — comma-joined, as legacy
  scope_subscription_kind text,                             -- PAID | TRIAL | FREE
  scope_product_ids       text[],
  scope_audience          text default 'ALL',               -- ALL | STUDENTS
  scope_cohort            text,
  scope_user_ids          text[]
);

create index if not exists announcements_status_idx on announcements (status);

create table if not exists user_notice_state (
  id         bigserial primary key,
  user_id    text not null references users (user_id),      -- S4
  item_type  text not null default 'ANNOUNCEMENT',
  item_id    text not null,
  state      text not null,                                 -- read | clicked | dismissed
  seen_at    timestamptz default now(),
  updated_at timestamptz default now(),
  constraint unique_user_notice unique (user_id, item_type, item_id)
);

create index if not exists user_notice_state_item_idx on user_notice_state (item_type, item_id);

-- ── row-level security ─────────────────────────────────────────────────
alter table announcements enable row level security;

drop policy if exists announcements_select on announcements;
create policy announcements_select on announcements for select
using (auth.uid() is not null);

drop policy if exists announcements_insert on announcements;
create policy announcements_insert on announcements for insert
with check (auth_user_role() = 'ADMIN');

drop policy if exists announcements_update on announcements;
create policy announcements_update on announcements for update
using (auth_user_role() = 'ADMIN');

drop policy if exists announcements_delete on announcements;
create policy announcements_delete on announcements for delete
using (auth_user_role() = 'ADMIN');

alter table user_notice_state enable row level security;

drop policy if exists user_notice_state_select on user_notice_state;
create policy user_notice_state_select on user_notice_state for select
using (user_notice_state.user_id = auth_user_id() or auth_user_role() = 'ADMIN');

drop policy if exists user_notice_state_insert on user_notice_state;
create policy user_notice_state_insert on user_notice_state for insert
with check (user_notice_state.user_id = auth_user_id());

drop policy if exists user_notice_state_update on user_notice_state;
create policy user_notice_state_update on user_notice_state for update
using (user_notice_state.user_id = auth_user_id());
