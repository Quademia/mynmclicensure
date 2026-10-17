-- 20261017140000_question_reports.sql — 06-question-bank.md (06.2),
-- question reports; ticked by Sam on 2026-10-17 (12-tables.md, "Question
-- reports").
--
-- WHY. A mistake in a question reached us as a message thread (the
-- sitting's "Send feedback"), so ten students finding one wrong answer
-- made ten threads in the support inbox, and nothing marked the question
-- fixed. Ruled: "Report an issue" under each question sends a report — a
-- reason, an optional note, the student's answer then — and the admin
-- sees one row per question with Mark fixed or Dismiss. Messages keeps
-- the conversations (08.2).
--
-- WHAT.
--   1. question_reports: one row per report. The reason is one of six
--      words (the box's seventh, "I don't understand the answer", opens
--      Messages and makes no row); a note up to 1,000 characters,
--      required for `other`; `chosen` as attempt_items keeps it; the
--      status new, fixed or dismissed ("reviewed" dropped — no button set
--      it, Sam), closed_by and closed_at set together with a close. One
--      open report per student per question (a unique index on `new`).
--      The browser holds nothing on it.
--   2. report_question(student, sitting, question, reason, note, chosen):
--      checks the question is in the student's own sitting and still in
--      the bank, then writes the row; a second report while the first is
--      open answers `already` with its date. Server only.
--   3. close_question_reports(question, fixed|dismissed, admin): closes
--      every open report of one question; returns how many. Server only.
--   4. question_report_groups(limit, offset): the admin page — one row
--      per question with open reports, newest first: its course, the
--      start of its stem and its answer, the count, the count by reason,
--      the newest date, the reports themselves (the newest 20) and the
--      number of such questions. Server only.
--
-- REACH. Dev only; prod at the next release Sam approves. A new table:
-- nothing the dev site (main's code) reads or writes changes.

set search_path = licensure_gh;

-- ── 1. the table ──────────────────────────────────────────────────────
create table if not exists question_reports (
  report_id  bigint generated always as identity primary key,
  item_id    text not null references question_bank (item_id) on delete cascade,
  course_id  text not null references courses (course_id) on delete cascade,
  attempt_id text references attempts (attempt_id) on delete set null,
  user_id    text not null references users (user_id) on delete cascade,
  reason     text not null,
  note       text,
  chosen     text,
  status     text not null default 'new',
  created_at timestamptz not null default now(),
  closed_by  text references users (user_id) on delete set null,
  closed_at  timestamptz,
  constraint question_reports_reason_check
    check (reason in ('answer_wrong', 'unclear', 'typo', 'picture', 'explanation', 'other')),
  constraint question_reports_note_check
    check (note is null or char_length(note) <= 1000),
  constraint question_reports_other_note_check
    check (reason <> 'other' or nullif(btrim(note), '') is not null),
  constraint question_reports_chosen_check
    check (chosen is null or chosen ~ '^[a-z](,[a-z])*$'),
  constraint question_reports_status_check
    check (status in ('new', 'fixed', 'dismissed')),
  constraint question_reports_closed_check
    check ((status = 'new') = (closed_at is null))
);

create unique index if not exists question_reports_open_key
  on question_reports (user_id, item_id) where status = 'new';
create index if not exists question_reports_item_idx
  on question_reports (item_id, created_at desc);
create index if not exists question_reports_new_idx
  on question_reports (created_at desc) where status = 'new';

-- No browser path: written and read through the functions below with the
-- service role (rule 9 — a new table starts with grant all to the browser
-- roles, so all of it is taken back).
alter table question_reports enable row level security;
revoke all on question_reports from anon, authenticated;
revoke all on sequence question_reports_report_id_seq from anon, authenticated;

-- ── 2. a student's report ─────────────────────────────────────────────
create or replace function report_question(
  p_user_id    text,
  p_attempt_id text,
  p_item_id    text,
  p_reason     text,
  p_note       text default null,
  p_chosen     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_note   text := nullif(btrim(coalesce(p_note, '')), '');
  v_chosen text := case when p_chosen ~ '^[a-z](,[a-z])*$' then p_chosen end;
  v_course text;
  v_at     timestamptz;
begin
  if not exists (
    select 1
    from attempts a
    join attempt_items i on i.attempt_id = a.attempt_id
    where a.attempt_id = p_attempt_id and a.user_id = p_user_id and i.item_id = p_item_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_in_sitting');
  end if;

  select q.course_id into v_course from question_bank q where q.item_id = p_item_id;
  if v_course is null then
    return jsonb_build_object('ok', false, 'code', 'no_question');
  end if;

  if p_reason is null or p_reason not in ('answer_wrong', 'unclear', 'typo', 'picture', 'explanation', 'other') then
    return jsonb_build_object('ok', false, 'code', 'bad_reason');
  end if;
  if p_reason = 'other' and v_note is null then
    return jsonb_build_object('ok', false, 'code', 'note_required');
  end if;
  if char_length(v_note) > 1000 then
    return jsonb_build_object('ok', false, 'code', 'note_too_long');
  end if;

  select r.created_at into v_at
  from question_reports r
  where r.user_id = p_user_id and r.item_id = p_item_id and r.status = 'new';
  if found then
    return jsonb_build_object('ok', false, 'code', 'already', 'at', v_at);
  end if;

  begin
    insert into question_reports (item_id, course_id, attempt_id, user_id, reason, note, chosen)
    values (p_item_id, v_course, p_attempt_id, p_user_id, p_reason, v_note, v_chosen)
    returning created_at into v_at;
  exception when unique_violation then
    -- two taps racing: the first one's row stands
    select r.created_at into v_at
    from question_reports r
    where r.user_id = p_user_id and r.item_id = p_item_id and r.status = 'new';
    return jsonb_build_object('ok', false, 'code', 'already', 'at', v_at);
  end;

  return jsonb_build_object('ok', true, 'at', v_at);
end;
$$;
revoke execute on function report_question(text, text, text, text, text, text) from public, anon, authenticated;

-- ── 3. the admin's close ──────────────────────────────────────────────
create or replace function close_question_reports(
  p_item_id  text,
  p_status   text,
  p_admin_id text
)
returns integer
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_n integer;
begin
  if p_status is null or p_status not in ('fixed', 'dismissed') then
    raise exception 'close_question_reports: status must be fixed or dismissed';
  end if;
  update question_reports
  set status = p_status, closed_by = p_admin_id, closed_at = now()
  where item_id = p_item_id and status = 'new';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function close_question_reports(text, text, text) from public, anon, authenticated;

-- ── 4. the admin's page ───────────────────────────────────────────────
create or replace function question_report_groups(
  p_limit  integer default 20,
  p_offset integer default 0
)
returns table (
  item_id      text,
  course_id    text,
  course_title text,
  stem         text,
  correct      text,
  reports      integer,
  reasons      jsonb,
  newest       timestamptz,
  lines        jsonb,
  total        bigint
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
         left(q.stem, 300),
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
  order by g.newest desc, g.item_id
  limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(0, coalesce(p_offset, 0))
$$;
revoke execute on function question_report_groups(integer, integer) from public, anon, authenticated;

notify pgrst, 'reload schema';
