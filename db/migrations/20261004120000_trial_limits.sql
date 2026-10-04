-- 20261004120000_trial_limits.sql — 03-free-account-and-trial.md F4, the
-- database half (Sam, 2026-10-04: "for now I just want us to do the
-- migration"); ticked 2026-10-04, written on its tables in 12-tables.md
--
-- WHY. A package said only which courses it opens and for how long, so
-- every grant of it — the trial included — opened everything in those
-- courses: every paper, every mock, the builder without limit. The trial
-- Sam settled is limited: one ticked paper a course, three builder
-- quizzes in all, no mocks, no packs, 14 days.
--
-- WHAT.
--   1. products: four limits — builder quizzes (null = unlimited),
--      offline packs per course (null = unlimited, 0 = none), papers
--      ('all' or 'trial_paper'), mocks (yes / no). Trials 3 · 0 · trial
--      paper · no; Free Full Access and paid packages unlimited · the
--      current packs setting (5) · all · yes. The programme trials' length
--      60 → 14 days (WELCOME_TRIAL's 7 kept).
--   2. subscriptions: a copy of the four, made by the database when a
--      receipt is written (or its package changes), so every writer gets
--      it and editing a package changes new grants only; existing
--      receipts take their package's.
--   3. quizzes.open_in_trial: at most one per course, the database
--      refusing a second.
--   4. create_attempt: the student must hold the course now; a paper
--      opens only on a grant with all papers, or if it is the ticked one;
--      a mock only on a grant with mocks; a new builder quiz only within a
--      grant's count (retakes free). Where two grants cover the course,
--      the more generous wins. No tally stored.
--   5. create_offline_pack: the student must hold the course now; packs
--      counted per course since the grant began, within the grant's limit.
-- The SMS half (the verified number, one trial per number) waits for an
-- SMS account. The admin's forms for the limits and the tick come with
-- those pages' redesign; until then they are set here or by hand.
--
-- REACH. Dev only: the live product is the old site; prod takes this at
-- the next release Sam approves. On dev, main's code calls the same two
-- functions with the same arguments, so it keeps working; a trial student
-- meets the refusals as plain messages.

set search_path = licensure_gh;

-- ── 1. the package's four limits ──────────────────────────────────────
alter table products
  add column allow_builder_quizzes  integer,
  add column allow_packs_per_course integer default 5,
  add column allow_papers           text not null default 'all',
  add column allow_mocks            boolean not null default true;

alter table products
  add constraint products_allow_builder_quizzes_check  check (allow_builder_quizzes is null or allow_builder_quizzes >= 0),
  add constraint products_allow_packs_per_course_check check (allow_packs_per_course is null or allow_packs_per_course >= 0),
  add constraint products_allow_papers_check           check (allow_papers in ('all', 'trial_paper'));

-- The paid shape's packs come from today's setting, not a typed number.
update products
set allow_builder_quizzes  = null,
    allow_packs_per_course = coalesce(
      (select nullif(btrim(value), '')::integer from config
       where key = 'offline_packs_per_course' and btrim(value) ~ '^[0-9]+$'), 5),
    allow_papers           = 'all',
    allow_mocks            = true
where kind <> 'TRIAL';

update products
set allow_builder_quizzes  = 3,
    allow_packs_per_course = 0,
    allow_papers           = 'trial_paper',
    allow_mocks            = false
where kind = 'TRIAL';

-- The programme trials: 14 days from when the student takes the trial.
update products set duration_days = 14
where kind = 'TRIAL' and product_id in (select trial_product_id from programs where trial_product_id is not null);

-- ── 2. the copy on each receipt ───────────────────────────────────────
alter table subscriptions
  add column allow_builder_quizzes  integer,
  add column allow_packs_per_course integer,
  add column allow_papers           text not null default 'all',
  add column allow_mocks            boolean not null default true;

alter table subscriptions
  add constraint subscriptions_allow_papers_check check (allow_papers in ('all', 'trial_paper'));

update subscriptions s
set allow_builder_quizzes  = p.allow_builder_quizzes,
    allow_packs_per_course = p.allow_packs_per_course,
    allow_papers           = p.allow_papers,
    allow_mocks            = p.allow_mocks
from products p
where p.product_id = s.product_id;

-- Whatever a writer sends, the copy is the package's at that moment. An
-- update that keeps the same package keeps the copy: what was bought is
-- kept, even if the package has been edited since.
create or replace function subscriptions_copy_limits()
returns trigger
language plpgsql
security definer
set search_path = licensure_gh
as $$
begin
  if tg_op = 'UPDATE' and new.product_id is not distinct from old.product_id then
    new.allow_builder_quizzes  := old.allow_builder_quizzes;
    new.allow_packs_per_course := old.allow_packs_per_course;
    new.allow_papers           := old.allow_papers;
    new.allow_mocks            := old.allow_mocks;
    return new;
  end if;
  select p.allow_builder_quizzes, p.allow_packs_per_course, p.allow_papers, p.allow_mocks
  into new.allow_builder_quizzes, new.allow_packs_per_course, new.allow_papers, new.allow_mocks
  from products p
  where p.product_id = new.product_id;
  if not found then
    raise exception 'subscriptions_copy_limits: no package %', new.product_id;
  end if;
  return new;
end;
$$;
revoke execute on function subscriptions_copy_limits() from public, anon, authenticated;

drop trigger if exists subscriptions_copy_limits on subscriptions;
create trigger subscriptions_copy_limits
  before insert or update of product_id on subscriptions
  for each row execute function subscriptions_copy_limits();

-- ── 3. the trial paper ────────────────────────────────────────────────
alter table quizzes add column open_in_trial boolean not null default false;
create unique index quizzes_one_trial_paper_per_course on quizzes (course_id) where open_in_trial;

-- ── 4. starting a sitting ─────────────────────────────────────────────
-- The limits are checked here, from the student's live grants for the
-- course, so no page and no tampered request can pass them. The refusal
-- sentences are for the student (the app passes them through).
create or replace function create_attempt(
  p_attempt_id        text,
  p_user_id           text,
  p_course_id         text,
  p_item_ids          text[],
  p_mode              text,
  p_source            text,
  p_quiz_id           text,
  p_duration_min      integer,
  p_display_label     text,
  p_origin_attempt_id text
)
returns integer
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_n           integer;
  v_kind        text;
  v_any_grant   boolean;
  v_papers_all  boolean;
  v_mocks       boolean;
  v_builder_ok  boolean;
begin
  -- The live grants for this course, and the most generous of each limit.
  select count(*) > 0,
         coalesce(bool_or(s.allow_papers = 'all'), false),
         coalesce(bool_or(s.allow_mocks), false)
  into v_any_grant, v_papers_all, v_mocks
  from course_access ca
  join subscriptions s on s.subscription_id = ca.subscription_id
  where ca.user_id = p_user_id
    and ca.course_id = p_course_id
    and ca.revoked_utc is null
    and now() >= ca.start_utc and now() < ca.expires_utc;

  if not v_any_grant then
    raise exception 'You do not have an active subscription for this course.';
  end if;

  -- What kind of sitting: a retake takes its quiz's kind; a builder
  -- retake is free.
  v_kind := case
    when p_source = 'fixed' then 'paper'
    when p_source = 'mock' then 'mock'
    when p_source = 'builder' then 'builder'
    when p_source = 'retake' and p_quiz_id is not null then
      case when exists (select 1 from mock_quizzes m where m.quiz_id = p_quiz_id) then 'mock' else 'paper' end
    else 'free'
  end;

  if v_kind = 'paper' and not v_papers_all
     and not exists (select 1 from quizzes q where q.quiz_id = p_quiz_id and q.open_in_trial) then
    raise exception 'This paper opens with a package.';
  end if;

  if v_kind = 'mock' and not v_mocks then
    raise exception 'Mock exams open with a package.';
  end if;

  -- Builder quizzes: unlimited on any grant without a count; otherwise a
  -- grant still has room when the student's builder sittings in its
  -- courses since it began are fewer than its count.
  if v_kind = 'builder' then
    select coalesce(bool_or(
             s.allow_builder_quizzes is null
             or (select count(*) from attempts a
                 where a.user_id = p_user_id
                   and a.source = 'builder'
                   and a.ts_iso >= s.start_utc
                   and a.course_id in (select ca2.course_id from course_access ca2
                                       where ca2.subscription_id = s.subscription_id))
                < s.allow_builder_quizzes
           ), false)
    into v_builder_ok
    from course_access ca
    join subscriptions s on s.subscription_id = ca.subscription_id
    where ca.user_id = p_user_id
      and ca.course_id = p_course_id
      and ca.revoked_utc is null
      and now() >= ca.start_utc and now() < ca.expires_utc;
    if not v_builder_ok then
      raise exception 'You have used all the Quiz Builder quizzes in your package.';
    end if;
  end if;

  -- A draft is not servable, whichever course it sits in.
  if exists (
    select 1
    from unnest(p_item_ids) as i(item_id)
    join question_bank q on q.item_id = i.item_id
    where not q.is_published
  ) then
    raise exception 'This quiz has a question that is not published';
  end if;

  insert into attempts (
    attempt_id, user_id, quiz_id, course_id, mode, source,
    n, status, ts_iso, duration_min, display_label, origin_attempt_id
  ) values (
    p_attempt_id, p_user_id, p_quiz_id, p_course_id, p_mode, p_source,
    0, 'in_progress', now(), p_duration_min, p_display_label, p_origin_attempt_id
  );

  insert into attempt_items (
    attempt_id, position, item_id,
    question_type, stem, option_a, option_b, option_c, option_d, option_e, option_f,
    marks, shuffle_options,
    correct, rationale, rationale_img, fb_a, fb_b, fb_c, fb_d, fb_e, fb_f,
    subject, maintopic, subtopic, difficulty,
    bloom_level, tags, version
  )
  select
    p_attempt_id, row_number() over (order by ids.ord), q.item_id,
    q.question_type, q.stem, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, q.option_f,
    q.marks, q.shuffle_options,
    q.correct, q.rationale, q.rationale_img, q.fb_a, q.fb_b, q.fb_c, q.fb_d, q.fb_e, q.fb_f,
    q.subject, q.maintopic, q.subtopic, q.difficulty,
    q.bloom_level, q.tags, q.version
  from unnest(p_item_ids) with ordinality as ids (item_id, ord)
  join question_bank q on q.item_id = ids.item_id and q.course_id = p_course_id;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'create_attempt: none of the % ids belong to course %', coalesce(array_length(p_item_ids, 1), 0), p_course_id;
  end if;

  update attempts a set n = v_n where a.attempt_id = p_attempt_id;
  return v_n;
end;
$$;
revoke execute on function create_attempt(text, text, text, text[], text, text, text, integer, text, text) from public, anon, authenticated;

-- ── 5. making a pack ──────────────────────────────────────────────────
create or replace function create_offline_pack(
  p_pack_id        text,
  p_user_id        text,
  p_course_id      text,
  p_item_ids       text[],
  p_pack_name      text,
  p_selection_mode text,
  p_maintopics     text[],
  p_subtopics      text[],
  p_difficulties   text[],
  p_question_types text[],
  p_concept_query  text,
  p_display_label  text,
  p_watermark      jsonb
)
returns integer
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_n         integer;
  v_any_grant boolean;
  v_any_packs boolean;
  v_room      boolean;
begin
  -- The live grants for this course: any at all, any that allows packs,
  -- and any with room left (packs made for this course since it began).
  select count(*) > 0,
         coalesce(bool_or(s.allow_packs_per_course is null or s.allow_packs_per_course > 0), false),
         coalesce(bool_or(
           s.allow_packs_per_course is null
           or (select count(*) from offline_packs op
               where op.user_id = p_user_id
                 and op.course_id = p_course_id
                 and op.created_utc >= ca.start_utc)
              < s.allow_packs_per_course
         ), false)
  into v_any_grant, v_any_packs, v_room
  from course_access ca
  join subscriptions s on s.subscription_id = ca.subscription_id
  where ca.user_id = p_user_id
    and ca.course_id = p_course_id
    and ca.revoked_utc is null
    and now() >= ca.start_utc and now() < ca.expires_utc;

  if not v_any_grant then
    raise exception 'You do not have an active subscription for this course.';
  end if;
  if not v_any_packs then
    raise exception 'Offline packs are not included in your package.';
  end if;
  if not v_room then
    raise exception 'You have used all your offline packs for this course.';
  end if;

  if exists (
    select 1
    from unnest(p_item_ids) as i(item_id)
    join question_bank q on q.item_id = i.item_id
    where not q.is_published
  ) then
    raise exception 'This pack has a question that is not published';
  end if;

  insert into offline_packs (
    pack_id, user_id, course_id, pack_name, selection_mode,
    maintopics, subtopics, difficulties, question_types, concept_query,
    display_label, question_count, watermark, status
  ) values (
    p_pack_id, p_user_id, p_course_id, p_pack_name, p_selection_mode,
    coalesce(p_maintopics, '{}'), coalesce(p_subtopics, '{}'), coalesce(p_difficulties, '{}'),
    coalesce(p_question_types, '{}'), p_concept_query,
    p_display_label, 0, coalesce(p_watermark, '{}'::jsonb), 'active'
  );

  insert into offline_pack_items (
    pack_id, position, item_id,
    question_type, stem, option_a, option_b, option_c, option_d, option_e, option_f,
    marks, shuffle_options,
    correct, rationale, rationale_img, fb_a, fb_b, fb_c, fb_d, fb_e, fb_f,
    subject, maintopic, subtopic, difficulty,
    bloom_level, tags, version
  )
  select
    p_pack_id, row_number() over (order by ids.ord), q.item_id,
    q.question_type, q.stem, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, q.option_f,
    q.marks, q.shuffle_options,
    q.correct, q.rationale, q.rationale_img, q.fb_a, q.fb_b, q.fb_c, q.fb_d, q.fb_e, q.fb_f,
    q.subject, q.maintopic, q.subtopic, q.difficulty,
    q.bloom_level, q.tags, q.version
  from unnest(p_item_ids) with ordinality as ids (item_id, ord)
  join question_bank q on q.item_id = ids.item_id and q.course_id = p_course_id;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'create_offline_pack: none of the % ids belong to course %', coalesce(array_length(p_item_ids, 1), 0), p_course_id;
  end if;

  update offline_packs set question_count = v_n where pack_id = p_pack_id;
  return v_n;
end;
$$;
revoke execute on function create_offline_pack(text, text, text, text[], text, text, text[], text[], text[], text[], text, text, jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';
