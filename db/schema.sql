-- ============================================================
-- QAcademy Nurses Hub — Full Database Schema
-- Supabase (PostgreSQL)
-- Last updated: April 2026
--
-- HOW TO USE THIS FILE:
--   - This is the single source of truth for all tables.
--   - When adding a new table, add it here first.
--   - Run the relevant CREATE/ALTER in Supabase SQL editor.
--   - All tables use dev_allow_all RLS during build.
--   - 49 tables total (11 core + 3 quiz engine + 11 items
--     + 1 offline packs + 2 messaging + 12 teacher assess
--     + 10 library items (teacher_library_anatomy, etc) — see section 5.9b)
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. CORE TABLES (MyNMCLicensure)
-- ────────────────────────────────────────────────────────────

-- 1.1 programs
CREATE TABLE programs (
  program_id       TEXT PRIMARY KEY,
  program_name     TEXT NOT NULL,
  trial_product_id TEXT
);

-- 1.2 courses
CREATE TABLE courses (
  course_id     TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  program_scope TEXT[] NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  page_slug     TEXT
);
-- status: active | draft | archived

-- 1.3 levels
CREATE TABLE levels (
  level_id   TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.4 products
CREATE TABLE products (
  product_id          TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  kind                TEXT NOT NULL DEFAULT 'PAID',
  status              TEXT NOT NULL DEFAULT 'active',
  courses_included    TEXT[] NOT NULL,
  price_minor         INTEGER NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'GHS',
  duration_days       INTEGER NOT NULL,
  telegram_group_keys TEXT[]
);
-- kind: PAID | TRIAL | FREE

-- 1.5 users
-- MyNMC Licensure users only. MyTeacher users are in teacher_users.
CREATE TABLE users (
  user_id              TEXT PRIMARY KEY,
  auth_id              UUID,
  username             TEXT,
  email                TEXT NOT NULL,
  phone_number         TEXT,
  name                 TEXT,
  forename             TEXT,
  surname              TEXT,
  program_id           TEXT,
  cohort               TEXT,
  level                TEXT,
  role                 TEXT NOT NULL DEFAULT 'STUDENT',
  active               BOOLEAN NOT NULL DEFAULT true,
  avatar_url           TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  signup_source        TEXT DEFAULT 'SUPABASE_AUTH',
  created_utc          TIMESTAMPTZ DEFAULT NOW(),
  last_login_utc       TIMESTAMPTZ
);
-- user_id: 'U_' + random string (TEXT, not UUID)
-- role: STUDENT | ADMIN | TEACHER
-- signup_source: SUPABASE_AUTH | PAYSTACK_SETUP

-- 1.6 subscriptions
CREATE TABLE subscriptions (
  subscription_id TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  product_id      TEXT NOT NULL,
  start_utc       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_utc     TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'ACTIVE',
  expiry_reminded BOOLEAN NOT NULL DEFAULT false,
  source          TEXT NOT NULL DEFAULT 'PAYMENT',
  source_ref      TEXT
);
-- status: ACTIVE | EXPIRED | REVOKED
-- source: PAYMENT | PAYSTACK | ADMIN | SELF_TRIAL_SIGNUP

-- 1.7 payments
CREATE TABLE payments (
  reference             TEXT PRIMARY KEY,
  status                TEXT NOT NULL,
  email                 TEXT NOT NULL,
  user_id               TEXT,
  product_id            TEXT NOT NULL,
  product_name          TEXT,
  amount_minor_expected INTEGER NOT NULL,
  currency              TEXT NOT NULL,
  amount_minor_paid     INTEGER,
  paid_utc              TIMESTAMPTZ,
  activated_utc         TIMESTAMPTZ,
  subscription_id       TEXT,
  failure_note          TEXT,
  raw                   JSONB,
  setup_token           TEXT,
  setup_created_utc     TIMESTAMPTZ,
  setup_completed_utc   TIMESTAMPTZ,
  program_id            TEXT,
  phone_number          TEXT
);
-- status: INIT | PAID | ACTIVATED | SETUP_REQUIRED | FAILED

-- 1.8 announcements
CREATE TABLE announcements (
  announcement_id         TEXT PRIMARY KEY,
  title                   TEXT NOT NULL,
  body_html               TEXT,
  body_text               TEXT,
  status                  TEXT NOT NULL DEFAULT 'draft',
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  start_at                TIMESTAMPTZ,
  end_at                  TIMESTAMPTZ,
  pinned                  BOOLEAN NOT NULL DEFAULT false,
  priority                INTEGER NOT NULL DEFAULT 0,
  dismissible             BOOLEAN NOT NULL DEFAULT true,
  scope_programs          TEXT[],
  scope_courses           TEXT[],
  scope_level             TEXT,
  scope_subscription_kind TEXT,
  scope_product_ids       TEXT[],
  scope_audience          TEXT DEFAULT 'ALL',
  scope_cohort            TEXT,
  scope_user_ids          TEXT[]
);
-- announcement_id: 'ANN_' + Date.now()
-- status: draft | active | archived
-- scope_level and scope_cohort are single TEXT values, not arrays
-- scope_subscription_kind: PAID | TRIAL | FREE (single value)

-- 1.9 user_notice_state
CREATE TABLE user_notice_state (
  id         BIGSERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL,
  item_type  TEXT NOT NULL DEFAULT 'ANNOUNCEMENT',
  item_id    TEXT NOT NULL,
  state      TEXT NOT NULL,
  seen_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_notice UNIQUE (user_id, item_type, item_id)
);
-- state: read | clicked | dismissed

-- 1.10 config
CREATE TABLE config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO config (key, value, description) VALUES
  ('runner_questions_per_page',   '2',  'Questions per page in both runners'),
  ('runner_autosave_interval_sec','60', 'Autosave frequency in runners (seconds)'),
  ('builder_max_questions',       '50', 'Max questions student can request in builder'),
  ('builder_default_questions',   '20', 'Default question count in builder'),
  ('builder_minutes_per_question','1',  'Time estimate per question in builder');


-- ────────────────────────────────────────────────────────────
-- 2. QUIZ ENGINE TABLES (MyNMCLicensure)
-- ────────────────────────────────────────────────────────────

-- 2.1 quizzes (fixed quizzes)
CREATE TABLE quizzes (
  quiz_id        TEXT PRIMARY KEY,
  course_id      TEXT NOT NULL,
  title          TEXT NOT NULL,
  item_ids       TEXT[] NOT NULL DEFAULT '{}',
  n              INTEGER NOT NULL DEFAULT 0,
  allowed_modes  TEXT NOT NULL DEFAULT 'BOTH',
  shuffle        BOOLEAN NOT NULL DEFAULT false,
  time_limit_sec INTEGER,
  published      BOOLEAN NOT NULL DEFAULT false,
  publish_at     TIMESTAMPTZ,
  unpublish_at   TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'draft',
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
-- allowed_modes: BOTH | INSTANT_ONLY | TIMED_ONLY
-- status: draft | active | archived

-- 2.2 mock_quizzes
CREATE TABLE mock_quizzes (
  quiz_id        TEXT PRIMARY KEY,
  course_id      TEXT NOT NULL,
  title          TEXT NOT NULL,
  n              INTEGER NOT NULL,
  item_ids       TEXT[] NOT NULL DEFAULT '{}',
  allowed_modes  TEXT NOT NULL DEFAULT 'BOTH',
  shuffle        BOOLEAN NOT NULL DEFAULT false,
  time_limit_sec INTEGER,
  status         TEXT NOT NULL DEFAULT 'draft',
  published      BOOLEAN NOT NULL DEFAULT false,
  visibility     TEXT NOT NULL DEFAULT 'ALL',
  publish_at     TIMESTAMPTZ,
  unpublish_at   TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
-- allowed_modes: BOTH | INSTANT_ONLY | TIMED_ONLY
-- status: draft | active | archived
-- visibility: ALL | PAID | TRIAL

-- 2.3 attempts
CREATE TABLE attempts (
  attempt_id        TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  quiz_id           TEXT,
  course_id         TEXT NOT NULL,
  mode              TEXT NOT NULL,
  source            TEXT NOT NULL,
  item_ids          TEXT NOT NULL,
  n                 INTEGER NOT NULL,
  seed              TEXT,
  duration_min      INTEGER,
  status            TEXT NOT NULL DEFAULT 'in_progress',
  score_raw         NUMERIC,
  score_total       NUMERIC,
  score_pct         NUMERIC,
  time_taken_s      INTEGER,
  origin_attempt_id TEXT,
  display_label     TEXT,
  answers_json      TEXT NOT NULL DEFAULT '[]',
  ts_iso            TIMESTAMPTZ DEFAULT NOW()
);
-- mode: instant | timed
-- source: fixed | builder | retake | mock
-- status: in_progress | completed | abandoned

CREATE INDEX ON attempts (user_id);
CREATE INDEX ON attempts (quiz_id);
CREATE INDEX ON attempts (course_id);
CREATE INDEX ON attempts (status);
CREATE INDEX ON attempts (user_id, quiz_id, mode, status);


-- ────────────────────────────────────────────────────────────
-- 3. ITEMS TABLES (one per course — MyNMCLicensure)
-- ────────────────────────────────────────────────────────────
-- All 11 tables follow this schema. Replace items_gp with:
--   items_gp, items_rn_med, items_rn_surg,
--   items_rm_ped_obs_hrn, items_rm_mid,
--   items_rphn_pphn, items_rphn_disease_ctrl,
--   items_rmhn_psych_nurs, items_rmhn_psych_ppharm,
--   items_nac_basic_clin, items_nac_basic_prev

CREATE TABLE items_gp (
  item_id         TEXT PRIMARY KEY,
  question_type   TEXT NOT NULL DEFAULT 'MCQ',
  stem            TEXT NOT NULL,
  option_a        TEXT, fb_a TEXT,
  option_b        TEXT, fb_b TEXT,
  option_c        TEXT, fb_c TEXT,
  option_d        TEXT, fb_d TEXT,
  option_e        TEXT, fb_e TEXT,
  option_f        TEXT, fb_f TEXT,
  correct         TEXT NOT NULL,
  rationale       TEXT,
  rationale_img   TEXT,
  subject         TEXT,
  maintopic       TEXT,
  subtopic        TEXT,
  difficulty      TEXT,
  marks           NUMERIC NOT NULL DEFAULT 1,
  batch_id        TEXT,
  shuffle_options BOOLEAN NOT NULL DEFAULT true
);
-- question_type: MCQ | TF | SATA
-- correct: single letter for MCQ/TF e.g. "b", comma-separated for SATA e.g. "a,c,e"
-- rationale_img: public URL from Supabase Storage rationale-images bucket
-- shuffle_options: false for TF questions

CREATE INDEX ON items_gp (maintopic);
CREATE INDEX ON items_gp (subtopic);
CREATE INDEX ON items_gp (subject);
CREATE INDEX ON items_gp (difficulty);
CREATE INDEX ON items_gp (question_type);
CREATE INDEX ON items_gp (batch_id);


-- ────────────────────────────────────────────────────────────
-- 3b. OFFLINE PACKS
-- ────────────────────────────────────────────────────────────

-- 3b.1 offline_packs
CREATE TABLE offline_packs (
  pack_id        TEXT NOT NULL PRIMARY KEY,
  user_id        TEXT NOT NULL,
  course_id      TEXT NOT NULL,
  pack_name      TEXT NOT NULL,
  selection_mode TEXT NOT NULL DEFAULT 'topics',
  maintopics     TEXT[] NOT NULL DEFAULT '{}',
  subtopics      TEXT[] NOT NULL DEFAULT '{}',
  difficulties   TEXT[] NOT NULL DEFAULT '{}',
  question_types TEXT[] NOT NULL DEFAULT '{}',
  concept_query  TEXT,
  display_label  TEXT,
  item_ids       TEXT[] NOT NULL,
  question_count INTEGER NOT NULL,
  watermark      JSONB NOT NULL DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'active',
  created_utc    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_utc    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- selection_mode: topics | concepts


-- ────────────────────────────────────────────────────────────
-- 4. MESSAGING TABLES
-- ────────────────────────────────────────────────────────────

-- 4.1 messages_threads
CREATE TABLE messages_threads (
  thread_id        TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  admin_id         TEXT NOT NULL DEFAULT 'admin1',
  status           TEXT NOT NULL DEFAULT 'open',
  context_type     TEXT NOT NULL DEFAULT 'general',
  subject          TEXT,
  course_id        TEXT,
  quiz_id          TEXT,
  question_id      TEXT,
  attempt_id       TEXT,
  bulk_batch_id    TEXT,
  ref_text         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sender_role TEXT NOT NULL DEFAULT 'student'
);
-- thread_id: 'THR_' + Date.now() + random
-- context_type: general | course | question
-- status: open | closed
-- ref_text: human-readable question reference for question context threads

-- 4.2 messages
CREATE TABLE messages (
  message_id    TEXT PRIMARY KEY,
  thread_id     TEXT NOT NULL,
  sender_id     TEXT NOT NULL,
  sender_role   TEXT NOT NULL,
  body_text     TEXT NOT NULL,
  read_by_user  BOOLEAN NOT NULL DEFAULT false,
  read_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- message_id: 'MSG_' + Date.now() + random
-- sender_role: student | admin


-- ────────────────────────────────────────────────────────────
-- 5. TEACHER ASSESS TABLES (MyTeacher)
-- ────────────────────────────────────────────────────────────

-- 5.1 teacher_profiles
CREATE TABLE teacher_profiles (
  teacher_id      TEXT NOT NULL PRIMARY KEY,
  display_name    TEXT,
  email           TEXT,
  phone_number    TEXT,
  organisation    TEXT,
  role_requested  TEXT DEFAULT 'TEACHER',
  plan_type       TEXT NOT NULL DEFAULT 'FREE',
  active          BOOLEAN NOT NULL DEFAULT false,
  request_status  TEXT NOT NULL DEFAULT 'PENDING',
  request_note    TEXT,
  request_count   INTEGER NOT NULL DEFAULT 0,
  requested_at    TIMESTAMPTZ,
  last_request_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  avatar_url      TEXT,
  org_tagline     TEXT,
  org_region      TEXT,
  org_logo_url    TEXT
);
-- request_status: PENDING | APPROVED | REJECTED
-- plan_type: FREE | PRO

-- 5.2 teacher_classes
CREATE TABLE teacher_classes (
  class_id           TEXT NOT NULL PRIMARY KEY,
  teacher_id         TEXT NOT NULL,
  title              TEXT NOT NULL,
  join_code          TEXT NOT NULL UNIQUE,
  custom_fields_json JSONB NOT NULL DEFAULT '{"fields": []}',
  status             TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  require_approval   BOOLEAN DEFAULT false,
  description        TEXT,
  programme          TEXT,
  course             TEXT,
  academic_year      TEXT,
  semester           TEXT,
  max_capacity       INTEGER,
  start_date         DATE,
  end_date           DATE,
  colour             TEXT,
  cohort_id          TEXT REFERENCES teacher_cohorts(cohort_id)
);
-- status: ACTIVE | ARCHIVED

CREATE INDEX ON teacher_classes (teacher_id);
CREATE INDEX ON teacher_classes (join_code);
CREATE INDEX ON teacher_classes (cohort_id);

-- 5.3 teacher_class_members
CREATE TABLE teacher_class_members (
  member_id          TEXT NOT NULL PRIMARY KEY,
  class_id           TEXT NOT NULL,
  user_id            TEXT NOT NULL,
  teacher_id         TEXT NOT NULL,
  display_name       TEXT,
  email              TEXT,
  member_fields_json JSONB NOT NULL DEFAULT '{"fields": {}}',
  status             TEXT NOT NULL DEFAULT 'ACTIVE',
  joined_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_class_member UNIQUE (class_id, user_id)
);
-- status: ACTIVE | PENDING | REJECTED

CREATE INDEX ON teacher_class_members (class_id);
CREATE INDEX ON teacher_class_members (user_id);
CREATE INDEX ON teacher_class_members (teacher_id);

-- 5.4 teacher_bank_items
CREATE TABLE teacher_bank_items (
  bank_item_id     TEXT NOT NULL PRIMARY KEY,
  teacher_id       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'ACTIVE',
  question_type    TEXT NOT NULL DEFAULT 'MCQ',
  stem             TEXT NOT NULL,
  option_a         TEXT, fb_a TEXT,
  option_b         TEXT, fb_b TEXT,
  option_c         TEXT, fb_c TEXT,
  option_d         TEXT, fb_d TEXT,
  option_e         TEXT, fb_e TEXT,
  option_f         TEXT, fb_f TEXT,
  correct          TEXT NOT NULL,
  rationale        TEXT,
  rationale_img    TEXT,
  subject          TEXT,
  maintopic        TEXT,
  subtopic         TEXT,
  difficulty       TEXT,
  marks            INTEGER NOT NULL DEFAULT 1,
  shuffle_options  BOOLEAN NOT NULL DEFAULT true,
  source_type      TEXT NOT NULL DEFAULT 'TEACHER',
  source_course_id TEXT,
  source_item_id   TEXT,
  imported_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  question_ref     TEXT,
  tags             TEXT[] NOT NULL DEFAULT '{}',
  batch_id         TEXT,
  year_level       TEXT,
  bloom_level      TEXT
);
-- question_type: MCQ | TF | SATA
-- source_type: TEACHER | IMPORT | QUIZ_INLINE | LIBRARY
-- question_ref: teacher's own reference code for numbering questions (unique per teacher)
-- bloom_level: Remember | Understand | Apply | Analyse | Evaluate | Create
-- year_level: e.g. 'Year 1', 'Year 2', 'Level 100', 'Level 200'

CREATE INDEX ON teacher_bank_items (teacher_id);
CREATE INDEX ON teacher_bank_items (teacher_id, status);
CREATE INDEX ON teacher_bank_items (maintopic);
CREATE INDEX ON teacher_bank_items (source_type);
CREATE UNIQUE INDEX idx_bank_question_ref ON teacher_bank_items (teacher_id, question_ref) WHERE question_ref IS NOT NULL;
CREATE INDEX idx_bank_tags ON teacher_bank_items USING GIN (tags);
CREATE INDEX idx_bank_batch ON teacher_bank_items (batch_id);
CREATE INDEX idx_bank_year ON teacher_bank_items (year_level);
CREATE INDEX idx_bank_bloom ON teacher_bank_items (bloom_level);

-- 5.5 teacher_quizzes
CREATE TABLE teacher_quizzes (
  teacher_quiz_id        TEXT NOT NULL PRIMARY KEY,
  teacher_id             TEXT NOT NULL,
  title                  TEXT NOT NULL,
  subject                TEXT,
  course_id              TEXT REFERENCES teacher_courses(course_id),
  preset                 TEXT NOT NULL DEFAULT 'EXAM',
  duration_minutes       INTEGER NOT NULL DEFAULT 0,
  shuffle_questions      BOOLEAN NOT NULL DEFAULT false,
  shuffle_options        BOOLEAN NOT NULL DEFAULT true,
  max_attempts           INTEGER NOT NULL DEFAULT 1,
  show_review            BOOLEAN NOT NULL DEFAULT false,
  show_results           BOOLEAN NOT NULL DEFAULT true,
  results_release_policy TEXT NOT NULL DEFAULT 'MANUAL',
  -- NOTE: results_released / results_released_at at quiz level are no longer
  -- used for gating. Release state lives on teacher_quiz_classes (per-class).
  -- Kept here for backward compat; remove in a follow-up.
  results_released       BOOLEAN NOT NULL DEFAULT false,
  results_released_at    TIMESTAMPTZ,
  -- open_at / close_at serve as the default template window. Per-class
  -- overrides live on teacher_quiz_classes (link.* ?? quiz.*).
  open_at                TIMESTAMPTZ,
  close_at               TIMESTAMPTZ,
  status                 TEXT NOT NULL DEFAULT 'DRAFT',
  access_code            TEXT,
  custom_fields_json     JSONB NOT NULL DEFAULT '{"fields": []}',
  draft_items_json       JSONB NOT NULL DEFAULT '{"items": []}',
  grading_policy         TEXT NOT NULL DEFAULT 'BANDS_PCT',
  grade_bands_json       JSONB NOT NULL DEFAULT '{"bands": []}',
  pass_threshold_pct     NUMERIC NOT NULL DEFAULT 50,
  score_display_policy   TEXT NOT NULL DEFAULT 'RAW_AND_PCT',
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  sata_scoring_policy    TEXT NOT NULL DEFAULT 'ALL_OR_NOTHING'
);
-- status: DRAFT | PUBLISHED | ARCHIVED
-- preset: EXAM | PRACTICE | HOMEWORK
-- results_release_policy: IMMEDIATE | AFTER_CLOSE | MANUAL
-- sata_scoring_policy: ALL_OR_NOTHING | PARTIAL_CREDIT | PER_OPTION
-- grading_policy: BANDS_PCT | PASS_FAIL | NONE
-- score_display_policy: RAW_AND_PCT | PCT_ONLY | RAW_ONLY | HIDDEN

CREATE INDEX ON teacher_quizzes (teacher_id);
CREATE INDEX ON teacher_quizzes (teacher_id, status);

-- 5.6 teacher_quiz_items (snapshot at publish time)
CREATE TABLE teacher_quiz_items (
  quiz_item_id         TEXT NOT NULL PRIMARY KEY,
  teacher_quiz_id      TEXT NOT NULL,
  position             INTEGER NOT NULL,
  bank_item_id         TEXT,
  snap_stem            TEXT NOT NULL,
  snap_option_a        TEXT, snap_fb_a TEXT,
  snap_option_b        TEXT, snap_fb_b TEXT,
  snap_option_c        TEXT, snap_fb_c TEXT,
  snap_option_d        TEXT, snap_fb_d TEXT,
  snap_option_e        TEXT, snap_fb_e TEXT,
  snap_option_f        TEXT, snap_fb_f TEXT,
  snap_correct         TEXT NOT NULL,
  snap_rationale       TEXT,
  snap_rationale_img   TEXT,
  snap_subject         TEXT,
  snap_maintopic       TEXT,
  snap_subtopic        TEXT,
  snap_difficulty      TEXT,
  snap_marks           INTEGER NOT NULL DEFAULT 1,
  snap_question_type   TEXT NOT NULL DEFAULT 'MCQ',
  snap_shuffle_options BOOLEAN NOT NULL DEFAULT true,
  snapped_at           TIMESTAMPTZ DEFAULT NOW(),
  snap_question_ref    TEXT,
  snap_tags            TEXT[] NOT NULL DEFAULT '{}',
  snap_year_level      TEXT,
  snap_bloom_level     TEXT
);

CREATE INDEX ON teacher_quiz_items (teacher_quiz_id);
CREATE INDEX ON teacher_quiz_items (teacher_quiz_id, position);

-- 5.7 teacher_quiz_classes
-- Assignment row: links a quiz (template) to a class with its own schedule
-- and release state. open_at/close_at override the quiz-level template
-- (null = inherit). results_released/_at is link-only (no inheritance).
CREATE TABLE teacher_quiz_classes (
  tqc_id              TEXT NOT NULL PRIMARY KEY,
  teacher_quiz_id     TEXT NOT NULL,
  class_id            TEXT NOT NULL,
  teacher_id          TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'ACTIVE',
  open_at             TIMESTAMPTZ,
  close_at            TIMESTAMPTZ,
  results_released    BOOLEAN NOT NULL DEFAULT false,
  results_released_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_quiz_class UNIQUE (teacher_quiz_id, class_id)
);

CREATE INDEX ON teacher_quiz_classes (teacher_quiz_id);
CREATE INDEX ON teacher_quiz_classes (class_id);
CREATE INDEX ON teacher_quiz_classes (teacher_id);

-- 5.8 teacher_quiz_attempts
CREATE TABLE teacher_quiz_attempts (
  attempt_id            TEXT NOT NULL PRIMARY KEY,
  user_id               TEXT NOT NULL,
  teacher_quiz_id       TEXT NOT NULL,
  teacher_id            TEXT NOT NULL,
  class_id              TEXT NOT NULL,
  attempt_no            INTEGER NOT NULL DEFAULT 1,
  mode                  TEXT NOT NULL,
  duration_minutes      INTEGER NOT NULL DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  started_at            TIMESTAMPTZ DEFAULT NOW(),
  due_at                TIMESTAMPTZ,
  submitted_at          TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  items_json            JSONB NOT NULL DEFAULT '[]',
  answers_json          JSONB NOT NULL DEFAULT '{}',
  flags_json            JSONB NOT NULL DEFAULT '{}',
  candidate_fields_json JSONB NOT NULL DEFAULT '{"fields": {}}',
  score_raw             NUMERIC,
  score_total           NUMERIC,
  score_pct             NUMERIC,
  time_taken_s          INTEGER,
  score_json            JSONB,
  grading_policy        TEXT,
  grade_bands_json      JSONB,
  score_display_policy  TEXT
);
-- status: IN_PROGRESS | SUBMITTED

CREATE INDEX ON teacher_quiz_attempts (user_id);
CREATE INDEX ON teacher_quiz_attempts (teacher_quiz_id);
CREATE INDEX ON teacher_quiz_attempts (teacher_id);
CREATE INDEX ON teacher_quiz_attempts (class_id);
CREATE INDEX ON teacher_quiz_attempts (user_id, teacher_quiz_id);
CREATE INDEX ON teacher_quiz_attempts (status);

-- 5.9 teacher_library_courses
CREATE TABLE teacher_library_courses (
  course_id    TEXT NOT NULL PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  programme    TEXT,
  faculty      TEXT,
  category     TEXT,
  year_group   TEXT,
  tags         TEXT[] NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  items_table  TEXT
);
-- items_table: points to the library items table (e.g. teacher_library_anatomy, teacher_library_english)
-- programme: e.g. 'Nursing', 'Business', 'General'
-- faculty: e.g. 'Health Sciences', 'Arts', 'Social Sciences'
-- category: e.g. 'Sciences', 'Languages', 'Commerce'
-- year_group: e.g. 'Year 1', 'Year 2', 'Postgraduate'

CREATE INDEX ON teacher_library_courses (status);
CREATE INDEX idx_lib_courses_programme ON teacher_library_courses (programme);
CREATE INDEX idx_lib_courses_faculty ON teacher_library_courses (faculty);
CREATE INDEX idx_lib_courses_category ON teacher_library_courses (category);
CREATE INDEX idx_lib_courses_year ON teacher_library_courses (year_group);
CREATE INDEX idx_lib_courses_tags ON teacher_library_courses USING GIN (tags);

-- 5.9b Library item tables (one per course)
-- All follow the same schema. Replace teacher_library_anatomy with:
--   teacher_library_anatomy, teacher_library_physiology, teacher_library_english,
--   teacher_library_accounting, teacher_library_government, teacher_library_microbiology,
--   teacher_library_pharmacology, teacher_library_sociology, teacher_library_surveying,
--   teacher_library_management (add more as needed)
-- 10 tables total

CREATE TABLE teacher_library_anatomy (
  item_id         TEXT PRIMARY KEY,
  question_type   TEXT NOT NULL DEFAULT 'MCQ',
  stem            TEXT NOT NULL,
  option_a        TEXT, fb_a TEXT,
  option_b        TEXT, fb_b TEXT,
  option_c        TEXT, fb_c TEXT,
  option_d        TEXT, fb_d TEXT,
  option_e        TEXT, fb_e TEXT,
  option_f        TEXT, fb_f TEXT,
  correct         TEXT NOT NULL,
  rationale       TEXT,
  rationale_img   TEXT,
  subject         TEXT,
  maintopic       TEXT,
  subtopic        TEXT,
  difficulty      TEXT,
  marks           INTEGER NOT NULL DEFAULT 1,
  shuffle_options BOOLEAN NOT NULL DEFAULT true,
  question_ref    TEXT,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  batch_id        TEXT,
  year_level      TEXT,
  bloom_level     TEXT
);
-- question_type: MCQ | TF | SATA
-- bloom_level: Remember | Understand | Apply | Analyse | Evaluate | Create
-- year_level: e.g. 'Year 1', 'Year 2', 'Level 100', 'Level 200'

CREATE INDEX ON teacher_library_anatomy (maintopic);
CREATE INDEX ON teacher_library_anatomy (subtopic);
CREATE INDEX ON teacher_library_anatomy (difficulty);
CREATE INDEX ON teacher_library_anatomy USING GIN (tags);
CREATE INDEX ON teacher_library_anatomy (batch_id);
CREATE INDEX ON teacher_library_anatomy (year_level);
CREATE INDEX ON teacher_library_anatomy (bloom_level);

-- 5.10 teacher_courses
-- A Course is what a teacher teaches (Pharmacology 1, Anatomy, etc).
-- Created once, reused across years. Quizzes link to a Course.
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

CREATE INDEX ON teacher_courses (teacher_id);

-- 5.11 teacher_programmes
-- A Programme is the academic programme (BSc Nursing, BSc Midwifery).
-- Lightweight label — just a title. Cohorts belong to a Programme.
CREATE TABLE teacher_programmes (
  programme_id  TEXT PRIMARY KEY,
  teacher_id    TEXT NOT NULL,
  title         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- status: ACTIVE | ARCHIVED

CREATE INDEX ON teacher_programmes (teacher_id);

-- 5.12 teacher_cohorts
-- A Cohort is the permanent identity of a student group.
-- e.g. "BSc Nursing 2024 Intake". Created once per intake year.
-- No uniqueness constraint — multiple cohorts per programme/year allowed.
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

CREATE INDEX ON teacher_cohorts (teacher_id);
CREATE INDEX ON teacher_cohorts (programme_id);


-- 1.11 sessions
-- Tracks active device sessions for concurrent login control.
-- Max 2 active sessions per user at any time.
-- Never delete rows — set active=FALSE on logout.
-- TODO: add pg_cron cleanup job when user base grows.
CREATE TABLE sessions (
  session_id    TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'LOGIN',
  issued_utc    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_utc   TIMESTAMPTZ NOT NULL,
  last_seen_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_label  TEXT,
  ua_hash       TEXT,
  ip_hash       TEXT,
  login_via     TEXT NOT NULL DEFAULT 'EMAIL',  -- EMAIL | GOOGLE | MAGIC_LINK
  active        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX ON sessions (user_id);
CREATE INDEX ON sessions (user_id, active, expires_utc);


-- 1.12 auth_events
-- Logs every login attempt (success + failure) for audit trail
-- and rate limiting. Never delete rows — use pg_cron cleanup
-- when table grows large. All writes go through RPC
-- (log_auth_event) — no direct browser INSERT.
CREATE TABLE auth_events (
  event_id      TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL,          -- LOGIN_SUCCESS | LOGIN_FAIL
  identifier    TEXT NOT NULL,          -- email used (lowercased)
  user_id       TEXT,                   -- NULL if unknown email
  fp_hash       TEXT,                   -- device fingerprint hash
  ua_hash       TEXT,                   -- user-agent hash
  device_label  TEXT,                   -- 'Windows · Chrome' etc.
  fail_reason   TEXT,                   -- NULL on success; INVALID_CREDENTIALS, RATE_LIMITED
  created_utc   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX auth_events_identifier_created
  ON auth_events (identifier, created_utc);

CREATE INDEX auth_events_fp_hash_created
  ON auth_events (fp_hash, created_utc)
  WHERE fp_hash IS NOT NULL;

CREATE INDEX auth_events_user_id_created
  ON auth_events (user_id, created_utc)
  WHERE user_id IS NOT NULL;

CREATE INDEX auth_events_created
  ON auth_events (created_utc);


-- 1.13 reset_requests
-- Tracks every forgot-password submission for rate limiting
-- and audit. Logs whether the email belonged to a real user,
-- whether the request was rate-limited, and whether the reset
-- link was actually used. All writes go through RPCs.
CREATE TABLE reset_requests (
  request_id    TEXT PRIMARY KEY,
  email         TEXT NOT NULL,            -- what the user typed (lowercased)
  user_exists   BOOLEAN NOT NULL DEFAULT FALSE,  -- was this a registered email
  status        TEXT NOT NULL,            -- EMAIL_SENT | RATE_LIMITED | EMAIL_FAILED
  fp_hash       TEXT,                     -- device fingerprint hash
  device_label  TEXT,                     -- 'Windows · Chrome' etc.
  used          BOOLEAN NOT NULL DEFAULT FALSE,  -- did they complete the reset
  used_utc      TIMESTAMPTZ,             -- when they completed it
  created_utc   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX reset_requests_email_created
  ON reset_requests (email, created_utc);

CREATE INDEX reset_requests_created
  ON reset_requests (created_utc);


-- ────────────────────────────────────────────────────────────
-- 7. MYTEACHER AUTH TABLES
-- Mirror of the Licensure auth tables (users, sessions,
-- auth_events, reset_requests) — fully separate infrastructure.
-- auth.users (Supabase Auth) stays shared across both products.
-- ────────────────────────────────────────────────────────────

-- 7.1 teacher_users
-- Core identity for all MyTeacher users (teachers + students).
-- role field differentiates: TEACHER | STUDENT | ADMIN
-- Teachers also have a row in teacher_profiles (org detail, plan, approval).
-- signup_source default is 'MYTEACHER' instead of 'SUPABASE_AUTH'.
CREATE TABLE teacher_users (
  user_id              TEXT PRIMARY KEY,
  auth_id              UUID,
  username             TEXT,
  email                TEXT NOT NULL,
  phone_number         TEXT,
  name                 TEXT,
  forename             TEXT,
  surname              TEXT,
  program_id           TEXT,
  cohort               TEXT,
  level                TEXT,
  role                 TEXT NOT NULL DEFAULT 'STUDENT',
  active               BOOLEAN NOT NULL DEFAULT true,
  avatar_url           TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  signup_source        TEXT DEFAULT 'MYTEACHER',
  created_utc          TIMESTAMPTZ DEFAULT NOW(),
  last_login_utc       TIMESTAMPTZ
);

CREATE INDEX idx_teacher_users_auth_id ON teacher_users(auth_id);
CREATE INDEX idx_teacher_users_email   ON teacher_users(email);
CREATE INDEX idx_teacher_users_role    ON teacher_users(role);


-- 7.2 teacher_sessions
-- Tracks active device sessions for MyTeacher users.
-- Mirror of sessions. Max 2 active sessions per user.
-- Never DELETE rows — set active=FALSE on logout.
CREATE TABLE teacher_sessions (
  session_id    TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'LOGIN',
  issued_utc    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_utc   TIMESTAMPTZ NOT NULL,
  last_seen_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_label  TEXT,
  ua_hash       TEXT,
  ip_hash       TEXT,
  login_via     TEXT NOT NULL DEFAULT 'EMAIL',
  active        BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_teacher_sessions_user_id ON teacher_sessions(user_id);
CREATE INDEX idx_teacher_sessions_active  ON teacher_sessions(active);


-- 7.3 teacher_auth_events
-- Logs every login attempt (success + failure) for MyTeacher users.
-- Mirror of auth_events. Never DELETE rows.
-- All writes go through RPC (log_myteacher_auth_event) — no direct browser INSERT.
CREATE TABLE teacher_auth_events (
  event_id     TEXT PRIMARY KEY,
  event_type   TEXT NOT NULL,
  identifier   TEXT NOT NULL,
  user_id      TEXT,
  fp_hash      TEXT,
  ua_hash      TEXT,
  device_label TEXT,
  fail_reason  TEXT,
  created_utc  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teacher_auth_events_user_id    ON teacher_auth_events(user_id);
CREATE INDEX idx_teacher_auth_events_identifier ON teacher_auth_events(identifier);
CREATE INDEX idx_teacher_auth_events_created    ON teacher_auth_events(created_utc);


-- 7.4 teacher_reset_requests
-- Tracks every forgot-password submission for MyTeacher users.
-- Mirror of reset_requests. All writes go through RPCs — no direct browser INSERT.
CREATE TABLE teacher_reset_requests (
  request_id   TEXT PRIMARY KEY,
  email        TEXT NOT NULL,
  user_exists  BOOLEAN NOT NULL DEFAULT false,
  status       TEXT NOT NULL,
  fp_hash      TEXT,
  device_label TEXT,
  used         BOOLEAN NOT NULL DEFAULT false,
  used_utc     TIMESTAMPTZ,
  created_utc  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teacher_reset_requests_email   ON teacher_reset_requests(email);
CREATE INDEX idx_teacher_reset_requests_created ON teacher_reset_requests(created_utc);


-- 5.11a teacher_config
-- MyTeacher runtime-tunable UX settings (future use — builder
-- bounds, runner behaviour, import caps, etc). Mirror of the
-- Licensure `config` table. Do NOT put worker URLs here —
-- those live in myteacher/js/config.js with hostname detection.
CREATE TABLE teacher_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT
);


-- ────────────────────────────────────────────────────────────
-- 5.12 MyTeacher FK constraints
-- ────────────────────────────────────────────────────────────
-- Declared here (after teacher_users exists) rather than inline
-- on each table definition. Both teacher_id and user_id columns
-- on MyTeacher content tables reference teacher_users, NOT the
-- Licensure users table — MyTeacher has its own identity table
-- since the auth split.

ALTER TABLE teacher_bank_items
  ADD CONSTRAINT teacher_bank_items_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES teacher_users(user_id);

ALTER TABLE teacher_classes
  ADD CONSTRAINT teacher_classes_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES teacher_users(user_id);

ALTER TABLE teacher_class_members
  ADD CONSTRAINT teacher_class_members_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES teacher_users(user_id);
ALTER TABLE teacher_class_members
  ADD CONSTRAINT teacher_class_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES teacher_users(user_id);

ALTER TABLE teacher_quizzes
  ADD CONSTRAINT teacher_quizzes_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES teacher_users(user_id);

ALTER TABLE teacher_quiz_classes
  ADD CONSTRAINT teacher_quiz_classes_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES teacher_users(user_id);

ALTER TABLE teacher_quiz_attempts
  ADD CONSTRAINT teacher_quiz_attempts_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES teacher_users(user_id);
ALTER TABLE teacher_quiz_attempts
  ADD CONSTRAINT teacher_quiz_attempts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES teacher_users(user_id);

-- Parent-child links (required for referential integrity AND
-- for PostgREST nested select embeds across these tables)
ALTER TABLE teacher_profiles
  ADD CONSTRAINT teacher_profiles_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES teacher_users(user_id) ON DELETE CASCADE;

ALTER TABLE teacher_class_members
  ADD CONSTRAINT teacher_class_members_class_id_fkey
  FOREIGN KEY (class_id) REFERENCES teacher_classes(class_id);

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


-- ────────────────────────────────────────────────────────────
-- 6. RLS (dev mode — replace before go-live)
-- ────────────────────────────────────────────────────────────
-- Apply to every table above:
--
-- ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "dev_allow_all" ON <table_name> FOR ALL USING (true) WITH CHECK (true);
