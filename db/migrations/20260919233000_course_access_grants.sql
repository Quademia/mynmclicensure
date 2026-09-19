-- 20260919233000_course_access_grants.sql — 02-subscriptions.md C2, the
-- grants finished (2026-09-19)
--
-- The C2 migration took insert / update / delete back from the browser
-- roles on course_access but left the rest of the schema's default
-- "grant all" in place — TRUNCATE, REFERENCES and TRIGGER stayed with
-- anon and authenticated (seen on dev right after the apply). RLS does
-- not gate TRUNCATE. A student's role should hold SELECT and nothing
-- else on this table; the service role keeps everything.

set search_path = licensure_gh;

revoke all on course_access from anon, authenticated;
grant select on course_access to authenticated;
