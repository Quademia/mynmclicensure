-- 20260926160000_copiers_refuse_any_draft.sql — 08-question-bank.md B4,
-- a correction to 20260926150000 the same afternoon
--
-- WHY. The previous file's refusal in create_attempt and
-- create_offline_pack joined the bank on the item id AND the course, so a
-- draft named from another course slipped past the refusal and was then
-- dropped silently by the copy join — "skip and shrink", the shape Sam
-- ruled out on 2026-09-26. The spec's clause has no course condition:
-- every unpublished id the list names is refused, whichever course it
-- belongs to. Found by the migration's reviewer before the apply, fixed
-- after it. The copy joins keep their course condition: a stranger id
-- that IS published is dropped as before (nothing to republish).

set search_path = licensure_gh;

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
  v_n integer;
begin
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
begin
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
