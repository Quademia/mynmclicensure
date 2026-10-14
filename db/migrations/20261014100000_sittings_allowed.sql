-- 20261014100000_sittings_allowed.sql — 04-practice.md (04.10, 04.11), a
-- paper's and a mock's settings; ticked by Sam 2026-10-14, written on
-- `quizzes`, `mock_quizzes` and the database's own functions in 12-tables.md
--
-- WHY. Papers and mocks carry the same settings (Sam, 2026-10-13: "they are
-- the same settings almost"). A mock's first sitting is the exam, in its
-- own mode, as a paper's is (04.5); and the admin may say how many times a
-- student may sit a paper or a mock.
--
-- WHAT.
--   1. mock_quizzes.first_mode, as quizzes.first_mode (20261012100000):
--      Free Navigation on a new mock; a mock today takes Free Navigation
--      where it allows it, else its first exam mode, else its first mode.
--      Students read it.
--   2. quizzes.sittings_allowed and mock_quizzes.sittings_allowed: a whole
--      number above 0, empty = no limit (every row today). Students read it.
--   3. create_attempt:
--      - a mock's sitting in a mode other than its first_mode is refused
--        until the student has completed a sitting of it in that mode, as
--        a paper's is;
--      - with sittings_allowed set, a new sitting is refused once the
--        student's sittings of that paper or mock — in progress, completed
--        or abandoned — reach it, and while one of them is in progress
--        (one sitting at a time, Sam 2026-10-14).
--      Every other rule is as 20261012100000.
--   4. save_quiz writes sittings_allowed for both kinds and first_mode for
--      a mock (it names the columns it writes, AGENTS.md); an edit that
--      sends no first_mode keeps the stored one, a new row takes Free
--      Navigation. Everything else is as 20261012110000.
--
-- REACH. Dev only: the live product is the old site; prod takes this at the
-- next release Sam approves. On the dev site (main's code) a mock's Learning
-- mode is refused until its first sitting in Free Navigation is finished;
-- no row has a limit, so nothing else changes there.

set search_path = licensure_gh;

-- ── 1. a mock's first sitting ─────────────────────────────────────────
alter table mock_quizzes add column if not exists first_mode text not null default 'TIMED_FREE_NAV';

update mock_quizzes q
set first_mode = case
    when 'TIMED_FREE_NAV'   = any (q.allowed_modes) then 'TIMED_FREE_NAV'
    when 'TIMED_SEQUENTIAL' = any (q.allowed_modes) then 'TIMED_SEQUENTIAL'
    when 'UNTIMED_TEST'     = any (q.allowed_modes) then 'UNTIMED_TEST'
    else q.allowed_modes[1]
  end
where not (q.first_mode = any (q.allowed_modes));

alter table mock_quizzes drop constraint if exists mock_quizzes_first_mode_check;
alter table mock_quizzes add constraint mock_quizzes_first_mode_check
  check (first_mode = any (allowed_modes));

-- ── 2. sittings allowed ───────────────────────────────────────────────
alter table quizzes add column if not exists sittings_allowed integer;
alter table quizzes drop constraint if exists quizzes_sittings_allowed_check;
alter table quizzes add constraint quizzes_sittings_allowed_check
  check (sittings_allowed is null or sittings_allowed > 0);

alter table mock_quizzes add column if not exists sittings_allowed integer;
alter table mock_quizzes drop constraint if exists mock_quizzes_sittings_allowed_check;
alter table mock_quizzes add constraint mock_quizzes_sittings_allowed_check
  check (sittings_allowed is null or sittings_allowed > 0);

grant select (first_mode, sittings_allowed) on mock_quizzes to authenticated;
grant select (sittings_allowed) on quizzes to authenticated;

-- ── 3. the start rule ─────────────────────────────────────────────────
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
  v_n           integer;
  v_kind        text;
  v_any_grant   boolean;
  v_papers_all  boolean;
  v_mocks       boolean;
  v_builder_ok  boolean;
  v_all_free    boolean;
  v_first_mode  text;
  v_allowed     integer;
  v_used        integer;
  v_going       boolean;
  v_word        text;
begin
  -- What kind of sitting: a retake takes its quiz's kind; a retake with
  -- no quiz is a builder retake, which no count limits.
  v_kind := case
    when p_source = 'fixed' then 'paper'
    when p_source = 'mock' then 'mock'
    when p_source = 'builder' then 'builder'
    when p_source = 'retake' and p_quiz_id is not null then
      case when exists (select 1 from mock_quizzes m where m.quiz_id = p_quiz_id) then 'mock' else 'paper' end
    else 'builder_retake'
  end;

  -- Every question a published free question of this course (the free set, 03).
  v_all_free := coalesce(array_length(p_item_ids, 1), 0) > 0
    and not exists (
      select 1
      from unnest(p_item_ids) as i(item_id)
      left join question_bank q on q.item_id = i.item_id and q.course_id = p_course_id
      where q.item_id is null or not q.is_published or not q.is_free_sample);

  -- The live grants for this course, and the most generous of each limit.
  select count(*) > 0,
         coalesce(bool_or(s.allow_papers = 'all'), false),
         coalesce(bool_or(s.allow_mocks), false)
  into v_any_grant, v_papers_all, v_mocks
  from course_access ca
  join subscriptions s on s.subscription_id = ca.subscription_id
  where ca.user_id = p_user_id
    and ca.course_id = p_course_id
    and ca.revoked_utc is null
    and now() >= ca.start_utc and now() < ca.expires_utc;

  if not v_any_grant then
    -- The free set (F1): a builder quiz of free questions only, in a
    -- course of the student's programme, in a Study mode.
    if v_kind not in ('builder', 'builder_retake') then
      raise exception 'You do not have an active subscription for this course.';
    end if;
    if p_mode not in ('UNTIMED_LEARNING', 'UNTIMED_TEST') then
      raise exception 'The exam modes open with a package.';
    end if;
    if not exists (
         select 1 from courses c join users u on u.user_id = p_user_id
         where c.course_id = p_course_id and u.program_id = any (c.program_scope))
       or not v_all_free
    then
      raise exception 'You do not have an active subscription for this course.';
    end if;
  else
    if v_kind = 'paper' and not v_papers_all
       and not exists (select 1 from quizzes q where q.quiz_id = p_quiz_id and q.open_in_trial) then
      raise exception 'This paper opens with a package.';
    end if;

    if v_kind = 'mock' and not v_mocks then
      raise exception 'Mock exams aren''t included in your package.';
    end if;

    if v_kind in ('paper', 'mock') then
      v_word := case when v_kind = 'mock' then 'mock' else 'paper' end;
      if v_kind = 'mock' then
        select m.first_mode, m.sittings_allowed into v_first_mode, v_allowed
        from mock_quizzes m where m.quiz_id = p_quiz_id;
      else
        select q.first_mode, q.sittings_allowed into v_first_mode, v_allowed
        from quizzes q where q.quiz_id = p_quiz_id;
      end if;

      -- The first sitting is in first_mode; the other ways open once a
      -- sitting in that mode is completed (04.5, 04.11).
      if v_first_mode is not null and p_mode <> v_first_mode
         and not exists (
           select 1 from attempts a
           where a.user_id = p_user_id and a.quiz_id = p_quiz_id
             and a.mode = v_first_mode and a.status = 'completed') then
        raise exception 'Finish your first sitting of this % before the other ways open.', v_word;
      end if;

      -- Sittings allowed (04.10): every sitting started counts, and one
      -- at a time.
      if v_allowed is not null then
        select count(*), coalesce(bool_or(a.status = 'in_progress'), false)
        into v_used, v_going
        from attempts a
        where a.user_id = p_user_id and a.quiz_id = p_quiz_id;
        if v_used >= v_allowed then
          raise exception 'You have used your % sittings of this %.', v_allowed, v_word;
        end if;
        if v_going then
          raise exception 'Finish or resume your sitting in progress first.';
        end if;
      end if;
    end if;

    -- Builder quizzes: unlimited on any grant without a count; otherwise
    -- a grant still has room when the student's builder sittings in its
    -- courses since it began are fewer than its count. With the count
    -- used up, the free questions stay open in a Study mode, as on a
    -- free account (Sam, 2026-10-11: b).
    if v_kind = 'builder' then
      select coalesce(bool_or(
               s.allow_builder_quizzes is null
               or (select count(*) from attempts a
                   where a.user_id = p_user_id
                     and a.source = 'builder'
                     and a.ts_iso >= s.start_utc
                     and a.course_id in (select ca2.course_id from course_access ca2
                                         where ca2.subscription_id = s.subscription_id))
                  < s.allow_builder_quizzes
             ), false)
      into v_builder_ok
      from course_access ca
      join subscriptions s on s.subscription_id = ca.subscription_id
      where ca.user_id = p_user_id
        and ca.course_id = p_course_id
        and ca.revoked_utc is null
        and now() >= ca.start_utc and now() < ca.expires_utc;
      if not v_builder_ok
         and not (v_all_free and p_mode in ('UNTIMED_LEARNING', 'UNTIMED_TEST')) then
        raise exception 'You have used all the Quiz Builder quizzes in your package.';
      end if;
    end if;
  end if;

  -- A draft is not servable, whichever course it sits in.
  if exists (
    select 1
    from unnest(p_item_ids) as i(item_id)
    join question_bank q on q.item_id = i.item_id
    where not q.is_published
  ) then
    raise exception 'This quiz has a question that is not published';
  end if;

  insert into attempts (
    attempt_id, user_id, quiz_id, course_id, mode, source,
    n, status, ts_iso, duration_min, display_label, origin_attempt_id
  ) values (
    p_attempt_id, p_user_id, p_quiz_id, p_course_id, p_mode, p_source,
    0, 'in_progress', now(), p_duration_min, p_display_label, p_origin_attempt_id
  );

  insert into attempt_items (
    attempt_id, position, item_id,
    question_type, stem, option_a, option_b, option_c, option_d, option_e, option_f,
    marks, shuffle_options,
    correct, rationale, rationale_img, fb_a, fb_b, fb_c, fb_d, fb_e, fb_f,
    subject, maintopic, subtopic, difficulty,
    bloom_level, tags, version
  )
  select
    p_attempt_id, row_number() over (order by ids.ord), q.item_id,
    q.question_type, q.stem, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, q.option_f,
    q.marks, q.shuffle_options,
    q.correct, q.rationale, q.rationale_img, q.fb_a, q.fb_b, q.fb_c, q.fb_d, q.fb_e, q.fb_f,
    q.subject, q.maintopic, q.subtopic, q.difficulty,
    q.bloom_level, q.tags, q.version
  from unnest(p_item_ids) with ordinality as ids (item_id, ord)
  join question_bank q on q.item_id = ids.item_id and q.course_id = p_course_id;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'create_attempt: none of the % ids belong to course %', coalesce(array_length(p_item_ids, 1), 0), p_course_id;
  end if;

  update attempts a set n = v_n where a.attempt_id = p_attempt_id;
  return v_n;
end;
$$;
revoke execute on function create_attempt(text, text, text, text[], text, text, text, integer, text, text) from public, anon, authenticated;

-- ── 4. the admin's save ───────────────────────────────────────────────
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
      set (course_id, title, n, allowed_modes, first_mode, sittings_allowed, shuffle, time_limit_sec, published,
           publish_at, unpublish_at, status, notes, updated_at)
        = (v_course, r.title, v_n, r.allowed_modes, coalesce(r.first_mode, q.first_mode), r.sittings_allowed, r.shuffle, r.time_limit_sec, r.published,
           r.publish_at, r.unpublish_at, r.status, r.notes, coalesce(r.updated_at, now()))
      from jsonb_populate_record(null::quizzes, p_quiz) as r
      where q.quiz_id = v_quiz_id;
      if not found then
        raise exception 'That quiz no longer exists.';
      end if;
    else
      insert into quizzes (quiz_id, course_id, title, n, allowed_modes, first_mode, sittings_allowed, shuffle, time_limit_sec,
                           published, publish_at, unpublish_at, status, notes, created_at, updated_at)
      select v_quiz_id, v_course, r.title, v_n, r.allowed_modes, coalesce(r.first_mode, 'TIMED_FREE_NAV'), r.sittings_allowed, r.shuffle, r.time_limit_sec,
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
      set (course_id, title, n, allowed_modes, first_mode, sittings_allowed, shuffle, time_limit_sec, published,
           publish_at, unpublish_at, status, notes, updated_at)
        = (v_course, r.title, v_n, r.allowed_modes, coalesce(r.first_mode, q.first_mode), r.sittings_allowed, r.shuffle, r.time_limit_sec, r.published,
           r.publish_at, r.unpublish_at, r.status, r.notes, coalesce(r.updated_at, now()))
      from jsonb_populate_record(null::mock_quizzes, p_quiz) as r
      where q.quiz_id = v_quiz_id;
      if not found then
        raise exception 'That mock exam no longer exists.';
      end if;
    else
      insert into mock_quizzes (quiz_id, course_id, title, n, allowed_modes, first_mode, sittings_allowed, shuffle, time_limit_sec,
                                published, publish_at, unpublish_at, status, notes, created_at, updated_at)
      select v_quiz_id, v_course, r.title, v_n, r.allowed_modes, coalesce(r.first_mode, 'TIMED_FREE_NAV'), r.sittings_allowed, r.shuffle, r.time_limit_sec,
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
