-- 20260915150000_messaging.sql — slice 12a
--
-- Messaging: the two tables transcribed from legacy/db/schema.sql into
-- the `licensure_gh` schema with the same columns and defaults. No
-- content copy: rebuild.md D5 — messages do not move.
--
-- Shape change, under Sam's standing tick (rebuild.md §8 S4, "as each
-- table lands"): `messages_threads.user_id` references `users`,
-- `messages_threads.course_id` references `courses` (nullable),
-- `messages.thread_id` references `messages_threads`. `admin_id` stays
-- a bare text with legacy's default 'admin1' (it named no user row);
-- `quiz_id` (a fixed quiz or a mock exam), `question_id` (one of eleven
-- item tables) and `attempt_id` carry no key. The tables are empty
-- here, so nothing can violate them.
--
-- Policies (rebuild.md §6.4): legacy's, with the June 2026 fix folded
-- in — a student reads, inserts and updates their own threads and the
-- messages on them; an ADMIN reads, inserts and updates all (the
-- thread INSERT bypass that legacy shipped without, so an admin-made
-- thread — New Thread, every Bulk Send recipient — is owned by the
-- student and still inserts). No DELETE, as legacy.
--
-- Live replies (Sam, 2026-09-15): legacy subscribed to Supabase's
-- realtime feed on `messages` so a reply appeared without a refresh.
-- The table joins the `supabase_realtime` publication here; the browser
-- subscribes under the same SELECT policy.

set search_path = licensure_gh;

-- ── messages_threads ───────────────────────────────────────────────────
create table if not exists messages_threads (
  thread_id        text primary key,                                   -- 'THR_' + 16 upper hex
  user_id          text not null references users (user_id),           -- S4: the student the thread belongs to
  admin_id         text not null default 'admin1',
  status           text not null default 'open',                       -- open | closed
  context_type     text not null default 'general',                    -- general | course | question
  subject          text,
  course_id        text references courses (course_id),                -- S4; nullable
  quiz_id          text,
  question_id      text,
  attempt_id       text,
  bulk_batch_id    text,
  ref_text         text,                                               -- the quoted question for a question thread
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz not null default now(),
  last_sender_role text not null default 'student'                     -- student | admin
);

create index if not exists messages_threads_user_id_idx on messages_threads (user_id);
create index if not exists messages_threads_last_message_idx on messages_threads (last_message_at desc);
create index if not exists messages_threads_status_idx on messages_threads (status);

-- ── messages ───────────────────────────────────────────────────────────
create table if not exists messages (
  message_id    text primary key,                                       -- 'MSG_' + 16 upper hex
  thread_id     text not null references messages_threads (thread_id),  -- S4
  sender_id     text not null,
  sender_role   text not null,                                          -- student | admin
  body_text     text not null,
  read_by_user  boolean not null default false,
  read_by_admin boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists messages_thread_id_idx on messages (thread_id);
create index if not exists messages_thread_created_idx on messages (thread_id, created_at);
create index if not exists messages_unread_admin_idx on messages (read_by_admin) where read_by_admin = false;

-- ── row-level security ─────────────────────────────────────────────────
alter table messages_threads enable row level security;

drop policy if exists messages_threads_select on messages_threads;
create policy messages_threads_select on messages_threads for select
using (auth_user_role() = 'ADMIN' or messages_threads.user_id = auth_user_id());

drop policy if exists messages_threads_insert on messages_threads;
create policy messages_threads_insert on messages_threads for insert
with check (auth_user_role() = 'ADMIN' or messages_threads.user_id = auth_user_id());

drop policy if exists messages_threads_update on messages_threads;
create policy messages_threads_update on messages_threads for update
using (auth_user_role() = 'ADMIN' or messages_threads.user_id = auth_user_id());

alter table messages enable row level security;

drop policy if exists messages_select on messages;
create policy messages_select on messages for select
using (
  auth_user_role() = 'ADMIN'
  or exists (select 1 from messages_threads t where t.thread_id = messages.thread_id and t.user_id = auth_user_id())
);

drop policy if exists messages_insert on messages;
create policy messages_insert on messages for insert
with check (
  auth_user_role() = 'ADMIN'
  or exists (select 1 from messages_threads t where t.thread_id = messages.thread_id and t.user_id = auth_user_id())
);

drop policy if exists messages_update on messages;
create policy messages_update on messages for update
using (
  auth_user_role() = 'ADMIN'
  or exists (select 1 from messages_threads t where t.thread_id = messages.thread_id and t.user_id = auth_user_id())
);

-- ── the realtime feed ──────────────────────────────────────────────────
-- Idempotent: a re-run must not fail on "already a member".
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'licensure_gh' and tablename = 'messages'
     ) then
    execute 'alter publication supabase_realtime add table licensure_gh.messages';
  end if;
end $$;
