-- 20261020220000_daily_challenge.sql — 04-practice.md (G2, 04.24), the
-- daily challenge's database; its four tables ticked by Sam 2026-10-20 in
-- 12-tables.md ("go on"), in place of the draw and the `challenge` source
-- and mode on `attempts` ticked 2026-10-08.
--
-- WHY. The challenge's rules share nothing with the quiz engine's — one
-- paper a day for everyone, the server's clock on an untimed screen,
-- answers open until midnight, voiding, the school kept — so it is kept
-- apart and papers, mocks and the builder are not touched. The day's
-- questions are stored once, on the day's paper, instead of copied into
-- every student's sitting (Sam's idea): a play's answer lines say what was
-- chosen and are marked against the paper.
--
-- WHAT.
--   1. challenge_days — the day's paper, one per programme per day, made by
--      the first student to open it: the programme's courses in turn by
--      name, a course with too few Practice questions skipped.
--   2. challenge_day_items — its questions, copied once; only published
--      Practice questions of its course (a trigger); the least recently
--      drawn first. A question a paper has used cannot be deleted (the key).
--   3. challenge_plays — one per student per day (unique); the school kept;
--      the time limit fixed at Start (questions × builder minutes).
--   4. challenge_answers — a play's answer lines; no copy of the question.
--   5. config challenge_questions = 5 (1 to 20; anything else reads as 5).
--   6. No browser path to the four tables (rule 9).
--   7. The server's functions: challenge_today, start_challenge,
--      save_challenge_answers, submit_challenge, challenge_play_lines, and
--      the admin's swap_challenge_item and void_challenge_item; internal
--      _challenge_paper, _challenge_mark, _challenge_close,
--      _challenge_close_due. A play past its time is closed as time_up when
--      it is next read — no clock.
--   8. _student_answers(student): every answer a student gave, sittings'
--      and challenges' (a voided one left out), each with its course, topic
--      and whether its results are held. student_dashboard reads it, so the
--      streak, questions met and mastered, the weakest topic and the recap
--      count challenge answers. Everything else is as 20261015100000.
--
-- Left out of the tick, on reading the code: the play's `seed` — the quiz
-- screen shuffles a student's options from the sitting's own id and the
-- question's (lib/attempts/scoring.ts), and the play's id does the same.
-- `right` is `right_count` (RIGHT is a word Postgres keeps).
--
-- REACH. Dev only: the live product is the old site; prod takes this at
-- the next release Sam approves. New tables only, and the dashboard's
-- numbers are unchanged until a challenge is played; main's code on the
-- dev site reads none of it.

set search_path = licensure_gh;

-- ── 1. the day's paper ────────────────────────────────────────────────
create table if not exists challenge_days (
  challenge_id text primary key,
  day          date not null,
  program_id   text not null references programs (program_id),
  course_id    text not null references courses (course_id),
  created_utc  timestamptz not null default now(),
  constraint challenge_days_one_a_day unique (day, program_id)
);

-- ── 2. its questions, stored once ─────────────────────────────────────
create table if not exists challenge_day_items (
  challenge_id    text not null references challenge_days (challenge_id) on delete cascade,
  position        integer not null check (position >= 1),
  item_id         text not null references question_bank (item_id),
  question_type   text not null,
  stem            text not null,
  option_a        text,
  option_b        text,
  option_c        text,
  option_d        text,
  option_e        text,
  option_f        text,
  fb_a            text,
  fb_b            text,
  fb_c            text,
  fb_d            text,
  fb_e            text,
  fb_f            text,
  correct         text not null,
  rationale       text,
  rationale_img   text,
  subject         text,
  maintopic       text,
  subtopic        text,
  difficulty      text,
  bloom_level     text,
  tags            text[] not null default '{}',
  marks           numeric not null default 1,
  shuffle_options boolean not null default true,
  version         integer,
  voided_utc      timestamptz,
  primary key (challenge_id, position),
  constraint challenge_day_items_once unique (challenge_id, item_id)
);
-- the draw's "least recently drawn" reads a question's past papers
create index if not exists challenge_day_items_item on challenge_day_items (item_id);

-- Only published Practice questions of the paper's course, whoever writes.
create or replace function _challenge_item_check()
returns trigger
language plpgsql
set search_path = licensure_gh
as $$
begin
  if not exists (
    select 1
    from challenge_days cd
    join question_bank q on q.item_id = new.item_id and q.course_id = cd.course_id
    where cd.challenge_id = new.challenge_id and q.is_published and q.pool = 'practice'
  ) then
    raise exception 'A challenge takes only published Practice questions of its course.';
  end if;
  return new;
end;
$$;
revoke execute on function _challenge_item_check() from public, anon, authenticated;

drop trigger if exists challenge_day_items_check on challenge_day_items;
create trigger challenge_day_items_check
  before insert or update of item_id on challenge_day_items
  for each row execute function _challenge_item_check();

-- ── 3. a student's play, one a day ────────────────────────────────────
create table if not exists challenge_plays (
  play_id       text primary key,
  user_id       text not null references users (user_id),
  day           date not null,
  challenge_id  text not null references challenge_days (challenge_id),
  school_id     bigint references schools (id),
  started_utc   timestamptz not null default now(),
  ends_utc      timestamptz not null,
  submitted_utc timestamptz,
  status        text not null default 'playing',
  time_taken_s  integer,
  right_count   integer,
  out_of        integer,
  constraint challenge_plays_one_a_day unique (user_id, day),
  constraint challenge_plays_status_check check (status in ('playing', 'submitted', 'time_up')),
  constraint challenge_plays_ends_check check (ends_utc > started_utc),
  constraint challenge_plays_ended_check check ((status = 'playing') = (submitted_utc is null))
);
-- void and swap find a paper's plays
create index if not exists challenge_plays_paper on challenge_plays (challenge_id);

-- ── 4. a play's answer lines ──────────────────────────────────────────
create table if not exists challenge_answers (
  play_id      text not null references challenge_plays (play_id) on delete cascade,
  position     integer not null,
  item_id      text not null references question_bank (item_id),
  chosen       text,
  flagged      boolean not null default false,
  is_correct   boolean,
  time_spent_s integer,
  answered_utc timestamptz,
  primary key (play_id, position)
);

-- ── 5. the setting ────────────────────────────────────────────────────
insert into config (key, value, description)
values ('challenge_questions', '5',
        'How many questions the daily challenge has each day, every programme (1 to 20); a change applies from the next day''s paper')
on conflict (key) do nothing;

-- ── 6. no browser path ────────────────────────────────────────────────
alter table challenge_days enable row level security;
alter table challenge_day_items enable row level security;
alter table challenge_plays enable row level security;
alter table challenge_answers enable row level security;
revoke all on challenge_days, challenge_day_items, challenge_plays, challenge_answers from anon, authenticated;

-- ── 7. the functions ──────────────────────────────────────────────────

-- The day's number of questions: 1 to 20, else 5.
create or replace function _challenge_setting_n()
returns integer
language sql
stable
set search_path = licensure_gh
as $$
  select coalesce((
    select btrim(c.value)::integer
    from config c
    where c.key = 'challenge_questions'
      and btrim(c.value) ~ '^[0-9]{1,2}$'
      and btrim(c.value)::integer between 1 and 20
  ), 5);
$$;
revoke execute on function _challenge_setting_n() from public, anon, authenticated;

-- The builder's minutes per question: above 0 and up to 10, else 1.
create or replace function _challenge_minutes_per_question()
returns numeric
language sql
stable
set search_path = licensure_gh
as $$
  select coalesce((
    select btrim(c.value)::numeric
    from config c
    where c.key = 'builder_minutes_per_question'
      and btrim(c.value) ~ '^[0-9]{1,2}(\.[0-9]+)?$'
      and btrim(c.value)::numeric > 0
      and btrim(c.value)::numeric <= 10
  ), 1);
$$;
revoke execute on function _challenge_minutes_per_question() from public, anon, authenticated;

-- The programme's paper for the day: found, or made by this first opener.
-- Null when no course can fill one ("Back tomorrow").
create or replace function _challenge_paper(p_program_id text, p_day date)
returns text
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_id      text;
  v_n       integer := _challenge_setting_n();
  v_courses text[];
  v_len     integer;
  v_last    text;
  v_start   integer;
  v_course  text;
  k         integer;
begin
  select cd.challenge_id into v_id
  from challenge_days cd where cd.program_id = p_program_id and cd.day = p_day;
  if found then return v_id; end if;

  -- one first opener at a time for a programme's day
  perform pg_advisory_xact_lock(hashtextextended('licensure_gh.challenge_paper:' || p_program_id || ':' || p_day::text, 0));
  select cd.challenge_id into v_id
  from challenge_days cd where cd.program_id = p_program_id and cd.day = p_day;
  if found then return v_id; end if;

  -- the programme's courses in the order the app lists them, by name
  select array_agg(c.course_id order by c.title, c.course_id) into v_courses
  from courses c
  where c.status = 'active' and p_program_id = any (c.program_scope);
  v_len := coalesce(cardinality(v_courses), 0);
  if v_len = 0 then return null; end if;

  select cd.course_id into v_last
  from challenge_days cd
  where cd.program_id = p_program_id and cd.day < p_day
  order by cd.day desc
  limit 1;

  if v_last is null then
    v_start := 1;
  elsif array_position(v_courses, v_last) is not null then
    v_start := array_position(v_courses, v_last) % v_len + 1;
  else
    -- the last paper's course has left the list: the next by name after it
    select coalesce(min(u.i), 1)::integer into v_start
    from unnest(v_courses) with ordinality as u(course_id, i)
    join courses c on c.course_id = u.course_id
    join courses l on l.course_id = v_last
    where (c.title, c.course_id) > (l.title, l.course_id);
  end if;

  for k in 0 .. v_len - 1 loop
    v_course := v_courses[((v_start - 1 + k) % v_len) + 1];
    if (select count(*) from question_bank q
        where q.course_id = v_course and q.is_published and q.pool = 'practice') >= v_n then
      v_id := 'CH_' || p_program_id || '_' || to_char(p_day, 'YYYYMMDD');
      insert into challenge_days (challenge_id, day, program_id, course_id)
      values (v_id, p_day, p_program_id, v_course);

      insert into challenge_day_items (
        challenge_id, position, item_id, question_type, stem,
        option_a, option_b, option_c, option_d, option_e, option_f,
        fb_a, fb_b, fb_c, fb_d, fb_e, fb_f,
        correct, rationale, rationale_img, subject, maintopic, subtopic,
        difficulty, bloom_level, tags, marks, shuffle_options, version)
      select v_id, row_number() over (order by d.last_day nulls first, d.r), q.item_id, q.question_type, q.stem,
             q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, q.option_f,
             q.fb_a, q.fb_b, q.fb_c, q.fb_d, q.fb_e, q.fb_f,
             q.correct, q.rationale, q.rationale_img, q.subject, q.maintopic, q.subtopic,
             q.difficulty, q.bloom_level, q.tags, q.marks, q.shuffle_options, q.version
      from (
        -- the least recently drawn for this programme first, at random among equals
        select q2.item_id, ld.last_day, random() as r
        from question_bank q2
        left join (
          select cdi.item_id, max(cd2.day) as last_day
          from challenge_day_items cdi
          join challenge_days cd2 on cd2.challenge_id = cdi.challenge_id
          where cd2.program_id = p_program_id
          group by cdi.item_id
        ) ld on ld.item_id = q2.item_id
        where q2.course_id = v_course and q2.is_published and q2.pool = 'practice'
        order by ld.last_day nulls first, r
        limit v_n
      ) d
      join question_bank q on q.item_id = d.item_id;
      return v_id;
    end if;
  end loop;

  return null;
end;
$$;
revoke execute on function _challenge_paper(text, date) from public, anon, authenticated;

-- A play's score: its right answers and its questions, a voided one out.
create or replace function _challenge_mark(p_play_id text)
returns void
language sql
security definer
set search_path = licensure_gh
as $$
  update challenge_plays p
  set right_count = m.r, out_of = m.o
  from (
    select count(*) filter (where ca.is_correct and cdi.voided_utc is null)::integer as r,
           count(*) filter (where cdi.voided_utc is null)::integer as o
    from challenge_answers ca
    join challenge_plays p2 on p2.play_id = ca.play_id
    join challenge_day_items cdi on cdi.challenge_id = p2.challenge_id and cdi.position = ca.position
    where ca.play_id = p_play_id
  ) m
  where p.play_id = p_play_id;
$$;
revoke execute on function _challenge_mark(text) from public, anon, authenticated;

-- End a play: mark each line against the paper (a quiz's marking), the
-- server's time from Start, capped at the limit.
create or replace function _challenge_close(p_play_id text, p_ended timestamptz, p_status text)
returns void
language plpgsql
security definer
set search_path = licensure_gh
as $$
begin
  update challenge_answers ca
  set is_correct = grade_answer(cdi.question_type, cdi.correct, ca.chosen)
  from challenge_plays p
  join challenge_day_items cdi on cdi.challenge_id = p.challenge_id
  where p.play_id = p_play_id and ca.play_id = p.play_id and cdi.position = ca.position;

  update challenge_plays p
  set status = p_status,
      submitted_utc = p_ended,
      time_taken_s = least(
        floor(extract(epoch from p.ends_utc - p.started_utc))::integer,
        greatest(0, floor(extract(epoch from p_ended - p.started_utc))::integer))
  where p.play_id = p_play_id;

  perform _challenge_mark(p_play_id);
end;
$$;
revoke execute on function _challenge_close(text, timestamptz, text) from public, anon, authenticated;

-- A student's plays past their time close as time_up, on what was answered.
create or replace function _challenge_close_due(p_user_id text)
returns void
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  r record;
begin
  for r in
    select p.play_id, p.ends_utc
    from challenge_plays p
    where p.user_id = p_user_id and p.status = 'playing' and now() >= p.ends_utc
    for update
  loop
    perform _challenge_close(r.play_id, r.ends_utc, 'time_up');
  end loop;
end;
$$;
revoke execute on function _challenge_close_due(text) from public, anon, authenticated;

-- Today's challenge for a student: the paper (made if this is the first
-- opener), its course and size, and the student's play today, if any.
-- challenge_id is null on a day with none ("Back tomorrow").
create or replace function challenge_today(p_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_today   date := (now() at time zone 'UTC')::date;
  v_program text;
  v_id      text;
  v_play    jsonb;
begin
  perform _challenge_close_due(p_user_id);

  select u.program_id into v_program from users u where u.user_id = p_user_id;
  if v_program is not null then
    v_id := _challenge_paper(v_program, v_today);
  end if;

  select jsonb_build_object(
           'play_id', p.play_id,
           'challenge_id', p.challenge_id,
           'status', p.status,
           'started_utc', p.started_utc,
           'ends_utc', p.ends_utc,
           'submitted_utc', p.submitted_utc,
           'time_taken_s', p.time_taken_s,
           'right', p.right_count,
           'out_of', p.out_of)
  into v_play
  from challenge_plays p
  where p.user_id = p_user_id and p.day = v_today;

  return (
    select jsonb_build_object(
             'day', v_today,
             'program_id', v_program,
             'challenge_id', cd.challenge_id,
             'course_id', cd.course_id,
             'course_title', c.title,
             'questions', (select count(*) from challenge_day_items i
                           where i.challenge_id = cd.challenge_id and i.voided_utc is null),
             'minutes_per_question', _challenge_minutes_per_question(),
             'play', v_play)
    from (select 1) as one
    left join challenge_days cd on cd.challenge_id = v_id
    left join courses c on c.course_id = cd.course_id
  );
end;
$$;
revoke execute on function challenge_today(text) from public, anon, authenticated;

-- Start: one play a day. A play already going is resumed; one finished
-- today is refused. The time limit is fixed here.
create or replace function start_challenge(p_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_today   date := (now() at time zone 'UTC')::date;
  v_program text;
  v_school  bigint;
  v_status  text;
  v_id      text;
  v_n       integer;
  v_play    text;
begin
  perform _challenge_close_due(p_user_id);

  select u.program_id, u.school_id into v_program, v_school from users u where u.user_id = p_user_id;
  if not found then raise exception 'This account was not found.'; end if;
  if v_program is null then
    raise exception 'Choose your programme on your Profile to play the daily challenge.';
  end if;

  select p.status into v_status from challenge_plays p where p.user_id = p_user_id and p.day = v_today;
  if found then
    if v_status = 'playing' then return challenge_today(p_user_id); end if;
    raise exception 'You have played today''s challenge. Come back tomorrow for the next one.';
  end if;

  v_id := _challenge_paper(v_program, v_today);
  if v_id is null then raise exception 'There is no challenge today. Come back tomorrow.'; end if;
  -- a swap waits for a Start in progress, and a Start for a swap
  perform 1 from challenge_days cd where cd.challenge_id = v_id for share;

  select count(*) into v_n from challenge_day_items i where i.challenge_id = v_id and i.voided_utc is null;
  if v_n = 0 then raise exception 'There is no challenge today. Come back tomorrow.'; end if;

  v_play := 'CP_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint
            || '_' || upper(substr(md5(gen_random_uuid()::text), 1, 7));
  insert into challenge_plays (play_id, user_id, day, challenge_id, school_id, started_utc, ends_utc)
  values (v_play, p_user_id, v_today, v_id, v_school, now(),
          now() + make_interval(secs => (v_n * _challenge_minutes_per_question() * 60)::double precision))
  on conflict (user_id, day) do nothing;
  if not found then return challenge_today(p_user_id); end if;  -- a second Start at the same moment

  insert into challenge_answers (play_id, position, item_id)
  select v_play, i.position, i.item_id
  from challenge_day_items i
  where i.challenge_id = v_id and i.voided_utc is null;

  return challenge_today(p_user_id);
end;
$$;
revoke execute on function start_challenge(text) from public, anon, authenticated;

-- Save as the student goes: rows of { item_id, chosen?, flagged?,
-- time_spent_s? }, as save_answers takes them. Nothing after the time.
create or replace function save_challenge_answers(p_play_id text, p_user_id text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_status text;
  v_ends   timestamptz;
  v_n      integer;
begin
  select p.status, p.ends_utc into v_status, v_ends
  from challenge_plays p where p.play_id = p_play_id and p.user_id = p_user_id;
  if not found then raise exception 'This challenge does not belong to your account.'; end if;
  if v_status <> 'playing' then raise exception 'This challenge has already been submitted.'; end if;
  if now() >= v_ends then raise exception 'The time for this challenge is up.'; end if;

  update challenge_answers ca
  set chosen       = case when r.value ? 'chosen' then nullif(btrim(r.value ->> 'chosen'), '') else ca.chosen end,
      flagged      = case when r.value ? 'flagged' then coalesce((r.value ->> 'flagged')::boolean, false) else ca.flagged end,
      time_spent_s = case when r.value ? 'time_spent_s' then (r.value ->> 'time_spent_s')::integer else ca.time_spent_s end,
      answered_utc = case when r.value ? 'chosen' and nullif(btrim(r.value ->> 'chosen'), '') is distinct from ca.chosen
                          then now() else ca.answered_utc end
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  where ca.play_id = p_play_id and ca.item_id = r.value ->> 'item_id';

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function save_challenge_answers(text, text, jsonb) from public, anon, authenticated;

-- Submit: marked against the paper, the server's time. Past the limit it
-- is the time-up close instead.
create or replace function submit_challenge(p_play_id text, p_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_status text;
  v_ends   timestamptz;
begin
  select p.status, p.ends_utc into v_status, v_ends
  from challenge_plays p where p.play_id = p_play_id and p.user_id = p_user_id
  for update;
  if not found then raise exception 'This challenge does not belong to your account.'; end if;
  if v_status <> 'playing' then raise exception 'This challenge has already been submitted.'; end if;

  if now() >= v_ends then
    perform _challenge_close(p_play_id, v_ends, 'time_up');
  else
    perform _challenge_close(p_play_id, now(), 'submitted');
  end if;

  return (
    select jsonb_build_object('status', p.status, 'right', p.right_count, 'out_of', p.out_of,
                              'time_taken_s', p.time_taken_s, 'submitted_utc', p.submitted_utc)
    from challenge_plays p where p.play_id = p_play_id
  );
end;
$$;
revoke execute on function submit_challenge(text, text) from public, anon, authenticated;

-- A play's questions, the words from the paper. While it is going: the
-- question and the student's own answers only. Once it has ended: the
-- answer, the marks, the explanation and the feedback too — until the
-- midnight after it ended (UTC, Ghana's time); then refused.
create or replace function challenge_play_lines(p_play_id text, p_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_status    text;
  v_ended     timestamptz;
  v_challenge text;
  v_show      boolean;
begin
  perform _challenge_close_due(p_user_id);

  select p.status, p.submitted_utc, p.challenge_id into v_status, v_ended, v_challenge
  from challenge_plays p where p.play_id = p_play_id and p.user_id = p_user_id;
  if not found then raise exception 'This challenge does not belong to your account.'; end if;

  v_show := v_status <> 'playing';
  if v_show and now() >= (((v_ended at time zone 'UTC')::date + 1)::timestamp at time zone 'UTC') then
    raise exception 'This challenge''s answers closed at midnight.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'position', ca.position,
             'item_id', ca.item_id,
             'question_type', i.question_type,
             'stem', i.stem,
             'option_a', i.option_a, 'option_b', i.option_b, 'option_c', i.option_c,
             'option_d', i.option_d, 'option_e', i.option_e, 'option_f', i.option_f,
             'marks', i.marks,
             'shuffle_options', i.shuffle_options,
             'subject', i.subject,
             'maintopic', i.maintopic,
             'voided', i.voided_utc is not null,
             'chosen', ca.chosen,
             'flagged', ca.flagged,
             'time_spent_s', ca.time_spent_s,
             'answered_utc', ca.answered_utc,
             'is_correct', case when v_show then ca.is_correct end,
             'correct', case when v_show then i.correct end,
             'rationale', case when v_show then i.rationale end,
             'rationale_img', case when v_show then i.rationale_img end,
             'fb_a', case when v_show then i.fb_a end, 'fb_b', case when v_show then i.fb_b end,
             'fb_c', case when v_show then i.fb_c end, 'fb_d', case when v_show then i.fb_d end,
             'fb_e', case when v_show then i.fb_e end, 'fb_f', case when v_show then i.fb_f end)
           order by ca.position)
    from challenge_answers ca
    join challenge_day_items i on i.challenge_id = v_challenge and i.position = ca.position
    where ca.play_id = p_play_id
  ), '[]'::jsonb);
end;
$$;
revoke execute on function challenge_play_lines(text, text) from public, anon, authenticated;

-- The admin's swap: another published Practice question of the course in
-- a question's place, only before anyone has played that paper.
create or replace function swap_challenge_item(p_challenge_id text, p_position integer, p_item_id text)
returns void
language plpgsql
security definer
set search_path = licensure_gh
as $$
begin
  perform 1 from challenge_days cd where cd.challenge_id = p_challenge_id for update;
  if not found then raise exception 'This challenge was not found.'; end if;
  if exists (select 1 from challenge_plays p where p.challenge_id = p_challenge_id) then
    raise exception 'Someone has played this challenge already. Void the question instead.';
  end if;
  if exists (select 1 from challenge_day_items i where i.challenge_id = p_challenge_id and i.item_id = p_item_id) then
    raise exception 'That question is on this challenge already.';
  end if;

  update challenge_day_items i
  set item_id = q.item_id, question_type = q.question_type, stem = q.stem,
      option_a = q.option_a, option_b = q.option_b, option_c = q.option_c,
      option_d = q.option_d, option_e = q.option_e, option_f = q.option_f,
      fb_a = q.fb_a, fb_b = q.fb_b, fb_c = q.fb_c, fb_d = q.fb_d, fb_e = q.fb_e, fb_f = q.fb_f,
      correct = q.correct, rationale = q.rationale, rationale_img = q.rationale_img,
      subject = q.subject, maintopic = q.maintopic, subtopic = q.subtopic,
      difficulty = q.difficulty, bloom_level = q.bloom_level, tags = q.tags,
      marks = q.marks, shuffle_options = q.shuffle_options, version = q.version,
      voided_utc = null
  from question_bank q
  where q.item_id = p_item_id and i.challenge_id = p_challenge_id and i.position = p_position;
  if not found then raise exception 'That question or that place on the challenge was not found.'; end if;
end;
$$;
revoke execute on function swap_challenge_item(text, integer, text) from public, anon, authenticated;

-- The admin's void: the question leaves every score of that paper; the
-- plays already ended are marked again now, the rest when they end.
-- Returns how many plays were marked again.
create or replace function void_challenge_item(p_challenge_id text, p_position integer)
returns integer
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  r   record;
  v_n integer := 0;
begin
  update challenge_day_items i
  set voided_utc = now()
  where i.challenge_id = p_challenge_id and i.position = p_position and i.voided_utc is null;
  if not found then raise exception 'That question is not on this challenge, or is voided already.'; end if;

  for r in
    select p.play_id from challenge_plays p
    where p.challenge_id = p_challenge_id and p.status <> 'playing'
  loop
    perform _challenge_mark(r.play_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke execute on function void_challenge_item(text, integer) from public, anon, authenticated;

-- ── 8. every answer a student gave ────────────────────────────────────
-- Sittings' and challenges' together, so no count can miss the challenge.
-- Plain SQL and no settings of its own, so the planner can fold it into
-- the query that reads it; the names are written out in full for that.
create or replace function _student_answers(p_user_id text)
returns table (
  course_id    text,
  item_id      text,
  maintopic    text,
  is_correct   boolean,
  time_spent_s integer,
  answered_utc timestamptz,
  held         boolean,
  src          smallint,
  row_key      bigint
)
language sql
stable
as $$
  select a.course_id, ai.item_id, ai.maintopic, ai.is_correct, ai.time_spent_s, ai.answered_utc,
         coalesce(now() < licensure_gh._quiz_results_at(a.quiz_id, a.source), false),
         0::smallint, ai.attempt_item_id
  from licensure_gh.attempt_items ai
  join licensure_gh.attempts a on a.attempt_id = ai.attempt_id
  where a.user_id = p_user_id
  union all
  select cd.course_id, ca.item_id, cdi.maintopic, ca.is_correct, ca.time_spent_s, ca.answered_utc,
         false,
         1::smallint, ca.position::bigint
  from licensure_gh.challenge_answers ca
  join licensure_gh.challenge_plays p on p.play_id = ca.play_id
  join licensure_gh.challenge_days cd on cd.challenge_id = p.challenge_id
  join licensure_gh.challenge_day_items cdi on cdi.challenge_id = p.challenge_id and cdi.position = ca.position
  where p.user_id = p_user_id and cdi.voided_utc is null
$$;
revoke execute on function _student_answers(text) from public, anon, authenticated;

-- student_dashboard: as 20261015100000, every count read from
-- _student_answers. The held sittings stay out of mastered, the weakest
-- topic and the recap, and in the streak and each course's met, as before.
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
  select array_agg(distinct (s.answered_utc at time zone 'UTC')::date order by (s.answered_utc at time zone 'UTC')::date)
  into v_days
  from _student_answers(p_user_id) s
  where s.answered_utc is not null;

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
    select distinct on (s.item_id) s.is_correct, s.time_spent_s
    from _student_answers(p_user_id) s
    where s.answered_utc is not null and not s.held
    order by s.item_id, s.answered_utc, s.src, s.row_key
  )
  select count(*), count(*) filter (where is_correct and coalesce(time_spent_s, 5) >= 5)
  into v_answered, v_mastered
  from firsts;

  -- ── the weakest topic ───────────────────────────────────────────────
  select count(*)
  into v_total
  from _student_answers(p_user_id) s
  where s.answered_utc is not null and not s.held;

  if v_total >= 20 then
    select jsonb_build_object('course_id', t.course_id, 'topic', t.topic, 'answered', t.n, 'correct', t.c)
    into v_weakest
    from (
      select s.course_id, btrim(s.maintopic) as topic, count(*) as n, count(*) filter (where s.is_correct) as c
      from _student_answers(p_user_id) s
      where s.answered_utc is not null and nullif(btrim(s.maintopic), '') is not null and not s.held
      group by s.course_id, btrim(s.maintopic)
      having count(*) >= 5
    ) t
    order by t.c::numeric / t.n, t.n desc, t.topic
    limit 1;
  end if;

  -- ── each course: questions met of its bank ──────────────────────────
  select coalesce(jsonb_agg(jsonb_build_object(
           'course_id', c.course_id,
           'met', (
             select count(distinct s.item_id)
             from _student_answers(p_user_id) s
             where s.course_id = c.course_id and s.answered_utc is not null
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
      select s.course_id, nullif(btrim(s.maintopic), '') as topic, s.is_correct
      from _student_answers(p_user_id) s
      where s.answered_utc >= p_recap_from and s.answered_utc < p_recap_to
        and not s.held
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
