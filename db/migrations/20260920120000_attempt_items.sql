-- 20260920120000_attempt_items.sql — 03-quiz-system.md Q4, the questions
-- as rows (rebuild.md §8 S7, ticked by Sam 2026-09-18, sliced 2026-09-20;
-- D12; the read side of the attempts restructure)
--
-- A sitting stops being a pointer list. Until now an attempt held its
-- questions as one comma-joined text of ids and the runner re-read the
-- live bank by those ids on every open — so a question edited after the
-- sitting changed the sitting, and a question deleted vanished from it
-- (the offline-pack renderer even apologised for the missing count).
-- From here every attempt and every offline pack carries its own copy
-- of each question, as served, one row per question.
--
-- Five moves, one file so the runner's transaction holds them together:
--   1. attempt_items — one row per question of an attempt: the links
--      (attempt, position, the bank id with NO key to the bank, on
--      purpose — the snapshot is the truth), the public half of the
--      question, the secret half (correct, rationale, rationale_img,
--      the per-option feedback), the analytics columns, and the answer
--      group (chosen, flagged, sata_checked, time_spent_s, is_correct,
--      score_awarded, answered_utc, graded_utc) that Q5 will write —
--      one row holds the snapshot and the answer (Sam, 2026-09-20; no
--      separate answers table). The header gains started_utc and
--      ended_utc (Q5 writes them; ts_iso keeps meaning "created").
--   2. offline_pack_items — the same row without the answer group;
--      offline_packs.item_ids dropped.
--   3. Grants and policies. Students read their own attempt's rows,
--      the secret half EXCLUDED at the grant (column-level, the S10
--      shape) — a console query for `correct` mid-exam is refused by
--      the database, one door further than the page's seal (Q6). No
--      browser write path on either table. The read policy tests the
--      attempt's owner as a set, once per statement (the B1 shape).
--   4. create_attempt() and create_offline_pack() — the header and the
--      rows in one transaction, the questions copied table to table
--      from question_bank in the given order (an id the bank no longer
--      has is dropped, as getItemsByIds did; none resolving raises).
--      EXECUTE off every browser role: the Server Actions gate with
--      requireStudent() and call through the service role, the
--      course_access shape ("no browser write path").
--   5. The existing attempts and packs deleted (Sam, 2026-09-20: no
--      backfill, new attempts). Both projects hold test sittings only,
--      and D5 leaves both tables empty on launch day regardless; an old
--      row would otherwise sit on the history pages with a Resume that
--      finds no rows.
--
-- The two blobs on attempts (item_ids, answers_json) and the student
-- INSERT / UPDATE policies stay until Q5 moves the answers into the
-- rows; the save path still writes the blob for now. The runner keeps
-- receiving every column of the row in this slice (Q6 is the seal).

set search_path = licensure_gh;

-- ── 1. the attempt's rows, and the header's two clocks ────────────────
alter table attempts add column if not exists started_utc timestamptz;
alter table attempts add column if not exists ended_utc   timestamptz;

create table if not exists attempt_items (
  attempt_item_id bigint generated always as identity primary key,
  attempt_id      text not null references attempts (attempt_id) on delete cascade,
  position        integer not null,
  item_id         text not null,                    -- the bank question; no FK, the snapshot is the truth
  -- the public half, as served
  question_type   text not null,
  stem            text not null,
  option_a        text, option_b text, option_c text,
  option_d        text, option_e text, option_f text,
  marks           numeric not null default 1,
  shuffle_options boolean not null default true,
  -- the secret half: revoked from the browser roles below
  correct         text not null,
  rationale       text,
  rationale_img   text,
  fb_a            text, fb_b text, fb_c text,
  fb_d            text, fb_e text, fb_f text,
  -- for the analytics, so they never re-read the bank
  subject         text,
  maintopic       text,
  subtopic        text,
  difficulty      text,
  -- the answer group (Q5 writes it; the server only)
  chosen          text,                             -- a letter, or a comma list for SATA, as `correct`
  flagged         boolean not null default false,
  sata_checked    boolean not null default false,
  time_spent_s    integer,
  is_correct      boolean,
  score_awarded   numeric,
  answered_utc    timestamptz,
  graded_utc      timestamptz,
  constraint attempt_items_position_check check (position > 0),
  constraint attempt_items_attempt_position_key unique (attempt_id, position)
);
create index if not exists attempt_items_item_id_idx on attempt_items (item_id);

alter table attempt_items enable row level security;
drop policy if exists attempt_items_select on attempt_items;
create policy attempt_items_select on attempt_items for select
using (
  auth_user_role() = 'ADMIN'
  or attempt_id in (select a.attempt_id from attempts a where a.user_id = auth_user_id())
);

revoke all on attempt_items from anon, authenticated;
grant select (
  attempt_item_id, attempt_id, position, item_id,
  question_type, stem, option_a, option_b, option_c, option_d, option_e, option_f,
  marks, shuffle_options,
  subject, maintopic, subtopic, difficulty,
  chosen, flagged, sata_checked, time_spent_s, is_correct, score_awarded, answered_utc, graded_utc
) on attempt_items to authenticated;
revoke all on sequence attempt_items_attempt_item_id_seq from anon, authenticated;

-- ── 2. the pack's rows ────────────────────────────────────────────────
create table if not exists offline_pack_items (
  pack_item_id    bigint generated always as identity primary key,
  pack_id         text not null references offline_packs (pack_id) on delete cascade,
  position        integer not null,
  item_id         text not null,
  question_type   text not null,
  stem            text not null,
  option_a        text, option_b text, option_c text,
  option_d        text, option_e text, option_f text,
  marks           numeric not null default 1,
  shuffle_options boolean not null default true,
  correct         text not null,
  rationale       text,
  rationale_img   text,
  fb_a            text, fb_b text, fb_c text,
  fb_d            text, fb_e text, fb_f text,
  subject         text,
  maintopic       text,
  subtopic        text,
  difficulty      text,
  constraint offline_pack_items_position_check check (position > 0),
  constraint offline_pack_items_pack_position_key unique (pack_id, position)
);
create index if not exists offline_pack_items_item_id_idx on offline_pack_items (item_id);

alter table offline_pack_items enable row level security;
drop policy if exists offline_pack_items_select on offline_pack_items;
create policy offline_pack_items_select on offline_pack_items for select
using (
  auth_user_role() = 'ADMIN'
  or pack_id in (select p.pack_id from offline_packs p where p.user_id = auth_user_id())
);

-- A pack carries its key by design (it is printed) and the renderer is a
-- Server Component reading as the owner: the whole row is readable.
revoke all on offline_pack_items from anon, authenticated;
grant select on offline_pack_items to authenticated;
revoke all on sequence offline_pack_items_pack_item_id_seq from anon, authenticated;

-- ── 3. the old sittings go; the pack's id list goes ───────────────────
delete from attempts;
delete from offline_packs;
alter table offline_packs drop column if exists item_ids;

-- ── 4. the two creators ───────────────────────────────────────────────
-- The header and the rows in one call. p_item_ids is the order to serve;
-- positions are 1…n over the ids the bank still has, in that order.
-- Returns n. Raises when none resolve, so no header is left behind.
create or replace function create_attempt(
  p_attempt_id        text,
  p_user_id           text,
  p_course_id         text,
  p_item_ids          text[],
  p_mode              text,
  p_source            text,
  p_quiz_id           text,
  p_duration_min      integer,
  p_display_label     text,
  p_origin_attempt_id text
)
returns integer
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_n integer;
begin
  insert into attempts (
    attempt_id, user_id, quiz_id, course_id, mode, source,
    item_ids, n, status, ts_iso, duration_min, answers_json,
    display_label, origin_attempt_id
  ) values (
    p_attempt_id, p_user_id, p_quiz_id, p_course_id, p_mode, p_source,
    '', 0, 'in_progress', now(), p_duration_min, '[]',
    p_display_label, p_origin_attempt_id
  );

  insert into attempt_items (
    attempt_id, position, item_id,
    question_type, stem, option_a, option_b, option_c, option_d, option_e, option_f,
    marks, shuffle_options,
    correct, rationale, rationale_img, fb_a, fb_b, fb_c, fb_d, fb_e, fb_f,
    subject, maintopic, subtopic, difficulty
  )
  select
    p_attempt_id, row_number() over (order by ids.ord), q.item_id,
    q.question_type, q.stem, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, q.option_f,
    q.marks, q.shuffle_options,
    q.correct, q.rationale, q.rationale_img, q.fb_a, q.fb_b, q.fb_c, q.fb_d, q.fb_e, q.fb_f,
    q.subject, q.maintopic, q.subtopic, q.difficulty
  from unnest(p_item_ids) with ordinality as ids (item_id, ord)
  join question_bank q on q.item_id = ids.item_id and q.course_id = p_course_id;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'create_attempt: none of the % ids belong to course %', coalesce(array_length(p_item_ids, 1), 0), p_course_id;
  end if;

  -- The header's own copies until Q5 drops them: the runner's save path
  -- still reads n and the finish path still parses item_ids.
  update attempts a
  set n = v_n,
      item_ids = (select string_agg(i.item_id, ',' order by i.position) from attempt_items i where i.attempt_id = p_attempt_id)
  where a.attempt_id = p_attempt_id;

  return v_n;
end;
$$;
revoke execute on function create_attempt(text, text, text, text[], text, text, text, integer, text, text) from public, anon, authenticated;

create or replace function create_offline_pack(
  p_pack_id        text,
  p_user_id        text,
  p_course_id      text,
  p_item_ids       text[],
  p_pack_name      text,
  p_selection_mode text,
  p_maintopics     text[],
  p_subtopics      text[],
  p_difficulties   text[],
  p_question_types text[],
  p_concept_query  text,
  p_display_label  text,
  p_watermark      jsonb
)
returns integer
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_n integer;
begin
  insert into offline_packs (
    pack_id, user_id, course_id, pack_name, selection_mode,
    maintopics, subtopics, difficulties, question_types, concept_query,
    display_label, question_count, watermark, status
  ) values (
    p_pack_id, p_user_id, p_course_id, p_pack_name, p_selection_mode,
    coalesce(p_maintopics, '{}'), coalesce(p_subtopics, '{}'), coalesce(p_difficulties, '{}'),
    coalesce(p_question_types, '{}'), p_concept_query,
    p_display_label, 0, coalesce(p_watermark, '{}'::jsonb), 'active'
  );

  insert into offline_pack_items (
    pack_id, position, item_id,
    question_type, stem, option_a, option_b, option_c, option_d, option_e, option_f,
    marks, shuffle_options,
    correct, rationale, rationale_img, fb_a, fb_b, fb_c, fb_d, fb_e, fb_f,
    subject, maintopic, subtopic, difficulty
  )
  select
    p_pack_id, row_number() over (order by ids.ord), q.item_id,
    q.question_type, q.stem, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, q.option_f,
    q.marks, q.shuffle_options,
    q.correct, q.rationale, q.rationale_img, q.fb_a, q.fb_b, q.fb_c, q.fb_d, q.fb_e, q.fb_f,
    q.subject, q.maintopic, q.subtopic, q.difficulty
  from unnest(p_item_ids) with ordinality as ids (item_id, ord)
  join question_bank q on q.item_id = ids.item_id and q.course_id = p_course_id;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'create_offline_pack: none of the % ids belong to course %', coalesce(array_length(p_item_ids, 1), 0), p_course_id;
  end if;

  update offline_packs set question_count = v_n where pack_id = p_pack_id;
  return v_n;
end;
$$;
revoke execute on function create_offline_pack(text, text, text, text[], text, text, text[], text[], text[], text[], text, text, jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';
