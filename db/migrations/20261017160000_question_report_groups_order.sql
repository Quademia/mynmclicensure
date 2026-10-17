-- 20261017160000_question_report_groups_order.sql — 06-question-bank.md
-- (06.2), the admin's Question Reports page redrawn (Sam, 2026-10-17: B
-- with C's detail).
--
-- WHY. The page became a quiet list, most reports first, a line opening in
-- place onto the whole question — its options and the bank's answer beside
-- the students' reports — so a report can be judged without opening the
-- bank. The page's one read must now carry the options, and the order
-- changes: the question most students hit comes to the top.
--
-- WHAT. question_report_groups() returns the question's type and its six
-- options as well, and orders by the number of open reports, then the
-- newest, then the id. Its return type changes, so it is dropped first.
-- Nothing else changes; still server only.
--
-- REACH. Dev only; prod at the next release Sam approves. Only this
-- session's page calls the function.

set search_path = licensure_gh;

drop function if exists question_report_groups(integer, integer);

create function question_report_groups(
  p_limit  integer default 20,
  p_offset integer default 0
)
returns table (
  item_id       text,
  course_id     text,
  course_title  text,
  question_type text,
  stem          text,
  option_a      text,
  option_b      text,
  option_c      text,
  option_d      text,
  option_e      text,
  option_f      text,
  correct       text,
  reports       integer,
  reasons       jsonb,
  newest        timestamptz,
  lines         jsonb,
  total         bigint
)
language sql
stable
security definer
set search_path = licensure_gh
as $$
  with g as (
    select r.item_id, count(*)::integer as reports, max(r.created_at) as newest
    from question_reports r
    where r.status = 'new'
    group by r.item_id
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
                  where r.item_id = g.item_id and r.status = 'new'
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
                  where r0.item_id = g.item_id and r0.status = 'new'
                  order by r0.created_at desc
                  limit 20) r
            left join users u on u.user_id = r.user_id),
         count(*) over ()
  from g
  join question_bank q on q.item_id = g.item_id
  left join courses c on c.course_id = q.course_id
  order by g.reports desc, g.newest desc, g.item_id
  limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(0, coalesce(p_offset, 0))
$$;
revoke execute on function question_report_groups(integer, integer) from public, anon, authenticated;

notify pgrst, 'reload schema';
