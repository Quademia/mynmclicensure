-- ============================================================
-- Fix: MyTeacher foreign keys pointing to wrong user table
-- ============================================================
--
-- Bug:
--   8 foreign keys across 6 MyTeacher tables reference
--   users(user_id) (the Licensure identity table). A freshly-
--   registered teacher/student has NO row in users — they live
--   only in teacher_users — so every INSERT fails the FK check
--   ("violates foreign key constraint ..._teacher_id_fkey").
--
-- Why it was hiding:
--   Same reason as the RLS bug — legacy dual-residency test
--   users masked the issue until a single-table real signup
--   tried to create content.
--
-- Fix:
--   Drop the 8 FKs and recreate them pointing to teacher_users.
--   MyTeacher students also live in teacher_users (verified:
--   1 teacher, 1 student, 1 admin, all in teacher_users), so
--   user_id FKs repoint there too.
--
-- Safe to run — all affected tables are empty on dev.
-- For prod: verify row counts + orphan check before applying.
-- ============================================================

BEGIN;

-- teacher_bank_items
ALTER TABLE teacher_bank_items
  DROP CONSTRAINT IF EXISTS teacher_bank_items_teacher_id_fkey;
ALTER TABLE teacher_bank_items
  ADD CONSTRAINT teacher_bank_items_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES teacher_users(user_id);

-- teacher_classes
ALTER TABLE teacher_classes
  DROP CONSTRAINT IF EXISTS teacher_classes_teacher_id_fkey;
ALTER TABLE teacher_classes
  ADD CONSTRAINT teacher_classes_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES teacher_users(user_id);

-- teacher_class_members (both columns)
ALTER TABLE teacher_class_members
  DROP CONSTRAINT IF EXISTS teacher_class_members_teacher_id_fkey;
ALTER TABLE teacher_class_members
  ADD CONSTRAINT teacher_class_members_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES teacher_users(user_id);

ALTER TABLE teacher_class_members
  DROP CONSTRAINT IF EXISTS teacher_class_members_user_id_fkey;
ALTER TABLE teacher_class_members
  ADD CONSTRAINT teacher_class_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES teacher_users(user_id);

-- teacher_quizzes
ALTER TABLE teacher_quizzes
  DROP CONSTRAINT IF EXISTS teacher_quizzes_teacher_id_fkey;
ALTER TABLE teacher_quizzes
  ADD CONSTRAINT teacher_quizzes_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES teacher_users(user_id);

-- teacher_quiz_classes
ALTER TABLE teacher_quiz_classes
  DROP CONSTRAINT IF EXISTS teacher_quiz_classes_teacher_id_fkey;
ALTER TABLE teacher_quiz_classes
  ADD CONSTRAINT teacher_quiz_classes_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES teacher_users(user_id);

-- teacher_quiz_attempts (both columns)
ALTER TABLE teacher_quiz_attempts
  DROP CONSTRAINT IF EXISTS teacher_quiz_attempts_teacher_id_fkey;
ALTER TABLE teacher_quiz_attempts
  ADD CONSTRAINT teacher_quiz_attempts_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES teacher_users(user_id);

ALTER TABLE teacher_quiz_attempts
  DROP CONSTRAINT IF EXISTS teacher_quiz_attempts_user_id_fkey;
ALTER TABLE teacher_quiz_attempts
  ADD CONSTRAINT teacher_quiz_attempts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES teacher_users(user_id);

COMMIT;
