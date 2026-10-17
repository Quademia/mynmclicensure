-- 20261017210000_admin_messages_wait.sql — 08-help-and-news.md (08.2
-- step 4), the admin's students list (Sam, 2026-10-17).
--
-- WHY. "Waiting for a reply" listed the longest-waiting first, but timed a
-- conversation's wait from its latest message — so a student who wrote on
-- Monday, then again on Wednesday because nobody answered, looked as if
-- they had waited since Wednesday and fell below someone who wrote once on
-- Tuesday. Ruled: the wait runs from the student's first unanswered
-- message.
--
-- WHAT. msg_admin_students() times each waiting conversation from the
-- student's first message after Quademia's last reply in it (their first
-- message, when there is no reply yet); a student's wait is their longest.
-- Nothing else changes; server only, as before.
--
-- REACH. Dev only; prod at the next release Sam approves.

set search_path = licensure_gh;

create or replace function msg_admin_students(
  p_search text default null,
  p_view   text default 'waiting',
  p_label  text default null,
  p_limit  integer default 20,
  p_offset integer default 0
)
returns table (
  user_id        text,
  name           text,
  email          text,
  program_id     text,
  waiting        boolean,
  waiting_labels jsonb,
  last_preview   text,
  last_sender    text,
  last_at        timestamptz,
  waiting_since  timestamptz,
  total          bigint
)
language sql
stable
security definer
set search_path = licensure_gh
as $$
  with q as (
    select nullif(btrim(coalesce(p_search, '')), '') as term,
           coalesce(p_view, 'waiting') <> 'all'      as w,
           nullif(btrim(coalesce(p_label, '')), '')   as lab
  ),
  t as (
    select th.user_id, th.thread_id, th.context_type, th.course_id, th.last_message_at,
           (th.status = 'open' and th.last_sender_role = 'student') as is_waiting,
           -- a waiting conversation waits from the student's first message
           -- after Quademia's last reply (or their first, with no reply yet)
           case when th.status = 'open' and th.last_sender_role = 'student' then (
             select min(m.created_at) from messages m
             where m.thread_id = th.thread_id and m.sender_role = 'student'
               and m.created_at > coalesce(
                 (select max(m2.created_at) from messages m2 where m2.thread_id = th.thread_id and m2.sender_role = 'admin'),
                 '-infinity'::timestamptz)
           ) end as first_unanswered
    from messages_threads th
  ),
  s as (
    select t.user_id,
           bool_or(t.is_waiting) as waiting,
           min(coalesce(t.first_unanswered, t.last_message_at)) filter (where t.is_waiting) as waiting_since,
           max(t.last_message_at) as last_at,
           jsonb_agg(distinct jsonb_build_object(
             'label', t.context_type,
             'course', case when t.context_type = 'course' then coalesce(c.title, t.course_id) end
           )) filter (where t.is_waiting) as waiting_labels,
           bool_or(t.context_type = q.lab and (not q.w or t.is_waiting)) as label_ok
    from t
    cross join q
    left join courses c on c.course_id = t.course_id
    group by t.user_id
  ),
  u as (
    select u.user_id,
           coalesce(nullif(btrim(concat_ws(' ', u.forename, u.surname)), ''), nullif(btrim(u.name), ''), u.email) as name,
           u.email,
           u.program_id,
           u.role
    from users u
    cross join q
    where q.term is null
       or u.email ilike '%' || q.term || '%'
       or u.name ilike '%' || q.term || '%'
       or u.forename ilike '%' || q.term || '%'
       or u.surname ilike '%' || q.term || '%'
  ),
  r as (
    select u.user_id, u.name, u.email, u.program_id,
           coalesce(s.waiting, false) as waiting,
           s.waiting_labels, s.last_at, s.waiting_since
    from u
    cross join q
    left join s on s.user_id = u.user_id
    where (s.user_id is not null or (q.term is not null and upper(coalesce(u.role, '')) = 'STUDENT'))
      and (not q.w or coalesce(s.waiting, false))
      and (q.lab is null or coalesce(s.label_ok, false))
  )
  select r.user_id, r.name, r.email, r.program_id, r.waiting,
         coalesce(r.waiting_labels, '[]'::jsonb),
         lm.preview, lm.sender, r.last_at, r.waiting_since,
         count(*) over ()
  from r
  cross join q
  left join lateral (
    select left(m.body_text, 140) as preview, m.sender_role as sender
    from messages m
    join messages_threads th on th.thread_id = m.thread_id
    where th.user_id = r.user_id and m.sender_role <> 'system'
    -- a waiting student's preview is what waits: their waiting threads first
    order by (th.status = 'open' and th.last_sender_role = 'student') desc, m.created_at desc
    limit 1
  ) lm on true
  order by
    case when q.w then r.waiting_since end asc nulls last,
    r.last_at desc nulls last,
    r.name
  limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(0, coalesce(p_offset, 0))
$$;
revoke execute on function msg_admin_students(text, text, text, integer, integer) from public, anon, authenticated;

notify pgrst, 'reload schema';
