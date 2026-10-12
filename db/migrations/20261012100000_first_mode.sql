-- 20261012100000_first_mode.sql — 04-practice.md (04.5), the first sitting of
-- a practice paper; ticked by Sam 2026-10-11, written on `quizzes` and the
-- database's own functions in 12-tables.md
--
-- WHY. The first sitting of a paper is the honest measure of a student, so
-- every first sitting is alike: in the mode the paper names. The paper's
-- other ways (its other allowed modes) open to a student once they have
-- finished that first sitting — submitted, or the time ran out; an
-- abandoned or unfinished sitting does not count (Sam, 2026-10-11).
--
-- WHAT.
--   1. quizzes.first_mode: the mode the first sitting must be in, one of
--      the paper's allowed_modes; TIMED_FREE_NAV on a new paper. Papers
--      already in the table whose allowed_modes lack Free Navigation take
--      the first exam mode they allow, else their first allowed mode (the
--      check below would refuse the rest, and prod's rows are unseen).
--      Students can read the column, as they read allowed_modes.
--   2. create_attempt: a paper's sitting (source 'fixed', or a retake of a
--      paper) in a mode other than its first_mode is refused until the
--      student has a completed sitting of that paper in the first_mode.
--      Every other rule is unchanged (as 20261011100000).
--
-- REACH. Dev only: the live product is the old site; prod takes this at
-- the next release Sam approves. On dev, main's code starts papers in
-- the mode the student picks; a paper's other modes are refused there
-- ("Finish your first sitting ...") until the first sitting is finished,
-- which main's page shows only as an error toast.

set search_path = licensure_gh;

-- ── 1. the column ─────────────────────────────────────────────────────
alter table quizzes add column if not exists first_mode text not null default 'TIMED_FREE_NAV';

update quizzes q
set first_mode = case
    when 'TIMED_FREE_NAV'   = any (q.allowed_modes) then 'TIMED_FREE_NAV'
    when 'TIMED_SEQUENTIAL' = any (q.allowed_modes) then 'TIMED_SEQUENTIAL'
    when 'UNTIMED_TEST'     = any (q.allowed_modes) then 'UNTIMED_TEST'
    else q.allowed_modes[1]
  end
where not (q.first_mode = any (q.allowed_modes));

alter table quizzes drop constraint if exists quizzes_first_mode_check;
alter table quizzes add constraint quizzes_first_mode_check
  check (first_mode = any (allowed_modes));

grant select (first_mode) on quizzes to authenticated;

-- ── 2. the other ways open after the first sitting ────────────────────
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

    -- The first sitting of a paper is in its first_mode; the paper's
    -- other ways open once a sitting in that mode is completed.
    if v_kind = 'paper' then
      select q.first_mode into v_first_mode from quizzes q where q.quiz_id = p_quiz_id;
      if v_first_mode is not null and p_mode <> v_first_mode
         and not exists (
           select 1 from attempts a
           where a.user_id = p_user_id and a.quiz_id = p_quiz_id
             and a.mode = v_first_mode and a.status = 'completed') then
        raise exception 'Finish your first sitting of this paper before the other ways open.';
      end if;
    end if;

    if v_kind = 'mock' and not v_mocks then
      raise exception 'Mock exams aren''t included in your package.';
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
