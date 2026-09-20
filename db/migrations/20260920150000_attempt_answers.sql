-- 20260920150000_attempt_answers.sql — 03-quiz-system.md Q5, the answers
-- as rows and the write door (rebuild.md §8 S7; D6, D7; Sam's rulings
-- 2026-09-20: one row holds the snapshot and the answer, grading in SQL,
-- every function callable by the service role only)
--
-- Q4 made the questions rows. This file makes the answers rows and shuts
-- the browser's write door. Until now the student's own browser held
-- INSERT and UPDATE on attempts (row-scoped, not column-scoped — a
-- console could set score_pct to 100, D7) and the answers travelled as
-- one JSON string that carried a second copy of the correct answer (D6).
-- From here the answer group on attempt_items is the only record of
-- what the student chose, the browser role holds SELECT and nothing
-- else on every attempt table, and every change goes through one of
-- six functions that take the caller's user id from the Server Action,
-- refuse a row the user does not own or an attempt not in progress, and
-- grade in SQL — the browser never supplies a score.
--
-- The six, plus two helpers:
--   grade_answer()        MCQ / TF by letter, SATA by the exact set
--                         (all-or-nothing through S7; partial credit is
--                         Q7). An empty answer grades as wrong.
--   start_timed_attempt() started_utc set once, returned thereafter —
--                         the second tab loses, the clock never resets.
--   save_answers()        chosen / flagged / sata_checked / time_spent_s
--                         for the rows given, each key optional; never
--                         the graded columns.
--   check_answer()        instant mode's Check Answer: writes the answer,
--                         grades that one row, returns its secret half
--                         (Q6 makes the runner render from it).
--   finish_attempt()      grades EVERY row from its final answer (instant
--                         mode lets a student change an answer after the
--                         reveal, as legacy did — the finish grade is the
--                         truth), sums the header, status completed,
--                         ended_utc = now().
--   expire_attempt()      timed only; refuses while the server's clock
--                         says time is left; closes with ended_utc = the
--                         true deadline and time_taken_s = the full
--                         length, not the moment it was noticed.
--   abandon_attempt()     status abandoned, ended_utc = now(), the rows
--                         kept ("I am not going back to this" is not
--                         "this never happened").
--
-- Then: the answer group backfilled from answers_json for the rows
-- created since Q4 (today's walk), the two blobs dropped, the student
-- INSERT / UPDATE policies dropped with the default "grant all" taken
-- back (D43), CHECKs on the three word columns, started_utc set from
-- the old marker for a timed attempt already started.

set search_path = licensure_gh;

-- ── 1. grading, once ──────────────────────────────────────────────────
create or replace function grade_answer(p_type text, p_correct text, p_chosen text)
returns boolean
language sql
immutable
as $$
  select case
    when p_chosen is null or btrim(p_chosen) = '' then false
    when p_type = 'SATA' then
      (select array_agg(x order by x) from (select distinct btrim(lower(x)) as x from unnest(string_to_array(coalesce(p_correct, ''), ',')) x where btrim(x) <> '') c)
      is not distinct from
      (select array_agg(x order by x) from (select distinct btrim(lower(x)) as x from unnest(string_to_array(p_chosen, ',')) x where btrim(x) <> '') s)
    else lower(btrim(p_chosen)) = lower(btrim(coalesce(p_correct, '')))
  end
$$;
revoke execute on function grade_answer(text, text, text) from public, anon, authenticated;

-- The one close path finish and expire share: grade every row, sum the
-- header, stamp the end. Internal; the two callers check ownership and
-- state first.
create or replace function _close_attempt(p_attempt_id text, p_ended timestamptz, p_time_taken_s integer)
returns table (score_raw numeric, score_total numeric, score_pct numeric)
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_raw numeric;
  v_total numeric;
  v_pct numeric;
begin
  update attempt_items i
  set is_correct    = grade_answer(i.question_type, i.correct, i.chosen),
      score_awarded = case when grade_answer(i.question_type, i.correct, i.chosen) then i.marks else 0 end,
      graded_utc    = p_ended
  where i.attempt_id = p_attempt_id;

  select coalesce(sum(i.score_awarded), 0), coalesce(sum(i.marks), 0)
  into v_raw, v_total
  from attempt_items i where i.attempt_id = p_attempt_id;
  v_pct := case when v_total > 0 then round(v_raw / v_total * 100) else 0 end;

  update attempts a
  set score_raw = v_raw, score_total = v_total, score_pct = v_pct,
      time_taken_s = p_time_taken_s,
      status = 'completed', ended_utc = p_ended
  where a.attempt_id = p_attempt_id;

  return query select v_raw, v_total, v_pct;
end;
$$;
revoke execute on function _close_attempt(text, timestamptz, integer) from public, anon, authenticated;

-- ── 2. the six doors ──────────────────────────────────────────────────
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
  if v_mode <> 'timed' then raise exception 'Only an exam has a clock to start.'; end if;
  if v_status <> 'in_progress' then raise exception 'This exam is no longer in progress.'; end if;
  if v_started is not null then return v_started; end if;

  update attempts a set started_utc = now()
  where a.attempt_id = p_attempt_id and a.started_utc is null;
  select a.started_utc into v_started from attempts a where a.attempt_id = p_attempt_id;
  return v_started;
end;
$$;
revoke execute on function start_timed_attempt(text, text) from public, anon, authenticated;

-- p_rows: [{ "item_id": "...", "chosen": "b" | "a,c" | null, "flagged": true,
--            "sata_checked": false, "time_spent_s": 12 }, …] — every key
-- but item_id optional; a key absent leaves that column alone.
create or replace function save_answers(p_attempt_id text, p_user_id text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_status text;
  v_n integer;
begin
  select a.status into v_status
  from attempts a where a.attempt_id = p_attempt_id and a.user_id = p_user_id;
  if not found then raise exception 'This quiz attempt does not belong to your account.'; end if;
  if v_status <> 'in_progress' then raise exception 'This attempt is no longer in progress.'; end if;

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
begin
  select a.attempt_id, a.status, a.mode into v_attempt_id, v_status, v_mode
  from attempt_items i join attempts a on a.attempt_id = i.attempt_id
  where i.attempt_item_id = p_attempt_item_id and a.user_id = p_user_id;
  if not found then raise exception 'This quiz attempt does not belong to your account.'; end if;
  if v_status <> 'in_progress' then raise exception 'This attempt is no longer in progress.'; end if;
  if v_mode <> 'instant' then raise exception 'Answers are checked at the end of an exam.'; end if;

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

-- p_time_taken_s is the browser's stopwatch for an instant attempt (as
-- legacy); an exam's time is the server clock's distance from
-- started_utc, capped at the exam's length.
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

  if v_mode = 'timed' then
    v_time := case when v_started is null then 0
                   else least(coalesce(v_duration, 0) * 60, greatest(0, floor(extract(epoch from now() - v_started))::integer)) end;
  else
    v_time := p_time_taken_s;
  end if;

  return query select * from _close_attempt(p_attempt_id, now(), v_time);
end;
$$;
revoke execute on function finish_attempt(text, text, integer) from public, anon, authenticated;

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
begin
  select a.status, a.mode, a.started_utc, a.duration_min into v_status, v_mode, v_started, v_duration
  from attempts a where a.attempt_id = p_attempt_id and a.user_id = p_user_id;
  if not found then raise exception 'This quiz attempt does not belong to your account.'; end if;
  if v_status <> 'in_progress' then raise exception 'This exam has already been submitted.'; end if;
  if v_mode <> 'timed' or v_started is null or coalesce(v_duration, 0) <= 0 then
    raise exception 'This attempt has no clock to run out.';
  end if;

  v_deadline := v_started + make_interval(mins => v_duration);
  if now() < v_deadline then raise exception 'This exam has not run out of time yet.'; end if;

  return query select * from _close_attempt(p_attempt_id, v_deadline, v_duration * 60);
end;
$$;
revoke execute on function expire_attempt(text, text) from public, anon, authenticated;

create or replace function abandon_attempt(p_attempt_id text, p_user_id text)
returns void
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_status text;
begin
  select a.status into v_status
  from attempts a where a.attempt_id = p_attempt_id and a.user_id = p_user_id;
  if not found then raise exception 'This quiz attempt does not belong to your account.'; end if;
  if v_status <> 'in_progress' then raise exception 'This attempt is no longer in progress.'; end if;

  update attempts a set status = 'abandoned', ended_utc = now() where a.attempt_id = p_attempt_id;
end;
$$;
revoke execute on function abandon_attempt(text, text) from public, anon, authenticated;

-- ── 3. the rows since Q4 carried over, then the blobs go ──────────────
update attempt_items i
set chosen       = case when jsonb_typeof(r.value -> 'chosen') = 'array'
                        then nullif((select string_agg(x, ',') from jsonb_array_elements_text(r.value -> 'chosen') x), '')
                        else nullif(btrim(r.value ->> 'chosen'), '') end,
    flagged      = coalesce((r.value ->> 'flagged')::boolean, false),
    sata_checked = coalesce((r.value ->> 'sata_checked')::boolean, false),
    is_correct   = case when a.status = 'completed' then coalesce((r.value ->> 'is_correct')::boolean, false) else null end,
    score_awarded = case when a.status = 'completed' then case when coalesce((r.value ->> 'is_correct')::boolean, false) then i.marks else 0 end else null end,
    graded_utc   = case when a.status = 'completed' then a.ts_iso else null end
from attempts a
cross join lateral jsonb_array_elements(case when a.answers_json ~ '^\s*\[' then a.answers_json::jsonb else '[]'::jsonb end) r
where i.attempt_id = a.attempt_id and i.item_id = r.value ->> 'item_id';

update attempts a
set started_utc = a.ts_iso
where a.mode = 'timed' and a.time_taken_s is not null and a.started_utc is null;

update attempts a
set ended_utc = a.ts_iso
where a.status in ('completed', 'abandoned') and a.ended_utc is null;

alter table attempts drop column if exists item_ids;
alter table attempts drop column if exists answers_json;

-- ── 4. the browser's write door, shut ─────────────────────────────────
drop policy if exists attempts_insert on attempts;
drop policy if exists attempts_update on attempts;
revoke all on attempts from anon, authenticated;
grant select on attempts to authenticated;

alter table attempts drop constraint if exists attempts_status_check;
alter table attempts add constraint attempts_status_check check (status in ('in_progress', 'completed', 'abandoned'));
alter table attempts drop constraint if exists attempts_mode_check;
alter table attempts add constraint attempts_mode_check check (mode in ('instant', 'timed'));
alter table attempts drop constraint if exists attempts_source_check;
alter table attempts add constraint attempts_source_check check (source in ('fixed', 'builder', 'retake', 'mock'));

-- create_attempt() wrote the two blobs for the Q4 interval; without them.
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
  v_n integer;
begin
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
    subject, maintopic, subtopic, difficulty
  )
  select
    p_attempt_id, row_number() over (order by ids.ord), q.item_id,
    q.question_type, q.stem, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, q.option_f,
    q.marks, q.shuffle_options,
    q.correct, q.rationale, q.rationale_img, q.fb_a, q.fb_b, q.fb_c, q.fb_d, q.fb_e, q.fb_f,
    q.subject, q.maintopic, q.subtopic, q.difficulty
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
