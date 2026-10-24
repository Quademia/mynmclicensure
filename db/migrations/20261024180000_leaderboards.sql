-- 20261024180000_leaderboards.sql — 05-progress.md (G1b) and
-- 01-accounts-and-sign-in.md, the leaderboards' database; ticked by Sam
-- 2026-10-24 in 12-tables.md: the leaderboard card, suggested schools,
-- users.school_other retired, and the boards worked out as the page opens
-- (no stored totals).
--
-- WHY. The leaderboards are a feature of their own: a student's choices
-- (asked once, joined, how they appear, the username) live on a card of
-- their own, so `users` stays private to each student and the boards read
-- only the card. The school boards need one name per school: a school not
-- on the regulator's list is a suggested school, one row its classmates
-- pick, approved, merged or removed by the admin — never loose text.
--
-- WHAT.
--   1. schools: status (listed / suggested), town, suggested_by,
--      suggested_utc; the id's numbering past the list's highest; the region empty
--      only on a suggestion; one name per region, capitals and spaces
--      ignored. The browser reads the list's own columns, never who
--      suggested a school; no browser writes (rule 9).
--   2. choose_suggested_school (a student's "not listed" school, found or
--      made, and set as theirs); the admin's approve_school, merge_school,
--      remove_school and school_suggestions.
--   3. users.school_other retired: each name typed into it is the
--      student's suggested school (no region — the column never had one),
--      or the listed school of that name when there is exactly one.
--   4. leaderboard_cards — one per student, made when first asked to join.
--   5. The name lists (Sam, 2026-10-20) and the card's functions:
--      leaderboard_card, leaderboard_not_now, leaderboard_join,
--      leaderboard_leave, leaderboard_show_as, leaderboard_rename,
--      leaderboard_random_name.
--   6. leaderboard_board(student, period, view, day): Today / This week /
--      All time over My school / My programme / All of Ghana / Schools,
--      worked out from challenge_plays as it is asked — the top 10, the
--      student's own line and the one above and below. A play left going
--      past its time in the last week is closed first, as time_up.
--
-- REACH. Dev now; prod at the next release Sam approves. main's code on
-- the dev site still writes users.school_other when registering and on
-- Profile, and the admin's student page reads it: those three fail on the
-- dev site until this branch is merged (only Sam, on dev).

set search_path = licensure_gh;

-- ── 1. suggested schools ──────────────────────────────────────────────
alter table schools add column if not exists status text not null default 'listed';
alter table schools add column if not exists town text;
alter table schools add column if not exists suggested_by text references users (user_id) on delete set null;
alter table schools add column if not exists suggested_utc timestamptz;

alter table schools drop constraint if exists schools_status_check;
alter table schools add constraint schools_status_check check (status in ('listed', 'suggested'));

-- a suggestion may wait for its region (the names typed before); a listed
-- school always has one
alter table schools alter column region drop not null;
alter table schools drop constraint if exists schools_listed_region_check;
alter table schools add constraint schools_listed_region_check check (status = 'suggested' or region is not null);

-- a suggestion takes the id column's next number: past the highest the
-- regulator's list was copied in with, whatever that copy left behind
select setval(pg_get_serial_sequence('licensure_gh.schools', 'id'),
              greatest((select coalesce(max(id), 1) from schools),
                       (select last_value from schools_id_seq)));

-- A school's name as compared: capitals and runs of spaces ignored.
create or replace function _school_key(p_name text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;
revoke execute on function _school_key(text) from public, anon, authenticated;

-- one name per region; a suggestion with no region is one of its own
create unique index if not exists schools_one_name_per_region
  on schools (coalesce(region, ''), _school_key(name));

-- the browser: the list's own columns, read only (rule 9)
revoke all on schools from anon, authenticated;
grant select (id, name, region, ownership, programmes, active, status, town, created_at)
  on schools to anon, authenticated;

-- ── 2. a student's "not listed" school, and the admin's three ─────────

-- Find or make the student's suggested school and make it theirs. The
-- same name in the same region is the same school; with no region, the
-- one listed school of that name when there is exactly one. Returns its id.
create or replace function choose_suggested_school(
  p_user_id text,
  p_name    text,
  p_region  text default null,
  p_town    text default null
)
returns bigint
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_name    text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_key     text := _school_key(p_name);
  v_region  text := nullif(btrim(coalesce(p_region, '')), '');
  v_town    text := nullif(regexp_replace(btrim(coalesce(p_town, '')), '\s+', ' ', 'g'), '');
  v_program text;
  v_id      bigint;
begin
  select u.program_id into v_program from users u where u.user_id = p_user_id;
  if not found then
    raise exception 'No such student.';
  end if;
  if char_length(v_name) < 3 or char_length(v_name) > 120 then
    raise exception 'A school''s name is 3 to 120 characters.';
  end if;
  if v_town is not null and char_length(v_town) > 80 then
    raise exception 'A town''s name is at most 80 characters.';
  end if;
  if v_region is not null
     and not exists (select 1 from schools s where s.status = 'listed' and s.region = v_region) then
    raise exception 'Unknown region.';
  end if;

  -- one maker at a time for a name in a region
  perform pg_advisory_xact_lock(hashtextextended('licensure_gh.school:' || coalesce(v_region, '') || ':' || v_key, 0));

  select s.id into v_id
  from schools s
  where coalesce(s.region, '') = coalesce(v_region, '') and _school_key(s.name) = v_key;

  if v_id is null and v_region is null then
    select min(s.id) into v_id
    from schools s
    where s.status = 'listed' and _school_key(s.name) = v_key
    having count(*) = 1;
  end if;

  if v_id is null then
    insert into schools (name, region, programmes, active, status, town, suggested_by, suggested_utc)
    values (v_name, v_region,
            case when v_program is null then '{}'::text[] else array[v_program] end,
            true, 'suggested', v_town, p_user_id, now())
    returning id into v_id;
  end if;

  update users set school_id = v_id where user_id = p_user_id;
  return v_id;
end;
$$;
revoke execute on function choose_suggested_school(text, text, text, text) from public, anon, authenticated;

-- Approve a suggestion onto the list, its spelling, region and town
-- corrected on the way if the admin gives them. It needs a region.
create or replace function approve_school(
  p_school_id bigint,
  p_name      text default null,
  p_region    text default null,
  p_town      text default null
)
returns void
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v        schools%rowtype;
  v_name   text;
  v_region text;
begin
  select * into v from schools where id = p_school_id for update;
  if not found then
    raise exception 'No such school.';
  end if;
  if v.status <> 'suggested' then
    raise exception 'This school is already on the list.';
  end if;

  v_name := coalesce(nullif(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), ''), v.name);
  v_region := coalesce(nullif(btrim(coalesce(p_region, '')), ''), v.region);
  if v_region is null then
    raise exception 'Choose the school''s region first.';
  end if;
  if not exists (select 1 from schools s where s.status = 'listed' and s.region = v_region) then
    raise exception 'Unknown region.';
  end if;
  if char_length(v_name) < 3 or char_length(v_name) > 120 then
    raise exception 'A school''s name is 3 to 120 characters.';
  end if;
  if exists (select 1 from schools s
             where s.id <> p_school_id and coalesce(s.region, '') = v_region
               and _school_key(s.name) = _school_key(v_name)) then
    raise exception 'A school of that name is already in that region. Merge into it instead.';
  end if;

  update schools
  set status = 'listed',
      name = v_name,
      region = v_region,
      town = coalesce(nullif(regexp_replace(btrim(coalesce(p_town, '')), '\s+', ' ', 'g'), ''), town)
  where id = p_school_id;
end;
$$;
revoke execute on function approve_school(bigint, text, text, text) from public, anon, authenticated;

-- Merge a suggestion into a listed school: its students and their
-- challenge plays move there, the suggestion goes. Returns the students moved.
create or replace function merge_school(p_from bigint, p_into bigint)
returns integer
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_status text;
  v_n      integer;
begin
  select s.status into v_status from schools s where s.id = p_from for update;
  if not found then
    raise exception 'No such school.';
  end if;
  if v_status <> 'suggested' then
    raise exception 'Only a suggested school can be merged.';
  end if;
  if p_into = p_from or not exists (select 1 from schools s where s.id = p_into and s.status = 'listed') then
    raise exception 'Merge into a school on the list.';
  end if;

  update users set school_id = p_into where school_id = p_from;
  get diagnostics v_n = row_count;
  update challenge_plays set school_id = p_into where school_id = p_from;
  delete from schools where id = p_from;
  return v_n;
end;
$$;
revoke execute on function merge_school(bigint, bigint) from public, anon, authenticated;

-- Remove a suggestion (a joke or a mistake): its students' school is
-- cleared, to choose again, and their plays count for no school. Returns
-- the students cleared.
create or replace function remove_school(p_school_id bigint)
returns integer
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_status text;
  v_n      integer;
begin
  select s.status into v_status from schools s where s.id = p_school_id for update;
  if not found then
    raise exception 'No such school.';
  end if;
  if v_status <> 'suggested' then
    raise exception 'Only a suggested school can be removed.';
  end if;

  update users set school_id = null where school_id = p_school_id;
  get diagnostics v_n = row_count;
  update challenge_plays set school_id = null where school_id = p_school_id;
  delete from schools where id = p_school_id;
  return v_n;
end;
$$;
revoke execute on function remove_school(bigint) from public, anon, authenticated;

-- The admin's list of suggestions: who suggested each, when, and how many
-- students have it as their school.
create or replace function school_suggestions()
returns table (
  id                bigint,
  name              text,
  region            text,
  town              text,
  suggested_utc     timestamptz,
  suggested_by      text,
  suggested_by_name text,
  students          integer
)
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select s.id, s.name, s.region, s.town, s.suggested_utc, s.suggested_by,
         coalesce(nullif(btrim(concat_ws(' ', u.forename, u.surname)), ''), u.name, u.email),
         (select count(*) from users x where x.school_id = s.id)::integer
  from schools s
  left join users u on u.user_id = s.suggested_by
  where s.status = 'suggested'
  order by s.region nulls first, s.name;
$$;
revoke execute on function school_suggestions() from public, anon, authenticated;

-- ── 3. users.school_other retired ─────────────────────────────────────
-- Each typed name becomes the student's suggested school (or the one
-- listed school of that name). A name under 3 characters says nothing to
-- match; that student chooses again (the dashboard's nudge asks).
do $$
declare
  r record;
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'licensure_gh' and table_name = 'users' and column_name = 'school_other') then
    for r in execute
      'select user_id, left(regexp_replace(btrim(school_other), ''\s+'', '' '', ''g''), 120) as typed
       from licensure_gh.users
       where school_id is null and nullif(btrim(school_other), '''') is not null
       order by created_utc nulls last, user_id'
    loop
      if char_length(r.typed) >= 3 then
        perform licensure_gh.choose_suggested_school(r.user_id, r.typed, null, null);
      end if;
    end loop;
  end if;
end;
$$;

alter table users drop column if exists school_other;

-- ── 4. the leaderboard card ───────────────────────────────────────────
create table if not exists leaderboard_cards (
  user_id          text primary key references users (user_id),
  asked_utc        timestamptz not null default now(),
  joined_utc       timestamptz,
  shown_as         text not null default 'username',
  word             text,
  animal           text,
  name_number      integer,
  name_changed_utc timestamptz,
  created_utc      timestamptz not null default now(),
  constraint leaderboard_cards_shown_as_check check (shown_as in ('username', 'name')),
  constraint leaderboard_cards_name_whole check (
    (word is null) = (animal is null)
    and (name_number is null or (word is not null and name_number >= 2))),
  constraint leaderboard_cards_joined_named check (joined_utc is null or word is not null)
);
-- a username is unique: "Brave Lion", then "Brave Lion 2"
create unique index if not exists leaderboard_cards_username
  on leaderboard_cards (word, animal, coalesce(name_number, 1))
  where word is not null;

alter table leaderboard_cards enable row level security;
revoke all on leaderboard_cards from anon, authenticated;

-- ── 5. the names and the card's functions ─────────────────────────────

-- The lists approved by Sam, 2026-10-20 (05): plain, kind words; no animal
-- used as an insult or linked with witchcraft or bad luck in Ghana.
create or replace function leaderboard_words()
returns text[]
language sql
immutable
set search_path = pg_catalog
as $$
  select array[
    'Agile', 'Alert', 'Bold', 'Brave', 'Bright', 'Brilliant', 'Calm', 'Cheerful',
    'Clever', 'Cosmic', 'Daring', 'Dazzling', 'Eager', 'Epic', 'Fearless', 'Focused',
    'Gentle', 'Glowing', 'Golden', 'Grand', 'Happy', 'Hardy', 'Heroic', 'Honest',
    'Jolly', 'Joyful', 'Keen', 'Kind', 'Lively', 'Loyal', 'Lucky', 'Merry',
    'Mighty', 'Nimble', 'Noble', 'Quick', 'Radiant', 'Rapid', 'Royal', 'Sharp',
    'Shining', 'Smart', 'Speedy', 'Steady', 'Stellar', 'Sunny', 'Swift', 'Trusty',
    'Valiant', 'Vibrant', 'Wise', 'Witty'
  ]::text[];
$$;
revoke execute on function leaderboard_words() from public, anon, authenticated;

create or replace function leaderboard_animals()
returns text[]
language sql
immutable
set search_path = pg_catalog
as $$
  select array[
    'Lion', 'Leopard', 'Tiger', 'Elephant', 'Giraffe', 'Zebra', 'Rhino', 'Camel',
    'Horse', 'Deer', 'Bison', 'Bear', 'Panda', 'Koala', 'Kangaroo', 'Fox',
    'Wolf', 'Rabbit', 'Squirrel', 'Hedgehog', 'Otter', 'Beaver', 'Eagle', 'Peacock',
    'Flamingo', 'Swan', 'Dove', 'Penguin', 'Dolphin', 'Octopus', 'Turtle', 'Crocodile',
    'Butterfly', 'Bee', 'Ladybird', 'Spider', 'Unicorn', 'Dragon'
  ]::text[];
$$;
revoke execute on function leaderboard_animals() from public, anon, authenticated;

-- "Brave Lion", "Brave Lion 2"
create or replace function _leaderboard_username(p_word text, p_animal text, p_number integer)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case when p_word is null then null
              else p_word || ' ' || p_animal || coalesce(' ' || p_number::text, '') end;
$$;
revoke execute on function _leaderboard_username(text, text, integer) from public, anon, authenticated;

-- "Ama O." — the first name and the surname's initial, never the full name
create or replace function _leaderboard_person(p_forename text, p_surname text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case when nullif(btrim(coalesce(p_forename, '')), '') is null then null
              else btrim(p_forename)
                   || coalesce(' ' || upper(left(nullif(btrim(coalesce(p_surname, '')), ''), 1)) || '.', '') end;
$$;
revoke execute on function _leaderboard_person(text, text) from public, anon, authenticated;

-- A word and an animal from the lists, or a refusal.
create or replace function _leaderboard_check_name(p_word text, p_animal text)
returns void
language plpgsql
immutable
set search_path = licensure_gh
as $$
begin
  if p_word is null or not (p_word = any (leaderboard_words())) then
    raise exception 'Pick a word from the list.';
  end if;
  if p_animal is null or not (p_animal = any (leaderboard_animals())) then
    raise exception 'Pick an animal from the list.';
  end if;
end;
$$;
revoke execute on function _leaderboard_check_name(text, text) from public, anon, authenticated;

-- The number a word and an animal take for this student: null when the
-- name is free, else the smallest free from 2. Holds the name's lock until
-- the caller's transaction ends, so two students cannot take the same.
create or replace function _leaderboard_name_number(p_user_id text, p_word text, p_animal text)
returns integer
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('licensure_gh.leaderboard_name:' || p_word || ':' || p_animal, 0));
  select min(g.n) into v_n
  from generate_series(1, (select count(*) + 1 from leaderboard_cards c
                           where c.word = p_word and c.animal = p_animal)::integer) as g(n)
  where not exists (select 1 from leaderboard_cards c
                    where c.word = p_word and c.animal = p_animal
                      and coalesce(c.name_number, 1) = g.n and c.user_id <> p_user_id);
  return nullif(v_n, 1);
end;
$$;
revoke execute on function _leaderboard_name_number(text, text, text) from public, anon, authenticated;

-- A student's card, or null before they were first asked.
create or replace function leaderboard_card(p_user_id text)
returns jsonb
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select jsonb_build_object(
           'asked_utc', c.asked_utc,
           'joined', c.joined_utc is not null,
           'joined_utc', c.joined_utc,
           'shown_as', c.shown_as,
           'word', c.word,
           'animal', c.animal,
           'name_number', c.name_number,
           'username', _leaderboard_username(c.word, c.animal, c.name_number),
           'person', _leaderboard_person(u.forename, u.surname),
           'photo', nullif(btrim(coalesce(u.avatar_url, '')), ''),
           'name_changed_utc', c.name_changed_utc,
           'next_change_utc', c.name_changed_utc + interval '7 days')
  from leaderboard_cards c
  join users u on u.user_id = c.user_id
  where c.user_id = p_user_id;
$$;
revoke execute on function leaderboard_card(text) from public, anon, authenticated;

-- "Not now, just play": the card made, asked, not joined. Asked once.
create or replace function leaderboard_not_now(p_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
begin
  if not exists (select 1 from users u where u.user_id = p_user_id) then
    raise exception 'No such student.';
  end if;
  insert into leaderboard_cards (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  return leaderboard_card(p_user_id);
end;
$$;
revoke execute on function leaderboard_not_now(text) from public, anon, authenticated;

-- Join (or join again): how they appear, and — the first time — the
-- username. A student who already holds a username keeps it; changing it is
-- leaderboard_rename's.
create or replace function leaderboard_join(p_user_id text, p_shown_as text, p_word text, p_animal text)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v leaderboard_cards%rowtype;
begin
  if p_shown_as is null or p_shown_as not in ('username', 'name') then
    raise exception 'Choose how you appear.';
  end if;
  if not exists (select 1 from users u where u.user_id = p_user_id) then
    raise exception 'No such student.';
  end if;

  insert into leaderboard_cards (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  select * into v from leaderboard_cards where user_id = p_user_id for update;

  if v.word is null then
    perform _leaderboard_check_name(p_word, p_animal);
    update leaderboard_cards
    set word = p_word,
        animal = p_animal,
        name_number = _leaderboard_name_number(p_user_id, p_word, p_animal)
    where user_id = p_user_id;
  end if;

  update leaderboard_cards
  set joined_utc = coalesce(joined_utc, now()),
      shown_as = p_shown_as
  where user_id = p_user_id;

  return leaderboard_card(p_user_id);
end;
$$;
revoke execute on function leaderboard_join(text, text, text, text) from public, anon, authenticated;

-- Leave the boards (Profile's switch). The username is kept for a return.
create or replace function leaderboard_leave(p_user_id text)
returns jsonb
language sql
security definer
set search_path = licensure_gh
as $$
  update leaderboard_cards set joined_utc = null where user_id = p_user_id;
  select leaderboard_card(p_user_id);
$$;
revoke execute on function leaderboard_leave(text) from public, anon, authenticated;

-- How they appear: the username and animal, or the name and photo. Any time.
create or replace function leaderboard_show_as(p_user_id text, p_shown_as text)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
begin
  if p_shown_as is null or p_shown_as not in ('username', 'name') then
    raise exception 'Choose how you appear.';
  end if;
  update leaderboard_cards set shown_as = p_shown_as where user_id = p_user_id;
  if not found then
    raise exception 'Join the leaderboards first.';
  end if;
  return leaderboard_card(p_user_id);
end;
$$;
revoke execute on function leaderboard_show_as(text, text) from public, anon, authenticated;

-- A new username: once a week (the name chosen at joining is not a change).
create or replace function leaderboard_rename(p_user_id text, p_word text, p_animal text)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v leaderboard_cards%rowtype;
begin
  select * into v from leaderboard_cards where user_id = p_user_id for update;
  if not found or v.word is null then
    raise exception 'Join the leaderboards first.';
  end if;
  if v.word = p_word and v.animal = p_animal then
    return leaderboard_card(p_user_id);
  end if;
  if v.name_changed_utc is not null and now() < v.name_changed_utc + interval '7 days' then
    raise exception 'A username can change once a week.';
  end if;
  perform _leaderboard_check_name(p_word, p_animal);

  update leaderboard_cards
  set word = p_word,
      animal = p_animal,
      name_number = _leaderboard_name_number(p_user_id, p_word, p_animal),
      name_changed_utc = now()
  where user_id = p_user_id;

  return leaderboard_card(p_user_id);
end;
$$;
revoke execute on function leaderboard_rename(text, text, text) from public, anon, authenticated;

-- A word and an animal at random: the join screen's first card, and a spin.
create or replace function leaderboard_random_name()
returns jsonb
language sql
volatile
set search_path = licensure_gh
as $$
  select jsonb_build_object(
           'word', (leaderboard_words())[1 + floor(random() * cardinality(leaderboard_words()))::integer],
           'animal', (leaderboard_animals())[1 + floor(random() * cardinality(leaderboard_animals()))::integer]);
$$;
revoke execute on function leaderboard_random_name() from public, anon, authenticated;

-- ── 6. the boards ─────────────────────────────────────────────────────

-- Plays of the last week left going past their time close as time_up, so
-- a student who left mid-play is on the boards before they come back.
create or replace function _challenge_close_due_recent()
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
    from challenge_days cd
    join challenge_plays p on p.challenge_id = cd.challenge_id
    where cd.day >= (now() at time zone 'UTC')::date - 7
      and p.status = 'playing' and now() >= p.ends_utc
    for update of p skip locked
  loop
    perform _challenge_close(r.play_id, r.ends_utc, 'time_up');
  end loop;
end;
$$;
revoke execute on function _challenge_close_due_recent() from public, anon, authenticated;

-- A board, worked out as it is asked (Sam, 2026-10-24: no stored totals).
--   p_period: 'today' — the day's right answers, then the quicker time;
--             'week'  — Monday to Sunday, the best 6 days' right answers,
--                       then the lower total time;
--             'all'   — the average right answers per challenge, from 10
--                       played; then more played, then the quicker average.
--   p_view:   'school' (the student's school in their programme),
--             'programme', 'ghana' (every programme), 'schools' (the
--             programme's listed schools by the average of each one's best
--             10; a school with fewer than 10 players waits).
--   p_day:    the day the board is for (today when null).
-- Only students who joined; their past plays count. A full tie shares a rank.
create or replace function leaderboard_board(p_user_id text, p_period text, p_view text, p_day date default null)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_day         date := coalesce(p_day, (now() at time zone 'UTC')::date);
  v_from        date;
  v_to          date;
  v_program     text;
  v_school      bigint;
  v_school_name text;
  v_school_kind text;
  v_joined      boolean;
  v_head        jsonb;
begin
  if p_period is null or p_period not in ('today', 'week', 'all') then
    raise exception 'Unknown period.';
  end if;
  if p_view is null or p_view not in ('school', 'programme', 'ghana', 'schools') then
    raise exception 'Unknown board.';
  end if;

  select u.program_id, u.school_id into v_program, v_school from users u where u.user_id = p_user_id;
  if not found then
    raise exception 'No such student.';
  end if;
  select s.name, s.status into v_school_name, v_school_kind from schools s where s.id = v_school;
  v_joined := exists (select 1 from leaderboard_cards c where c.user_id = p_user_id and c.joined_utc is not null);

  if p_period = 'today' then
    v_from := v_day;
    v_to := v_day;
  elsif p_period = 'week' then
    v_from := v_day - (extract(isodow from v_day)::integer - 1);
    v_to := v_from + 6;
  else
    v_from := null;
    v_to := v_day;
  end if;

  perform _challenge_close_due_recent();

  v_head := jsonb_build_object(
    'period', p_period,
    'view', p_view,
    'day', v_day,
    'from', v_from,
    'to', v_to,
    'program_id', v_program,
    'school_id', v_school,
    'school_name', v_school_name,
    'school_suggested', v_school_kind = 'suggested',
    'joined', v_joined,
    'min_played', 10,
    'min_players', 10);

  if p_view <> 'schools' then
    return v_head || (
      with plays as (
        select p.user_id, p.day, p.right_count as r, p.time_taken_s as t
        from challenge_plays p
        join challenge_days cd on cd.challenge_id = p.challenge_id
        join leaderboard_cards c on c.user_id = p.user_id and c.joined_utc is not null
        join users u on u.user_id = p.user_id and u.active and u.role = 'STUDENT'
        where p.status in ('submitted', 'time_up')
          and (v_from is null or cd.day >= v_from) and cd.day <= v_to
          and (p_view = 'ghana' or cd.program_id = v_program)
          and (p_view <> 'school' or p.school_id = v_school)
      ),
      days as (
        select pl.*, row_number() over (partition by pl.user_id order by pl.r desc, pl.t asc, pl.day) as k
        from plays pl
      ),
      scores as (
        select d.user_id,
               count(*)::integer as played,
               (sum(d.r) filter (where p_period <> 'week' or d.k <= 6))::integer as right_sum,
               (sum(d.t) filter (where p_period <> 'week' or d.k <= 6))::integer as time_sum
        from days d
        group by d.user_id
      ),
      board as (
        select s.*,
               case when p_period = 'all' then round(s.right_sum::numeric / s.played, 6) else s.right_sum end as score,
               case when p_period = 'all' then round(s.time_sum::numeric / s.played, 6) else s.time_sum end as tscore
        from scores s
        where p_period <> 'all' or s.played >= 10
      ),
      ranked as (
        select b.*,
               rank() over (order by b.score desc, case when p_period = 'all' then b.played end desc nulls last, b.tscore asc) as rnk,
               row_number() over (order by b.score desc, case when p_period = 'all' then b.played end desc nulls last, b.tscore asc, b.user_id) as pos
        from board b
      ),
      lines as (
        select r.pos, r.user_id,
               jsonb_build_object(
                 'rank', r.rnk,
                 'name', case when c.shown_as = 'name'
                              then coalesce(_leaderboard_person(u.forename, u.surname), _leaderboard_username(c.word, c.animal, c.name_number))
                              else _leaderboard_username(c.word, c.animal, c.name_number) end,
                 'animal', c.animal,
                 'photo', case when c.shown_as = 'name' then nullif(btrim(coalesce(u.avatar_url, '')), '') end,
                 'right', r.right_sum,
                 'time_s', r.time_sum,
                 'played', r.played,
                 'average', case when p_period = 'all' then round(r.score, 2) end,
                 'average_time_s', case when p_period = 'all' then round(r.tscore) end,
                 'is_me', r.user_id = p_user_id) as j
        from ranked r
        join leaderboard_cards c on c.user_id = r.user_id
        join users u on u.user_id = r.user_id
      ),
      me as (
        select l.pos from lines l where l.user_id = p_user_id
      )
      select jsonb_build_object(
               'players', (select count(*) from ranked),
               'top', coalesce((select jsonb_agg(l.j order by l.pos) from lines l where l.pos <= 10), '[]'::jsonb),
               'me', (select l.j from lines l where l.user_id = p_user_id),
               'around', case when (select m.pos from me m) > 10
                              then (select jsonb_agg(l.j order by l.pos) from lines l, me m
                                    where l.pos between m.pos - 1 and m.pos + 1)
                              else '[]'::jsonb end,
               'me_played', (select count(*) from plays pl where pl.user_id = p_user_id))
    );
  end if;

  -- the Schools view: each school's players by the same rules, the
  -- school's score the average of its best 10
  return v_head || (
    with plays as (
      select p.school_id, p.user_id, p.day, p.right_count as r, p.time_taken_s as t
      from challenge_plays p
      join challenge_days cd on cd.challenge_id = p.challenge_id
      join leaderboard_cards c on c.user_id = p.user_id and c.joined_utc is not null
      join users u on u.user_id = p.user_id and u.active and u.role = 'STUDENT'
      where p.status in ('submitted', 'time_up')
        and p.school_id is not null
        and (v_from is null or cd.day >= v_from) and cd.day <= v_to
        and cd.program_id = v_program
    ),
    days as (
      select pl.*, row_number() over (partition by pl.school_id, pl.user_id order by pl.r desc, pl.t asc, pl.day) as k
      from plays pl
    ),
    scores as (
      select d.school_id, d.user_id,
             count(*)::integer as played,
             (sum(d.r) filter (where p_period <> 'week' or d.k <= 6))::integer as right_sum,
             (sum(d.t) filter (where p_period <> 'week' or d.k <= 6))::integer as time_sum
      from days d
      group by d.school_id, d.user_id
    ),
    board as (
      select s.*,
             case when p_period = 'all' then round(s.right_sum::numeric / s.played, 6) else s.right_sum end as score,
             case when p_period = 'all' then round(s.time_sum::numeric / s.played, 6) else s.time_sum end as tscore
      from scores s
      where p_period <> 'all' or s.played >= 10
    ),
    ranked as (
      select b.*,
             row_number() over (partition by b.school_id
                                order by b.score desc, case when p_period = 'all' then b.played end desc nulls last, b.tscore asc, b.user_id) as pos
      from board b
    ),
    school_scores as (
      select r.school_id,
             count(*)::integer as players,
             avg(r.score) filter (where r.pos <= 10) as s,
             avg(r.tscore) filter (where r.pos <= 10) as ts
      from ranked r
      group by r.school_id
    ),
    sranked as (
      select ss.*, sch.name,
             rank() over (order by round(ss.s, 6) desc, round(ss.ts, 6) asc) as rnk,
             row_number() over (order by round(ss.s, 6) desc, round(ss.ts, 6) asc, sch.name, ss.school_id) as pos
      from school_scores ss
      join schools sch on sch.id = ss.school_id
      where sch.status = 'listed' and ss.players >= 10
    ),
    lines as (
      select sr.pos, sr.school_id,
             jsonb_build_object(
               'rank', sr.rnk,
               'school', sr.name,
               'players', sr.players,
               'average', round(sr.s, 2),
               'average_time_s', round(sr.ts),
               'is_mine', sr.school_id = v_school) as j
      from sranked sr
    ),
    mine as (
      select l.pos from lines l where l.school_id = v_school
    )
    select jsonb_build_object(
             'schools', (select count(*) from sranked),
             'top', coalesce((select jsonb_agg(l.j order by l.pos) from lines l where l.pos <= 10), '[]'::jsonb),
             'mine', case when v_school is null then null else jsonb_build_object(
                       'school', v_school_name,
                       'suggested', v_school_kind = 'suggested',
                       'players', coalesce((select ss.players from school_scores ss where ss.school_id = v_school), 0),
                       'rank', (select sr.rnk from sranked sr where sr.school_id = v_school),
                       'of', (select count(*) from sranked),
                       'needed', case when v_school_kind = 'listed'
                                       and not exists (select 1 from sranked sr where sr.school_id = v_school)
                                      then 10 - coalesce((select ss.players from school_scores ss where ss.school_id = v_school), 0) end)
                     end,
             'around', case when (select m.pos from mine m) > 10
                            then (select jsonb_agg(l.j order by l.pos) from lines l, mine m
                                  where l.pos between m.pos - 1 and m.pos + 1)
                            else '[]'::jsonb end,
             'waiting', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'school', sch.name,
                        'players', ss.players,
                        'needed', 10 - ss.players,
                        'is_mine', ss.school_id = v_school) order by ss.players desc, sch.name)
               from school_scores ss
               join schools sch on sch.id = ss.school_id
               where sch.status = 'listed' and ss.players < 10), '[]'::jsonb))
  );
end;
$$;
revoke execute on function leaderboard_board(text, text, text, date) from public, anon, authenticated;
