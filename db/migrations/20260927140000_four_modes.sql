-- 20260927140000_four_modes.sql — rebuild.md §8 S21, 03-quiz-system.md Q8
-- steps 2 and 3 (Sam, 2026-09-27: talked through, ruled and ticked the
-- same day)
--
-- WHY. A sitting had one of two modes, `instant` or `timed`, and a quiz or
-- mock allowed one or both (`BOTH` / `INSTANT_ONLY` / `TIMED_ONLY`). Since
-- 03 Q8's step 1 the app names and plays a mode from one table
-- (lib/attempts/modes.ts, MyNclex's shape); Sam asked for four of
-- MyNclex's modes now, in its two groups, under its stored codes:
--   Study  UNTIMED_LEARNING  Learning — the answer after each question
--                            (was `instant`)
--          UNTIMED_TEST      Untimed practice — no clock, results at the end
--   Exam   TIMED_FREE_NAV    Free Navigation — the wall clock, any order
--                            (was `timed`)
--          TIMED_SEQUENTIAL  Sequential — the wall clock, one question at a
--                            time, no going back, an answer required to
--                            move on (Sam)
-- The database accepted only the two words, and nothing held an order of
-- answering: save_answers took any row of a sitting.
--
-- WHAT.
--   1. attempts.mode: the rows converted, the CHECK to the four codes.
--   2. allowed_modes becomes a list (text[]) on both quiz tables — the
--      admin ticks which modes a quiz or mock allows and the student picks
--      among them (Sam: A). Converted like for like: BOTH → Learning + Free
--      Navigation, INSTANT_ONLY → Learning, TIMED_ONLY → Free Navigation.
--      The CHECK: at least one, only the four. The default is BOTH's list.
--      save_quiz() (03 Q14) reads the column with its own type, so it takes
--      the list unchanged.
--   3. Sequential's lock, in the database — the screen cannot be trusted:
--      attempt_items.passed_utc, stamped when the student moves past a
--      question. advance_attempt() stamps the current row (the first not
--      passed, by position) only when it has an answer, and not after the
--      deadline; in a Sequential sitting save_answers takes only that
--      current row, so an earlier answer cannot change and a later one
--      cannot be given early, whatever the browser sends.
--   4. The four functions that tested the mode by word, on the codes:
--      check_answer for Learning only; start_timed_attempt, expire_attempt
--      and finish_attempt's server-clock time for the two TIMED_ modes.
--
-- TIDY (AGENTS.md: prod cannot be read from here). attempts_mode_check has
-- held `instant` / `timed` and the allowed_modes CHECKs the three words on
-- both projects since 03 Q1 and Q5 (both released), so nothing else can be
-- there; prod holds no sittings (the new app is not live). A word the
-- conversion does not know would still land as BOTH's list, the default.
--
-- RULE 9. All four tables already hold SELECT only for the browser roles
-- (checked 2026-09-27: attempts table-wide for authenticated; column lists
-- on attempt_items, quizzes, mock_quizzes). The new column is in no grant —
-- the runner reads a sitting's rows through the service role. The new
-- function is revoked from the browser roles, as the other doors.
--
-- REACH. Dev until the merge: main's code writes `instant` / `timed` and
-- reads allowed_modes as a word, so on the dev site starting a sitting and
-- saving a quiz fail until main has this code. Only Sam.

set search_path = licensure_gh;

-- ── 1. a sitting's mode ────────────────────────────────────────────────
alter table attempts drop constraint if exists attempts_mode_check;
update attempts set mode = 'UNTIMED_LEARNING' where mode = 'instant';
update attempts set mode = 'TIMED_FREE_NAV'   where mode = 'timed';
alter table attempts add constraint attempts_mode_check
  check (mode in ('UNTIMED_LEARNING', 'UNTIMED_TEST', 'TIMED_FREE_NAV', 'TIMED_SEQUENTIAL'));

-- ── 2. a quiz's modes, a list ──────────────────────────────────────────
alter table quizzes drop constraint if exists quizzes_allowed_modes_check;
alter table quizzes alter column allowed_modes drop default;
alter table quizzes alter column allowed_modes type text[] using (
  case allowed_modes
    when 'INSTANT_ONLY' then array['UNTIMED_LEARNING']
    when 'TIMED_ONLY'   then array['TIMED_FREE_NAV']
    else array['UNTIMED_LEARNING', 'TIMED_FREE_NAV']
  end
);
alter table quizzes alter column allowed_modes set default array['UNTIMED_LEARNING', 'TIMED_FREE_NAV'];
alter table quizzes add constraint quizzes_allowed_modes_check check (
  cardinality(allowed_modes) >= 1
  and allowed_modes <@ array['UNTIMED_LEARNING', 'UNTIMED_TEST', 'TIMED_FREE_NAV', 'TIMED_SEQUENTIAL']
);

alter table mock_quizzes drop constraint if exists mock_quizzes_allowed_modes_check;
alter table mock_quizzes alter column allowed_modes drop default;
alter table mock_quizzes alter column allowed_modes type text[] using (
  case allowed_modes
    when 'INSTANT_ONLY' then array['UNTIMED_LEARNING']
    when 'TIMED_ONLY'   then array['TIMED_FREE_NAV']
    else array['UNTIMED_LEARNING', 'TIMED_FREE_NAV']
  end
);
alter table mock_quizzes alter column allowed_modes set default array['UNTIMED_LEARNING', 'TIMED_FREE_NAV'];
alter table mock_quizzes add constraint mock_quizzes_allowed_modes_check check (
  cardinality(allowed_modes) >= 1
  and allowed_modes <@ array['UNTIMED_LEARNING', 'UNTIMED_TEST', 'TIMED_FREE_NAV', 'TIMED_SEQUENTIAL']
);

-- ── 3. Sequential's lock ───────────────────────────────────────────────
alter table attempt_items add column passed_utc timestamptz;

-- The student moves past the current question. Returns the position now
-- current, or null when every question is passed (the last one's Submit
-- follows). Refuses without an answer, and after the deadline — the
-- clock closes the sitting then, not a late move.
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
  if v_started is not null and coalesce(v_duration, 0) > 0
     and now() >= v_started + make_interval(mins => v_duration) then
    raise exception 'This exam has run out of time.';
  end if;

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

-- save_answers: as 03 Q5 wrote it, and in a Sequential sitting only the
-- current row — no earlier answer changed, no later one given early.
create or replace function save_answers(p_attempt_id text, p_user_id text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_status  text;
  v_mode    text;
  v_current text;
  v_n       integer;
begin
  select a.status, a.mode into v_status, v_mode
  from attempts a where a.attempt_id = p_attempt_id and a.user_id = p_user_id;
  if not found then raise exception 'This quiz attempt does not belong to your account.'; end if;
  if v_status <> 'in_progress' then raise exception 'This attempt is no longer in progress.'; end if;

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

-- ── 4. the functions on the codes ──────────────────────────────────────
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

  update attempts a set started_utc = now()
  where a.attempt_id = p_attempt_id and a.started_utc is null;
  select a.started_utc into v_started from attempts a where a.attempt_id = p_attempt_id;
  return v_started;
end;
$$;
revoke execute on function start_timed_attempt(text, text) from public, anon, authenticated;

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
  if v_mode <> 'UNTIMED_LEARNING' then raise exception 'In this mode answers are shown at the end.'; end if;

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

-- p_time_taken_s is the browser's stopwatch for a sitting with no clock
-- (as legacy); an exam's time is the server clock's distance from
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
  if v_mode not in ('TIMED_FREE_NAV', 'TIMED_SEQUENTIAL') or v_started is null or coalesce(v_duration, 0) <= 0 then
    raise exception 'This attempt has no clock to run out.';
  end if;

  v_deadline := v_started + make_interval(mins => v_duration);
  if now() < v_deadline then raise exception 'This exam has not run out of time yet.'; end if;

  return query select * from _close_attempt(p_attempt_id, v_deadline, v_duration * 60);
end;
$$;
revoke execute on function expire_attempt(text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
