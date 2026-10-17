-- 20261017200000_admin_messages_students.sql — 08-help-and-news.md (08.2
-- step 4), the admin's Messages as a list of students (Sam, 2026-10-17).
--
-- WHY. The admin's inbox listed every conversation, a student's several
-- threads scattered down it, read whole on every visit. Ruled: a list of
-- the students who have written — those waiting for a reply first — each
-- opening onto that student's Messages as they see them; search across
-- all students (to start a message to one who never wrote), a "Waiting
-- for a reply / All" switch, and the label. Paged in the database.
--
-- WHAT. msg_admin_students(search, view, label, limit, offset): one row
-- per student — the name, email and programme; whether they are waiting
-- (an open conversation whose last message is theirs); what is waiting
-- (the labels, a course's title); the start of their latest message and
-- whose it was; when it came; how long they have waited; and how many
-- such students. With no search, only students who have written; with a
-- search, every student whose name or email matches. "Waiting" lists the
-- longest-waiting first; "All" the newest first. A label keeps a student
-- with a conversation of it (a waiting one, under "Waiting"). Server only.
--
-- REACH. Dev only; prod at the next release Sam approves. A new function;
-- nothing else changes.

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
           (th.status = 'open' and th.last_sender_role = 'student') as is_waiting
    from messages_threads th
  ),
  s as (
    select t.user_id,
           bool_or(t.is_waiting) as waiting,
           min(t.last_message_at) filter (where t.is_waiting) as waiting_since,
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

create index if not exists messages_threads_waiting_idx
  on messages_threads (last_message_at) where status = 'open' and last_sender_role = 'student';

notify pgrst, 'reload schema';
