-- 20261015140000_at_the_close.sql — 04-practice.md (04.14), when a paper
-- or mock closes; ruled 2026-10-13/14, the rest by Sam on 2026-10-15 ("a
-- sitting with no answer at the close is Abandoned, and an exam that was
-- never started can't start after the close"). No column (12-tables.md,
-- `quizzes`, the 04.14 line).
--
-- WHY. After the close no new sitting starts, but a sitting already going
-- went on for ever: Resume in Learning History opened it, and an untimed
-- one could be answered weeks later. Ruled: a timed sitting started before
-- the close runs to the end of its own clock; any other sitting going is
-- finished at the close, on what was answered — the next time it is
-- opened or an answer is saved.
--
-- WHAT.
--   1. _quiz_closes_at(quiz, source): the paper's or mock's unpublish_at,
--      found as _quiz_results_at() finds the results date. Internal.
--   2. _sitting_close_due(attempt): the close a sitting going is due to be
--      finished at — its paper or mock has closed, and it has no clock
--      running (an untimed mode, or an exam whose Start was never pressed).
--      Null otherwise. Internal.
--   3. _refuse_past_close(attempt): "This paper has closed." /
--      "This mock has closed." — the words the server's code recognises.
--      save_answers, check_answer, finish_attempt and start_timed_attempt
--      refuse with it; everything else in them is as before.
--   4. _close_at_close(attempt, close): finished at the close (no earlier
--      than the sitting began) and scored on the answers saved, its time
--      the sum of its questions' times (03 Q11); with no answer saved,
--      Abandoned at the close instead — not scored, still a sitting (Sam).
--   5. expire_attempt: the sitting's time is up — its exam clock, as
--      before, or its paper's close. The session page calls it on open.
--   6. student_attempts() returns closes_at as well (its type changes, so
--      it is dropped and made again; columns added only).
--
-- REACH. Dev only; prod at the next release Sam approves. On the dev site
-- (main's code) an answer saved to a sitting of a closed paper is refused.

set search_path = licensure_gh;

-- ── 1. the close ──────────────────────────────────────────────────────
create or replace function _quiz_closes_at(p_quiz_id text, p_source text)
returns timestamptz
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select case
    when p_quiz_id is null then null
    when p_source = 'mock' then (select m.unpublish_at from mock_quizzes m where m.quiz_id = p_quiz_id)
    when p_source = 'fixed' then (select q.unpublish_at from quizzes q where q.quiz_id = p_quiz_id)
    when p_source = 'retake' then
      case when exists (select 1 from mock_quizzes m where m.quiz_id = p_quiz_id)
           then (select m.unpublish_at from mock_quizzes m where m.quiz_id = p_quiz_id)
           else (select q.unpublish_at from quizzes q where q.quiz_id = p_quiz_id) end
    else null
  end
$$;
revoke execute on function _quiz_closes_at(text, text) from public, anon, authenticated;

-- ── 2. is a sitting due to be finished at the close ───────────────────
create or replace function _sitting_close_due(p_attempt_id text)
returns timestamptz
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select c.closes_at
  from attempts a
  cross join lateral (select _quiz_closes_at(a.quiz_id, a.source) as closes_at) c
  where a.attempt_id = p_attempt_id
    and a.status = 'in_progress'
    and c.closes_at is not null
    and c.closes_at < now()
    and not (a.mode in ('TIMED_FREE_NAV', 'TIMED_SEQUENTIAL') and a.started_utc is not null)
$$;
revoke execute on function _sitting_close_due(text) from public, anon, authenticated;

-- ── 3. the refusal ────────────────────────────────────────────────────
create or replace function _refuse_past_close(p_attempt_id text)
returns void
language plpgsql
stable
security definer
set search_path = licensure_gh
as $$
begin
  if _sitting_close_due(p_attempt_id) is not null then
    raise exception 'This % has closed.',
      case when exists (select 1 from attempts a join mock_quizzes m on m.quiz_id = a.quiz_id
                        where a.attempt_id = p_attempt_id)
           then 'mock' else 'paper' end;
  end if;
end;
$$;
revoke execute on function _refuse_past_close(text) from public, anon, authenticated;

-- ── 4. finished, or abandoned, at the close ───────────────────────────
create or replace function _close_at_close(p_attempt_id text, p_close timestamptz)
returns table (score_raw numeric, score_total numeric, score_pct numeric)
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_ended timestamptz;
  v_time  integer;
begin
  select greatest(p_close, a.ts_iso) into v_ended from attempts a where a.attempt_id = p_attempt_id;

  if not exists (
    select 1 from attempt_items i
    where i.attempt_id = p_attempt_id and i.chosen is not null and btrim(i.chosen) <> ''
  ) then
    update attempts a set status = 'abandoned', ended_utc = v_ended where a.attempt_id = p_attempt_id;
    return;
  end if;

  select coalesce(sum(i.time_spent_s), 0)::integer into v_time
  from attempt_items i where i.attempt_id = p_attempt_id;
  return query select * from _close_attempt(p_attempt_id, v_ended, v_time);
end;
$$;
revoke execute on function _close_at_close(text, timestamptz) from public, anon, authenticated;

-- ── 5. the doors ──────────────────────────────────────────────────────
-- expire_attempt: an exam's clock, as before, or the paper's close.
create or replace function expire_attempt(p_attempt_id text, p_user_id text)
returns table (score_raw numeric, score_total numeric, score_pct numeric)
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_status text;
  v_mode text;
  v_started timestamptz;
  v_duration integer;
  v_deadline timestamptz;
  v_close timestamptz;
begin
  select a.status, a.mode, a.started_utc, a.duration_min into v_status, v_mode, v_started, v_duration
  from attempts a where a.attempt_id = p_attempt_id and a.user_id = p_user_id;
  if not found then raise exception 'This quiz attempt does not belong to your account.'; end if;
  if v_status <> 'in_progress' then raise exception 'This exam has already been submitted.'; end if;

  v_close := _sitting_close_due(p_attempt_id);
  if v_close is not null then
    return query select * from _close_at_close(p_attempt_id, v_close);
    return;
  end if;

  if v_mode not in ('TIMED_FREE_NAV', 'TIMED_SEQUENTIAL') or v_started is null or coalesce(v_duration, 0) <= 0 then
    raise exception 'This attempt has no clock to run out.';
  end if;

  v_deadline := v_started + make_interval(mins => v_duration);
  if now() < v_deadline then raise exception 'This exam has not run out of time yet.'; end if;

  return query select * from _close_attempt(p_attempt_id, v_deadline, v_duration * 60);
end;
$$;
revoke execute on function expire_attempt(text, text) from public, anon, authenticated;

-- save_answers: as 20260927160000, and nothing saved past the close.
create or replace function save_answers(p_attempt_id text, p_user_id text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_status   text;
  v_mode     text;
  v_started  timestamptz;
  v_duration integer;
  v_current  text;
  v_n        integer;
begin
  select a.status, a.mode, a.started_utc, a.duration_min into v_status, v_mode, v_started, v_duration
  from attempts a where a.attempt_id = p_attempt_id and a.user_id = p_user_id;
  if not found then raise exception 'This quiz attempt does not belong to your account.'; end if;
  if v_status <> 'in_progress' then raise exception 'This attempt is no longer in progress.'; end if;
  perform _refuse_past_close(p_attempt_id);
  if _exam_time_up(v_mode, v_started, v_duration) then raise exception 'This exam has run out of time.'; end if;

  if v_mode = 'TIMED_SEQUENTIAL' then
    select i.item_id into v_current
    from attempt_items i
    where i.attempt_id = p_attempt_id and i.passed_utc is null
    order by i.position
    limit 1;
    if exists (
      select 1 from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
      where v_current is null or (r.value ->> 'item_id') is distinct from v_current
    ) then
      raise exception 'In a sequential exam only the current question can be answered.';
    end if;
  end if;

  update attempt_items i
  set chosen       = case when r.value ? 'chosen' then nullif(btrim(r.value ->> 'chosen'), '') else i.chosen end,
      flagged      = case when r.value ? 'flagged' then coalesce((r.value ->> 'flagged')::boolean, false) else i.flagged end,
      sata_checked = case when r.value ? 'sata_checked' then coalesce((r.value ->> 'sata_checked')::boolean, false) else i.sata_checked end,
      time_spent_s = case when r.value ? 'time_spent_s' then (r.value ->> 'time_spent_s')::integer else i.time_spent_s end,
      answered_utc = case when r.value ? 'chosen' and nullif(btrim(r.value ->> 'chosen'), '') is distinct from i.chosen then now() else i.answered_utc end
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  where i.attempt_id = p_attempt_id and i.item_id = r.value ->> 'item_id';

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function save_answers(text, text, jsonb) from public, anon, authenticated;

-- finish_attempt: as 20260927160000, and Submit past the close is
-- refused — the session page then finishes the sitting at the close.
create or replace function finish_attempt(p_attempt_id text, p_user_id text, p_time_taken_s integer)
returns table (score_raw numeric, score_total numeric, score_pct numeric)
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_status text;
  v_mode text;
  v_started timestamptz;
  v_duration integer;
  v_time integer;
begin
  select a.status, a.mode, a.started_utc, a.duration_min into v_status, v_mode, v_started, v_duration
  from attempts a where a.attempt_id = p_attempt_id and a.user_id = p_user_id;
  if not found then raise exception 'This quiz attempt does not belong to your account.'; end if;
  if v_status <> 'in_progress' then raise exception 'This attempt has already been submitted.'; end if;
  perform _refuse_past_close(p_attempt_id);

  if _exam_time_up(v_mode, v_started, v_duration) then
    return query select * from _close_attempt(p_attempt_id, v_started + make_interval(mins => v_duration), v_duration * 60);
    return;
  end if;

  if v_mode in ('TIMED_FREE_NAV', 'TIMED_SEQUENTIAL') then
    v_time := case when v_started is null then 0
                   else least(coalesce(v_duration, 0) * 60, greatest(0, floor(extract(epoch from now() - v_started))::integer)) end;
  else
    v_time := p_time_taken_s;
  end if;

  return query select * from _close_attempt(p_attempt_id, now(), v_time);
end;
$$;
revoke execute on function finish_attempt(text, text, integer) from public, anon, authenticated;

-- start_timed_attempt: as 20260927140000, and no clock starts past the
-- close (Sam: an exam never started cannot start after it).
create or replace function start_timed_attempt(p_attempt_id text, p_user_id text)
returns timestamptz
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_started timestamptz;
  v_status text;
  v_mode text;
begin
  select a.status, a.mode, a.started_utc into v_status, v_mode, v_started
  from attempts a where a.attempt_id = p_attempt_id and a.user_id = p_user_id;
  if not found then raise exception 'This quiz attempt does not belong to your account.'; end if;
  if v_mode not in ('TIMED_FREE_NAV', 'TIMED_SEQUENTIAL') then raise exception 'Only an exam has a clock to start.'; end if;
  if v_status <> 'in_progress' then raise exception 'This exam is no longer in progress.'; end if;
  if v_started is not null then return v_started; end if;
  perform _refuse_past_close(p_attempt_id);

  update attempts a set started_utc = now()
  where a.attempt_id = p_attempt_id and a.started_utc is null;
  select a.started_utc into v_started from attempts a where a.attempt_id = p_attempt_id;
  return v_started;
end;
$$;
revoke execute on function start_timed_attempt(text, text) from public, anon, authenticated;

-- check_answer: as 20261015120000, and no check past the close.
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
  perform _refuse_past_close(v_attempt_id);
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

-- ── 6. the one reader, with the close ─────────────────────────────────
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
  review_closed     boolean,
  closes_at         timestamptz
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
         s.review, s.review_closes_at, _quiz_review_closed(a.quiz_id, a.source),
         _quiz_closes_at(a.quiz_id, a.source)
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

notify pgrst, 'reload schema';
