-- 20260927160000_exam_deadline.sql — rebuild.md §8 S22 (Sam, 2026-09-27:
-- "do the deadline fix now"), found building S21 / 03 Q8
--
-- WHY. An exam's clock is the server's — started_utc plus duration_min —
-- but only expire_attempt and (since S21) advance_attempt read it.
-- save_answers took an answer at any time while the sitting was in
-- progress and finish_attempt closed a sitting whenever it was called,
-- grading every answer saved. So a student who blocked the browser's
-- auto-submit could keep answering after time was up, then submit, and
-- the late answers counted. Since 03 Q5; on prod since its release.
--
-- WHAT. For the two TIMED_ modes, one rule in one helper: time is up once
-- now() is 10 seconds past started_utc + duration_min — the grace an
-- answer tapped in the last second needs to reach the server (the runner
-- saves half a second after a tap, and the auto-submit flushes first).
--   save_answers    refuses past it: "This exam has run out of time."
--   finish_attempt  past it, closes the sitting AT the deadline, as
--                   expire_attempt does — a late Submit is the time-up it
--                   is (ended_utc the deadline, the time the full length).
--   advance_attempt the same helper (it refused at the deadline exactly).
-- The two untimed modes are untouched. No table, column or grant changes.
--
-- REACH. Dev: the dev site already waits on the merge for S21. Students
-- see nothing unless they answer after the clock — then the refusal.

set search_path = licensure_gh;

-- True once an exam's time is up, grace included. False for a sitting
-- with no clock, or one whose clock has not started.
create or replace function _exam_time_up(p_mode text, p_started timestamptz, p_duration integer)
returns boolean
language sql
stable
as $$
  select p_mode in ('TIMED_FREE_NAV', 'TIMED_SEQUENTIAL')
     and p_started is not null
     and coalesce(p_duration, 0) > 0
     and now() > p_started + make_interval(mins => p_duration) + interval '10 seconds'
$$;
revoke execute on function _exam_time_up(text, timestamptz, integer) from public, anon, authenticated;

-- save_answers: S21's (Sequential takes only the current row), and no
-- answer once an exam's time is up.
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

-- finish_attempt: an exam finished after its time is up closes at the
-- deadline with the full length, as expire_attempt closes it.
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

-- advance_attempt: S21's, on the one helper.
create or replace function advance_attempt(p_attempt_id text, p_user_id text)
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
  v_row      bigint;
  v_chosen   text;
  v_next     integer;
begin
  select a.status, a.mode, a.started_utc, a.duration_min into v_status, v_mode, v_started, v_duration
  from attempts a where a.attempt_id = p_attempt_id and a.user_id = p_user_id;
  if not found then raise exception 'This quiz attempt does not belong to your account.'; end if;
  if v_status <> 'in_progress' then raise exception 'This exam is no longer in progress.'; end if;
  if v_mode <> 'TIMED_SEQUENTIAL' then raise exception 'Only a sequential exam moves one question at a time.'; end if;
  if _exam_time_up(v_mode, v_started, v_duration) then raise exception 'This exam has run out of time.'; end if;

  select i.attempt_item_id, i.chosen into v_row, v_chosen
  from attempt_items i
  where i.attempt_id = p_attempt_id and i.passed_utc is null
  order by i.position
  limit 1
  for update;
  if not found then return null; end if;
  if v_chosen is null or btrim(v_chosen) = '' then
    raise exception 'Answer this question before moving on.';
  end if;

  update attempt_items i set passed_utc = now() where i.attempt_item_id = v_row;

  select min(i.position) into v_next
  from attempt_items i where i.attempt_id = p_attempt_id and i.passed_utc is null;
  return v_next;
end;
$$;
revoke execute on function advance_attempt(text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
