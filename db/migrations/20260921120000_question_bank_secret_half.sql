-- 20260921120000_question_bank_secret_half.sql — 08-question-bank.md B2
-- (D8, D9), after S7
--
-- The bank's answer half leaves the browser's reach. Until now
-- question_bank handed both browser roles the schema's default `grant
-- all` — SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
-- on every one of its 26 columns — with the RLS policies the only gate.
-- A student holding a course could read `correct`, the rationale and the
-- six per-option feedbacks for every question in it with their own
-- credential (D8, carried from legacy). That could not be closed until
-- S7: the runner read the live bank, so the key had to be reachable.
-- Since 03 Q4–Q6 the runner is served from attempt_items and the pack
-- renderer from offline_pack_items, both snapshotted at creation by a
-- service-role function. Nothing on the student side needs the key any
-- more.
--
-- Two moves:
--   1. `revoke all` from anon and authenticated, then SELECT granted
--      back on the seventeen public columns to `authenticated` only —
--      the S10 / Q1 shape. `correct`, `rationale`, `rationale_img` and
--      fb_a…fb_f are reachable by the service role alone. The stem, the
--      options and the criteria columns stay readable: a student holding
--      the course is entitled to the question, and the SELECT policy
--      still decides which course. `anon` gets nothing — the bank has
--      always been behind a course gate.
--      The admin's cookie client is `authenticated` too, so every admin
--      read of the answer half now goes through the service role behind
--      requireAdmin() (lib/bank/actions.ts loadCourseItems,
--      lib/quizzes/actions.ts loadPickerItems) — as Q1 did for item_ids
--      and notes.
--   2. The write grants go with it (Sam, 2026-09-21). The bank's only
--      write path is the admin Question Bank page — Save, Delete and the
--      CSV import — and those three move to the service role behind the
--      same gate, the way S10 moved the profile insert and Deactivate.
--      The table is then left with no browser write path at all, which
--      is what a table in this schema should look like; TRUNCATE in
--      particular is not subject to RLS. The three admin write policies
--      go with the privilege they policed: with no role holding INSERT,
--      UPDATE or DELETE, RLS refuses by default, and a policy that can
--      never be reached reads like a live gate.
--
-- Nothing user-visible changes but the wait on one field. The builders
-- stop shipping a course's stems and rationales to the browser (D9): the
-- concept keyword is matched by search_question_bank_ids() below, which
-- returns item ids and never text. It is a function rather than a filter
-- built in TypeScript because the keyword is a student's own typing —
-- as a bound parameter it cannot reach the query's shape, and `position`
-- reproduces the browser's `.includes()` exactly, with none of LIKE's
-- wildcard meanings to escape.
--
-- Prod carries the same table with the same default grants; this file
-- applies there at the next release.

set search_path = licensure_gh;

-- ── 1. the secret half off the browser roles ──────────────────────────
revoke all on question_bank from anon, authenticated;
grant select (
  item_id, course_id, question_type, stem,
  option_a, option_b, option_c, option_d, option_e, option_f,
  marks, shuffle_options,
  subject, maintopic, subtopic, difficulty, batch_id
) on question_bank to authenticated;

-- ── 2. the write policies follow the write grants ─────────────────────
drop policy if exists question_bank_insert on question_bank;
drop policy if exists question_bank_update on question_bank;
drop policy if exists question_bank_delete on question_bank;

-- question_bank_select stays: it is the live gate on the student's read.

-- ── 3. the builders' concept search, server-side ──────────────────────
-- The four fields the wizard has always matched on — subtopic, main
-- topic, stem, rationale — tested as a plain case-insensitive substring,
-- which is what the browser's String.includes() did over the same rows.
-- Returns the course's matching item ids in id order; the browser keeps
-- its own light rows (criteria columns only, no text since B2) and
-- intersects, so every chip, count and the pool size go on working as
-- they did. An empty query matches nothing here, not everything.
--
-- SECURITY INVOKER: the caller is the service role, which reads the
-- table already; the callers' own gate is requireStudent() plus the
-- course-access check (lib/attempts/actions.ts searchBuilderConcepts).
-- EXECUTE off the browser roles, like every other function since S9.
create or replace function search_question_bank_ids(p_course_id text, p_query text)
returns table (item_id text)
language sql
stable
set search_path = licensure_gh
as $$
  select q.item_id
  from question_bank q
  where q.course_id = p_course_id
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

notify pgrst, 'reload schema';
