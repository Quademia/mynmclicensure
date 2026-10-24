-- 20261024230000_leaderboard_rows.sql — 05-progress.md (G1b, 05.14): Show
-- more on the Leaderboards page (Sam, 2026-10-24: "a Show more under the
-- board that loads the next 20 players at a time … it should be able to
-- show all the players"). No table changes.
--
-- WHY. leaderboard_board hands back the top 10 and the student's
-- neighbours; Show more needs the board from a given place onward, ranked
-- exactly as the board is. So the ranking moves into two inner functions
-- both read: _leaderboard_people (a board of students) and
-- _leaderboard_schools (the Schools board), and a line's words into
-- _leaderboard_line. leaderboard_board keeps its shape — the same answer,
-- each line now carrying its place on the board (`pos`) so the page can
-- join the pieces; leaderboard_board_rows(student, period, view, from,
-- count) hands back `count` lines (1 to 50) from place `from`.
--
-- REACH. Dev now; prod at the next release Sam approves. main's code on
-- the dev site reads leaderboard_board only, whose answer gains a key.

set search_path = licensure_gh;

-- A board of students, every one who joined and played in the time: their
-- right answers and time (This week's best 6 days), and their place. A
-- student below All time's 10 challenges is returned with no place (pos and
-- rnk null) so the board can say how many they have played.
create or replace function _leaderboard_people(p_user_id text, p_period text, p_view text, p_day date)
returns table (
  pos       integer,
  rnk       integer,
  user_id   text,
  right_sum integer,
  time_sum  integer,
  played    integer,
  score     numeric,
  tscore    numeric
)
language sql
stable
security definer
set search_path = licensure_gh
as $$
  with me as (
    select u.program_id, u.school_id from users u where u.user_id = p_user_id
  ),
  span as (
    select case when p_period = 'today' then p_day
                when p_period = 'week' then p_day - (extract(isodow from p_day)::integer - 1)
           end as d_from,
           case when p_period = 'week' then p_day - (extract(isodow from p_day)::integer - 1) + 6
                else p_day
           end as d_to
  ),
  plays as (
    select p.user_id, p.day, p.right_count as r, p.time_taken_s as t
    from challenge_plays p
    join challenge_days cd on cd.challenge_id = p.challenge_id
    join leaderboard_cards c on c.user_id = p.user_id and c.joined_utc is not null
    join users u on u.user_id = p.user_id and u.active and u.role = 'STUDENT'
    cross join me
    cross join span
    where p.status in ('submitted', 'time_up')
      and (span.d_from is null or cd.day >= span.d_from) and cd.day <= span.d_to
      and (p_view = 'ghana' or cd.program_id = me.program_id)
      and (p_view <> 'school' or p.school_id = me.school_id)
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
           case when p_period = 'all' then round(s.time_sum::numeric / s.played, 6) else s.time_sum end as tscore,
           (p_period <> 'all' or s.played >= 10) as on_board
    from scores s
  )
  select (case when b.on_board then row_number() over (
            partition by b.on_board
            order by b.score desc, case when p_period = 'all' then b.played end desc nulls last, b.tscore asc, b.user_id) end)::integer,
         (case when b.on_board then rank() over (
            partition by b.on_board
            order by b.score desc, case when p_period = 'all' then b.played end desc nulls last, b.tscore asc) end)::integer,
         b.user_id, b.right_sum, b.time_sum, b.played, b.score, b.tscore
  from board b;
$$;
revoke execute on function _leaderboard_people(text, text, text, date) from public, anon, authenticated;

-- The Schools board: every school with a joined player in the programme
-- and time — its players and the average of its best 10 — placed when it is
-- listed and has 10 players (pos and rnk null otherwise).
create or replace function _leaderboard_schools(p_user_id text, p_period text, p_day date)
returns table (
  pos       integer,
  rnk       integer,
  school_id bigint,
  name      text,
  status    text,
  players   integer,
  s         numeric,
  ts        numeric
)
language sql
stable
security definer
set search_path = licensure_gh
as $$
  with me as (
    select u.program_id from users u where u.user_id = p_user_id
  ),
  span as (
    select case when p_period = 'today' then p_day
                when p_period = 'week' then p_day - (extract(isodow from p_day)::integer - 1)
           end as d_from,
           case when p_period = 'week' then p_day - (extract(isodow from p_day)::integer - 1) + 6
                else p_day
           end as d_to
  ),
  plays as (
    select p.school_id, p.user_id, p.day, p.right_count as r, p.time_taken_s as t
    from challenge_plays p
    join challenge_days cd on cd.challenge_id = p.challenge_id
    join leaderboard_cards c on c.user_id = p.user_id and c.joined_utc is not null
    join users u on u.user_id = p.user_id and u.active and u.role = 'STUDENT'
    cross join me
    cross join span
    where p.status in ('submitted', 'time_up')
      and p.school_id is not null
      and (span.d_from is null or cd.day >= span.d_from) and cd.day <= span.d_to
      and cd.program_id = me.program_id
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
    select sc.*,
           case when p_period = 'all' then round(sc.right_sum::numeric / sc.played, 6) else sc.right_sum end as score,
           case when p_period = 'all' then round(sc.time_sum::numeric / sc.played, 6) else sc.time_sum end as tscore
    from scores sc
    where p_period <> 'all' or sc.played >= 10
  ),
  ranked as (
    select b.*,
           row_number() over (partition by b.school_id
                              order by b.score desc, case when p_period = 'all' then b.played end desc nulls last, b.tscore asc, b.user_id) as upos
    from board b
  ),
  school_scores as (
    select r.school_id,
           count(*)::integer as players,
           avg(r.score) filter (where r.upos <= 10) as s,
           avg(r.tscore) filter (where r.upos <= 10) as ts
    from ranked r
    group by r.school_id
  ),
  named as (
    select ss.*, sch.name, sch.status, (sch.status = 'listed' and ss.players >= 10) as on_board
    from school_scores ss
    join schools sch on sch.id = ss.school_id
  )
  select (case when n.on_board then row_number() over (
            partition by n.on_board order by round(n.s, 6) desc, round(n.ts, 6) asc, n.name, n.school_id) end)::integer,
         (case when n.on_board then rank() over (
            partition by n.on_board order by round(n.s, 6) desc, round(n.ts, 6) asc) end)::integer,
         n.school_id, n.name, n.status, n.players, n.s, n.ts
  from named n;
$$;
revoke execute on function _leaderboard_schools(text, text, date) from public, anon, authenticated;

-- A student's line as every board shows it: the username, or "Ama O." with
-- the photo for one shown by name.
create or replace function _leaderboard_line(
  p_period  text,
  p_viewer  text,
  p_user_id text,
  p_rnk     integer,
  p_pos     integer,
  p_right   integer,
  p_time    integer,
  p_played  integer,
  p_score   numeric,
  p_tscore  numeric
)
returns jsonb
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select jsonb_build_object(
           'rank', p_rnk,
           'pos', p_pos,
           'name', case when c.shown_as = 'name'
                        then coalesce(_leaderboard_person(u.forename, u.surname), _leaderboard_username(c.word, c.animal, c.name_number))
                        else _leaderboard_username(c.word, c.animal, c.name_number) end,
           'animal', c.animal,
           'photo', case when c.shown_as = 'name' then nullif(btrim(coalesce(u.avatar_url, '')), '') end,
           'right', p_right,
           'time_s', p_time,
           'played', p_played,
           'average', case when p_period = 'all' then round(p_score, 2) end,
           'average_time_s', case when p_period = 'all' then round(p_tscore) end,
           'is_me', p_user_id = p_viewer)
  from leaderboard_cards c
  join users u on u.user_id = c.user_id
  where c.user_id = p_user_id;
$$;
revoke execute on function _leaderboard_line(text, text, text, integer, integer, integer, integer, integer, numeric, numeric) from public, anon, authenticated;

-- A school's line on the Schools board.
create or replace function _leaderboard_school_line(p_rnk integer, p_pos integer, p_name text, p_players integer, p_s numeric, p_ts numeric, p_mine boolean)
returns jsonb
language sql
immutable
set search_path = licensure_gh
as $$
  select jsonb_build_object(
           'rank', p_rnk,
           'pos', p_pos,
           'school', p_name,
           'players', p_players,
           'average', round(p_s, 2),
           'average_time_s', round(p_ts),
           'is_mine', coalesce(p_mine, false));
$$;
revoke execute on function _leaderboard_school_line(integer, integer, text, integer, numeric, numeric, boolean) from public, anon, authenticated;

-- The board, as 20261024180000 made it, on the inner functions: the top
-- 10, the student's own line, and outside the top 10 the one above, the
-- student and the one below — each line with its place (`pos`).
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
      with r as materialized (
        select * from _leaderboard_people(p_user_id, p_period, p_view, v_day)
      ),
      mine as (
        select r.pos from r where r.user_id = p_user_id
      ),
      lines as (
        select r.pos,
               _leaderboard_line(p_period, p_user_id, r.user_id, r.rnk, r.pos, r.right_sum, r.time_sum, r.played, r.score, r.tscore) as j
        from r
        where r.pos is not null
          and (r.pos <= 10 or r.pos between (select m.pos from mine m) - 1 and (select m.pos from mine m) + 1)
      )
      select jsonb_build_object(
               'players', (select count(*) from r where r.pos is not null),
               'top', coalesce((select jsonb_agg(l.j order by l.pos) from lines l where l.pos <= 10), '[]'::jsonb),
               'me', (select l.j from lines l where l.pos = (select m.pos from mine m)),
               'around', case when (select m.pos from mine m) > 10
                              then (select jsonb_agg(l.j order by l.pos) from lines l
                                    where l.pos between (select m.pos from mine m) - 1 and (select m.pos from mine m) + 1)
                              else '[]'::jsonb end,
               'me_played', coalesce((select r.played from r where r.user_id = p_user_id), 0))
    );
  end if;

  -- the Schools view
  return v_head || (
    with r as materialized (
      select * from _leaderboard_schools(p_user_id, p_period, v_day)
    ),
    mine as (
      select r.pos, r.rnk, r.players from r where r.school_id = v_school
    ),
    lines as (
      select r.pos, _leaderboard_school_line(r.rnk, r.pos, r.name, r.players, r.s, r.ts, r.school_id = v_school) as j
      from r
      where r.pos is not null
    )
    select jsonb_build_object(
             'schools', (select count(*) from lines),
             'top', coalesce((select jsonb_agg(l.j order by l.pos) from lines l where l.pos <= 10), '[]'::jsonb),
             'mine', case when v_school is null then null else jsonb_build_object(
                       'school', v_school_name,
                       'suggested', v_school_kind = 'suggested',
                       'players', coalesce((select m.players from mine m), 0),
                       'rank', (select m.rnk from mine m),
                       'of', (select count(*) from lines),
                       'needed', case when v_school_kind = 'listed' and (select m.pos from mine m) is null
                                      then 10 - coalesce((select m.players from mine m), 0) end)
                     end,
             'around', case when (select m.pos from mine m) > 10
                            then (select jsonb_agg(l.j order by l.pos) from lines l
                                  where l.pos between (select m.pos from mine m) - 1 and (select m.pos from mine m) + 1)
                            else '[]'::jsonb end,
             'waiting', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'school', r.name,
                        'players', r.players,
                        'needed', 10 - r.players,
                        'is_mine', r.school_id = v_school) order by r.players desc, r.name)
               from r
               where r.status = 'listed' and r.players < 10), '[]'::jsonb))
  );
end;
$$;
revoke execute on function leaderboard_board(text, text, text, date) from public, anon, authenticated;

-- Show more: `p_count` lines (1 to 50) of a board from place `p_from`, as
-- the board ranks them.
create or replace function leaderboard_board_rows(
  p_user_id text,
  p_period  text,
  p_view    text,
  p_from    integer,
  p_count   integer default 20,
  p_day     date default null
)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_day    date := coalesce(p_day, (now() at time zone 'UTC')::date);
  v_from   integer := greatest(coalesce(p_from, 1), 1);
  v_to     integer := greatest(coalesce(p_from, 1), 1) + least(greatest(coalesce(p_count, 20), 1), 50) - 1;
  v_school bigint;
begin
  if p_period is null or p_period not in ('today', 'week', 'all') then
    raise exception 'Unknown period.';
  end if;
  if p_view is null or p_view not in ('school', 'programme', 'ghana', 'schools') then
    raise exception 'Unknown board.';
  end if;
  select u.school_id into v_school from users u where u.user_id = p_user_id;
  if not found then
    raise exception 'No such student.';
  end if;

  if p_view = 'schools' then
    return coalesce((
      select jsonb_agg(_leaderboard_school_line(r.rnk, r.pos, r.name, r.players, r.s, r.ts, r.school_id = v_school) order by r.pos)
      from _leaderboard_schools(p_user_id, p_period, v_day) r
      where r.pos between v_from and v_to), '[]'::jsonb);
  end if;

  return coalesce((
    select jsonb_agg(_leaderboard_line(p_period, p_user_id, r.user_id, r.rnk, r.pos, r.right_sum, r.time_sum, r.played, r.score, r.tscore) order by r.pos)
    from _leaderboard_people(p_user_id, p_period, p_view, v_day) r
    where r.pos between v_from and v_to), '[]'::jsonb);
end;
$$;
revoke execute on function leaderboard_board_rows(text, text, text, integer, integer, date) from public, anon, authenticated;
