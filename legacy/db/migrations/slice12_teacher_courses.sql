-- ============================================================
-- Slice 12: Teacher Courses
-- Run in Supabase SQL editor
-- ============================================================

-- 1. Create teacher_courses table
CREATE TABLE teacher_courses (
  course_id    TEXT PRIMARY KEY,
  teacher_id   TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- status: ACTIVE | ARCHIVED

CREATE INDEX idx_teacher_courses_teacher_id ON teacher_courses(teacher_id);

-- 2. RLS
ALTER TABLE teacher_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_courses_select" ON teacher_courses
  FOR SELECT USING (
    teacher_id = auth_user_id()
    OR auth_user_role() = 'ADMIN'
  );

CREATE POLICY "teacher_courses_insert" ON teacher_courses
  FOR INSERT WITH CHECK (
    teacher_id = auth_user_id()
  );

CREATE POLICY "teacher_courses_update" ON teacher_courses
  FOR UPDATE USING (
    teacher_id = auth_user_id()
  );

-- 3. Add course_id to teacher_quizzes (nullable — subject kept as fallback)
ALTER TABLE teacher_quizzes
  ADD COLUMN course_id TEXT REFERENCES teacher_courses(course_id);

CREATE INDEX idx_teacher_quizzes_course_id ON teacher_quizzes(course_id);
