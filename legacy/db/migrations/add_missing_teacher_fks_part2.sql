-- ============================================================
-- Add missing MyTeacher foreign keys (part 2)
-- ============================================================
--
-- Discovered during prod smoke-test on 2026-04-17: the student
-- "my classes" page failed with PGRST200 — PostgREST couldn't
-- find a relationship between teacher_class_members and
-- teacher_classes because the FK was never created on prod.
--
-- Audit revealed 7 FKs that exist on dev but had never been
-- added to prod (nor declared in the repo schema files). All
-- needed for referential integrity AND for PostgREST's nested
-- select embeds like:
--   db.from('teacher_class_members').select('teacher_classes(...)')
--
-- Applied to prod directly via MCP, zero orphans found pre-apply.
-- Also NOTIFY pgrst, 'reload schema' after — required for
-- PostgREST to pick up the new FKs without a restart.
-- ============================================================

BEGIN;

ALTER TABLE teacher_class_members
  ADD CONSTRAINT teacher_class_members_class_id_fkey
  FOREIGN KEY (class_id) REFERENCES teacher_classes(class_id);

ALTER TABLE teacher_profiles
  ADD CONSTRAINT teacher_profiles_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES teacher_users(user_id) ON DELETE CASCADE;

ALTER TABLE teacher_quiz_attempts
  ADD CONSTRAINT teacher_quiz_attempts_class_id_fkey
  FOREIGN KEY (class_id) REFERENCES teacher_classes(class_id);

ALTER TABLE teacher_quiz_attempts
  ADD CONSTRAINT teacher_quiz_attempts_teacher_quiz_id_fkey
  FOREIGN KEY (teacher_quiz_id) REFERENCES teacher_quizzes(teacher_quiz_id);

ALTER TABLE teacher_quiz_classes
  ADD CONSTRAINT teacher_quiz_classes_class_id_fkey
  FOREIGN KEY (class_id) REFERENCES teacher_classes(class_id);

ALTER TABLE teacher_quiz_classes
  ADD CONSTRAINT teacher_quiz_classes_teacher_quiz_id_fkey
  FOREIGN KEY (teacher_quiz_id) REFERENCES teacher_quizzes(teacher_quiz_id);

ALTER TABLE teacher_quiz_items
  ADD CONSTRAINT teacher_quiz_items_teacher_quiz_id_fkey
  FOREIGN KEY (teacher_quiz_id) REFERENCES teacher_quizzes(teacher_quiz_id);

COMMIT;

-- After commit, notify PostgREST to reload so it picks up the new FKs:
-- NOTIFY pgrst, 'reload schema';
