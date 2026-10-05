-- 20261004160000_student_dashboard.sql — the dashboard's numbers in one
-- read (D2a: 11-pages.md Dashboard, 05 G1a; Sam, 2026-10-04: "go ahead
-- with D2a"). Reads only — no table changes.
--
-- WHY. The redesigned dashboard shows numbers nothing in the app counts
-- yet: the streak, questions met and mastered, the weakest topic, how
-- much of each course's bank the student has met, how far the unfinished
-- sitting has gone, and the recap when a trial or package ends. Counted
-- here, from the answers every sitting already saves, they arrive in one
-- request however long the student's history grows (AGENTS.md rule 10:
-- one row back, not thousands).
--
-- WHAT. student_dashboard(student, courses, recap window) returns one
-- jsonb:
--   streak    current, best, and the last 7 days (oldest first). A study
--             day is one question answered, the calendar day in UTC
--             (Ghana's time). One missed day a week, Monday to Sunday, is
--             forgiven (Sam, 2026-10-03; the week, Sam 2026-10-04); today
--             does not break the streak before it is over. A forgiven day
--             keeps the streak but does not add to it.
--   answered  questions met: different questions answered, ever.
--   mastered  of those, right the first time met — not in under 5 s
--             (05 G1a). An answer saved before engaged seconds were kept
--             (no time) is given the benefit of the doubt.
--   weakest   the topic with the lowest share right, from 20 answers in
--             all and at least 5 in that topic (Sam, 2026-10-04,
--             MyNclex's gate); ties go to the topic with more answers.
--             Null below the gate.
--   courses   for each course asked about, in the order asked: questions
--             met in it, and the published questions in its bank (Sam,
--             2026-10-04: "212 of 1,080 met").
--   carry_on  the latest unfinished sitting and how many of its
--             questions are answered; null when there is none.
--   recap     answers, right answers, finished sittings and up to three
--             topics to work on (at least 5 answers each), inside the
--             window the page passes — the ended trial's or package's
--             days; null when no window is passed.
--
-- Server only: the browser's roles cannot call it; the server passes the
-- student from the sign-in check, as create_attempt does.
--
-- REACH. Dev only, and only the new dashboard reads it; prod at the next
-- release Sam approves.

set search_path = licensure_gh;

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
begin
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
  where a.user_id = p_user_id and ai.answered_utc is not null;

  if v_total >= 20 then
    select jsonb_build_object('course_id', t.course_id, 'topic', t.topic, 'answered', t.n, 'correct', t.c)
    into v_weakest
    from (
      select a.course_id, btrim(ai.maintopic) as topic, count(*) as n, count(*) filter (where ai.is_correct) as c
      from attempt_items ai
      join attempts a on a.attempt_id = ai.attempt_id
      where a.user_id = p_user_id and ai.answered_utc is not null and nullif(btrim(ai.maintopic), '') is not null
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

notify pgrst, 'reload schema';
