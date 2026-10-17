-- 20261017180000_support_desk.sql — 08-help-and-news.md (08.2), Messages
-- through the server; ticked by Sam on 2026-09-18 (the support desk) and
-- 2026-10-17 (the five labels) — 12-tables.md, `messages_threads` and
-- `messages`.
--
-- WHY. The old site's messaging wrote from the browser: a student could
-- rewrite a thread's status or edit Quademia's reply, every message kept
-- two read flags that the badge counted one by one, a thread was general
-- or a course with a free subject line, and the question feedback and
-- Bulk Send columns lingered. Ruled: writes through the server only, a
-- message fixed once sent, 2,000 characters, read stamps on the thread,
-- a reply to a closed thread reopening it with a line, and five labels.
--
-- WHAT.
--   1. Tidy: the question threads deleted with their messages (Sam); a
--      `general` thread becomes `other`, a course thread with no course
--      `other`; any odd status or sender word set straight.
--   2. student_read_at and admin_read_at on the thread, filled from the
--      read flags (the moment before the side's first unread message, or
--      the last message when none is unread); the flags then go.
--   3. The leftover columns go: subject, admin_id, quiz_id, question_id,
--      attempt_id, bulk_batch_id, ref_text.
--   4. Checks: the status (open, closed), the label (payment, account,
--      technical, course, other) with course_id set exactly for a course,
--      the last sender (student, admin), a message's sender (student,
--      admin, system), 2,000 characters (new messages; old rows unchecked)
--      — and a message cannot be changed once written.
--   5. The browser keeps SELECT only (its policies decide whose rows);
--      the insert and update policies go (rule 9).
--   6. The functions every write goes through, server only:
--      msg_student_send (into a thread of the student's own, or the
--      newest open one of a label — made when there is none), msg_admin_
--      send, msg_admin_start (New Thread to one student), msg_set_status
--      (close, reopen), msg_mark_read (one side's stamp), and the two
--      badges, msg_unread_count and msg_admin_unread_count. A reply into
--      a closed thread writes the line "Reopened by a reply." first and
--      opens it. Ids are made here (THR_/MSG_ + 16 hex).
--   7. messages_threads joins the realtime feed, so a close reaches an
--      open page.
--
-- One open thread per label is the rule a NEW message follows (the newest
-- open one is reused); it is not a unique index, because a reply into an
-- older closed thread must reopen it even when the label has another open
-- thread (Sam's "reopened by a reply").
--
-- REACH. Dev only; prod at the next release Sam approves. The dev site
-- runs main's code until the merge: its Messages writes from the browser
-- and reads the dropped columns, so there sends fail and the page reads
-- empty until then — Sam only.

set search_path = licensure_gh;

-- ── 1. tidy ───────────────────────────────────────────────────────────
delete from messages
where thread_id in (select thread_id from messages_threads where context_type = 'question');
delete from messages_threads where context_type = 'question';

update messages_threads set context_type = 'other'
where context_type is null or context_type not in ('payment', 'account', 'technical', 'course', 'other');
update messages_threads set context_type = 'other' where context_type = 'course' and course_id is null;
update messages_threads set course_id = null where context_type <> 'course' and course_id is not null;
update messages_threads set status = 'open' where status is null or status not in ('open', 'closed');
update messages_threads set last_sender_role = 'student'
where last_sender_role is null or last_sender_role not in ('student', 'admin');
update messages set sender_role = 'admin' where sender_role is null or sender_role not in ('student', 'admin', 'system');

-- ── 2. the read stamps ────────────────────────────────────────────────
alter table messages_threads add column if not exists student_read_at timestamptz;
alter table messages_threads add column if not exists admin_read_at timestamptz;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'licensure_gh' and table_name = 'messages' and column_name = 'read_by_user'
  ) then
    update licensure_gh.messages_threads t set
      student_read_at = coalesce(
        (select min(m.created_at) - interval '1 millisecond' from licensure_gh.messages m
         where m.thread_id = t.thread_id and not m.read_by_user),
        t.last_message_at),
      admin_read_at = coalesce(
        (select min(m.created_at) - interval '1 millisecond' from licensure_gh.messages m
         where m.thread_id = t.thread_id and not m.read_by_admin),
        t.last_message_at);
  end if;
end $$;

drop index if exists messages_unread_admin_idx;
alter table messages drop column if exists read_by_user;
alter table messages drop column if exists read_by_admin;

-- ── 3. the leftover columns ───────────────────────────────────────────
alter table messages_threads
  drop column if exists subject,
  drop column if exists admin_id,
  drop column if exists quiz_id,
  drop column if exists question_id,
  drop column if exists attempt_id,
  drop column if exists bulk_batch_id,
  drop column if exists ref_text;

-- ── 4. the checks ─────────────────────────────────────────────────────
alter table messages_threads alter column context_type set default 'other';

alter table messages_threads drop constraint if exists messages_threads_status_check;
alter table messages_threads add constraint messages_threads_status_check
  check (status in ('open', 'closed'));
alter table messages_threads drop constraint if exists messages_threads_label_check;
alter table messages_threads add constraint messages_threads_label_check
  check (context_type in ('payment', 'account', 'technical', 'course', 'other'));
alter table messages_threads drop constraint if exists messages_threads_course_check;
alter table messages_threads add constraint messages_threads_course_check
  check ((context_type = 'course') = (course_id is not null));
alter table messages_threads drop constraint if exists messages_threads_last_sender_check;
alter table messages_threads add constraint messages_threads_last_sender_check
  check (last_sender_role in ('student', 'admin'));

alter table messages drop constraint if exists messages_sender_check;
alter table messages add constraint messages_sender_check
  check (sender_role in ('student', 'admin', 'system'));
alter table messages drop constraint if exists messages_body_check;
alter table messages add constraint messages_body_check
  check (char_length(btrim(body_text)) between 1 and 2000) not valid;

create or replace function messages_fixed()
returns trigger
language plpgsql
as $$
begin
  raise exception 'A message cannot be changed once sent.';
end;
$$;
drop trigger if exists messages_fixed on messages;
create trigger messages_fixed before update on messages
  for each row execute function messages_fixed();

create index if not exists messages_threads_open_idx
  on messages_threads (user_id, context_type, course_id) where status = 'open';

-- ── 5. the browser reads only ─────────────────────────────────────────
revoke all on messages_threads from anon, authenticated;
revoke all on messages from anon, authenticated;
grant select on messages_threads to authenticated;
grant select on messages to authenticated;

drop policy if exists messages_threads_insert on messages_threads;
drop policy if exists messages_threads_update on messages_threads;
drop policy if exists messages_insert on messages;
drop policy if exists messages_update on messages;

-- ── 6. the functions ──────────────────────────────────────────────────
create or replace function msg_new_id(p_prefix text)
returns text
language sql
volatile
as $$
  select p_prefix || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))
$$;
revoke execute on function msg_new_id(text) from public, anon, authenticated;

-- One message into a thread already locked by the caller: the reopen line
-- first when it is closed, then the message, then the thread's stamps.
create or replace function msg_write(
  p_thread_id text,
  p_sender_id text,
  p_role      text,
  p_body      text
)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_status   text;
  v_reopened boolean := false;
  v_id       text := msg_new_id('MSG_');
  v_at       timestamptz;
begin
  select status into v_status from messages_threads where thread_id = p_thread_id;
  if v_status = 'closed' then
    insert into messages (message_id, thread_id, sender_id, sender_role, body_text, created_at)
    values (msg_new_id('MSG_'), p_thread_id, 'system', 'system', 'Reopened by a reply.', clock_timestamp());
    v_reopened := true;
  end if;

  v_at := clock_timestamp();
  insert into messages (message_id, thread_id, sender_id, sender_role, body_text, created_at)
  values (v_id, p_thread_id, p_sender_id, p_role, p_body, v_at);

  update messages_threads set
    status = 'open',
    last_message_at = v_at,
    last_sender_role = p_role,
    student_read_at = case when p_role = 'student' then v_at else student_read_at end,
    admin_read_at   = case when p_role = 'admin' then v_at else admin_read_at end
  where thread_id = p_thread_id;

  return jsonb_build_object('ok', true, 'thread_id', p_thread_id, 'message_id', v_id, 'at', v_at, 'reopened', v_reopened);
end;
$$;
revoke execute on function msg_write(text, text, text, text) from public, anon, authenticated;

-- The newest open thread of a label (a course's: that course), made when
-- there is none. Locked against a second tap making a second one.
create or replace function msg_thread_for(
  p_user_id   text,
  p_label     text,
  p_course_id text,
  p_by        text
)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_course text := case when p_label = 'course' then nullif(btrim(coalesce(p_course_id, '')), '') end;
  v_thread text;
  v_at     timestamptz := clock_timestamp();
begin
  if p_label is null or p_label not in ('payment', 'account', 'technical', 'course', 'other') then
    return jsonb_build_object('ok', false, 'code', 'bad_label');
  end if;
  if p_label = 'course' and (v_course is null or not exists (select 1 from courses c where c.course_id = v_course)) then
    return jsonb_build_object('ok', false, 'code', 'no_course');
  end if;

  perform pg_advisory_xact_lock(hashtext('msg_thread:' || p_user_id || ':' || p_label || ':' || coalesce(v_course, '')));

  select t.thread_id into v_thread
  from messages_threads t
  where t.user_id = p_user_id and t.status = 'open' and t.context_type = p_label
    and t.course_id is not distinct from v_course
  order by t.last_message_at desc
  limit 1;
  if found then
    return jsonb_build_object('ok', true, 'thread_id', v_thread, 'created', false);
  end if;

  v_thread := msg_new_id('THR_');
  insert into messages_threads (thread_id, user_id, status, context_type, course_id, created_at, last_message_at,
                                last_sender_role, student_read_at, admin_read_at)
  values (v_thread, p_user_id, 'open', p_label, v_course, v_at, v_at,
          case when p_by = 'admin' then 'admin' else 'student' end, v_at, v_at);
  return jsonb_build_object('ok', true, 'thread_id', v_thread, 'created', true);
end;
$$;
revoke execute on function msg_thread_for(text, text, text, text) from public, anon, authenticated;

-- A student's message: into a thread of their own (p_thread_id), or the
-- newest open one of a label — the pop-up's one trip.
create or replace function msg_student_send(
  p_user_id   text,
  p_thread_id text,
  p_label     text,
  p_course_id text,
  p_body      text
)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_body    text := btrim(coalesce(p_body, ''));
  v_thread  text := nullif(btrim(coalesce(p_thread_id, '')), '');
  v_created boolean := false;
  v_r       jsonb;
begin
  if v_body = '' then return jsonb_build_object('ok', false, 'code', 'empty'); end if;
  if char_length(v_body) > 2000 then return jsonb_build_object('ok', false, 'code', 'too_long'); end if;

  if v_thread is null then
    v_r := msg_thread_for(p_user_id, p_label, p_course_id, 'student');
    if not (v_r ->> 'ok')::boolean then return v_r; end if;
    v_thread := v_r ->> 'thread_id';
    v_created := (v_r ->> 'created')::boolean;
  end if;

  perform 1 from messages_threads where thread_id = v_thread and user_id = p_user_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'no_thread'); end if;

  return msg_write(v_thread, p_user_id, 'student', v_body) || jsonb_build_object('created', v_created);
end;
$$;
revoke execute on function msg_student_send(text, text, text, text, text) from public, anon, authenticated;

-- Quademia's reply into a thread.
create or replace function msg_admin_send(
  p_admin_id  text,
  p_thread_id text,
  p_body      text
)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_body = '' then return jsonb_build_object('ok', false, 'code', 'empty'); end if;
  if char_length(v_body) > 2000 then return jsonb_build_object('ok', false, 'code', 'too_long'); end if;
  perform 1 from messages_threads where thread_id = p_thread_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'no_thread'); end if;
  return msg_write(p_thread_id, p_admin_id, 'admin', v_body);
end;
$$;
revoke execute on function msg_admin_send(text, text, text) from public, anon, authenticated;

-- New Thread to one student: the newest open thread of the label, or a
-- new one, and the message.
create or replace function msg_admin_start(
  p_admin_id  text,
  p_user_id   text,
  p_label     text,
  p_course_id text,
  p_body      text
)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_r    jsonb;
begin
  if v_body = '' then return jsonb_build_object('ok', false, 'code', 'empty'); end if;
  if char_length(v_body) > 2000 then return jsonb_build_object('ok', false, 'code', 'too_long'); end if;
  if not exists (select 1 from users u where u.user_id = p_user_id) then
    return jsonb_build_object('ok', false, 'code', 'no_student');
  end if;
  v_r := msg_thread_for(p_user_id, p_label, p_course_id, 'admin');
  if not (v_r ->> 'ok')::boolean then return v_r; end if;
  perform 1 from messages_threads where thread_id = v_r ->> 'thread_id' for update;
  return msg_write(v_r ->> 'thread_id', p_admin_id, 'admin', v_body) || jsonb_build_object('created', (v_r ->> 'created')::boolean);
end;
$$;
revoke execute on function msg_admin_start(text, text, text, text, text) from public, anon, authenticated;

-- Close or reopen (the admin's buttons).
create or replace function msg_set_status(
  p_thread_id text,
  p_status    text
)
returns boolean
language plpgsql
security definer
set search_path = licensure_gh
as $$
begin
  if p_status is null or p_status not in ('open', 'closed') then
    raise exception 'msg_set_status: status must be open or closed';
  end if;
  update messages_threads set status = p_status where thread_id = p_thread_id;
  return found;
end;
$$;
revoke execute on function msg_set_status(text, text) from public, anon, authenticated;

-- One side's read stamp: the student's (their own thread only) or Quademia's.
create or replace function msg_mark_read(
  p_thread_id text,
  p_side      text,
  p_user_id   text default null
)
returns boolean
language plpgsql
security definer
set search_path = licensure_gh
as $$
begin
  if p_side = 'student' then
    update messages_threads set student_read_at = clock_timestamp()
    where thread_id = p_thread_id and user_id = p_user_id;
  elsif p_side = 'admin' then
    update messages_threads set admin_read_at = clock_timestamp() where thread_id = p_thread_id;
  else
    raise exception 'msg_mark_read: side must be student or admin';
  end if;
  return found;
end;
$$;
revoke execute on function msg_mark_read(text, text, text) from public, anon, authenticated;

-- The badges: open threads whose last message is the other side's, after
-- this side last read it.
create or replace function msg_unread_count(p_user_id text)
returns integer
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select count(*)::integer from messages_threads t
  where t.user_id = p_user_id and t.status = 'open' and t.last_sender_role = 'admin'
    and (t.student_read_at is null or t.student_read_at < t.last_message_at)
$$;
revoke execute on function msg_unread_count(text) from public, anon, authenticated;

create or replace function msg_admin_unread_count()
returns integer
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select count(*)::integer from messages_threads t
  where t.status = 'open' and t.last_sender_role = 'student'
    and (t.admin_read_at is null or t.admin_read_at < t.last_message_at)
$$;
revoke execute on function msg_admin_unread_count() from public, anon, authenticated;

-- ── 7. a close reaches an open page ───────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'licensure_gh' and tablename = 'messages_threads'
     ) then
    execute 'alter publication supabase_realtime add table licensure_gh.messages_threads';
  end if;
end $$;

notify pgrst, 'reload schema';
