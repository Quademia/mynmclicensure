-- 20261011100000_free_builder.sql — 04-practice.md, The Quiz Builder
-- (04.4; Sam, 2026-10-11: "go", decision 4 "b"); ticked 2026-10-11,
-- written on the database's own functions in 12-tables.md
--
-- WHY. The Quiz Builder's redesign opens the builder to every status
-- through one door. Two rules underneath it were short:
--   - A trial student who has built their 3 quizzes still holds the
--     trial's courses, so create_attempt took them as a grant holder and
--     refused every builder quiz — free questions too — until the trial
--     ended: less than a free account gets (Sam: b, they carry on with
--     the free questions).
--   - The keyword matched anywhere inside a word ("iron" found
--     "environment", "BP" every word holding those letters), so its
--     "N questions contain …" counted questions not about the word; and
--     it answered with every matching question, so a free student's
--     search came back with ids from outside the free set.
--
-- WHAT.
--   1. create_attempt: when a grant's builder count is used up, a builder
--      quiz whose questions are all published free questions of that
--      course, in a Study mode (Learning or Untimed practice), is still
--      allowed — the free account's own door, at the same rule. Anything
--      else keeps "You have used all the Quiz Builder quizzes in your
--      package." Every other rule is unchanged (as 20261004150000).
--   2. search_question_bank_ids: the word is matched from the start of a
--      word (Postgres's \m), in the question, its rationale, its main
--      topic or its subtopic, case ignored; "malar" finds malaria and
--      malarial, not antimalarial — the price of "iron" not finding
--      environment (Sam: start of a word). Spaces in the query match any
--      run of spaces; every other character is matched as itself. A third
--      argument, p_free_only (default false), answers with the free
--      questions only. The old two-argument function is dropped so a
--      call by name has one match; the pack builder's call (two named
--      arguments) is unchanged and gets the new matching.
--
-- REACH. Dev only: the live product is the old site; prod takes this at
-- the next release Sam approves. On dev, main's code calls both functions
-- with the same arguments; a trial student past 3 quizzes is allowed a
-- free quiz there too, and the old builder's Concept search matches from
-- the start of a word.

set search_path = licensure_gh;

-- ── 1. a used-up builder count leaves the free questions open ─────────
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

-- ── 2. the keyword, from the start of a word; the free set alone ──────
-- SECURITY INVOKER, called by the service role (lib/bank/queries.ts)
-- after the caller's own gate; its ids reach the browser bare, so the
-- drafts stay out and, for a free student, everything not free.
drop function if exists search_question_bank_ids(text, text);
create or replace function search_question_bank_ids(p_course_id text, p_query text, p_free_only boolean default false)
returns table (item_id text)
language sql
stable
set search_path = licensure_gh
as $$
  with pat as (
    -- every character but letters, digits and spaces matched as itself;
    -- a run of spaces as any run of spaces; anchored at a word's start
    select '\m' || regexp_replace(
             regexp_replace(btrim(coalesce(p_query, '')), '([^[:alnum:][:space:]])', '\\\1', 'g'),
             '\s+', '\\s+', 'g') as re
  )
  select q.item_id
  from question_bank q, pat
  where q.course_id = p_course_id
    and q.is_published
    and (not p_free_only or q.is_free_sample)
    and btrim(coalesce(p_query, '')) <> ''
    and (
      coalesce(q.subtopic, '') ~* pat.re
      or coalesce(q.maintopic, '') ~* pat.re
      or coalesce(q.stem, '') ~* pat.re
      or coalesce(q.rationale, '') ~* pat.re
    )
  order by q.item_id
$$;
revoke all on function search_question_bank_ids(text, text, boolean) from public, anon, authenticated;

notify pgrst, 'reload schema';
