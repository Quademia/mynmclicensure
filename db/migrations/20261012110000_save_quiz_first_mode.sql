-- 20261012110000_save_quiz_first_mode.sql — 04-practice.md (04.5), the admin's
-- "First sitting in" dropdown; no table change (the column is
-- 20261012100000_first_mode.sql)
--
-- WHY. save_quiz() names the columns it writes, so a paper's first_mode
-- was never saved by the admin's form: a paper edited to allow no Free
-- Navigation would fail the check on first_mode with no way to change it.
--
-- WHAT. save_quiz writes first_mode for a paper (kind 'fixed'): an edit
-- takes the sent value, else keeps the stored one; a new paper takes the
-- sent value, else Free Navigation. A mock has no such column. Everything
-- else in the function is as 20260927100000.
--
-- REACH. Dev only. main's form does not send first_mode, so on the dev
-- site a save keeps the stored value, and one that unticks the paper's
-- first mode is refused by the table's check.

set search_path = licensure_gh;

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
      set (course_id, title, n, allowed_modes, first_mode, shuffle, time_limit_sec, published,
           publish_at, unpublish_at, status, notes, updated_at)
        = (v_course, r.title, v_n, r.allowed_modes, coalesce(r.first_mode, q.first_mode), r.shuffle, r.time_limit_sec, r.published,
           r.publish_at, r.unpublish_at, r.status, r.notes, coalesce(r.updated_at, now()))
      from jsonb_populate_record(null::quizzes, p_quiz) as r
      where q.quiz_id = v_quiz_id;
      if not found then
        raise exception 'That quiz no longer exists.';
      end if;
    else
      insert into quizzes (quiz_id, course_id, title, n, allowed_modes, first_mode, shuffle, time_limit_sec,
                           published, publish_at, unpublish_at, status, notes, created_at, updated_at)
      select v_quiz_id, v_course, r.title, v_n, r.allowed_modes, coalesce(r.first_mode, 'TIMED_FREE_NAV'), r.shuffle, r.time_limit_sec,
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
