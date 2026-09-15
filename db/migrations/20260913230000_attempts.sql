-- 20260913230000_attempts.sql — slice 6a
--
-- Attempts: one row per run of a quiz — fixed, builder, mock, or a
-- retake of any of those — transcribed from legacy/db/schema.sql into
-- the `licensure_gh` schema with the same nineteen columns and defaults.
-- `item_ids` (comma-joined) and `answers_json` (a JSON string) stay TEXT
-- blobs: rebuild.md §8 S3 is unticked. No content copy: D5 — attempts
-- do not move.
--
-- Shape change, under Sam's standing tick (§8 S4, "as each table
-- lands"): `user_id` references `users`, `course_id` references
-- `courses`, `origin_attempt_id` references `attempts` (a retake points
-- at a real attempt). `quiz_id` carries no key: it names a row in
-- `quizzes` OR `mock_quizzes`, and is null for the builder.
--
-- Policies are the legacy ones: a student reads, inserts and updates
-- their own rows; ADMIN reads all (the stats on the quiz admin pages,
-- the attempts analytics page); NO DELETE. Under the new stack the
-- browser never writes this table — the runner's Server Actions do, as
-- the signed-in student, so the own-row policies are the floor.

set search_path = licensure_gh;

create table if not exists attempts (
  attempt_id        text primary key,                                  -- 'ATT_' + ms + '_' + 7 hex
  user_id           text not null references users (user_id),         -- S4
  quiz_id           text,                                              -- quizzes / mock_quizzes; null for builder
  course_id         text not null references courses (course_id),     -- S4
  mode              text not null,                                     -- instant | timed
  source            text not null,                                     -- fixed | builder | retake | mock
  item_ids          text not null,                                     -- comma-joined, in the attempt's order
  n                 integer not null,
  seed              text,
  duration_min      integer,
  status            text not null default 'in_progress',               -- in_progress | completed | abandoned
  score_raw         numeric,
  score_total       numeric,
  score_pct         numeric,
  time_taken_s      integer,
  origin_attempt_id text references attempts (attempt_id),             -- S4; the retake chain
  display_label     text,
  answers_json      text not null default '[]',
  ts_iso            timestamptz default now()
);

create index if not exists attempts_user_id_idx   on attempts (user_id);
create index if not exists attempts_quiz_id_idx   on attempts (quiz_id);
create index if not exists attempts_course_id_idx on attempts (course_id);
create index if not exists attempts_status_idx    on attempts (status);
create index if not exists attempts_user_quiz_mode_status_idx on attempts (user_id, quiz_id, mode, status);

-- ── row-level security ─────────────────────────────────────────────────
alter table attempts enable row level security;

drop policy if exists attempts_select on attempts;
create policy attempts_select on attempts for select
using (attempts.user_id = auth_user_id() or auth_user_role() = 'ADMIN');

drop policy if exists attempts_insert on attempts;
create policy attempts_insert on attempts for insert
with check (attempts.user_id = auth_user_id());

drop policy if exists attempts_update on attempts;
create policy attempts_update on attempts for update
using (attempts.user_id = auth_user_id());
