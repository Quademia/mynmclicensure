-- ============================================================
-- Add teacher_config table (MyTeacher runtime-tunable settings)
-- ============================================================
--
-- Mirror of the Licensure `config` table, scoped to MyTeacher.
-- Used for future runtime-tunable UX limits (e.g. quiz builder
-- bounds, runner behaviour, bank import caps).
--
-- Rules:
--   - Any logged-in user can SELECT (so client-side reads work)
--   - Only MyTeacher admins can INSERT / UPDATE / DELETE
--   - Worker URLs do NOT live here (they live in
--     myteacher/js/config.js with hostname detection)
--
-- Seed: empty. Features add their keys as they're introduced.
-- ============================================================

BEGIN;

CREATE TABLE teacher_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT
);

ALTER TABLE teacher_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_config_select"
ON teacher_config FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "teacher_config_insert"
ON teacher_config FOR INSERT
WITH CHECK (myteacher_user_role() = 'ADMIN');

CREATE POLICY "teacher_config_update"
ON teacher_config FOR UPDATE
USING (myteacher_user_role() = 'ADMIN');

CREATE POLICY "teacher_config_delete"
ON teacher_config FOR DELETE
USING (myteacher_user_role() = 'ADMIN');

COMMIT;
