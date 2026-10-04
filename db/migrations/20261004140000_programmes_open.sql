-- 20261004140000_programmes_open.sql — 02-packages-and-payments.md C5a,
-- Open to the public (Sam, 2026-10-04: "go ahead with C5a"); ticked
-- 2026-10-04, written on programs in 12-tables.md
--
-- WHY. Every programme row was offered at once — the home page and
-- registration listed every one, the shop and checkout accepted any — so
-- a programme could not be prepared before its question bank was ready.
-- Sam ruled seven programmes, released in batches.
--
-- WHAT.
--   1. programs.is_open, Open to the public — one switch per programme,
--      the one place it is set. Every programme already here starts open
--      (today's five); a new one starts closed (the column's default).
--   2. NAC, NAP and RCN added, closed, with working names Sam can correct.
--      No courses or packages move yet: NACNAP's two courses and four
--      packages move to NAC and NAP in one step on the day they open
--      (C5b), because a package's programme is read from its courses.
--   3. Rule 9 on programs: the browser keeps reading (the public pages
--      need the names); inserts and updates leave the browser roles, the
--      admin's save goes through the server; the two write policies go.
-- The refusals at registration and checkout, and the lists showing open
-- programmes only, are the app's (same commit).
--
-- REACH. Dev only. On the dev site, main's admin programme save (a
-- browser write) is refused until this branch is merged — Sam only.

set search_path = licensure_gh;

-- ── 1. the switch ─────────────────────────────────────────────────────
alter table programs add column is_open boolean not null default false;
update programs set is_open = true;

-- ── 2. the three new programmes, closed ───────────────────────────────
insert into programs (program_id, program_name, trial_product_id, is_open) values
  ('NAC', 'Nursing Assistant Clinical',   null, false),
  ('NAP', 'Nursing Assistant Preventive', null, false),
  ('RCN', 'Registered Community Nursing', null, false)
on conflict (program_id) do nothing;

-- ── 3. rule 9 ─────────────────────────────────────────────────────────
revoke insert, update, delete, truncate, references, trigger on programs from anon, authenticated;
drop policy if exists programs_insert on programs;
drop policy if exists programs_update on programs;

notify pgrst, 'reload schema';
