-- ============================================================
-- Fix: MyTeacher RLS policies using wrong helper functions
-- ============================================================
--
-- Bug:
--   21 policies across 7 MyTeacher tables reference
--   auth_user_id() / auth_user_role(). Those helpers read
--   public.users (the Licensure identity table). A freshly-
--   registered teacher has NO row in public.users — they live
--   only in teacher_users — so the helpers return NULL and
--   every INSERT/SELECT on their own content fails with 42501.
--
-- Why it was hiding:
--   Legacy test teachers had dual rows in both public.users
--   AND teacher_users (artifact of the pre-split era), so the
--   wrong helpers still returned a match. Real new signups
--   (single-table residency) exposed the bug.
--
-- Fix:
--   Swap to myteacher_user_id() / myteacher_user_role(), which
--   read teacher_users. These helpers already exist in rls.sql
--   and are used correctly on teacher_class_members and
--   teacher_quiz_attempts — we just didn't propagate them to
--   the teacher-authored content tables.
--
-- Scope (9 tables, 26 policies):
--   teacher_profiles        (insert/update)
--   teacher_programmes      (select/insert/update)
--   teacher_cohorts         (select/insert/update)
--   teacher_courses         (select/insert/update)
--   teacher_bank_items      (select/insert/update)
--   teacher_classes         (select/insert/update)  -- preserves
--                            auth.uid() IS NOT NULL for join_code
--   teacher_quizzes         (select/insert/update)
--   teacher_quiz_classes    (select/insert/update)
--   teacher_quiz_items      (select/insert/delete)
--
-- Intentionally NOT changed:
--   teacher_library_courses  (admin-only; current admins have
--                             rows in both tables, so behavior
--                             is unchanged. Revisit when teacher
--                             public library ships.)
--
-- NOT in scope:
--   Licensure tables (public.users, subscriptions, payments,
--   quizzes, attempts, items_*) — they continue to use
--   auth_user_id() / auth_user_role() correctly.
--
-- Apply to dev first, verify, then prod.
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────
-- 0. teacher_profiles
--    SELECT policy (auth.uid() IS NOT NULL) is fine —
--    only INSERT and UPDATE reference helpers.
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "teacher_profiles_insert" ON teacher_profiles;
DROP POLICY IF EXISTS "teacher_profiles_update" ON teacher_profiles;

CREATE POLICY "teacher_profiles_insert"
ON teacher_profiles FOR INSERT
WITH CHECK (
  teacher_profiles.teacher_id = myteacher_user_id()
);

CREATE POLICY "teacher_profiles_update"
ON teacher_profiles FOR UPDATE
USING (
  teacher_profiles.teacher_id = myteacher_user_id()
  OR myteacher_user_role() = 'ADMIN'
);

-- ─────────────────────────────────────────────────
-- 1. teacher_programmes
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "teacher_programmes_select" ON teacher_programmes;
DROP POLICY IF EXISTS "teacher_programmes_insert" ON teacher_programmes;
DROP POLICY IF EXISTS "teacher_programmes_update" ON teacher_programmes;

CREATE POLICY "teacher_programmes_select" ON teacher_programmes
  FOR SELECT USING (
    teacher_id = myteacher_user_id()
    OR myteacher_user_role() = 'ADMIN'
  );

CREATE POLICY "teacher_programmes_insert" ON teacher_programmes
  FOR INSERT WITH CHECK (
    teacher_id = myteacher_user_id()
  );

CREATE POLICY "teacher_programmes_update" ON teacher_programmes
  FOR UPDATE USING (
    teacher_id = myteacher_user_id()
  );

-- ─────────────────────────────────────────────────
-- 2. teacher_cohorts
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "teacher_cohorts_select" ON teacher_cohorts;
DROP POLICY IF EXISTS "teacher_cohorts_insert" ON teacher_cohorts;
DROP POLICY IF EXISTS "teacher_cohorts_update" ON teacher_cohorts;

CREATE POLICY "teacher_cohorts_select" ON teacher_cohorts
  FOR SELECT USING (
    teacher_id = myteacher_user_id()
    OR myteacher_user_role() = 'ADMIN'
  );

CREATE POLICY "teacher_cohorts_insert" ON teacher_cohorts
  FOR INSERT WITH CHECK (
    teacher_id = myteacher_user_id()
  );

CREATE POLICY "teacher_cohorts_update" ON teacher_cohorts
  FOR UPDATE USING (
    teacher_id = myteacher_user_id()
  );

-- ─────────────────────────────────────────────────
-- 3. teacher_courses
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "teacher_courses_select" ON teacher_courses;
DROP POLICY IF EXISTS "teacher_courses_insert" ON teacher_courses;
DROP POLICY IF EXISTS "teacher_courses_update" ON teacher_courses;

CREATE POLICY "teacher_courses_select" ON teacher_courses
  FOR SELECT USING (
    teacher_id = myteacher_user_id()
    OR myteacher_user_role() = 'ADMIN'
  );

CREATE POLICY "teacher_courses_insert" ON teacher_courses
  FOR INSERT WITH CHECK (
    teacher_id = myteacher_user_id()
  );

CREATE POLICY "teacher_courses_update" ON teacher_courses
  FOR UPDATE USING (
    teacher_id = myteacher_user_id()
  );

-- ─────────────────────────────────────────────────
-- 4. teacher_bank_items
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "teacher_bank_items_select" ON teacher_bank_items;
DROP POLICY IF EXISTS "teacher_bank_items_insert" ON teacher_bank_items;
DROP POLICY IF EXISTS "teacher_bank_items_update" ON teacher_bank_items;

CREATE POLICY "teacher_bank_items_select"
ON teacher_bank_items FOR SELECT
USING (
  teacher_bank_items.teacher_id = myteacher_user_id()
  OR myteacher_user_role() = 'ADMIN'
);

CREATE POLICY "teacher_bank_items_insert"
ON teacher_bank_items FOR INSERT
WITH CHECK (
  teacher_bank_items.teacher_id = myteacher_user_id()
);

CREATE POLICY "teacher_bank_items_update"
ON teacher_bank_items FOR UPDATE
USING (
  teacher_bank_items.teacher_id = myteacher_user_id()
);

-- ─────────────────────────────────────────────────
-- 5. teacher_classes
--    SELECT preserves `auth.uid() IS NOT NULL` per
--    rls.sql LESSON 2: students need to look up
--    classes by join_code before they're members.
--    Hardening to a SECURITY DEFINER RPC is on the
--    BUILD_LIST follow-up.
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "teacher_classes_select" ON teacher_classes;
DROP POLICY IF EXISTS "teacher_classes_insert" ON teacher_classes;
DROP POLICY IF EXISTS "teacher_classes_update" ON teacher_classes;

CREATE POLICY "teacher_classes_select"
ON teacher_classes FOR SELECT
USING (
  myteacher_user_role() = 'ADMIN'
  OR teacher_classes.teacher_id = myteacher_user_id()
  OR auth.uid() IS NOT NULL
);

CREATE POLICY "teacher_classes_insert"
ON teacher_classes FOR INSERT
WITH CHECK (
  teacher_classes.teacher_id = myteacher_user_id()
);

CREATE POLICY "teacher_classes_update"
ON teacher_classes FOR UPDATE
USING (
  teacher_classes.teacher_id = myteacher_user_id()
  OR myteacher_user_role() = 'ADMIN'
);

-- ─────────────────────────────────────────────────
-- 6. teacher_quizzes
--    SELECT keeps the EXISTS subquery for student
--    access via class membership — just swaps
--    auth_user_id() → myteacher_user_id().
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "teacher_quizzes_select" ON teacher_quizzes;
DROP POLICY IF EXISTS "teacher_quizzes_insert" ON teacher_quizzes;
DROP POLICY IF EXISTS "teacher_quizzes_update" ON teacher_quizzes;

CREATE POLICY "teacher_quizzes_select"
ON teacher_quizzes FOR SELECT
USING (
  myteacher_user_role() = 'ADMIN'
  OR teacher_quizzes.teacher_id = myteacher_user_id()
  OR (
    teacher_quizzes.status = 'PUBLISHED'
    AND EXISTS (
      SELECT 1 FROM teacher_quiz_classes tqc
      JOIN teacher_class_members m
        ON m.class_id = tqc.class_id
      WHERE tqc.teacher_quiz_id = teacher_quizzes.teacher_quiz_id
      AND m.user_id = myteacher_user_id()
      AND m.status = 'ACTIVE'
    )
  )
);

CREATE POLICY "teacher_quizzes_insert"
ON teacher_quizzes FOR INSERT
WITH CHECK (
  teacher_quizzes.teacher_id = myteacher_user_id()
);

CREATE POLICY "teacher_quizzes_update"
ON teacher_quizzes FOR UPDATE
USING (
  teacher_quizzes.teacher_id = myteacher_user_id()
  OR myteacher_user_role() = 'ADMIN'
);

-- ─────────────────────────────────────────────────
-- 7. teacher_quiz_classes
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "teacher_quiz_classes_select" ON teacher_quiz_classes;
DROP POLICY IF EXISTS "teacher_quiz_classes_insert" ON teacher_quiz_classes;
DROP POLICY IF EXISTS "teacher_quiz_classes_update" ON teacher_quiz_classes;

CREATE POLICY "teacher_quiz_classes_select"
ON teacher_quiz_classes FOR SELECT
USING (
  myteacher_user_role() = 'ADMIN'
  OR teacher_quiz_classes.teacher_id = myteacher_user_id()
  OR EXISTS (
    SELECT 1 FROM teacher_class_members m
    WHERE m.class_id = teacher_quiz_classes.class_id
    AND m.user_id = myteacher_user_id()
    AND m.status = 'ACTIVE'
  )
);

CREATE POLICY "teacher_quiz_classes_insert"
ON teacher_quiz_classes FOR INSERT
WITH CHECK (
  teacher_quiz_classes.teacher_id = myteacher_user_id()
);

CREATE POLICY "teacher_quiz_classes_update"
ON teacher_quiz_classes FOR UPDATE
USING (
  teacher_quiz_classes.teacher_id = myteacher_user_id()
);

-- ─────────────────────────────────────────────────
-- 8. teacher_quiz_items
--    Existing policies: select, insert, delete
--    (no update policy — items are replaced via
--    delete + insert on quiz republish).
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "teacher_quiz_items_select" ON teacher_quiz_items;
DROP POLICY IF EXISTS "teacher_quiz_items_insert" ON teacher_quiz_items;
DROP POLICY IF EXISTS "teacher_quiz_items_delete" ON teacher_quiz_items;

CREATE POLICY "teacher_quiz_items_select"
ON teacher_quiz_items FOR SELECT
USING (
  myteacher_user_role() = 'ADMIN'
  OR EXISTS (
    SELECT 1 FROM teacher_quizzes q
    WHERE q.teacher_quiz_id = teacher_quiz_items.teacher_quiz_id
    AND (
      q.teacher_id = myteacher_user_id()
      OR q.status = 'PUBLISHED'
    )
  )
);

CREATE POLICY "teacher_quiz_items_insert"
ON teacher_quiz_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM teacher_quizzes q
    WHERE q.teacher_quiz_id = teacher_quiz_items.teacher_quiz_id
    AND q.teacher_id = myteacher_user_id()
  )
);

CREATE POLICY "teacher_quiz_items_delete"
ON teacher_quiz_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM teacher_quizzes q
    WHERE q.teacher_quiz_id = teacher_quiz_items.teacher_quiz_id
    AND q.teacher_id = myteacher_user_id()
  )
);

COMMIT;
