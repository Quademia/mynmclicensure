-- ============================================================
-- Rename library_* tables → teacher_library_*
-- ============================================================
-- Why: naming consistency. Every other MyTeacher-owned table
-- uses the teacher_ prefix. These 10 are the last holdouts.
--
-- Safe because: all 10 tables empty on dev + prod (verified).
-- No JS changes needed — resolveLibraryRefs() in myteacher-api.js
-- reads items_table from teacher_library_courses dynamically.
--
-- RLS state pre-migration: each table has one permissive SELECT
-- policy for public named "Anyone can read library_X". Postgres
-- preserves policies across RENAME, but the policy names go stale.
-- We rename the policies to match for consistency.
-- ============================================================

BEGIN;

-- 1. Rename the 10 item tables
ALTER TABLE library_accounting   RENAME TO teacher_library_accounting;
ALTER TABLE library_anatomy      RENAME TO teacher_library_anatomy;
ALTER TABLE library_english      RENAME TO teacher_library_english;
ALTER TABLE library_government   RENAME TO teacher_library_government;
ALTER TABLE library_management   RENAME TO teacher_library_management;
ALTER TABLE library_microbiology RENAME TO teacher_library_microbiology;
ALTER TABLE library_pharmacology RENAME TO teacher_library_pharmacology;
ALTER TABLE library_physiology   RENAME TO teacher_library_physiology;
ALTER TABLE library_sociology    RENAME TO teacher_library_sociology;
ALTER TABLE library_surveying    RENAME TO teacher_library_surveying;

-- 2. Rename the accompanying RLS policies to match the new table names
ALTER POLICY "Anyone can read library_accounting"   ON teacher_library_accounting   RENAME TO "Anyone can read teacher_library_accounting";
ALTER POLICY "Anyone can read library_anatomy"      ON teacher_library_anatomy      RENAME TO "Anyone can read teacher_library_anatomy";
ALTER POLICY "Anyone can read library_english"      ON teacher_library_english      RENAME TO "Anyone can read teacher_library_english";
ALTER POLICY "Anyone can read library_government"   ON teacher_library_government   RENAME TO "Anyone can read teacher_library_government";
ALTER POLICY "Anyone can read library_management"   ON teacher_library_management   RENAME TO "Anyone can read teacher_library_management";
ALTER POLICY "Anyone can read library_microbiology" ON teacher_library_microbiology RENAME TO "Anyone can read teacher_library_microbiology";
ALTER POLICY "Anyone can read library_pharmacology" ON teacher_library_pharmacology RENAME TO "Anyone can read teacher_library_pharmacology";
ALTER POLICY "Anyone can read library_physiology"   ON teacher_library_physiology   RENAME TO "Anyone can read teacher_library_physiology";
ALTER POLICY "Anyone can read library_sociology"    ON teacher_library_sociology    RENAME TO "Anyone can read teacher_library_sociology";
ALTER POLICY "Anyone can read library_surveying"    ON teacher_library_surveying    RENAME TO "Anyone can read teacher_library_surveying";

-- 3. Update the catalogue pointer — idempotent guard
UPDATE teacher_library_courses
SET items_table = REPLACE(items_table, 'library_', 'teacher_library_')
WHERE items_table LIKE 'library_%';

-- 4. Reload PostgREST schema cache so the renamed tables are queryable
NOTIFY pgrst, 'reload schema';

COMMIT;
