-- ============================================================
-- PROD SETUP — Script 4 of 4: Seed Reference Data
-- Paste this into the prod Supabase SQL Editor and run.
-- Seeds reference/catalogue data only — NO users, NO test data.
-- ============================================================

-- ── Programs ────────────────────────────────────────────────

INSERT INTO programs (program_id, program_name, trial_product_id) VALUES
  ('RN',     'Registered Nursing',              'RN_TRIAL'),
  ('RM',     'Registered Midwifery',            'RM_TRIAL'),
  ('RPHN',   'Registered Public Health Nursing', 'RPHN_TRIAL'),
  ('RMHN',   'Registered Mental Health Nursing', 'RMHN_TRIAL'),
  ('NACNAP', 'NACNAP',                          'NACNAP_TRIAL');

-- ── Courses ─────────────────────────────────────────────────

INSERT INTO courses (course_id, title, program_scope, status) VALUES
  ('GP',                'General Paper',                                       '{RN,RM,RPHN,RMHN,NACNAP}', 'active'),
  ('RN_MED',            'Medicine & Medical Nursing',                          '{RN}',                     'active'),
  ('RN_SURG',           'Surgery & Surgical Nursing',                          '{RN}',                     'active'),
  ('RM_PED_OBS_HRN',    'Paediatric, Obstetric Anatomy, & High-Risk Neonates', '{RM}',                     'active'),
  ('RM_MID',            'Midwifery',                                           '{RM}',                     'active'),
  ('RPHN_PPHN',         'Principles of Public Health Nursing',                 '{RPHN}',                   'active'),
  ('RPHN_DISEASE_CTRL', 'Principles of Disease Management & Control',          '{RPHN}',                   'active'),
  ('RMHN_PSYCH_NURS',   'Principles & Practice of Psychiatric Nursing',        '{RMHN}',                   'active'),
  ('RMHN_PSYCH_PPHARM', 'Psychiatry, Psychopathology & Psychopharmacology',    '{RMHN}',                   'active'),
  ('NAC_BASIC_CLIN',    'Basic Clinical Nursing',                              '{NACNAP}',                 'active'),
  ('NAC_BASIC_PREV',    'Basic Preventive Nursing',                            '{NACNAP}',                 'active');

-- ── Levels ──────────────────────────────────────────────────

INSERT INTO levels (level_id, label) VALUES
  ('L100', 'Level 100'),
  ('L200', 'Level 200'),
  ('L300', 'Level 300'),
  ('L400', 'Level 400');

-- ── Products ────────────────────────────────────────────────

-- Trial products (7-day free)
INSERT INTO products (product_id, name, kind, status, courses_included, price_minor, currency, duration_days) VALUES
  ('RN_TRIAL',     'Registered Nursing — 7 Day Free Trial',                       'TRIAL', 'active', '{GP,RN_MED,RN_SURG}',                   0, 'GHS', 7),
  ('RM_TRIAL',     'Registered Midwifery — 7 Day Free Trial',                     'TRIAL', 'active', '{GP,RM_PED_OBS_HRN,RM_MID}',            0, 'GHS', 7),
  ('RPHN_TRIAL',   'Registered Public Health Nursing — 7 Day Free Trial',         'TRIAL', 'active', '{GP,RPHN_PPHN,RPHN_DISEASE_CTRL}',      0, 'GHS', 7),
  ('RMHN_TRIAL',   'Registered Mental Health Nursing — 7 Day Free Trial',         'TRIAL', 'active', '{GP,RMHN_PSYCH_NURS,RMHN_PSYCH_PPHARM}',0, 'GHS', 7),
  ('NACNAP_TRIAL', 'Nursing Assistant Preventive/Clinical — 7 Day Free Trial',    'TRIAL', 'active', '{GP,NAC_BASIC_CLIN,NAC_BASIC_PREV}',    0, 'GHS', 7);

-- Free products (30-day)
INSERT INTO products (product_id, name, kind, status, courses_included, price_minor, currency, duration_days) VALUES
  ('RN_FULL_FREE',     'Registered Nursing Free Full Access',                       'FREE', 'active', '{GP,RN_MED,RN_SURG}',                    0, 'GHS', 30),
  ('RM_FULL_FREE',     'Registered Midwife Free Full Access',                       'FREE', 'active', '{GP,RM_PED_OBS_HRN,RM_MID}',             0, 'GHS', 30),
  ('RPHN_FULL_FREE',   'Registered Public Health Nursing Free Full Access',         'FREE', 'active', '{GP,RPHN_PPHN,RPHN_DISEASE_CTRL}',       0, 'GHS', 30),
  ('RMHN_FULL_FREE',   'Registered Mental Health Nursing Free Full Access',         'FREE', 'active', '{GP,RMHN_PSYCH_NURS,RMHN_PSYCH_PPHARM}', 0, 'GHS', 30),
  ('NACNAP_FULL_FREE', 'Nursing Assistant, Preventive/Clinical Free Full Access',   'FREE', 'active', '{GP,NAC_BASIC_CLIN,NAC_BASIC_PREV}',     0, 'GHS', 30);

-- 2026 Premium Prep (240-day, with Telegram)
INSERT INTO products (product_id, name, kind, status, courses_included, price_minor, currency, duration_days, telegram_group_keys) VALUES
  ('RN_2026_PREP',     'Registered Nursing 2026 Premium Prep',                     'PAID', 'active', '{GP,RN_MED,RN_SURG}',                    7900, 'GHS', 240, '{PREMIUM_2026,RN_2026}'),
  ('RM_2026_PREP',     'Registered Midwife 2026 Premium Prep',                     'PAID', 'active', '{GP,RM_PED_OBS_HRN,RM_MID}',             7900, 'GHS', 240, '{PREMIUM_2026,RM_2026}'),
  ('RPHN_2026_PREP',   'Registered Public Health Nursing 2026 Premium Prep',       'PAID', 'active', '{GP,RPHN_PPHN,RPHN_DISEASE_CTRL}',       7900, 'GHS', 240, '{PREMIUM_2026,RPHN_2026}'),
  ('RMHN_2026_PREP',   'Registered Mental Health Nursing 2026 Premium Prep',       'PAID', 'active', '{GP,RMHN_PSYCH_NURS,RMHN_PSYCH_PPHARM}', 7900, 'GHS', 240, '{PREMIUM_2026,RMHN_2026}'),
  ('NACNAP_2026_PREP', 'Nursing Assistant, Preventive/Clinical 2026 Premium Prep', 'PAID', 'active', '{GP,NAC_BASIC_CLIN,NAC_BASIC_PREV}',     7900, 'GHS', 240, '{PREMIUM_2026,NACNAP_2026}');

-- Full Access (365-day)
INSERT INTO products (product_id, name, kind, status, courses_included, price_minor, currency, duration_days) VALUES
  ('RN_FULL',     'Registered Nursing Full Access',                     'PAID', 'active', '{GP,RN_MED,RN_SURG}',                    15000, 'GHS', 365),
  ('RM_FULL',     'Registered Midwife Full Access',                     'PAID', 'active', '{GP,RM_PED_OBS_HRN,RM_MID}',             15000, 'GHS', 365),
  ('RPHN_FULL',   'Registered Public Health Nursing Full Access',       'PAID', 'active', '{GP,RPHN_PPHN,RPHN_DISEASE_CTRL}',       15000, 'GHS', 365),
  ('RMHN_FULL',   'Registered Mental Health Nursing Full Access',       'PAID', 'active', '{GP,RMHN_PSYCH_NURS,RMHN_PSYCH_PPHARM}', 15000, 'GHS', 365),
  ('NACNAP_FULL', 'Nursing Assistant, Preventive/Clinical Full Access', 'PAID', 'active', '{GP,NAC_BASIC_CLIN,NAC_BASIC_PREV}',     15000, 'GHS', 365);

-- Standalone (per-course, 365-day)
INSERT INTO products (product_id, name, kind, status, courses_included, price_minor, currency, duration_days, telegram_group_keys) VALUES
  ('GP_ONLY',                'General Paper Standalone Access',                                              'PAID', 'active', '{GP}',                5900, 'GHS', 365, NULL),
  ('RN_MED_ONLY',            'Medicine & Medical Nursing Standalone Access',                                 'PAID', 'active', '{RN_MED}',            5900, 'GHS', 365, NULL),
  ('RN_SURG_ONLY',           'Surgery & Surgical Nursing Standalone Access',                                 'PAID', 'active', '{RN_SURG}',           5900, 'GHS', 365, NULL),
  ('RM_PED_OBS_HRN_ONLY',    'Paediatric, Obstetric Anatomy, & High-Risk Neonates Standalone Access',       'PAID', 'active', '{RM_PED_OBS_HRN}',    5900, 'GHS', 365, NULL),
  ('RM_MID_ONLY',            'Midwifery Standalone Access',                                                  'PAID', 'active', '{RM_MID}',            5900, 'GHS', 365, NULL),
  ('RPHN_PPHN_ONLY',         'Principles of Public Health Nursing Standalone Access',                        'PAID', 'active', '{RPHN_PPHN}',         5900, 'GHS', 365, NULL),
  ('RPHN_DISEASE_CTRL_ONLY', 'Principles of Disease Management & Control Standalone Access',                 'PAID', 'active', '{RPHN_DISEASE_CTRL}', 5900, 'GHS', 365, NULL),
  ('RMHN_PSYCH_NURS_ONLY',   'Principles & Practice of Psychiatric Nursing Standalone Access',               'PAID', 'active', '{RMHN_PSYCH_NURS}',   5900, 'GHS', 365, NULL),
  ('RMHN_PSYCH_PPHARM_ONLY', 'Psychiatry, Psychopathology & Psychopharmacology Standalone Access',           'PAID', 'active', '{RMHN_PSYCH_PPHARM}', 5900, 'GHS', 365, NULL),
  ('NAC_BASIC_CLIN_ONLY',    'Basic Clinical Nursing Standalone Access',                                     'PAID', 'active', '{NAC_BASIC_CLIN}',    5910, 'GHS', 70,  '{JKHOILHHPI}'),
  ('NAC_BASIC_PREV_ONLY',    'Basic Preventive Nursing Standalone Access',                                   'PAID', 'active', '{NAC_BASIC_PREV}',    5900, 'GHS', 365, '{JUKJGHOIU8ILUL}');

-- ── Config ──────────────────────────────────────────────────
-- Runtime-tunable UX limits. The payments worker URL is NOT here —
-- it lives in mynmclicensure/js/config.js as PAYMENTS_API_BASE
-- (single source of truth, picked by hostname).

INSERT INTO config (key, value, description) VALUES
  ('runner_questions_per_page',    '1',  'Number of questions shown per page in both instant and timed runners'),
  ('runner_autosave_interval_sec', '60', 'How often runners autosave in-progress attempts in seconds'),
  ('builder_max_questions',        '50', 'Maximum number of questions a student can request in the quiz builder'),
  ('builder_default_questions',    '40', 'Default max questions allowed by builder.'),
  ('builder_minutes_per_question', '1',  'Controls minutes per question for builder'),
  ('offline_max_questions',        '100','Max questions allowed per offline pack'),
  ('offline_packs_per_course',     '5',  'Max packs per course per subscription period');

-- ── Teacher Library Courses ─────────────────────────────────

INSERT INTO teacher_library_courses (course_id, title, description, programme, faculty, category, year_group, tags, status, items_table) VALUES
  ('ANATOMY',      'Anatomy',      'Human anatomy questions covering musculoskeletal, cardiovascular, nervous, and organ systems', 'Nursing',     'Health Sciences', 'Sciences',   'Year 1', '{preclinical, health}',  'active', 'teacher_library_anatomy'),
  ('PHYSIOLOGY',   'Physiology',   'Human physiology covering cardiovascular, respiratory, renal, endocrine, and nervous system function', 'Nursing',     'Health Sciences', 'Sciences',   'Year 1', '{preclinical, health}',  'active', 'teacher_library_physiology'),
  ('ENGLISH',      'English',      'English language and literature covering grammar, vocabulary, writing, and literary devices', 'General',     'Arts',            'Languages',  'Year 1', '{language, literacy}',   'active', 'teacher_library_english'),
  ('ACCOUNTING',   'Accounting',   'Financial accounting fundamentals including bookkeeping, financial statements, and analysis', 'Business',    'Business',        'Commerce',   'Year 1', '{finance, business}',    'active', 'teacher_library_accounting'),
  ('GOVERNMENT',   'Government',   'Political systems, constitutional law, elections, and democratic principles', 'General',     'Social Sciences', 'Humanities', 'Year 1', '{politics, civics}',     'active', 'teacher_library_government'),
  ('MICROBIOLOGY', 'Microbiology', 'Bacteriology, virology, mycology, immunology, and laboratory methods', 'Nursing',     'Health Sciences', 'Sciences',   'Year 2', '{clinical, infection}',  'active', 'teacher_library_microbiology'),
  ('PHARMACOLOGY', 'Pharmacology', 'Drug mechanisms, pharmacokinetics, toxicology, and therapeutic classes', 'Nursing',     'Health Sciences', 'Sciences',   'Year 2', '{clinical, drugs}',      'active', 'teacher_library_pharmacology'),
  ('SOCIOLOGY',    'Sociology',    'Social theory, institutions, inequality, culture, and deviance', 'General',     'Social Sciences', 'Humanities', 'Year 1', '{social, theory}',       'active', 'teacher_library_sociology'),
  ('MANAGEMENT',   'Management',   'Planning, leadership, strategy, organisational structure, and ethics', 'Business',    'Business',        'Commerce',   'Year 1', '{business, leadership}', 'active', 'teacher_library_management'),
  ('SURVEYING',    'Surveying',    'Land measurement, levelling, instruments, mapping, and modern methods', 'Engineering', 'Engineering',     'Technical',  'Year 1', '{fieldwork, measurement}', 'active', 'teacher_library_surveying');
