-- 20261030190000_access_floor.sql — 02 Premium goes first (Sam,
-- 2026-10-30: option C, the column ticked "Ticked, build it"; 12-tables,
-- course_access)
--
-- A Premium Prep receipt is laid down on its own day even while a
-- Standard one is running on the course; the running row is cut there
-- and a second row of the same receipt holds the rest, laid after the
-- Premium days. No day is lost, the end is the same, only the order
-- changes.
--
-- The rest needs its own floor. The chain orders its links by their
-- earliest allowed start, and until now that was the receipt's (the
-- admin's requested start, else when it was made) — so the next re-pack
-- would join the rest straight back onto the first piece and undo the
-- pause. floor_utc is a piece's own earliest start: the moment it was
-- cut. Empty means the receipt's, which is every row written before
-- today and every first piece. The row writer (lib/subscriptions/
-- access-rows.ts) reads and writes it; nothing else does. Each row stays
-- a plain window, so the gate and every reader of access are unchanged.
--
-- AGENTS.md rule 9: the table's grants restated — the browser's roles
-- hold SELECT and nothing else (as since 02 C2, 2026-09-19).

set search_path = licensure_gh;

alter table course_access add column if not exists floor_utc timestamptz;

revoke all on table course_access from anon, authenticated;
grant select on table course_access to authenticated;

notify pgrst, 'reload schema';
