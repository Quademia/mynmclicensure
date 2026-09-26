-- 20260926150000_question_bank_columns_history.sql — 08-question-bank.md B4,
-- rebuild.md §8 S17 (Sam, 2026-09-26: adopted item by item, ticked, scoped
-- the same day)
--
-- WHY. The bank had 26 columns and two constraints, the key and the course
-- key. A saved or imported question was live the moment it landed; nothing
-- said what kind of thinking a question demands, where it came from, when
-- it was made or changed, or what it said before an edit; `question_type`
-- and `difficulty` were unchecked text, so a file's "T/F" landed as a type
-- no code renders. MyNclex's bank was compared column by column and nine
-- things taken (08 §3, 2026-09-26). This file is the storage half of B4.
--
-- WHAT.
--   1. Nine columns on question_bank: bloom_level, is_published (draft by
--      default; every existing row set live here), is_free_sample (the
--      pool mark — its door is §8 S16, not this file), question_ref
--      (internal provenance), tags, created_at / updated_at (a trigger
--      stamps the update), version, updated_by (the admin's U_ id, written
--      by every admin write — a plain PostgREST statement carries only the
--      row's columns and a trigger cannot see the actor under the service
--      role, so the actor travels on the row).
--   2. CHECKs on question_type, difficulty and bloom_level. The ADD
--      CONSTRAINT refuses the whole file if any row fails, which is the
--      refusal wanted: on dev 5,277 / 0 / 4 and 2,437 / 2,125 / 719 pass.
--   3. question_bank_history — the bank's columns plus the version pushed
--      aside, who, when and a deleted mark — written by one trigger when a
--      PUBLISHED row's CONTENT changes (stem, options, correct, rationale,
--      image, feedbacks, type, marks) and when a published row is deleted.
--      Label-only changes, drafts, and the publish switch itself write
--      nothing (Sam, 2026-09-26). Born with `grant all` to both browser
--      roles by the schema's default privileges, so revoked, RLS on, no
--      policy: the admin reads it through the service role.
--   4. The read policy gains `is_published` for non-admins; the concept
--      search gains the same (it runs as the service role, which RLS never
--      filters, and its ids reach the browser bare).
--   5. attempt_items and offline_pack_items gain bloom_level, tags and
--      version; both copiers copy them and REFUSE a draft id before the
--      copy, with the message the Start button shows. A deleted id keeps
--      today's rule and is dropped.
--   6. Rule 9: authenticated gains SELECT on is_published and
--      is_free_sample only (the student reads filter on them); anon holds
--      nothing since B2; question_ref and updated_by are never granted.
--      offline_pack_items held table-level SELECT, which would carry the
--      three new columns by itself — narrowed to the 27 columns it has
--      today. attempt_items' column list is left as it stands.
--
-- REACH. Applied on dev before the merge: main's code keeps working (its
-- editor picks type and difficulty from lists; its importer upper-cases the
-- type), but until the merge a question saved or imported from main's admin
-- page lands as a draft with no Publish control there, a CSV row whose
-- difficulty is not exactly Easy / Moderate / Hard fails its batch at the
-- CHECK, and a history row written meanwhile carries a null changed_by.
-- Dev only; Sam alone (said when the apply was proposed, 2026-09-26).

set search_path = licensure_gh;

-- ── 1. the nine columns ────────────────────────────────────────────────
alter table question_bank
  add column bloom_level    text,
  add column is_published   boolean     not null default false,
  add column is_free_sample boolean     not null default false,
  add column question_ref   text,
  add column tags           text[]      not null default '{}',
  add column created_at     timestamptz not null default now(),
  add column updated_at     timestamptz not null default now(),
  add column version        integer     not null default 1,
  add column updated_by     text;

-- Every row that exists today is what students practise on: live.
-- A row saved after this file lands as a draft (the default above).
update question_bank set is_published = true;

-- ── 2. the CHECKs ──────────────────────────────────────────────────────
alter table question_bank
  add constraint question_bank_question_type_check
    check (question_type in ('MCQ', 'TF', 'SATA'));
alter table question_bank
  add constraint question_bank_difficulty_check
    check (difficulty is null or difficulty in ('Easy', 'Moderate', 'Hard'));
alter table question_bank
  add constraint question_bank_bloom_level_check
    check (bloom_level is null or bloom_level in ('Remember', 'Understand', 'Apply', 'Analyse', 'Evaluate', 'Create'));

-- ── 3. updated_at, stamped by the database ─────────────────────────────
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists question_bank_touch_updated_at on question_bank;
create trigger question_bank_touch_updated_at
  before update on question_bank
  for each row execute function touch_updated_at();

-- ── 4. the history table and its trigger ───────────────────────────────
create table question_bank_history (
  history_id      bigint generated always as identity primary key,
  -- the bank's columns, as the row was before the change
  item_id         text not null,
  course_id       text,
  question_type   text,
  stem            text,
  option_a text, fb_a text,
  option_b text, fb_b text,
  option_c text, fb_c text,
  option_d text, fb_d text,
  option_e text, fb_e text,
  option_f text, fb_f text,
  correct         text,
  rationale       text,
  rationale_img   text,
  subject         text,
  maintopic       text,
  subtopic        text,
  difficulty      text,
  marks           numeric,
  batch_id        text,
  shuffle_options boolean,
  bloom_level     text,
  is_published    boolean,
  is_free_sample  boolean,
  question_ref    text,
  tags            text[],
  created_at      timestamptz,
  updated_at      timestamptz,
  updated_by      text,
  -- the version pushed aside, who pushed it, when, and whether by a delete
  version         integer     not null,
  changed_by      text,
  changed_at      timestamptz not null default now(),
  deleted         boolean     not null default false
);

-- not unique: a deleted id re-imported starts again at version 1
create index question_bank_history_item_version_idx
  on question_bank_history (item_id, version);

-- a new table here is born with `grant all` to both browser roles
revoke all on question_bank_history from anon, authenticated;
revoke all on sequence question_bank_history_history_id_seq from anon, authenticated;
alter table question_bank_history enable row level security;

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
        bloom_level, is_published, is_free_sample, question_ref, tags, created_at, updated_at, updated_by,
        version, changed_by, deleted
      ) values (
        old.item_id, old.course_id, old.question_type, old.stem,
        old.option_a, old.fb_a, old.option_b, old.fb_b, old.option_c, old.fb_c, old.option_d, old.fb_d, old.option_e, old.fb_e, old.option_f, old.fb_f,
        old.correct, old.rationale, old.rationale_img, old.subject, old.maintopic, old.subtopic, old.difficulty,
        old.marks, old.batch_id, old.shuffle_options,
        old.bloom_level, old.is_published, old.is_free_sample, old.question_ref, old.tags, old.created_at, old.updated_at, old.updated_by,
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
      bloom_level, is_published, is_free_sample, question_ref, tags, created_at, updated_at, updated_by,
      version, changed_by, deleted
    ) values (
      old.item_id, old.course_id, old.question_type, old.stem,
      old.option_a, old.fb_a, old.option_b, old.fb_b, old.option_c, old.fb_c, old.option_d, old.fb_d, old.option_e, old.fb_e, old.option_f, old.fb_f,
      old.correct, old.rationale, old.rationale_img, old.subject, old.maintopic, old.subtopic, old.difficulty,
      old.marks, old.batch_id, old.shuffle_options,
      old.bloom_level, old.is_published, old.is_free_sample, old.question_ref, old.tags, old.created_at, old.updated_at, old.updated_by,
      old.version, new.updated_by, false
    );
    new.version = old.version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists question_bank_history on question_bank;
create trigger question_bank_history
  before update or delete on question_bank
  for each row execute function question_bank_history_write();

-- ── 5. the read policy: published only, unless admin ───────────────────
drop policy if exists question_bank_select on question_bank;
create policy question_bank_select on question_bank for select
using (
  auth_user_role() = 'ADMIN'
  or (is_published and course_id in (select m.course_id from my_course_access() m))
);

-- ── 6. rule 9 ──────────────────────────────────────────────────────────
-- the two switches join authenticated's column list (B2 gave it 17); the
-- student reads filter on them and a cookie-client filter needs SELECT on
-- the column. bloom_level, tags, version, the dates, question_ref and
-- updated_by are NOT granted: no student read uses them yet, and the bank
-- page reads them through the service role. anon holds nothing since B2.
grant select (is_published, is_free_sample) on question_bank to authenticated;

-- offline_pack_items held table-level SELECT, which would hand the three
-- new columns below to authenticated by itself: the 27 columns it has
-- today, by name.
revoke all on offline_pack_items from anon, authenticated;
grant select (
  pack_item_id, pack_id, position, item_id,
  question_type, stem, option_a, option_b, option_c, option_d, option_e, option_f,
  marks, shuffle_options,
  correct, rationale, rationale_img, fb_a, fb_b, fb_c, fb_d, fb_e, fb_f,
  subject, maintopic, subtopic, difficulty
) on offline_pack_items to authenticated;

-- ── 7. the snapshot columns ────────────────────────────────────────────
alter table attempt_items
  add column bloom_level text,
  add column tags        text[] not null default '{}',
  add column version     integer;

alter table offline_pack_items
  add column bloom_level text,
  add column tags        text[] not null default '{}',
  add column version     integer;

-- ── 8. the concept search: published rows only ─────────────────────────
-- SECURITY INVOKER, but called by the service role (searchConceptItemIds),
-- which RLS never filters, and its ids reach the browser bare.
create or replace function search_question_bank_ids(p_course_id text, p_query text)
returns table (item_id text)
language sql
stable
set search_path = licensure_gh
as $$
  select q.item_id
  from question_bank q
  where q.course_id = p_course_id
    and q.is_published
    and btrim(coalesce(p_query, '')) <> ''
    and (
      position(lower(p_query) in lower(coalesce(q.subtopic, ''))) > 0
      or position(lower(p_query) in lower(coalesce(q.maintopic, ''))) > 0
      or position(lower(p_query) in lower(q.stem)) > 0
      or position(lower(p_query) in lower(coalesce(q.rationale, ''))) > 0
    )
  order by q.item_id
$$;
revoke all on function search_question_bank_ids(text, text) from public, anon, authenticated;

-- ── 9. the two copiers: refuse a draft, copy the three ─────────────────
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
  -- A draft is not servable. The builder never offers one; a fixed quiz,
  -- a mock or a retake may name one that was unpublished since. Refuse
  -- the start rather than copy or drop it (B4, ruled 2026-09-26). The
  -- message is what createAttemptRows shows on the card.
  if exists (
    select 1
    from unnest(p_item_ids) as i(item_id)
    join question_bank q on q.item_id = i.item_id and q.course_id = p_course_id
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
  -- the pack builder's pool is published rows only, so a draft id here is
  -- a stale browser or a tampered request: refused, as create_attempt does
  if exists (
    select 1
    from unnest(p_item_ids) as i(item_id)
    join question_bank q on q.item_id = i.item_id and q.course_id = p_course_id
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
