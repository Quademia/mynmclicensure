-- 20261017170000_question_reports_closed_view.sql — 06-question-bank.md
-- (06.2), a read-only Closed tab on the admin's Question Reports page (Sam,
-- 2026-10-17).
--
-- WHY. The page listed only open reports, so what was fixed or dismissed,
-- by whom and when, could not be seen once done. Ruled: a Closed tab beside
-- Open — the fixed and dismissed questions, newest closed first, each with
-- who closed it and when; read only.
--
-- WHAT. question_report_groups() takes a third argument, the view: `open`
-- (as before — a line per question, most reports first) or `closed` — a
-- line per close: one question's reports closed together by one admin at
-- one moment (a question fixed, reported again and dismissed later is two
-- lines), newest close first. Each line carries its status, when it was
-- closed and the admin's name; its reasons and reports are that close's
-- own. The two-argument function goes. An index on the closed reports by
-- their close serves the tab. Server only, as before.
--
-- REACH. Dev only; prod at the next release Sam approves. Only this
-- session's page calls the function.

set search_path = licensure_gh;

create index if not exists question_reports_closed_idx
  on question_reports (closed_at desc) where status <> 'new';

drop function if exists question_report_groups(integer, integer);
drop function if exists question_report_groups(integer, integer, text);

create function question_report_groups(
  p_limit  integer default 20,
  p_offset integer default 0,
  p_view   text default 'open'
)
returns table (
  item_id        text,
  course_id      text,
  course_title   text,
  question_type  text,
  stem           text,
  option_a       text,
  option_b       text,
  option_c       text,
  option_d       text,
  option_e       text,
  option_f       text,
  correct        text,
  reports        integer,
  reasons        jsonb,
  newest         timestamptz,
  lines          jsonb,
  status         text,
  closed_at      timestamptz,
  closed_by_name text,
  total          bigint
)
language sql
stable
security definer
set search_path = licensure_gh
as $$
  with v as (
    select coalesce(p_view, 'open') = 'closed' as closed
  ),
  g as (
    select r.item_id, r.status, r.closed_by, r.closed_at,
           count(*)::integer as reports, max(r.created_at) as newest
    from question_reports r, v
    where (v.closed and r.status <> 'new') or (not v.closed and r.status = 'new')
    group by r.item_id, r.status, r.closed_by, r.closed_at
  )
  select g.item_id,
         q.course_id,
         c.title,
         q.question_type,
         q.stem,
         q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, q.option_f,
         q.correct,
         g.reports,
         (select jsonb_object_agg(x.reason, x.n)
            from (select r.reason, count(*) as n
                  from question_reports r
                  where r.item_id = g.item_id and r.status = g.status
                    and r.closed_at is not distinct from g.closed_at
                  group by r.reason) x),
         g.newest,
         (select jsonb_agg(jsonb_build_object(
                   'reason', r.reason,
                   'note', r.note,
                   'chosen', r.chosen,
                   'at', r.created_at,
                   'name', coalesce(nullif(u.forename, ''), nullif(u.name, ''), u.email)
                 ) order by r.created_at desc)
            from (select * from question_reports r0
                  where r0.item_id = g.item_id and r0.status = g.status
                    and r0.closed_at is not distinct from g.closed_at
                  order by r0.created_at desc
                  limit 20) r
            left join users u on u.user_id = r.user_id),
         g.status,
         g.closed_at,
         (select coalesce(nullif(a.forename, ''), nullif(a.name, ''), a.email) from users a where a.user_id = g.closed_by),
         count(*) over ()
  from g
  cross join v
  join question_bank q on q.item_id = g.item_id
  left join courses c on c.course_id = q.course_id
  order by
    case when v.closed then extract(epoch from g.closed_at) else g.reports end desc nulls last,
    g.newest desc,
    g.item_id
  limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(0, coalesce(p_offset, 0))
$$;
revoke execute on function question_report_groups(integer, integer, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
