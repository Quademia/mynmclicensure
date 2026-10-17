-- 20261017100000_history_figures.sql — 05-progress.md (05 Q12, 05.5),
-- Learning History's figures; ticked by Sam on 2026-10-17 (12-tables.md,
-- `attempts` and "The history's figures").
--
-- WHY. The history's figures counted only the sittings the page had
-- loaded (twenty at a time), so a student with forty sittings saw half.
-- Ruled: true totals over the whole history, following the course chip —
-- the sittings, the average and the best, and a count by kind (practice
-- papers, mocks, quiz builder, free practice). Counted here in one trip:
-- the other way is every sitting sent to the server, and every builder
-- quiz's questions read, to count the free ones.
--
-- WHAT.
--   1. attempts_user_ts_idx: a student's sittings by date, newest first —
--      the order the history lists them in and its figures read them
--      (10, Speed and scale). Only an index on user_id alone before.
--   2. student_history_figures(student, course or null): one row —
--      sittings (every status); average_pct and best_pct over finished
--      sittings with a score (through student_attempts(), so a held one is
--      left out until its date); papers, mocks, builder, free. A retake
--      keeps its original's paper or mock in quiz_id, so a sitting with a
--      quiz is a mock when that quiz is a mock, else a paper; one with no
--      quiz is a builder quiz, and free when every question it holds is a
--      published question of its course in the Free pool — the test
--      isFreeSitting() makes, judged by today's pool. Server only.
--
-- REACH. Dev only; prod at the next release Sam approves. Nothing is taken
-- from the browser; the dev site (main's code) does not call it.

set search_path = licensure_gh;

-- ── 1. the index ──────────────────────────────────────────────────────
create index if not exists attempts_user_ts_idx on attempts (user_id, ts_iso desc);

-- ── 2. the figures ────────────────────────────────────────────────────
create or replace function student_history_figures(
  p_user_id   text,
  p_course_id text default null
)
returns table (
  sittings    integer,
  average_pct numeric,
  best_pct    numeric,
  papers      integer,
  mocks       integer,
  builder     integer,
  free        integer
)
language sql
stable
security definer
set search_path = licensure_gh
as $$
  with s as (
    select a.attempt_id, a.quiz_id, a.course_id, a.status, a.score_pct
    from student_attempts(p_user_id, null, p_course_id) a
  ),
  k as (
    select s.status, s.score_pct,
      case
        when s.quiz_id is null then
          case when exists (select 1 from attempt_items i where i.attempt_id = s.attempt_id)
                and not exists (
                  select 1 from attempt_items i
                  left join question_bank q on q.item_id = i.item_id
                  where i.attempt_id = s.attempt_id
                    and not coalesce(q.pool = 'free' and q.is_published and q.course_id = s.course_id, false)
                )
               then 'free' else 'builder' end
        when exists (select 1 from mock_quizzes m where m.quiz_id = s.quiz_id) then 'mock'
        else 'paper'
      end as kind
    from s
  )
  select count(*)::integer,
         round(avg(score_pct) filter (where status = 'completed' and score_pct is not null), 1),
         max(score_pct) filter (where status = 'completed' and score_pct is not null),
         (count(*) filter (where kind = 'paper'))::integer,
         (count(*) filter (where kind = 'mock'))::integer,
         (count(*) filter (where kind = 'builder'))::integer,
         (count(*) filter (where kind = 'free'))::integer
  from k
$$;
revoke execute on function student_history_figures(text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
