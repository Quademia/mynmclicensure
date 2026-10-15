-- 20261015200000_packs_database.sql — 07-offline-packs.md, slice 1 of the
-- redesign (07.1, 07.6, 07.7); ticked by Sam 2026-10-15 on
-- `offline_packs`, `offline_pack_items` and `config` in 12-tables.md.
--
-- WHY. The redesign keeps packs on the phone and in a PDF, so a pack leaves
-- our control: it holds the question, its options and its answer — never
-- the explanation (Sam). A student may delete a pack without getting the
-- allowance back. The allowance is the package's (03 F4), read by one rule
-- for the page and the maker alike. A phone keeps its packs open only so
-- many days without connecting.
--
-- WHAT.
--   1. pack_allowance(user, course): the course's live grants, and the best
--      of them — unlimited if any grant has no count; else the one with the
--      most packs left — as granted, allowed (null = unlimited), used,
--      packs_left (null = unlimited) and since (that grant's start). Every
--      pack made since the grant began counts, deleted ones too. Server only.
--   2. create_offline_pack: the allowance from pack_allowance (the same
--      three refusals in the same words); a question outside the Practice
--      and Free pools refused (06.8); the explanation, its picture and the
--      per-option feedback no longer copied. Everything else as
--      20261004120000.
--   3. offline_pack_items loses rationale, rationale_img and fb_a … fb_f —
--      the packs already made lose theirs (and the owner's column grant on
--      them goes with the columns).
--   4. offline_packs, rule 9: the browser keeps the owner's (and the
--      admin's) read only; the insert and update policies go. Delete is the
--      server's: status 'deleted', the row kept.
--   5. config: offline_checkin_days (30) added; offline_packs_per_course
--      retired — the package says how many (07.1).
--
-- REACH. Dev only; prod at the next release Sam approves. On the dev site
-- (main's code) the pack page errors (it reads the dropped columns) until
-- the merge; making a pack keeps working.

set search_path = licensure_gh;

-- ── 1. the allowance, one rule ────────────────────────────────────────
create or replace function pack_allowance(p_user_id text, p_course_id text)
returns table (granted boolean, allowed integer, used integer, packs_left integer, since timestamptz)
language sql
stable
security definer
set search_path = licensure_gh
as $$
  with g as (
    select s.allow_packs_per_course as lim,
           ca.start_utc as start_utc,
           (select count(*)::integer from offline_packs op
             where op.user_id = p_user_id
               and op.course_id = p_course_id
               and op.created_utc >= ca.start_utc) as used
    from course_access ca
    join subscriptions s on s.subscription_id = ca.subscription_id
    where ca.user_id = p_user_id
      and ca.course_id = p_course_id
      and ca.revoked_utc is null
      and now() >= ca.start_utc and now() < ca.expires_utc
  ),
  best as (
    select lim, used, start_utc,
           case when lim is null then null else greatest(0, lim - used) end as left_n
    from g
    order by (lim is null) desc, greatest(0, coalesce(lim, 0) - used) desc, start_utc
    limit 1
  )
  select exists (select 1 from g),
         (select lim from best),
         coalesce((select used from best), 0),
         case when exists (select 1 from g) then (select left_n from best) else 0 end,
         (select start_utc from best)
$$;
revoke execute on function pack_allowance(text, text) from public, anon, authenticated;

-- ── 2. the pack maker ─────────────────────────────────────────────────
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
  v_n integer;
  a   record;
begin
  -- The allowance, from the one rule (pack_allowance, above).
  select * into a from pack_allowance(p_user_id, p_course_id);
  if not a.granted then
    raise exception 'You do not have an active subscription for this course.';
  end if;
  if a.allowed = 0 then
    raise exception 'Offline packs are not included in your package.';
  end if;
  if a.packs_left = 0 then
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

  -- Pools (06.8): a pack holds Practice and Free questions only.
  if exists (
    select 1
    from unnest(p_item_ids) as i(item_id)
    join question_bank q on q.item_id = i.item_id
    where q.pool not in ('practice', 'free')
  ) then
    raise exception 'This pack has a question that is not in the practice bank.';
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
    correct,
    subject, maintopic, subtopic, difficulty,
    bloom_level, tags, version
  )
  select
    p_pack_id, row_number() over (order by ids.ord), q.item_id,
    q.question_type, q.stem, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, q.option_f,
    q.marks, q.shuffle_options,
    q.correct,
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

-- ── 3. no explanations in a pack ──────────────────────────────────────
alter table offline_pack_items
  drop column if exists rationale,
  drop column if exists rationale_img,
  drop column if exists fb_a,
  drop column if exists fb_b,
  drop column if exists fb_c,
  drop column if exists fb_d,
  drop column if exists fb_e,
  drop column if exists fb_f;

-- ── 4. rule 9 on offline_packs ────────────────────────────────────────
drop policy if exists offline_packs_insert on offline_packs;
drop policy if exists offline_packs_update on offline_packs;
revoke all on offline_packs from anon, authenticated;
grant select on offline_packs to authenticated;

-- ── 5. the settings ───────────────────────────────────────────────────
insert into config (key, value, description)
values ('offline_checkin_days', '30',
        'Days a phone keeps its offline packs open without connecting; after that they lock until it connects once')
on conflict (key) do nothing;
delete from config where key = 'offline_packs_per_course';

notify pgrst, 'reload schema';
