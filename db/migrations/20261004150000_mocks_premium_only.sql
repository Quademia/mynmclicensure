-- 20261004150000_mocks_premium_only.sql — 02-packages-and-payments.md
-- 02.10 (Sam, 2026-10-04: "the most important thing is that mock is for
-- premium prep products"; "go ahead with 02.10"); ticked 2026-10-04,
-- written on products.allow_mocks in 12-tables.md
--
-- WHY. F4a (20261004120000) gave every paid package and Free Full Access
-- mocks: yes. Mock exams are seasonal, built for the main sitting, and
-- with the premium channel they are what Premium Prep has and Full
-- Access does not — so only the packages marked premium open them.
--
-- WHAT.
--   1. products.allow_mocks takes its package's premium mark: the
--      Premium Prep packages yes; Full Access, the single courses, the
--      General Paper and Free Full Access no (the trials were already no).
--      A new package starts without.
--   2. The mark leads: a package added, or a package whose premium tick
--      is changed, takes allow_mocks from the tick — the admin's existing
--      form needs no new field. A save that leaves the tick as it was
--      leaves allow_mocks alone. (03.1 gives the form the four limits; if
--      mocks ever need setting apart from the tick, that is where.)
--   3. create_attempt's refusal reads for a student who holds a package
--      without mocks: "Mock exams aren't included in your package."
-- Receipts are not touched: each keeps the copy it was written with, so
-- a package already bought keeps its mocks (bought means kept); grants
-- written from now on copy the new value.
--
-- REACH. Dev only: the live product is the old site; prod takes this at
-- the next release Sam approves. On dev, main's code calls create_attempt
-- with the same arguments; only the refusal's words change.

set search_path = licensure_gh;

-- ── 1. each package's mocks follow its premium mark ───────────────────
alter table products alter column allow_mocks set default false;

update products
set allow_mocks = is_premium
where allow_mocks is distinct from is_premium;

-- ── 2. the mark leads ─────────────────────────────────────────────────
create or replace function products_mocks_follow_premium()
returns trigger
language plpgsql
set search_path = licensure_gh
as $$
begin
  if tg_op = 'INSERT' or new.is_premium is distinct from old.is_premium then
    new.allow_mocks := coalesce(new.is_premium, false);
  end if;
  return new;
end;
$$;
revoke execute on function products_mocks_follow_premium() from public, anon, authenticated;

drop trigger if exists products_mocks_follow_premium on products;
create trigger products_mocks_follow_premium
  before insert or update of is_premium on products
  for each row execute function products_mocks_follow_premium();

-- ── 3. the refusal's words ────────────────────────────────────────────
-- As 20261004130000_free_set_doors.sql, the mock refusal's sentence apart.
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
       or coalesce(array_length(p_item_ids, 1), 0) = 0
       or exists (
         select 1
         from unnest(p_item_ids) as i(item_id)
         left join question_bank q on q.item_id = i.item_id and q.course_id = p_course_id
         where q.item_id is null or not q.is_published or not q.is_free_sample)
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

    -- Builder quizzes: unlimited on any grant without a count; otherwise
    -- a grant still has room when the student's builder sittings in its
    -- courses since it began are fewer than its count.
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
      if not v_builder_ok then
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

notify pgrst, 'reload schema';
