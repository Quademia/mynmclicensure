-- 20261015120000_review.sql — 04-practice.md (04.13), the review: Always,
-- Until a date, or Not allowed; ticked by Sam 2026-10-15 on `quizzes` and
-- `mock_quizzes` in 12-tables.md (in place of review_days, ticked
-- 2026-10-14 and never built).
--
-- WHY. A mock reused across groups needs its answers kept (Sam,
-- 2026-10-13). The review closes on its own date, independent of the
-- results date, or is not allowed at all (Sam, 2026-10-15: "the review
-- date now is an extra independent feature"; the three-way field). While
-- it is closed the score and the summary stay; the answers do not.
--
-- WHAT.
--   1. quizzes.review and mock_quizzes.review: 'always' (the default, every
--      row), 'until' or 'never'; review_closes_at, set with 'until' only.
--      Checks: the date with 'until' and only then; not on or before
--      results_at; 'never' not with Learning among the modes, 'until' not
--      with a Learning first sitting (none could start it after the close).
--      Students read both.
--   2. _quiz_review_closed(quiz, source): 'never', or 'until' and the date
--      has passed — the sitting's paper or mock found as
--      _quiz_results_at() finds it. Internal.
--   3. student_attempts() returns review, review_closes_at and
--      review_closed beside results_at and held (its type changes, so it
--      is dropped and made again).
--   4. attempt_items: a finished sitting whose results are held or whose
--      review is closed is not readable by its owner — the policy asks
--      _my_sealed_attempt_ids(), which replaces _my_held_attempt_ids().
--   5. create_attempt refuses Learning while the review is closed (Sam:
--      only Learning shuts; the other modes show the summary only);
--      check_answer refuses. Everything else is as 20261015100000.
--   6. save_quiz writes both (an edit that sends no `review` keeps the
--      stored one, and its date). Everything else is as 20261015100000.
--
-- The settings are read live, not copied to a sitting (Sam, 2026-10-15): a
-- change reaches sittings already taken. The admin is never closed out.
--
-- REACH. Dev only; prod at the next release Sam approves. Every row takes
-- 'always', so nothing closes until an admin picks Until or Not allowed.

set search_path = licensure_gh;

-- ── 1. the setting ────────────────────────────────────────────────────
alter table quizzes add column if not exists review text not null default 'always';
alter table quizzes add column if not exists review_closes_at timestamptz;
alter table quizzes drop constraint if exists quizzes_review_check;
alter table quizzes add constraint quizzes_review_check
  check (review in ('always', 'until', 'never')
         and (review = 'until') = (review_closes_at is not null)
         and (results_at is null or review_closes_at is null or review_closes_at > results_at)
         and not (review = 'never' and 'UNTIMED_LEARNING' = any (allowed_modes))
         and not (review = 'until' and first_mode = 'UNTIMED_LEARNING'));

alter table mock_quizzes add column if not exists review text not null default 'always';
alter table mock_quizzes add column if not exists review_closes_at timestamptz;
alter table mock_quizzes drop constraint if exists mock_quizzes_review_check;
alter table mock_quizzes add constraint mock_quizzes_review_check
  check (review in ('always', 'until', 'never')
         and (review = 'until') = (review_closes_at is not null)
         and (results_at is null or review_closes_at is null or review_closes_at > results_at)
         and not (review = 'never' and 'UNTIMED_LEARNING' = any (allowed_modes))
         and not (review = 'until' and first_mode = 'UNTIMED_LEARNING'));

grant select (review, review_closes_at) on quizzes to authenticated;
grant select (review, review_closes_at) on mock_quizzes to authenticated;

-- ── 2. is a sitting's review closed ───────────────────────────────────
create or replace function _quiz_review_closed(p_quiz_id text, p_source text)
returns boolean
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select coalesce((
    select r.review = 'never' or (r.review = 'until' and now() >= r.review_closes_at)
    from (
      select m.review, m.review_closes_at from mock_quizzes m
      where m.quiz_id = p_quiz_id
        and (p_source = 'mock' or (p_source = 'retake' and exists (select 1 from mock_quizzes x where x.quiz_id = p_quiz_id)))
      union all
      select q.review, q.review_closes_at from quizzes q
      where q.quiz_id = p_quiz_id
        and (p_source = 'fixed' or (p_source = 'retake' and not exists (select 1 from mock_quizzes x where x.quiz_id = p_quiz_id)))
    ) r
    limit 1
  ), false)
$$;
revoke execute on function _quiz_review_closed(text, text) from public, anon, authenticated;

-- ── 3. the one reader, with the review ────────────────────────────────
drop function if exists student_attempts(text, text[], text);
create function student_attempts(
  p_user_id     text,
  p_attempt_ids text[] default null,
  p_course_id   text default null
)
returns table (
  attempt_id        text,
  user_id           text,
  quiz_id           text,
  course_id         text,
  mode              text,
  source            text,
  n                 integer,
  seed              text,
  duration_min      integer,
  status            text,
  score_raw         numeric,
  score_total       numeric,
  score_pct         numeric,
  time_taken_s      integer,
  origin_attempt_id text,
  display_label     text,
  ts_iso            timestamptz,
  started_utc       timestamptz,
  ended_utc         timestamptz,
  results_at        timestamptz,
  held              boolean,
  review            text,
  review_closes_at  timestamptz,
  review_closed     boolean
)
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select a.attempt_id, a.user_id, a.quiz_id, a.course_id, a.mode, a.source,
         a.n, a.seed, a.duration_min, a.status,
         case when h.held then null else a.score_raw end,
         case when h.held then null else a.score_total end,
         case when h.held then null else a.score_pct end,
         a.time_taken_s, a.origin_attempt_id, a.display_label,
         a.ts_iso, a.started_utc, a.ended_utc,
         r.results_at, h.held,
         s.review, s.review_closes_at, _quiz_review_closed(a.quiz_id, a.source)
  from attempts a
  cross join lateral (select _quiz_results_at(a.quiz_id, a.source) as results_at) r
  cross join lateral (select coalesce(now() < r.results_at, false) as held) h
  left join lateral (
    select m.review, m.review_closes_at from mock_quizzes m
    where m.quiz_id = a.quiz_id
      and (a.source = 'mock' or (a.source = 'retake' and exists (select 1 from mock_quizzes x where x.quiz_id = a.quiz_id)))
    union all
    select q.review, q.review_closes_at from quizzes q
    where q.quiz_id = a.quiz_id
      and (a.source = 'fixed' or (a.source = 'retake' and not exists (select 1 from mock_quizzes x where x.quiz_id = a.quiz_id)))
    limit 1
  ) s on true
  where a.user_id = p_user_id
    and (p_attempt_ids is null or a.attempt_id = any (p_attempt_ids))
    and (p_course_id is null or a.course_id = p_course_id)
$$;
revoke execute on function student_attempts(text, text[], text) from public, anon, authenticated;

-- ── 4. a closed review's answers stay here ────────────────────────────
create or replace function _my_sealed_attempt_ids()
returns setof text
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select a.attempt_id
  from attempts a
  where a.user_id = auth_user_id()
    and a.status = 'completed'
    and (coalesce(now() < _quiz_results_at(a.quiz_id, a.source), false)
         or _quiz_review_closed(a.quiz_id, a.source))
$$;
revoke execute on function _my_sealed_attempt_ids() from public, anon;
grant execute on function _my_sealed_attempt_ids() to authenticated;

drop policy if exists attempt_items_select on attempt_items;
create policy attempt_items_select on attempt_items for select
using (
  auth_user_role() = 'ADMIN'
  or (
    attempt_id in (select a.attempt_id from attempts a where a.user_id = auth_user_id())
    and attempt_id not in (select h from _my_sealed_attempt_ids() h)
  )
);
drop function if exists _my_held_attempt_ids();


-- ── 5. the start rule ─────────────────────────────────────────────────
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
  v_results_at  timestamptz;
  v_review      text;
  v_review_end  timestamptz;
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
        select m.first_mode, m.sittings_allowed, m.results_at, m.review, m.review_closes_at
        into v_first_mode, v_allowed, v_results_at, v_review, v_review_end
        from mock_quizzes m where m.quiz_id = p_quiz_id;
      else
        select q.first_mode, q.sittings_allowed, q.results_at, q.review, q.review_closes_at
        into v_first_mode, v_allowed, v_results_at, v_review, v_review_end
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

      -- Results on a date (04.12): until then only the first mode, which
      -- shows nothing before the date; another would show the answers.
      if v_results_at is not null and now() < v_results_at
         and v_first_mode is not null and p_mode <> v_first_mode then
        raise exception 'Until its results are out, this % can only be sat in its first mode.', v_word;
      end if;

      -- The review (04.13): while it is closed only Learning shuts — it
      -- shows each answer; the other modes show the summary only (Sam).
      if p_mode = 'UNTIMED_LEARNING'
         and (v_review = 'never' or (v_review = 'until' and now() >= v_review_end)) then
        raise exception 'The answers to this % are not shown any more, so Learning is not open.', v_word;
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

-- ── 5b. Check Answer waits for the date, and stops at the review's close ────────────────────────────────
create or replace function check_answer(p_attempt_item_id bigint, p_user_id text, p_chosen text, p_sata_checked boolean default false)
returns table (
  is_correct boolean, score_awarded numeric,
  correct text, rationale text, rationale_img text,
  fb_a text, fb_b text, fb_c text, fb_d text, fb_e text, fb_f text
)
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_attempt_id text;
  v_status text;
  v_mode text;
  v_quiz_id text;
  v_source text;
begin
  select a.attempt_id, a.status, a.mode, a.quiz_id, a.source into v_attempt_id, v_status, v_mode, v_quiz_id, v_source
  from attempt_items i join attempts a on a.attempt_id = i.attempt_id
  where i.attempt_item_id = p_attempt_item_id and a.user_id = p_user_id;
  if not found then raise exception 'This quiz attempt does not belong to your account.'; end if;
  if v_status <> 'in_progress' then raise exception 'This attempt is no longer in progress.'; end if;
  if v_mode <> 'UNTIMED_LEARNING' then raise exception 'In this mode answers are shown at the end.'; end if;
  if now() < _quiz_results_at(v_quiz_id, v_source) then
    raise exception 'The answers come out with the results.';
  end if;
  if _quiz_review_closed(v_quiz_id, v_source) then
    raise exception 'The answers to this sitting are not shown any more.';
  end if;

  update attempt_items i
  set chosen        = nullif(btrim(p_chosen), ''),
      sata_checked  = coalesce(p_sata_checked, false),
      answered_utc  = case when nullif(btrim(p_chosen), '') is distinct from i.chosen then now() else coalesce(i.answered_utc, now()) end,
      is_correct    = grade_answer(i.question_type, i.correct, nullif(btrim(p_chosen), '')),
      score_awarded = case when grade_answer(i.question_type, i.correct, nullif(btrim(p_chosen), '')) then i.marks else 0 end,
      graded_utc    = now()
  where i.attempt_item_id = p_attempt_item_id;

  return query
  select i.is_correct, i.score_awarded, i.correct, i.rationale, i.rationale_img,
         i.fb_a, i.fb_b, i.fb_c, i.fb_d, i.fb_e, i.fb_f
  from attempt_items i where i.attempt_item_id = p_attempt_item_id;
end;
$$;
revoke execute on function check_answer(bigint, text, text, boolean) from public, anon, authenticated;

-- ── 6. the admin's save ───────────────────────────────────────────────
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
      set (course_id, title, n, allowed_modes, first_mode, sittings_allowed, results_at, review, review_closes_at, shuffle, time_limit_sec, published,
           publish_at, unpublish_at, status, notes, updated_at)
        = (v_course, r.title, v_n, r.allowed_modes, coalesce(r.first_mode, q.first_mode), r.sittings_allowed, r.results_at, coalesce(r.review, q.review), case when r.review is null then q.review_closes_at else r.review_closes_at end, r.shuffle, r.time_limit_sec, r.published,
           r.publish_at, r.unpublish_at, r.status, r.notes, coalesce(r.updated_at, now()))
      from jsonb_populate_record(null::quizzes, p_quiz) as r
      where q.quiz_id = v_quiz_id;
      if not found then
        raise exception 'That quiz no longer exists.';
      end if;
    else
      insert into quizzes (quiz_id, course_id, title, n, allowed_modes, first_mode, sittings_allowed, results_at, review, review_closes_at, shuffle, time_limit_sec,
                           published, publish_at, unpublish_at, status, notes, created_at, updated_at)
      select v_quiz_id, v_course, r.title, v_n, r.allowed_modes, coalesce(r.first_mode, 'TIMED_FREE_NAV'), r.sittings_allowed, r.results_at, coalesce(r.review, 'always'), r.review_closes_at, r.shuffle, r.time_limit_sec,
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
      set (course_id, title, n, allowed_modes, first_mode, sittings_allowed, results_at, review, review_closes_at, shuffle, time_limit_sec, published,
           publish_at, unpublish_at, status, notes, updated_at)
        = (v_course, r.title, v_n, r.allowed_modes, coalesce(r.first_mode, q.first_mode), r.sittings_allowed, r.results_at, coalesce(r.review, q.review), case when r.review is null then q.review_closes_at else r.review_closes_at end, r.shuffle, r.time_limit_sec, r.published,
           r.publish_at, r.unpublish_at, r.status, r.notes, coalesce(r.updated_at, now()))
      from jsonb_populate_record(null::mock_quizzes, p_quiz) as r
      where q.quiz_id = v_quiz_id;
      if not found then
        raise exception 'That mock exam no longer exists.';
      end if;
    else
      insert into mock_quizzes (quiz_id, course_id, title, n, allowed_modes, first_mode, sittings_allowed, results_at, review, review_closes_at, shuffle, time_limit_sec,
                                published, publish_at, unpublish_at, status, notes, created_at, updated_at)
      select v_quiz_id, v_course, r.title, v_n, r.allowed_modes, coalesce(r.first_mode, 'TIMED_FREE_NAV'), r.sittings_allowed, r.results_at, coalesce(r.review, 'always'), r.review_closes_at, r.shuffle, r.time_limit_sec,
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

notify pgrst, 'reload schema';
