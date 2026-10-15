-- 20261015160000_pools.sql — 06-question-bank.md (06.8), pools; ticked
-- by Sam 2026-10-15 on `question_bank` in 12-tables.md.
--
-- WHY. A question's place was worked out each time from which draft or
-- active papers and mocks listed it ("held back"), so it leaked whenever a
-- listing changed — a mock archived before its results date (04.21), a
-- question taken off a mock, a mock question not yet added. Now every
-- question belongs to one pool, set by the admin, and each place that
-- draws from the bank reads only its own (Sam, 2026-10-15).
--
-- WHAT.
--   1. question_bank.pool: 'practice', 'free', 'paper' or 'mock', not
--      null, default 'practice'. Filled from today's rows: listed by a mock
--      → mock, by a paper → paper, marked free → free, the rest practice
--      (dev: 245 / 9,500 / 90 / the rest, none in two).
--   2. A paper's list (quiz_items) takes only Paper questions, a mock's
--      (mock_quiz_items) only Mock ones; a question a paper or mock lists
--      cannot change pool. Triggers, so the rows already listed are not
--      re-checked.
--   3. The free read rule and create_attempt's free check read
--      pool = 'free'; create_attempt refuses a builder sitting (or its
--      retake) holding a question outside Practice and Free. Everything
--      else in create_attempt is as 20261015120000.
--   4. The keyword search returns Practice and Free only (Free alone for
--      the free set).
--   5. question_bank_history keeps pool in place of is_free_sample; the
--      history trigger copies it.
--   6. is_free_sample is dropped; authenticated reads pool in its place.
--
-- REACH. Dev only; prod at the next release Sam approves. On the dev site
-- (main's code, which reads is_free_sample) the bank page, the free
-- builder and the packs error until the merge.

set search_path = licensure_gh;

-- ── 1. the pool ───────────────────────────────────────────────────────
alter table question_bank add column if not exists pool text not null default 'practice';
update question_bank q
set pool = case
  when exists (select 1 from mock_quiz_items m where m.item_id = q.item_id) then 'mock'
  when exists (select 1 from quiz_items p where p.item_id = q.item_id) then 'paper'
  when q.is_free_sample then 'free'
  else 'practice'
end;
alter table question_bank drop constraint if exists question_bank_pool_check;
alter table question_bank add constraint question_bank_pool_check
  check (pool in ('practice', 'free', 'paper', 'mock'));
create index if not exists question_bank_course_pool_idx on question_bank (course_id, pool);

-- ── 2. a list takes only its own pool; a listed question stays ─────────
create or replace function _pool_list_check()
returns trigger
language plpgsql
set search_path = licensure_gh
as $$
declare
  v_want text := case when tg_table_name = 'quiz_items' then 'paper' else 'mock' end;
  v_pool text;
begin
  select q.pool into v_pool from question_bank q where q.item_id = new.item_id;
  if v_pool is distinct from v_want then
    raise exception 'Question % is in the % pool; a % takes only % questions.',
      new.item_id, initcap(coalesce(v_pool, 'no')),
      case when v_want = 'paper' then 'practice paper' else 'mock' end, initcap(v_want);
  end if;
  return new;
end;
$$;
revoke execute on function _pool_list_check() from public, anon, authenticated;

drop trigger if exists quiz_items_pool on quiz_items;
create trigger quiz_items_pool before insert or update of item_id on quiz_items
  for each row execute function _pool_list_check();
drop trigger if exists mock_quiz_items_pool on mock_quiz_items;
create trigger mock_quiz_items_pool before insert or update of item_id on mock_quiz_items
  for each row execute function _pool_list_check();

create or replace function _pool_change_check()
returns trigger
language plpgsql
set search_path = licensure_gh
as $$
begin
  if new.pool is distinct from old.pool then
    if exists (select 1 from quiz_items p where p.item_id = old.item_id) then
      raise exception 'Question % is in a practice paper, so it stays in the Paper pool. Take it out of the paper first.', old.item_id;
    end if;
    if exists (select 1 from mock_quiz_items m where m.item_id = old.item_id) then
      raise exception 'Question % is in a mock, so it stays in the Mock pool. Take it out of the mock first.', old.item_id;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function _pool_change_check() from public, anon, authenticated;

drop trigger if exists question_bank_pool on question_bank;
create trigger question_bank_pool before update of pool on question_bank
  for each row execute function _pool_change_check();

-- ── 3. the free read rule, and the start rule ─────────────────────────
drop policy if exists question_bank_select_free on question_bank;
create policy question_bank_select_free on question_bank
  for select
  using (is_published and pool = 'free' and auth.uid() is not null);

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
  v_all_free    boolean;
  v_first_mode  text;
  v_allowed     integer;
  v_results_at  timestamptz;
  v_review      text;
  v_review_end  timestamptz;
  v_used        integer;
  v_going       boolean;
  v_word        text;
begin
  -- What kind of sitting: a retake takes its quiz's kind; a retake with
  -- no quiz is a builder retake, which no count limits.
  v_kind := case
    when p_source = 'fixed' then 'paper'
    when p_source = 'mock' then 'mock'
    when p_source = 'builder' then 'builder'
    when p_source = 'retake' and p_quiz_id is not null then
      case when exists (select 1 from mock_quizzes m where m.quiz_id = p_quiz_id) then 'mock' else 'paper' end
    else 'builder_retake'
  end;

  -- Every question a published free question of this course (the free set, 03).
  v_all_free := coalesce(array_length(p_item_ids, 1), 0) > 0
    and not exists (
      select 1
      from unnest(p_item_ids) as i(item_id)
      left join question_bank q on q.item_id = i.item_id and q.course_id = p_course_id
      where q.item_id is null or not q.is_published or q.pool <> 'free');

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
    -- The free set (F1): a builder quiz of free questions only, in a
    -- course of the student's programme, in a Study mode.
    if v_kind not in ('builder', 'builder_retake') then
      raise exception 'You do not have an active subscription for this course.';
    end if;
    if p_mode not in ('UNTIMED_LEARNING', 'UNTIMED_TEST') then
      raise exception 'The exam modes open with a package.';
    end if;
    if not exists (
         select 1 from courses c join users u on u.user_id = p_user_id
         where c.course_id = p_course_id and u.program_id = any (c.program_scope))
       or not v_all_free
    then
      raise exception 'You do not have an active subscription for this course.';
    end if;
  else
    if v_kind = 'paper' and not v_papers_all
       and not exists (select 1 from quizzes q where q.quiz_id = p_quiz_id and q.open_in_trial) then
      raise exception 'This paper opens with a package.';
    end if;

    if v_kind = 'mock' and not v_mocks then
      raise exception 'Mock exams aren''t included in your package.';
    end if;

    if v_kind in ('paper', 'mock') then
      v_word := case when v_kind = 'mock' then 'mock' else 'paper' end;
      if v_kind = 'mock' then
        select m.first_mode, m.sittings_allowed, m.results_at, m.review, m.review_closes_at
        into v_first_mode, v_allowed, v_results_at, v_review, v_review_end
        from mock_quizzes m where m.quiz_id = p_quiz_id;
      else
        select q.first_mode, q.sittings_allowed, q.results_at, q.review, q.review_closes_at
        into v_first_mode, v_allowed, v_results_at, v_review, v_review_end
        from quizzes q where q.quiz_id = p_quiz_id;
      end if;

      -- The first sitting is in first_mode; the other ways open once a
      -- sitting in that mode is completed (04.5, 04.11).
      if v_first_mode is not null and p_mode <> v_first_mode
         and not exists (
           select 1 from attempts a
           where a.user_id = p_user_id and a.quiz_id = p_quiz_id
             and a.mode = v_first_mode and a.status = 'completed') then
        raise exception 'Finish your first sitting of this % before the other ways open.', v_word;
      end if;

      -- Results on a date (04.12): until then only the first mode, which
      -- shows nothing before the date; another would show the answers.
      if v_results_at is not null and now() < v_results_at
         and v_first_mode is not null and p_mode <> v_first_mode then
        raise exception 'Until its results are out, this % can only be sat in its first mode.', v_word;
      end if;

      -- The review (04.13): while it is closed only Learning shuts — it
      -- shows each answer; the other modes show the summary only (Sam).
      if p_mode = 'UNTIMED_LEARNING'
         and (v_review = 'never' or (v_review = 'until' and now() >= v_review_end)) then
        raise exception 'The answers to this % are not shown any more, so Learning is not open.', v_word;
      end if;

      -- Sittings allowed (04.10): every sitting started counts, and one
      -- at a time.
      if v_allowed is not null then
        select count(*), coalesce(bool_or(a.status = 'in_progress'), false)
        into v_used, v_going
        from attempts a
        where a.user_id = p_user_id and a.quiz_id = p_quiz_id;
        if v_used >= v_allowed then
          raise exception 'You have used your % sittings of this %.', v_allowed, v_word;
        end if;
        if v_going then
          raise exception 'Finish or resume your sitting in progress first.';
        end if;
      end if;
    end if;

    -- Builder quizzes: unlimited on any grant without a count; otherwise
    -- a grant still has room when the student's builder sittings in its
    -- courses since it began are fewer than its count. With the count
    -- used up, the free questions stay open in a Study mode, as on a
    -- free account (Sam, 2026-10-11: b).
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
      if not v_builder_ok
         and not (v_all_free and p_mode in ('UNTIMED_LEARNING', 'UNTIMED_TEST')) then
        raise exception 'You have used all the Quiz Builder quizzes in your package.';
      end if;
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

  -- Pools (06.8): a builder sitting, and its retake, holds only Practice
  -- and Free questions — never a paper's or a mock's.
  if v_kind in ('builder', 'builder_retake') and exists (
    select 1
    from unnest(p_item_ids) as i(item_id)
    join question_bank q on q.item_id = i.item_id
    where q.pool not in ('practice', 'free')
  ) then
    raise exception 'This quiz has a question that is not in the practice bank.';
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

-- ── 4. the keyword search: the practice bank ──────────────────────────
create or replace function search_question_bank_ids(p_course_id text, p_query text, p_free_only boolean default false)
returns table (item_id text)
language sql
stable
set search_path = licensure_gh
as $$
  with pat as (
    -- every character but letters, digits and spaces matched as itself;
    -- a run of spaces as any run of spaces; anchored at a word's start
    select '\m' || regexp_replace(
             regexp_replace(btrim(coalesce(p_query, '')), '([^[:alnum:][:space:]])', '\\\1', 'g'),
             '\s+', '\\s+', 'g') as re
  )
  select q.item_id
  from question_bank q, pat
  where q.course_id = p_course_id
    and q.is_published
    and q.pool in ('practice', 'free')
    and (not p_free_only or q.pool = 'free')
    and btrim(coalesce(p_query, '')) <> ''
    and (
      coalesce(q.subtopic, '') ~* pat.re
      or coalesce(q.maintopic, '') ~* pat.re
      or coalesce(q.stem, '') ~* pat.re
      or coalesce(q.rationale, '') ~* pat.re
    )
  order by q.item_id
$$;
revoke all on function search_question_bank_ids(text, text, boolean) from public, anon, authenticated;

-- ── 5. the history keeps pool ─────────────────────────────────────────
alter table question_bank_history add column if not exists pool text;
update question_bank_history set pool = case when is_free_sample then 'free' else 'practice' end where pool is null;
alter table question_bank_history drop column if exists is_free_sample;

create or replace function question_bank_history_write()
returns trigger
language plpgsql
set search_path = licensure_gh
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_published then
      insert into question_bank_history (
        item_id, course_id, question_type, stem,
        option_a, fb_a, option_b, fb_b, option_c, fb_c, option_d, fb_d, option_e, fb_e, option_f, fb_f,
        correct, rationale, rationale_img, subject, maintopic, subtopic, difficulty,
        marks, batch_id, shuffle_options,
        bloom_level, is_published, pool, question_ref, tags, created_at, updated_at, updated_by,
        version, changed_by, deleted
      ) values (
        old.item_id, old.course_id, old.question_type, old.stem,
        old.option_a, old.fb_a, old.option_b, old.fb_b, old.option_c, old.fb_c, old.option_d, old.fb_d, old.option_e, old.fb_e, old.option_f, old.fb_f,
        old.correct, old.rationale, old.rationale_img, old.subject, old.maintopic, old.subtopic, old.difficulty,
        old.marks, old.batch_id, old.shuffle_options,
        old.bloom_level, old.is_published, old.pool, old.question_ref, old.tags, old.created_at, old.updated_at, old.updated_by,
        old.version, old.updated_by, true
      );
    end if;
    return old;
  end if;

  -- UPDATE: a version is cut only when a PUBLISHED row's CONTENT changes.
  -- Label-only edits, drafts, and the publish switch itself write nothing.
  if old.is_published
     and row(old.stem, old.option_a, old.option_b, old.option_c, old.option_d, old.option_e, old.option_f,
             old.correct, old.rationale, old.rationale_img,
             old.fb_a, old.fb_b, old.fb_c, old.fb_d, old.fb_e, old.fb_f,
             old.question_type, old.marks)
         is distinct from
         row(new.stem, new.option_a, new.option_b, new.option_c, new.option_d, new.option_e, new.option_f,
             new.correct, new.rationale, new.rationale_img,
             new.fb_a, new.fb_b, new.fb_c, new.fb_d, new.fb_e, new.fb_f,
             new.question_type, new.marks)
  then
    insert into question_bank_history (
      item_id, course_id, question_type, stem,
      option_a, fb_a, option_b, fb_b, option_c, fb_c, option_d, fb_d, option_e, fb_e, option_f, fb_f,
      correct, rationale, rationale_img, subject, maintopic, subtopic, difficulty,
      marks, batch_id, shuffle_options,
      bloom_level, is_published, pool, question_ref, tags, created_at, updated_at, updated_by,
      version, changed_by, deleted
    ) values (
      old.item_id, old.course_id, old.question_type, old.stem,
      old.option_a, old.fb_a, old.option_b, old.fb_b, old.option_c, old.fb_c, old.option_d, old.fb_d, old.option_e, old.fb_e, old.option_f, old.fb_f,
      old.correct, old.rationale, old.rationale_img, old.subject, old.maintopic, old.subtopic, old.difficulty,
      old.marks, old.batch_id, old.shuffle_options,
      old.bloom_level, old.is_published, old.pool, old.question_ref, old.tags, old.created_at, old.updated_at, old.updated_by,
      old.version, new.updated_by, false
    );
    new.version = old.version + 1;
  end if;
  return new;
end;
$$;

-- ── 6. the mark goes ──────────────────────────────────────────────────
alter table question_bank drop column if exists is_free_sample;
grant select (pool) on question_bank to authenticated;

notify pgrst, 'reload schema';
