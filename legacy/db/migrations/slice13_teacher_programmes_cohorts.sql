-- ============================================================
-- Slice 13: Teacher Programmes & Cohorts
-- Run in Supabase SQL editor
-- ============================================================

-- 1. Create teacher_programmes table
CREATE TABLE teacher_programmes (
  programme_id  TEXT PRIMARY KEY,
  teacher_id    TEXT NOT NULL,
  title         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- status: ACTIVE | ARCHIVED

CREATE INDEX idx_teacher_programmes_teacher_id ON teacher_programmes(teacher_id);

-- 2. RLS for teacher_programmes
ALTER TABLE teacher_programmes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_programmes_select" ON teacher_programmes
  FOR SELECT USING (
    teacher_id = auth_user_id()
    OR auth_user_role() = 'ADMIN'
  );

CREATE POLICY "teacher_programmes_insert" ON teacher_programmes
  FOR INSERT WITH CHECK (
    teacher_id = auth_user_id()
  );

CREATE POLICY "teacher_programmes_update" ON teacher_programmes
  FOR UPDATE USING (
    teacher_id = auth_user_id()
  );

-- 3. Create teacher_cohorts table
-- No uniqueness constraint — a teacher can have multiple cohorts for the same
-- programme and intake year (e.g. Group A and Group B of the same intake).
CREATE TABLE teacher_cohorts (
  cohort_id     TEXT PRIMARY KEY,
  teacher_id    TEXT NOT NULL,
  programme_id  TEXT NOT NULL REFERENCES teacher_programmes(programme_id),
  title         TEXT NOT NULL,
  intake_year   INT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- status: ACTIVE | ARCHIVED

CREATE INDEX idx_teacher_cohorts_teacher_id   ON teacher_cohorts(teacher_id);
CREATE INDEX idx_teacher_cohorts_programme_id ON teacher_cohorts(programme_id);

-- 4. RLS for teacher_cohorts
ALTER TABLE teacher_cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_cohorts_select" ON teacher_cohorts
  FOR SELECT USING (
    teacher_id = auth_user_id()
    OR auth_user_role() = 'ADMIN'
  );

CREATE POLICY "teacher_cohorts_insert" ON teacher_cohorts
  FOR INSERT WITH CHECK (
    teacher_id = auth_user_id()
  );

CREATE POLICY "teacher_cohorts_update" ON teacher_cohorts
  FOR UPDATE USING (
    teacher_id = auth_user_id()
  );
