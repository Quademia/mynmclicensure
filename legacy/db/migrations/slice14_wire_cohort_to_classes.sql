-- ============================================================
-- Slice 14: Wire Cohorts into Classes
-- Run in Supabase SQL editor (after Slice 12 + 13 migrations)
-- ============================================================

-- Add cohort_id to teacher_classes (nullable — backward compatible)
-- Courses do NOT link to classes — they link through quizzes only.
ALTER TABLE teacher_classes
  ADD COLUMN cohort_id TEXT REFERENCES teacher_cohorts(cohort_id);

CREATE INDEX idx_teacher_classes_cohort_id ON teacher_classes(cohort_id);
