-- 20260914200000_offline_packs.sql — slice 13a
--
-- Offline packs: one row per stored revision pack a student built —
-- an immutable snapshot of the chosen item ids plus the filters that
-- chose them and the watermark stamped on the render. Transcribed from
-- legacy/db/schema.sql (3b.1) into the `licensure_gh` schema with the
-- same seventeen columns and defaults, and legacy's updated_utc trigger.
-- No content copy: D5 — packs do not move.
--
-- Shape change, under Sam's standing tick (§8 S4, "as each table
-- lands"): `user_id` references `users`, `course_id` references
-- `courses`.
--
-- Policies are the legacy ones (rls.sql §18): a student reads, inserts
-- and updates their own rows; ADMIN reads all; NO DELETE — a pack is
-- deactivated, never deleted. Under the new stack the browser never
-- writes this table — the builder's Server Action does, as the
-- signed-in student, so the own-row policies are the floor.

set search_path = licensure_gh;

create table if not exists offline_packs (
  pack_id        text primary key,                                   -- 'PACK_' + ms + '_' + 8 hex
  user_id        text not null references users (user_id),          -- S4
  course_id      text not null references courses (course_id),      -- S4
  pack_name      text not null,
  selection_mode text not null default 'topics',                     -- topics | concept
  maintopics     text[] not null default '{}',
  subtopics      text[] not null default '{}',
  difficulties   text[] not null default '{}',
  question_types text[] not null default '{}',
  concept_query  text,
  display_label  text,
  item_ids       text[] not null,
  question_count integer not null,
  watermark      jsonb not null default '{}',
  status         text not null default 'active',
  created_utc    timestamptz not null default now(),
  updated_utc    timestamptz not null default now()
);

create index if not exists offline_packs_user_id_idx        on offline_packs (user_id);
create index if not exists offline_packs_user_course_idx    on offline_packs (user_id, course_id, status);

-- legacy: auto-touch updated_utc on every UPDATE
create or replace function set_offline_packs_updated_utc()
returns trigger
language plpgsql
as $$
begin
  new.updated_utc = now();
  return new;
end;
$$;

drop trigger if exists trg_offline_packs_updated_utc on offline_packs;
create trigger trg_offline_packs_updated_utc
  before update on offline_packs
  for each row
  execute function set_offline_packs_updated_utc();

-- ── row-level security ─────────────────────────────────────────────────
alter table offline_packs enable row level security;

drop policy if exists offline_packs_select on offline_packs;
create policy offline_packs_select on offline_packs for select
using (offline_packs.user_id = auth_user_id() or auth_user_role() = 'ADMIN');

drop policy if exists offline_packs_insert on offline_packs;
create policy offline_packs_insert on offline_packs for insert
with check (offline_packs.user_id = auth_user_id());

drop policy if exists offline_packs_update on offline_packs;
create policy offline_packs_update on offline_packs for update
using (offline_packs.user_id = auth_user_id());
