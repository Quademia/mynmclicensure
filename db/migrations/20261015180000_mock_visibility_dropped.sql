-- 20261015180000_mock_visibility_dropped.sql — 10-launch-and-platform.md
-- (10.17), ticked by Sam 2026-10-04 on `mock_quizzes` in 12-tables.md.
--
-- WHY. mock_quizzes.visibility ('ALL', 'PAID', 'TRIAL') came from legacy,
-- which stored it and never checked it; the package's mock yes / no is the
-- gate (03 F4, 02.10). Nothing reads or writes it: save_quiz names its
-- columns and leaves it out, and the app stopped reading it the same day.
--
-- WHAT. The column goes, with its check and its column grant.
--
-- REACH. Dev only; prod at the next release Sam approves. On the dev site
-- (main's code, which still lists the column in the mock list's read) the
-- Mock exams page errors until the merge.

set search_path = licensure_gh;

alter table mock_quizzes drop column if exists visibility;

notify pgrst, 'reload schema';
