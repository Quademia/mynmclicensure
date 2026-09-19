-- 20260919170000_quiz_floor.sql — 03-quiz-system.md Q1 (rebuild.md §8 S12;
-- D44, D48; Sam, 2026-09-18 the ruling, 2026-09-19 the go)
--
-- The floor under the two quiz tables. Until now quizzes_select and
-- mock_quizzes_select were `auth.uid() is not null`: every signed-in
-- account read every row of both tables — every course, draft and
-- archived — with item_ids (the exact question set) and notes ("admin
-- only"). Proven on dev 2026-09-18: an RN student read the RM quizzes
-- and all 45 mock question ids. The pages filtered in TypeScript and
-- shipped the rows whole.
--
-- Three moves:
--   1. The SELECT policies become admin, or an active published row
--      of a course the caller holds (user_has_course, the bank's own
--      gate). Drafts, archived rows and other programmes' quizzes stop
--      existing for a student at the source.
--   2. item_ids and notes leave the browser roles' reach — column-level
--      (the S10 shape): SELECT revoked from authenticated and granted
--      back on every column but those two. The admin's cookie client
--      is `authenticated` too, so every read of the two columns goes
--      through the service role behind a gate (the attempt spawn, the
--      admin edit step, the two whole-table admin reads —
--      lib/quizzes/queries.ts). The service role keeps its grant from
--      the schema migration.
--   3. The status words pinned: CHECKs on status, allowed_modes and
--      mock_quizzes.visibility; n defaulted on mock_quizzes like its
--      sibling. Dev holds only the known words (checked 2026-09-19);
--      prod's rows are copied from the legacy tables at cutover and
--      carry the same three vocabularies.

set search_path = licensure_gh;

-- ── 1. course-scoped reads ────────────────────────────────────────────
drop policy if exists quizzes_select on quizzes;
create policy quizzes_select on quizzes for select
using (
  auth_user_role() = 'ADMIN'
  or (status = 'active' and published and user_has_course(course_id))
);

drop policy if exists mock_quizzes_select on mock_quizzes;
create policy mock_quizzes_select on mock_quizzes for select
using (
  auth_user_role() = 'ADMIN'
  or (status = 'active' and published and user_has_course(course_id))
);

-- ── 2. item_ids and notes server-only ─────────────────────────────────
revoke select on quizzes from anon, authenticated;
grant select (quiz_id, course_id, title, n, allowed_modes, shuffle, time_limit_sec,
              published, publish_at, unpublish_at, status, created_at, updated_at)
  on quizzes to authenticated;

revoke select on mock_quizzes from anon, authenticated;
grant select (quiz_id, course_id, title, n, allowed_modes, shuffle, time_limit_sec,
              published, publish_at, unpublish_at, status, visibility, created_at, updated_at)
  on mock_quizzes to authenticated;

-- ── 3. the words pinned ───────────────────────────────────────────────
alter table quizzes drop constraint if exists quizzes_status_check;
alter table quizzes add constraint quizzes_status_check
  check (status in ('draft', 'active', 'archived'));
alter table quizzes drop constraint if exists quizzes_allowed_modes_check;
alter table quizzes add constraint quizzes_allowed_modes_check
  check (allowed_modes in ('BOTH', 'INSTANT_ONLY', 'TIMED_ONLY'));

alter table mock_quizzes drop constraint if exists mock_quizzes_status_check;
alter table mock_quizzes add constraint mock_quizzes_status_check
  check (status in ('draft', 'active', 'archived'));
alter table mock_quizzes drop constraint if exists mock_quizzes_allowed_modes_check;
alter table mock_quizzes add constraint mock_quizzes_allowed_modes_check
  check (allowed_modes in ('BOTH', 'INSTANT_ONLY', 'TIMED_ONLY'));
alter table mock_quizzes drop constraint if exists mock_quizzes_visibility_check;
alter table mock_quizzes add constraint mock_quizzes_visibility_check
  check (visibility in ('ALL', 'PAID', 'TRIAL'));
alter table mock_quizzes alter column n set default 0;
