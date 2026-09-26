-- 20260927100000_quiz_item_rows.sql — 03-quiz-system.md Q14, rebuild.md
-- §8 S20 (Sam, 2026-09-27: talked through, ruled and ticked the same day)
--
-- WHY. A fixed quiz's and a mock's questions were an id array
-- (`item_ids text[]`), which cannot carry a key. A deleted question stayed
-- named and was skipped at start (create_attempt copies only the ids it
-- finds in the quiz's course), so a quiz served fewer questions than its
-- `n` and nothing said so; nothing refused a repeat or another course's
-- id; an existing quiz's course could be changed in the editor while it
-- held the old course's questions, leaving a quiz no student could start;
-- and "which mocks hold this question" read every mock's whole list.
--
-- WHAT.
--   1. The pairs the keys point at: unique (course_id, item_id) on the
--      bank and (quiz_id, course_id) on both quiz tables. No new data —
--      the ids are already unique; the pairs let one key check the course.
--   2. quiz_items and mock_quiz_items: quiz, course, question, position.
--      A question once per quiz (the primary key), in any number of
--      quizzes and mocks (08 B6); one question per position, from 1. The
--      quiz key cascades a quiz's delete to its rows; the bank key
--      RESTRICTS — a question a quiz or mock names cannot be deleted
--      (Sam: unpublish is the way to retire one). The two keys share
--      course_id, so a quiz holds only its own course's questions.
--   3. The arrays copied in, tidied first — prod's lists cannot be read
--      from here (AGENTS.md: a rule added to prod's data tidies it
--      first): an id missing from the bank or in another course is left
--      out, a repeat keeps its first place, positions run from 1. On dev
--      nothing is left out (checked 2026-09-27: 7 quizzes and mocks, 95
--      ids — 50 fixed, 45 mock). A notice counts what was left out — seen in a proof run; the
--      runner does not print notices — and `n` is set to the rows copied
--      where it differs, so a card counts what a sitting serves.
--   4. item_ids dropped from both quiz tables.
--   5. save_quiz(): the quiz row and its question rows written in one
--      step, so a quiz is never half-saved. Checks with words an admin
--      can read: no questions, a repeat, a question not in this course.
--      Called by the service role behind requireAdmin(); no browser role
--      may execute it.
--   6. Rule 9 on the tables this file touches. The two new tables: born
--      with `grant all` to the browser roles — revoked, RLS on, no policy;
--      the server reads and writes them. The two quiz tables: INSERT,
--      UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER still sat with
--      anon and authenticated (03 Q1 fixed the reads and left the
--      writes) — revoked, and the two write policies each dropped; the
--      admin's save, publish and status writes move to the service role.
--      The column-level SELECT and the select policies stay.
--
-- REACH. Dev until the merge: main's code reads and writes item_ids, so on
-- the dev site starting a quiz or a mock, saving one, the fixed-quiz
-- picker and both builders (they read the mock lists for B6's hold-back)
-- fail until main has this code. Only Sam. At cutover the quizzes'
-- re-copy writes rows after the bank (the line under 00).

set search_path = licensure_gh;

-- ── 1. the pairs the keys point at ─────────────────────────────────────
alter table question_bank add constraint question_bank_course_item_key unique (course_id, item_id);
alter table quizzes       add constraint quizzes_quiz_course_key       unique (quiz_id, course_id);
alter table mock_quizzes  add constraint mock_quizzes_quiz_course_key  unique (quiz_id, course_id);

-- ── 2. the two tables ──────────────────────────────────────────────────
create table quiz_items (
  quiz_id   text    not null,
  course_id text    not null,
  item_id   text    not null,
  position  integer not null,
  constraint quiz_items_pkey          primary key (quiz_id, item_id),
  constraint quiz_items_position_key  unique (quiz_id, position),
  constraint quiz_items_position_check check (position >= 1),
  constraint quiz_items_quiz_fkey     foreign key (quiz_id, course_id)
    references quizzes (quiz_id, course_id) on delete cascade,
  constraint quiz_items_item_fkey     foreign key (course_id, item_id)
    references question_bank (course_id, item_id) on delete restrict
);
create index quiz_items_item_idx on quiz_items (course_id, item_id);

create table mock_quiz_items (
  quiz_id   text    not null,
  course_id text    not null,
  item_id   text    not null,
  position  integer not null,
  constraint mock_quiz_items_pkey          primary key (quiz_id, item_id),
  constraint mock_quiz_items_position_key  unique (quiz_id, position),
  constraint mock_quiz_items_position_check check (position >= 1),
  constraint mock_quiz_items_quiz_fkey     foreign key (quiz_id, course_id)
    references mock_quizzes (quiz_id, course_id) on delete cascade,
  constraint mock_quiz_items_item_fkey     foreign key (course_id, item_id)
    references question_bank (course_id, item_id) on delete restrict
);
create index mock_quiz_items_item_idx on mock_quiz_items (course_id, item_id);

-- ── 3. the arrays copied in, tidied ────────────────────────────────────
insert into quiz_items (quiz_id, course_id, item_id, position)
select quiz_id, course_id, item_id, row_number() over (partition by quiz_id order by first_ord)
from (
  select q.quiz_id, q.course_id, btrim(u.item_id) as item_id, min(u.ord) as first_ord
  from quizzes q
  cross join lateral unnest(q.item_ids) with ordinality as u (item_id, ord)
  join question_bank b on b.item_id = btrim(u.item_id) and b.course_id = q.course_id
  group by q.quiz_id, q.course_id, btrim(u.item_id)
) s;

insert into mock_quiz_items (quiz_id, course_id, item_id, position)
select quiz_id, course_id, item_id, row_number() over (partition by quiz_id order by first_ord)
from (
  select q.quiz_id, q.course_id, btrim(u.item_id) as item_id, min(u.ord) as first_ord
  from mock_quizzes q
  cross join lateral unnest(q.item_ids) with ordinality as u (item_id, ord)
  join question_bank b on b.item_id = btrim(u.item_id) and b.course_id = q.course_id
  group by q.quiz_id, q.course_id, btrim(u.item_id)
) s;

do $$
declare
  v_fixed_ids integer; v_fixed_rows integer; v_mock_ids integer; v_mock_rows integer;
begin
  select coalesce(sum(cardinality(item_ids)), 0) into v_fixed_ids from quizzes;
  select count(*) into v_fixed_rows from quiz_items;
  select coalesce(sum(cardinality(item_ids)), 0) into v_mock_ids from mock_quizzes;
  select count(*) into v_mock_rows from mock_quiz_items;
  raise notice 'quiz_items: % ids in the lists, % rows copied, % left out', v_fixed_ids, v_fixed_rows, v_fixed_ids - v_fixed_rows;
  raise notice 'mock_quiz_items: % ids in the lists, % rows copied, % left out', v_mock_ids, v_mock_rows, v_mock_ids - v_mock_rows;
end $$;

update quizzes q
set n = coalesce((select count(*) from quiz_items i where i.quiz_id = q.quiz_id), 0)
where q.n is distinct from coalesce((select count(*) from quiz_items i where i.quiz_id = q.quiz_id), 0);

update mock_quizzes q
set n = coalesce((select count(*) from mock_quiz_items i where i.quiz_id = q.quiz_id), 0)
where q.n is distinct from coalesce((select count(*) from mock_quiz_items i where i.quiz_id = q.quiz_id), 0);

-- ── 4. the arrays go ───────────────────────────────────────────────────
alter table quizzes      drop column item_ids;
alter table mock_quizzes drop column item_ids;

-- ── 5. the save: the quiz row and its rows in one step ─────────────────
-- p_quiz carries the columns the editor saves (the app's payload, as the
-- quiz tables name them); jsonb_populate_record reads them with the
-- columns' own types, as the API does. `n` is the rows written. On an edit
-- the rows go first, so a course change meets the keys only through the
-- new rows: a question not in the new course is refused by name.
create or replace function save_quiz(p_kind text, p_is_edit boolean, p_quiz jsonb, p_item_ids text[])
returns integer
language plpgsql
set search_path = licensure_gh
as $$
declare
  v_quiz_id text := btrim(coalesce(p_quiz ->> 'quiz_id', ''));
  v_course  text := btrim(coalesce(p_quiz ->> 'course_id', ''));
  v_ids     text[];
  v_n       integer;
  v_bad     text;
begin
  if p_kind is null or p_kind not in ('fixed', 'mock') then
    raise exception 'save_quiz: unknown kind %', p_kind;
  end if;
  if v_quiz_id = '' or v_course = '' then
    raise exception 'save_quiz: the quiz id and the course are required';
  end if;

  select array_agg(btrim(x) order by o) into v_ids
  from unnest(p_item_ids) with ordinality as t (x, o)
  where btrim(coalesce(x, '')) <> '';
  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n = 0 then
    raise exception 'Cannot save with no questions.';
  end if;

  select string_agg(x, ', ' order by x) into v_bad
  from (select x from unnest(v_ids) as t (x) group by x having count(*) > 1) d;
  if v_bad is not null then
    raise exception 'A question can appear only once: % is in the list more than once.', v_bad;
  end if;

  select string_agg(x, ', ' order by o) into v_bad
  from unnest(v_ids) with ordinality as t (x, o)
  where not exists (select 1 from question_bank b where b.item_id = t.x and b.course_id = v_course);
  if v_bad is not null then
    raise exception 'Not a question of course %: %.', v_course, v_bad;
  end if;

  if p_kind = 'fixed' then
    if p_is_edit then
      delete from quiz_items where quiz_id = v_quiz_id;
      update quizzes q
      set (course_id, title, n, allowed_modes, shuffle, time_limit_sec, published,
           publish_at, unpublish_at, status, notes, updated_at)
        = (v_course, r.title, v_n, r.allowed_modes, r.shuffle, r.time_limit_sec, r.published,
           r.publish_at, r.unpublish_at, r.status, r.notes, coalesce(r.updated_at, now()))
      from jsonb_populate_record(null::quizzes, p_quiz) as r
      where q.quiz_id = v_quiz_id;
      if not found then
        raise exception 'That quiz no longer exists.';
      end if;
    else
      insert into quizzes (quiz_id, course_id, title, n, allowed_modes, shuffle, time_limit_sec,
                           published, publish_at, unpublish_at, status, notes, created_at, updated_at)
      select v_quiz_id, v_course, r.title, v_n, r.allowed_modes, r.shuffle, r.time_limit_sec,
             r.published, r.publish_at, r.unpublish_at, r.status, r.notes,
             coalesce(r.created_at, now()), coalesce(r.updated_at, now())
      from jsonb_populate_record(null::quizzes, p_quiz) as r;
    end if;
    insert into quiz_items (quiz_id, course_id, item_id, position)
    select v_quiz_id, v_course, t.x, t.o from unnest(v_ids) with ordinality as t (x, o);
  else
    if p_is_edit then
      delete from mock_quiz_items where quiz_id = v_quiz_id;
      update mock_quizzes q
      set (course_id, title, n, allowed_modes, shuffle, time_limit_sec, published,
           publish_at, unpublish_at, status, notes, updated_at)
        = (v_course, r.title, v_n, r.allowed_modes, r.shuffle, r.time_limit_sec, r.published,
           r.publish_at, r.unpublish_at, r.status, r.notes, coalesce(r.updated_at, now()))
      from jsonb_populate_record(null::mock_quizzes, p_quiz) as r
      where q.quiz_id = v_quiz_id;
      if not found then
        raise exception 'That mock exam no longer exists.';
      end if;
    else
      insert into mock_quizzes (quiz_id, course_id, title, n, allowed_modes, shuffle, time_limit_sec,
                                published, publish_at, unpublish_at, status, notes, created_at, updated_at)
      select v_quiz_id, v_course, r.title, v_n, r.allowed_modes, r.shuffle, r.time_limit_sec,
             r.published, r.publish_at, r.unpublish_at, r.status, r.notes,
             coalesce(r.created_at, now()), coalesce(r.updated_at, now())
      from jsonb_populate_record(null::mock_quizzes, p_quiz) as r;
    end if;
    insert into mock_quiz_items (quiz_id, course_id, item_id, position)
    select v_quiz_id, v_course, t.x, t.o from unnest(v_ids) with ordinality as t (x, o);
  end if;

  return v_n;
end;
$$;

revoke all on function save_quiz(text, boolean, jsonb, text[]) from public, anon, authenticated;

-- ── 6. rule 9 ──────────────────────────────────────────────────────────
revoke all on quiz_items      from anon, authenticated;
revoke all on mock_quiz_items from anon, authenticated;
alter table quiz_items      enable row level security;
alter table mock_quiz_items enable row level security;

revoke insert, update, delete, truncate, references, trigger on quizzes      from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on mock_quizzes from anon, authenticated;
drop policy if exists quizzes_insert      on quizzes;
drop policy if exists quizzes_update      on quizzes;
drop policy if exists mock_quizzes_insert on mock_quizzes;
drop policy if exists mock_quizzes_update on mock_quizzes;

notify pgrst, 'reload schema';
