-- 20261015100000_results_at.sql — 04-practice.md (04.12), results on a date;
-- ticked by Sam 2026-10-14 on `quizzes` and `mock_quizzes` in 12-tables.md,
-- built 2026-10-15 (Sam: the number of sittings stays the admin's; while
-- results are held only the first mode is sat).
--
-- WHY. A mock reused across groups needs its answers kept from the next
-- group, and papers and mocks carry the same settings (Sam, 2026-10-13). An
-- admin may hold a paper's or a mock's results until a date: until then no
-- student sees a score, a report, a right or wrong mark or an explanation
-- from any sitting of it, however many times they sit it.
--
-- WHAT.
--   1. quizzes.results_at and mock_quizzes.results_at: a date and time;
--      empty = Immediately (every row today). With a date, the first
--      sitting must be in an exam mode (a check). Students read it.
--   2. _quiz_results_at(quiz, source): a sitting's paper or mock and its
--      date — by source, a retake by whether its quiz is a mock (as
--      create_attempt finds a retake's kind). Internal.
--   3. student_attempts(student, ids, course): a student's sittings with the
--      score empty while their paper's results are held, the date, and
--      held. Server only, as student_dashboard: every student page reads
--      sittings through it.
--   4. attempts: the browser's roles lose the three score columns (every
--      other column stays readable to the owner and an admin).
--   5. attempt_items: a finished sitting whose results are held is not
--      readable by its owner's role (its right and wrong marks stay here),
--      through _my_held_attempt_ids(), which the policy calls.
--   6. create_attempt: while results are held, a sitting in a mode other
--      than the first is refused (a retake too). Everything else is as
--      20261014100000.
--   7. check_answer: refused while results are held (a Learning sitting
--      begun before the admin set a date). Everything else is as
--      20260927140000.
--   8. student_dashboard: questions met and mastered, the weakest topic and
--      the recap leave out the sittings whose results are held; the streak
--      and each course's questions met keep them. Everything else is as
--      20261004160000.
--   9. save_quiz writes results_at for both kinds (empty clears it).
--      Everything else is as 20261014100000.
--
-- Held: results_at is set and now() < results_at. A sitting submitted after
-- the date is not held. The admin's pages read the table with the service
-- role and see every score.
--
-- REACH. Dev only: the live product is the old site; prod takes this at the
-- next release Sam approves. No row has a date, so no result is held. But
-- main's code on the dev site reads `attempts` with `select('*')` through the
-- student's sign-in, which the narrowed grant refuses: its paper and mock
-- lists, Learning History, reports and the admin's Attempts page fail there
-- until the merge.

set search_path = licensure_gh;

-- ── 1. the date ───────────────────────────────────────────────────────
alter table quizzes add column if not exists results_at timestamptz;
alter table quizzes drop constraint if exists quizzes_results_at_check;
alter table quizzes add constraint quizzes_results_at_check
  check (results_at is null or first_mode in ('TIMED_FREE_NAV', 'TIMED_SEQUENTIAL'));

alter table mock_quizzes add column if not exists results_at timestamptz;
alter table mock_quizzes drop constraint if exists mock_quizzes_results_at_check;
alter table mock_quizzes add constraint mock_quizzes_results_at_check
  check (results_at is null or first_mode in ('TIMED_FREE_NAV', 'TIMED_SEQUENTIAL'));

grant select (results_at) on quizzes to authenticated;
grant select (results_at) on mock_quizzes to authenticated;

-- ── 2. a sitting's date ───────────────────────────────────────────────
create or replace function _quiz_results_at(p_quiz_id text, p_source text)
returns timestamptz
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select case
    when p_quiz_id is null then null
    when p_source = 'mock' then (select m.results_at from mock_quizzes m where m.quiz_id = p_quiz_id)
    when p_source = 'fixed' then (select q.results_at from quizzes q where q.quiz_id = p_quiz_id)
    when p_source = 'retake' then
      case when exists (select 1 from mock_quizzes m where m.quiz_id = p_quiz_id)
           then (select m.results_at from mock_quizzes m where m.quiz_id = p_quiz_id)
           else (select q.results_at from quizzes q where q.quiz_id = p_quiz_id) end
    else null
  end
$$;
revoke execute on function _quiz_results_at(text, text) from public, anon, authenticated;

-- ── 3. the one reader of a student's sittings ─────────────────────────
create or replace function student_attempts(
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
  held              boolean
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
         r.results_at, h.held
  from attempts a
  cross join lateral (select _quiz_results_at(a.quiz_id, a.source) as results_at) r
  cross join lateral (select coalesce(now() < r.results_at, false) as held) h
  where a.user_id = p_user_id
    and (p_attempt_ids is null or a.attempt_id = any (p_attempt_ids))
    and (p_course_id is null or a.course_id = p_course_id)
$$;
revoke execute on function student_attempts(text, text[], text) from public, anon, authenticated;

-- ── 4. the score leaves the browser's reach ───────────────────────────
revoke all on attempts from anon, authenticated;
grant select (
  attempt_id, user_id, quiz_id, course_id, mode, source, n, seed, duration_min, status,
  time_taken_s, origin_attempt_id, display_label, ts_iso, started_utc, ended_utc
) on attempts to authenticated;

-- ── 5. a held sitting's answers stay here ─────────────────────────────
-- The policy runs as the student, who cannot read results_at on a closed
-- or unpublished paper; this function reads it as the owner. It returns
-- only the caller's own sittings, so the student's role keeps EXECUTE.
create or replace function _my_held_attempt_ids()
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
    and now() < _quiz_results_at(a.quiz_id, a.source)
$$;
revoke execute on function _my_held_attempt_ids() from public, anon;
grant execute on function _my_held_attempt_ids() to authenticated;

drop policy if exists attempt_items_select on attempt_items;
create policy attempt_items_select on attempt_items for select
using (
  auth_user_role() = 'ADMIN'
  or (
    attempt_id in (select a.attempt_id from attempts a where a.user_id = auth_user_id())
    and attempt_id not in (select h from _my_held_attempt_ids() h)
  )
);

-- ── 6. the start rule ─────────────────────────────────────────────────
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
        select m.first_mode, m.sittings_allowed, m.results_at into v_first_mode, v_allowed, v_results_at
        from mock_quizzes m where m.quiz_id = p_quiz_id;
      else
        select q.first_mode, q.sittings_allowed, q.results_at into v_first_mode, v_allowed, v_results_at
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

-- ── 7. Check Answer waits for the date ────────────────────────────────
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

-- ── 8. the dashboard waits too ────────────────────────────────────────
create or replace function student_dashboard(
  p_user_id    text,
  p_course_ids text[],
  p_recap_from timestamptz default null,
  p_recap_to   timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = licensure_gh
as $$
declare
  v_today    date := (now() at time zone 'UTC')::date;
  v_days     date[];
  v_d        date;
  v_run      integer := 0;
  v_best     integer := 0;
  v_forgiven date;   -- the Monday of the week whose one forgiven day is used
  v_streak   jsonb;
  v_answered integer := 0;
  v_mastered integer := 0;
  v_total    integer := 0;
  v_weakest  jsonb;
  v_courses  jsonb;
  v_carry    jsonb;
  v_recap    jsonb;
  v_held     text[];   -- the sittings whose results are held (04.12)
begin
  select coalesce(array_agg(a.attempt_id), '{}'::text[])
  into v_held
  from attempts a
  where a.user_id = p_user_id
    and now() < _quiz_results_at(a.quiz_id, a.source);

  -- ── the streak ──────────────────────────────────────────────────────
  select array_agg(distinct (ai.answered_utc at time zone 'UTC')::date order by (ai.answered_utc at time zone 'UTC')::date)
  into v_days
  from attempt_items ai
  join attempts a on a.attempt_id = ai.attempt_id
  where a.user_id = p_user_id and ai.answered_utc is not null;

  if v_days is not null then
    v_d := v_days[1];
    while v_d <= v_today loop
      if v_d = any (v_days) then
        v_run := v_run + 1;
        v_best := greatest(v_best, v_run);
      elsif v_d = v_today then
        null;  -- today is not over yet
      elsif v_run > 0 and v_forgiven is distinct from date_trunc('week', v_d)::date then
        v_forgiven := date_trunc('week', v_d)::date;  -- this week's one forgiven day
      else
        v_run := 0;
      end if;
      v_d := v_d + 1;
    end loop;
  end if;

  v_streak := jsonb_build_object(
    'current', v_run,
    'best', v_best,
    'days', (
      select jsonb_agg((g.d::date = any (coalesce(v_days, '{}'::date[]))) order by g.d)
      from generate_series(v_today - 6, v_today, interval '1 day') as g(d)
    )
  );

  -- ── questions met and mastered ──────────────────────────────────────
  with firsts as (
    select distinct on (ai.item_id) ai.is_correct, ai.time_spent_s
    from attempt_items ai
    join attempts a on a.attempt_id = ai.attempt_id
    where a.user_id = p_user_id and ai.answered_utc is not null
      and not (a.attempt_id = any (v_held))
    order by ai.item_id, ai.answered_utc, ai.attempt_item_id
  )
  select count(*), count(*) filter (where is_correct and coalesce(time_spent_s, 5) >= 5)
  into v_answered, v_mastered
  from firsts;

  -- ── the weakest topic ───────────────────────────────────────────────
  select count(*)
  into v_total
  from attempt_items ai
  join attempts a on a.attempt_id = ai.attempt_id
  where a.user_id = p_user_id and ai.answered_utc is not null
    and not (a.attempt_id = any (v_held));

  if v_total >= 20 then
    select jsonb_build_object('course_id', t.course_id, 'topic', t.topic, 'answered', t.n, 'correct', t.c)
    into v_weakest
    from (
      select a.course_id, btrim(ai.maintopic) as topic, count(*) as n, count(*) filter (where ai.is_correct) as c
      from attempt_items ai
      join attempts a on a.attempt_id = ai.attempt_id
      where a.user_id = p_user_id and ai.answered_utc is not null and nullif(btrim(ai.maintopic), '') is not null
        and not (a.attempt_id = any (v_held))
      group by a.course_id, btrim(ai.maintopic)
      having count(*) >= 5
    ) t
    order by t.c::numeric / t.n, t.n desc, t.topic
    limit 1;
  end if;

  -- ── each course: questions met of its bank ──────────────────────────
  select coalesce(jsonb_agg(jsonb_build_object(
           'course_id', c.course_id,
           'met', (
             select count(distinct ai.item_id)
             from attempt_items ai
             join attempts a on a.attempt_id = ai.attempt_id
             where a.user_id = p_user_id and a.course_id = c.course_id and ai.answered_utc is not null
           ),
           'bank', (select count(*) from question_bank q where q.course_id = c.course_id and q.is_published)
         ) order by c.ord), '[]'::jsonb)
  into v_courses
  from unnest(coalesce(p_course_ids, '{}'::text[])) with ordinality as c(course_id, ord);

  -- ── the unfinished sitting ──────────────────────────────────────────
  select jsonb_build_object(
           'attempt_id', a.attempt_id,
           'course_id', a.course_id,
           'quiz_id', a.quiz_id,
           'source', a.source,
           'mode', a.mode,
           'display_label', a.display_label,
           'n', a.n,
           'answered', (select count(*) from attempt_items ai where ai.attempt_id = a.attempt_id and ai.answered_utc is not null)
         )
  into v_carry
  from attempts a
  where a.user_id = p_user_id and a.status = 'in_progress'
  order by a.ts_iso desc
  limit 1;

  -- ── the recap of an ended trial or package ──────────────────────────
  if p_recap_from is not null and p_recap_to is not null then
    with ans as (
      select a.course_id, nullif(btrim(ai.maintopic), '') as topic, ai.is_correct
      from attempt_items ai
      join attempts a on a.attempt_id = ai.attempt_id
      where a.user_id = p_user_id
        and ai.answered_utc >= p_recap_from and ai.answered_utc < p_recap_to
        and not (a.attempt_id = any (v_held))
    )
    select jsonb_build_object(
             'answered', (select count(*) from ans),
             'correct', (select count(*) from ans where is_correct),
             'quizzes', (
               select count(*) from attempts a2
               where a2.user_id = p_user_id and a2.status = 'completed'
                 and a2.ts_iso >= p_recap_from and a2.ts_iso < p_recap_to
             ),
             'topics', (
               select coalesce(jsonb_agg(jsonb_build_object('course_id', t.course_id, 'topic', t.topic) order by t.acc, t.n desc, t.topic), '[]'::jsonb)
               from (
                 select course_id, topic, count(*) as n, count(*) filter (where is_correct)::numeric / count(*) as acc
                 from ans
                 where topic is not null
                 group by course_id, topic
                 having count(*) >= 5
                 order by acc, n desc, topic
                 limit 3
               ) t
             )
           )
    into v_recap;
  end if;

  return jsonb_build_object(
    'streak', v_streak,
    'answered', v_answered,
    'mastered', v_mastered,
    'weakest', v_weakest,
    'courses', v_courses,
    'carry_on', v_carry,
    'recap', v_recap
  );
end;
$$;
revoke execute on function student_dashboard(text, text[], timestamptz, timestamptz) from public, anon, authenticated;

-- ── 9. the admin's save ───────────────────────────────────────────────
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
      set (course_id, title, n, allowed_modes, first_mode, sittings_allowed, results_at, shuffle, time_limit_sec, published,
           publish_at, unpublish_at, status, notes, updated_at)
        = (v_course, r.title, v_n, r.allowed_modes, coalesce(r.first_mode, q.first_mode), r.sittings_allowed, r.results_at, r.shuffle, r.time_limit_sec, r.published,
           r.publish_at, r.unpublish_at, r.status, r.notes, coalesce(r.updated_at, now()))
      from jsonb_populate_record(null::quizzes, p_quiz) as r
      where q.quiz_id = v_quiz_id;
      if not found then
        raise exception 'That quiz no longer exists.';
      end if;
    else
      insert into quizzes (quiz_id, course_id, title, n, allowed_modes, first_mode, sittings_allowed, results_at, shuffle, time_limit_sec,
                           published, publish_at, unpublish_at, status, notes, created_at, updated_at)
      select v_quiz_id, v_course, r.title, v_n, r.allowed_modes, coalesce(r.first_mode, 'TIMED_FREE_NAV'), r.sittings_allowed, r.results_at, r.shuffle, r.time_limit_sec,
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
      set (course_id, title, n, allowed_modes, first_mode, sittings_allowed, results_at, shuffle, time_limit_sec, published,
           publish_at, unpublish_at, status, notes, updated_at)
        = (v_course, r.title, v_n, r.allowed_modes, coalesce(r.first_mode, q.first_mode), r.sittings_allowed, r.results_at, r.shuffle, r.time_limit_sec, r.published,
           r.publish_at, r.unpublish_at, r.status, r.notes, coalesce(r.updated_at, now()))
      from jsonb_populate_record(null::mock_quizzes, p_quiz) as r
      where q.quiz_id = v_quiz_id;
      if not found then
        raise exception 'That mock exam no longer exists.';
      end if;
    else
      insert into mock_quizzes (quiz_id, course_id, title, n, allowed_modes, first_mode, sittings_allowed, results_at, shuffle, time_limit_sec,
                                published, publish_at, unpublish_at, status, notes, created_at, updated_at)
      select v_quiz_id, v_course, r.title, v_n, r.allowed_modes, coalesce(r.first_mode, 'TIMED_FREE_NAV'), r.sittings_allowed, r.results_at, r.shuffle, r.time_limit_sec,
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
