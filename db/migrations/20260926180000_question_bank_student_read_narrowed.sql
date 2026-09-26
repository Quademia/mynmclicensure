-- 20260926180000_question_bank_student_read_narrowed.sql — rebuild.md §8
-- S19, built with 08-question-bank.md B6 (Sam, 2026-09-26: adopted and
-- ticked the same day)
--
-- WHY. Since 08 B2 `authenticated` held SELECT on 19 columns of
-- question_bank, the read policy scoping the rows to a student's
-- published course rows. The app's browser-client reads use 10 of them
-- (knownItemIds, getBuilderCourseItems, getItemFilterOptions — the id,
-- course, subject, topic, subtopic, difficulty, type, batch and the two
-- switches; the admin page's filter options read the batch through the
-- admin's own cookie client, which is `authenticated` too). The other 9
-- no code reads through a browser client: a sitting's and a pack's
-- questions are copied by create_attempt / create_offline_pack (definer,
-- service role only) and read through the service role. So a subscribed
-- student's own login could read the wording and options of every
-- published question in their courses straight from the API — a mock's
-- questions before it is sat (B6 holds them back from practice), and a
-- whole course's question text to copy out.
--
-- WHAT. The 9 columns taken from `authenticated`; the 10 filter columns
-- stay. `anon` holds nothing since B2 and gets nothing. No function or
-- policy reads the 9 as `authenticated` (the four functions reading the
-- bank are definer or run by the service role — checked 2026-09-26).
--
-- REACH. No screen changes. The dev site's `main` code reads no question
-- text through a student's client (B2 took the stems out of the
-- builders), so nothing breaks there before the merge.

set search_path = licensure_gh;

revoke select (stem, option_a, option_b, option_c, option_d, option_e, option_f, marks, shuffle_options)
  on question_bank from authenticated;
