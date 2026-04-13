# QAcademy Nurses Hub — CLONING NOTES
*Last updated: April 2026*

Technical rebuild guide. Follow end-to-end to recreate the full environment from scratch.

---

## 0. Project Structure & Path Config

### Folder layout

```
qacademy-gamma/
  mynmclicensure/          ← NMC Licensure product
    admin/                 ← 12 admin pages
    student/               ← 16 student pages
    runner/                ← 2 quiz runner pages
    register.html          ← Student registration
    subscribe.html         ← Paid subscription flow
    payment-confirmation.html ← Payment callback
    premium-prep.html      ← Premium marketing page
  myteacher/               ← Teacher Assess product
    js/
      myteacher-guard.js   ← MyTeacher auth & role guard (mirror of js/guard.js)
      myteacher-auth.js    ← MyTeacher auth utilities (mirror of js/auth.js)
      myteacher-api.js     ← Teacher Assess data layer
      myteacher-admin-nav.js
      myteacher-teacher-nav.js
      myteacher-student-nav.js
    admin/                 ← 2 admin pages
    teacher/               ← 9 teacher pages
    student/               ← 5 student pages
    login.html             ← MyTeacher login
    forgot-password.html   ← MyTeacher forgot password
    reset-password.html    ← MyTeacher reset password
    router.html            ← MyTeacher router (routes by role after login)
    access-request.html    ← Teacher access request / approval status page
    register.html          ← Teacher & student registration
  js/
    paths.js               ← CENTRAL PATH CONFIG — edit this to clone
    config.js              ← Environment config (auto-detects dev vs prod)
    guard.js               ← Licensure auth & role guards
    auth.js                ← Licensure auth utilities (hashing, fingerprint, event IDs)
    mynmclicensure-api.js  ← Licensure data layer
    mynmclicensure-admin-sidebar.js
    mynmclicensure-student-sidebar.js
  payments-worker/         ← Cloudflare Worker (separate deployment)
  workers/email-worker/    ← Cloudflare Worker for transactional emails
  db/
    schema.sql             ← Single source of truth for all 42 tables
    rls.sql                ← All RLS policies + helper functions
    prod-setup/            ← Ready-to-run SQL scripts for new environments
  docs/                    ← Reference documentation
  .github/workflows/       ← GitHub Actions (mirror to prod repo)
  product-select.html      ← Product selector — root entry point (choose Licensure or MyTeacher)
  index.html               ← Home / landing page
  mynmclicensure/          ← also contains: login.html, forgot-password.html, reset-password.html, router.html
```

### Config-driven paths — `js/paths.js`

All dynamic URLs are driven by a central config:

```js
const LICENSURE = {
  admin:   '/mynmclicensure/admin',
  student: '/mynmclicensure/student',
  runner:  '/mynmclicensure/runner',
};

const MYTEACHER = {
  admin:   '/myteacher/admin',
  teacher: '/myteacher/teacher',
  student: '/myteacher/student',
};
```

Usage in JS: `LICENSURE.student + '/dashboard.html'` or `` `${MYTEACHER.teacher}/classes.html` ``

Static HTML `href` attributes (where JS variables can't be used) use the full path: `href="/mynmclicensure/student/dashboard.html"`.

### The Golden Rule: Never Hardcode Paths in JS

**DO THIS:**
```js
window.location.href = LICENSURE.student + '/new-page.html';
```

**NOT THIS:**
```js
window.location.href = '/mynmclicensure/student/new-page.html';
```

Every hardcoded path in JS is one more thing to find-and-replace when cloning. Using the config constants means cloning only requires changing `js/paths.js`. This applies to both products — use `LICENSURE.x` or `MYTEACHER.x` in all JS contexts.

### Cloning a product

To clone e.g. `mynmclicensure/` into `mypharmacy/`:

1. Add new config to `js/paths.js`: `const PHARMACY = { admin: '/mypharmacy/admin', ... }`
2. Copy the folder: `cp -r mynmclicensure/ mypharmacy/`
3. Copy & rename JS files: `mynmclicensure-api.js` → `mypharmacy-api.js`, etc.
4. In the new JS files, replace `LICENSURE` with `PHARMACY`
5. In the new HTML files, update `<script src>` tags to point to new JS filenames
6. Find-and-replace hardcoded HTML hrefs: `/mynmclicensure/` → `/mypharmacy/`
7. Update `router.html` to route to new product dashboards
8. Add cross-product switch buttons if needed
9. Grep to confirm no stale old-product paths remain

---

## 1. Stack
- **Frontend:** Vanilla HTML / CSS / JS — no build step
- **Hosting:** Cloudflare Pages (auto-deploys on push)
- **Database & Auth:** Supabase (free tier)
- **Payments:** Paystack — Cloudflare Worker deployed at `payments-worker/`
- **Emails:** Resend API — Cloudflare Worker deployed at `workers/email-worker/`

### Environments
| | Dev | Prod |
|--|-----|------|
| **Repo** | `mybackpacc-byte/qacademy-gamma` | `mybackpacc-byte/qacademy-gamma` |
| **Branch** | `main` | `production` |
| **Pages URL** | `qacademy-gamma.pages.dev` | `qacademynurseshub.pages.dev` |
| **Supabase** | `zrakjibtxyzoqcdtvpmq` | `qizhyhjeqhaybyddsuni` |
| **Payments worker** | `qacademy-gamma-payment-workers` | `qacademy-prod-payment-workers` |
| **Email worker** | `qacademy-email-worker` | `qacademy-prod-email-worker` |

`js/config.js` auto-detects the environment by checking `window.location.hostname` — same code works on both.

### Dev → Prod workflow
1. All work happens on `main` branch (dev repo)
2. When ready to promote: merge `main` → `production` branch
3. GitHub Action automatically mirrors `production` to the prod repo
4. Prod Cloudflare Pages auto-deploys from the prod repo
5. Workers must be deployed manually (`npx wrangler deploy`)

---

## 2. Environment Setup

### Supabase
1. Create a new Supabase project
2. Run the 4 SQL scripts in `db/prod-setup/` in order (01 → 04) in the SQL Editor
3. Update `js/config.js` with the project URL and anon key (in the IS_PROD ternary)

> The Supabase JS CDN uses `supabase` as its global. We use `db` everywhere.
> `js/config.js` uses hostname detection — no need for separate config files per environment.

### Cloudflare Pages
1. Connect GitHub repo to Cloudflare Pages
2. No build command — root directory `/`, output directory `/`

### Payments Worker (Cloudflare Worker)
The worker lives in `payments-worker/` and is deployed separately from the frontend.

1. `cd payments-worker`
2. `npm install`
3. `npx wrangler deploy`

Required environment variables (set in Cloudflare Workers dashboard → Settings → Variables):
| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (not anon key) |
| `PAYSTACK_SECRET_KEY` | Paystack secret key from dashboard |
| `APP_BASE_URL` | e.g. `https://qacademy-gamma.pages.dev` |
| `APP_ORIGIN` | Same as APP_BASE_URL — used for CORS |

Worker routes:
| Route | Method | Purpose |
|---|---|---|
| `/payments/init-public` | POST | New student (no account) initiates payment |
| `/payments/init-upgrade` | POST | Logged-in student upgrades subscription |
| `/payments/verify` | GET | Verify payment with Paystack, activate subscription |
| `/payments/setup-complete` | POST | Create account for student who paid before registering |

Payment status flow: `INIT → PAID → ACTIVATED` (or `SETUP_REQUIRED` if no account yet)

### Rate Limiting
The worker uses Cloudflare's built-in rate limiting.
Configured in `wrangler.jsonc` under `"ratelimits"`:
- Binding name: `RATE_LIMITER`
- Namespace ID: `"1001"` (string)
- Limit: 5 requests per 60 seconds per IP
- Applied to: init-public, init-upgrade, verify, setup-complete
- NOT applied to: /admin/subscriptions/* routes

If cloning to a new worker account, the namespace_id can stay as "1001" — it is account-scoped so there is no conflict risk.

### Setup Token Lifetime
Tokens issued during SETUP_REQUIRED expire after 48 hours.
Admin can refresh a token by clicking "Retry Activation" on the payment row in the admin payments panel, then copying the fresh setup link.

All three payment pages (`subscribe.html`, `upgrade.html`, `payment-confirmation.html`) read `PAYMENTS_API_BASE` from `js/config.js` — no per-file URL needed.

### Email Worker (Cloudflare Worker)
The worker lives in `workers/email-worker/` and is deployed separately from the frontend.

1. `cd workers/email-worker`
2. `npx wrangler deploy`

Required environment variables (set in Cloudflare Workers dashboard → Settings → Variables):
| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Resend API key — create at resend.com (Sending access only) |
| `EMAIL_SECRET` | Shared secret — must match EMAIL_SECRET in js/config.js |

Supported events:
| Event | Trigger location | Who receives it |
|---|---|---|
| `WELCOME_STUDENT` | register.html — after successful registration | Student |
| `WELCOME_TEACHER` | myteacher/admin/teachers.html — after teacher approval | Teacher |
| `SUBSCRIPTION_ASSIGNED` | mynmclicensure/admin/subscriptions.html — after manual subscription assign | Student |
| `SUBSCRIPTION_REVOKED` | mynmclicensure/admin/subscriptions.html — after subscription revoke | Student |
| `PAYMENT_SETUP_REQUIRED` | mynmclicensure/admin/payments.html — after retry activation returns SETUP_REQUIRED | Student |
| `CLASS_JOIN_APPROVED` | myteacher/teacher/classes.html — after teacher approves join request | Student |
| `CLASS_JOIN_APPROVED` | myteacher/student/my-classes.html — after direct join (no approval needed) | Student |

CORS: Worker only accepts requests from APP_BASE_URL. Update the allowed origin in index.js if the domain changes.

From address: QAcademy Educational Consult <noreply@qacademynurses.com>
Templates live in: workers/email-worker/templates/

Shared footer: `workers/email-worker/templates/footer.html`
Injected into every email via `{{footer}}` placeholder in `index.js`.
Social link placeholders (`{{socialTiktok}}`, `{{socialTelegram}}`, `{{socialWhatsapp}}`)
are resolved in `index.js` — update the URLs there when real links are available.

### Email & SMTP Setup

#### Resend Account
- Provider: resend.com
- Domain verified: qacademynurses.com
- Sender address: noreply@qacademynurses.com
- API key name in Resend: qacademy-gamma
- One API key is used for both Supabase SMTP and the Email Worker

#### Supabase SMTP (for auth emails)
Configure in Supabase dashboard → Authentication → Settings → Email → Custom SMTP:
| Field | Value |
|---|---|
| Host | smtp.resend.com |
| Port | 465 |
| Username | resend |
| Password | your Resend API key (re_xxxx) |
| Sender email | noreply@qacademynurses.com |
| Sender name | QAcademy Educational Consult |

#### Supabase Auth Email Templates
All four templates are customised with QAcademy branding (dark blue header #1e3a5f, teal CTA #2d7d72).
Templates are set directly in Supabase dashboard → Authentication → Email Templates:
| Template | Subject |
|---|---|
| Confirm signup | Verify your QAcademy email address |
| Reset password | Reset your QAcademy password |
| Magic link | Your QAcademy login link |
| Change email | Confirm your new QAcademy email address |

#### Email Confirmation Setting
Supabase email confirmation is currently OFF — users can log in immediately after registration.
Turn this ON in Supabase → Authentication → Settings → Email → Confirm email BEFORE going live with real users.
When turning on, the following UI must be built first:
- "Check your inbox" screen after registration
- Error state in login.html for unconfirmed email
- Resend confirmation link button

---

## 3. Database Setup

### 3.1 Core Tables

#### programs
```sql
CREATE TABLE programs (
  program_id       TEXT PRIMARY KEY,
  program_name     TEXT NOT NULL,
  trial_product_id TEXT
);
```

#### courses
```sql
CREATE TABLE courses (
  course_id     TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  program_scope TEXT[],
  status        TEXT NOT NULL DEFAULT 'active',
  sort_order    INTEGER DEFAULT 0
);
-- status: active | draft | archived
```

#### products
```sql
CREATE TABLE products (
  product_id    TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'PAID',
  price_minor   INTEGER,
  currency      TEXT NOT NULL DEFAULT 'GHS',
  duration_days INTEGER,
  course_ids    TEXT[],
  telegram_keys TEXT[],
  status        TEXT NOT NULL DEFAULT 'active',
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
-- kind: PAID | TRIAL | FREE
```

#### users
```sql
CREATE TABLE users (
  user_id        UUID PRIMARY KEY,
  auth_id        UUID REFERENCES auth.users(id),
  email          TEXT,
  forename       TEXT,
  surname        TEXT,
  name           TEXT,
  program_id     TEXT REFERENCES programs(program_id),
  level          TEXT,
  cohort         TEXT,
  role           TEXT NOT NULL DEFAULT 'STUDENT',
  active         BOOLEAN NOT NULL DEFAULT true,
  phone_number   TEXT,
  signup_source  TEXT,
  created_utc    TIMESTAMPTZ DEFAULT NOW()
);
-- role: STUDENT | ADMIN | TEACHER
-- signup_source: REGISTER | PAYSTACK_SETUP
```

#### subscriptions
```sql
CREATE TABLE subscriptions (
  subscription_id TEXT PRIMARY KEY,
  user_id         UUID REFERENCES users(user_id),
  product_id      TEXT REFERENCES products(product_id),
  status          TEXT NOT NULL DEFAULT 'ACTIVE',
  source          TEXT,
  source_ref      TEXT,
  start_utc       TIMESTAMPTZ,
  expires_utc     TIMESTAMPTZ,
  expiry_reminded BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- status: ACTIVE | EXPIRED | CANCELLED
-- source: SELF_TRIAL_SIGNUP | ADMIN | PAYSTACK | IMPORT
```

#### payments
```sql
CREATE TABLE payments (
  reference              TEXT PRIMARY KEY,
  status                 TEXT NOT NULL DEFAULT 'INIT',
  email                  TEXT,
  user_id                UUID,
  product_id             TEXT,
  product_name           TEXT,
  amount_minor_expected  INTEGER,
  amount_minor_paid      INTEGER,
  currency               TEXT,
  paid_utc               TIMESTAMPTZ,
  activated_utc          TIMESTAMPTZ,
  subscription_id        TEXT,
  failure_note           TEXT,
  raw                    JSONB,
  setup_token            TEXT,
  setup_created_utc      TIMESTAMPTZ,
  setup_completed_utc    TIMESTAMPTZ,
  program_id             TEXT,
  phone_number           TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);
-- status: INIT | PAID | ACTIVATED | SETUP_REQUIRED | FAILED

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_allow_all" ON payments FOR ALL USING (true) WITH CHECK (true);
```

#### announcements
```sql
CREATE TABLE announcements (
  announcement_id TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  cta_label       TEXT,
  cta_url         TEXT,
  priority        INTEGER DEFAULT 0,
  pinned          BOOLEAN DEFAULT false,
  status          TEXT NOT NULL DEFAULT 'active',
  scope_audience  TEXT DEFAULT 'ALL',
  scope_programme TEXT[],
  scope_course    TEXT[],
  scope_level     TEXT[],
  scope_sub_kind  TEXT[],
  scope_product   TEXT[],
  scope_cohort    TEXT[],
  scope_user_ids  TEXT[],
  publish_at      TIMESTAMPTZ,
  unpublish_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- announcement_id: 'ANN_' + Date.now()

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_allow_all" ON announcements FOR ALL USING (true) WITH CHECK (true);
```

#### user_notice_state
```sql
CREATE TABLE user_notice_state (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES users(user_id),
  item_type  TEXT NOT NULL DEFAULT 'announcement',
  item_id    TEXT NOT NULL,
  state      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- state: read | clicked | dismissed
ALTER TABLE user_notice_state
  ADD CONSTRAINT unique_user_notice UNIQUE (user_id, item_type, item_id);

ALTER TABLE user_notice_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_allow_all" ON user_notice_state FOR ALL USING (true) WITH CHECK (true);
```

#### config
```sql
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

ALTER TABLE config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_allow_all" ON config FOR ALL USING (true) WITH CHECK (true);
```

---

### 3.2 Quiz Engine Tables

#### quizzes
```sql
CREATE TABLE quizzes (
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

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_allow_all" ON quizzes FOR ALL USING (true) WITH CHECK (true);
```

#### attempts
```sql
CREATE TABLE attempts (
  attempt_id        TEXT PRIMARY KEY,
  user_id           UUID REFERENCES users(user_id),
  quiz_id           TEXT,
  course_id         TEXT NOT NULL,
  mode              TEXT NOT NULL,
  source            TEXT NOT NULL,
  n                 INTEGER,
  seed              TEXT,
  item_ids          TEXT,
  status            TEXT NOT NULL DEFAULT 'in_progress',
  score_raw         NUMERIC,
  score_total       NUMERIC,
  score_pct         NUMERIC,
  time_taken_s      NUMERIC,
  duration_min      INTEGER,
  answers_json      TEXT,
  display_label     TEXT,
  origin_attempt_id TEXT,
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

ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_allow_all" ON attempts FOR ALL USING (true) WITH CHECK (true);
```

#### mock_quizzes
```sql
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

ALTER TABLE mock_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_allow_all" ON mock_quizzes FOR ALL USING (true) WITH CHECK (true);
```

---

### 3.3 Items Tables (one per course)

All 11 tables follow this schema. Replace `items_gp` with the correct table name.

Course tables:
`items_gp`, `items_rn_med`, `items_rn_surg`, `items_rm_ped_obs_hrn`, `items_rm_mid`,
`items_rphn_pphn`, `items_rphn_disease_ctrl`, `items_rmhn_psych_nurs`,
`items_rmhn_psych_ppharm`, `items_nac_basic_clin`, `items_nac_basic_prev`

```sql
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
-- correct: single letter for MCQ/TF e.g. "b"
-- correct for SATA: quoted comma-separated e.g. "a,c,e"
-- rationale_img: public URL from Supabase Storage rationale-images bucket
-- shuffle_options: false for TF questions

CREATE INDEX ON items_gp (maintopic);
CREATE INDEX ON items_gp (subtopic);
CREATE INDEX ON items_gp (subject);
CREATE INDEX ON items_gp (difficulty);
CREATE INDEX ON items_gp (question_type);
CREATE INDEX ON items_gp (batch_id);

ALTER TABLE items_gp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_allow_all" ON items_gp FOR ALL USING (true) WITH CHECK (true);
```

---

### 3.4 Teacher Assess Tables

Full schema is documented in `db/schema.sql`. Key tables:

#### teacher_users
```sql
-- MyTeacher user accounts. Separate from public.users (Licensure).
-- Supabase Auth (auth.users) is shared — auth_id links the two.
CREATE TABLE teacher_users (
  user_id       TEXT PRIMARY KEY,   -- 'U_' + random hex
  auth_id       UUID REFERENCES auth.users(id),
  email         TEXT,
  forename      TEXT,
  surname       TEXT,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'STUDENT',  -- STUDENT | TEACHER | ADMIN
  active        BOOLEAN NOT NULL DEFAULT true,
  phone_number  TEXT,
  avatar_url    TEXT,
  signup_source TEXT,               -- MYTEACHER
  created_utc   TIMESTAMPTZ DEFAULT NOW()
);
```

#### teacher_profiles
```sql
-- One row per teacher access request. Created on registration or via access-request.html.
-- request_status: PENDING | APPROVED | REJECTED | DISABLED
-- active=true only after admin approval (also sets teacher_users.role = 'TEACHER')
CREATE TABLE teacher_profiles (
  teacher_id      TEXT PRIMARY KEY REFERENCES teacher_users(user_id),
  display_name    TEXT,
  email           TEXT,
  phone_number    TEXT,
  organisation    TEXT,
  role_requested  TEXT,
  plan_type       TEXT NOT NULL DEFAULT 'FREE',
  active          BOOLEAN NOT NULL DEFAULT false,
  request_status  TEXT NOT NULL DEFAULT 'PENDING',
  request_note    TEXT,
  request_count   INTEGER NOT NULL DEFAULT 1,
  requested_at    TIMESTAMPTZ,
  last_request_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ
);
```

#### teacher_classes
```sql
-- Manages teacher-created classes with join codes
-- Key columns: class_id, teacher_id, title, join_code, custom_fields_json, status
```

#### teacher_class_members
```sql
-- Students joined to classes
-- Key columns: user_id, class_id, display_name, custom_fields_json, status
```

#### teacher_bank_items
```sql
-- Teacher's personal question bank
-- Key columns: bank_item_id, teacher_id, question_type (MCQ/TF/SATA), stem, option_a-f, fb_a-f, correct, rationale
-- Source tracking: source_type (TEACHER/IMPORT/QUIZ_INLINE/LIBRARY), source_course_id, source_item_id
```

#### teacher_quizzes
```sql
-- Quiz definitions with full lifecycle management
-- Key columns: teacher_quiz_id, teacher_id, title, subject, preset, duration_minutes, max_attempts
-- Settings: shuffle_questions, shuffle_options, show_review, show_results, results_release_policy
-- Grading: grading_policy, grade_bands_json, pass_threshold_pct, score_display_policy
-- Schedule: open_at, close_at, access_code
-- State: status (DRAFT/PUBLISHED/ARCHIVED), sata_scoring_policy (ALL_OR_NOTHING/PARTIAL_CREDIT/PER_OPTION)
-- Draft: draft_items_json (array of TBANK_ and LIB:COURSE:ITEM refs), custom_fields_json
```

#### teacher_quiz_items
```sql
-- Snapshot of questions frozen at publish time
-- Key columns: quiz_item_id, teacher_quiz_id, position, snap_stem, snap_option_a-f, snap_correct, snap_marks, snap_question_type
```

#### teacher_quiz_classes
```sql
-- Links quizzes to classes
-- Key columns: teacher_quiz_id, class_id
```

#### teacher_quiz_attempts
```sql
-- Student attempts with full scoring data
-- Key columns: attempt_id, user_id, teacher_quiz_id, class_id, attempt_no, status (IN_PROGRESS/SUBMITTED)
-- Scoring: score_raw, score_total, score_pct, time_taken_s, score_json
-- Grading snapshot: grading_policy, grade_bands_json, score_display_policy
-- Data: items_json, answers_json, flags_json, candidate_fields_json
```

#### teacher_library_courses
```sql
-- QAcademy shared library course catalog
-- Key columns: course_id, title, program_scope, items_table, status
-- items_table points to the actual items table (e.g., items_gp, items_rn_med)
```

### 3.4 Messaging Tables

#### messages_threads
```sql
CREATE TABLE messages_threads (
  thread_id        TEXT PRIMARY KEY,
  user_id          UUID REFERENCES users(user_id),
  admin_id         TEXT,
  status           TEXT NOT NULL DEFAULT 'open',
  context_type     TEXT NOT NULL DEFAULT 'general',
  subject          TEXT,
  course_id        TEXT,
  quiz_id          TEXT,
  question_id      TEXT,
  attempt_id       TEXT,
  bulk_batch_id    TEXT,
  ref_text         TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  last_message_at  TIMESTAMPTZ DEFAULT NOW(),
  last_sender_role TEXT
);
-- thread_id: 'THR_' + Date.now() + random
-- context_type: general | course | question
-- status: open | closed
-- ref_text: human-readable question reference (stem, options, student answer) for question context threads

ALTER TABLE messages_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_allow_all" ON messages_threads FOR ALL USING (true) WITH CHECK (true);
```

#### messages
```sql
CREATE TABLE messages (
  message_id   TEXT PRIMARY KEY,
  thread_id    TEXT REFERENCES messages_threads(thread_id),
  sender_id    TEXT NOT NULL,
  sender_role  TEXT NOT NULL,
  body_text    TEXT NOT NULL,
  read_by_user  BOOLEAN DEFAULT false,
  read_by_admin BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
-- message_id: 'MSG_' + Date.now() + random
-- sender_role: student | admin

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_allow_all" ON messages FOR ALL USING (true) WITH CHECK (true);
```

### 3.5 Auth Events & Rate Limiting

Each product has its own auth event and reset request tables — they are fully separate.

#### auth_events
```sql
-- Logs every login attempt (success + failure) for audit trail and rate limiting.
-- All writes go through RPC — no direct browser access.
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
```

Two SECURITY DEFINER RPCs are required (no direct browser access to this table):
- `log_auth_event(...)` — inserts one row after every login attempt
- `check_login_rate_limit(p_identifier, p_fp_hash)` — counts recent failures, returns `{ allowed: true }` or `{ allowed: false, retry_after_seconds, reason }`

Rate limit thresholds: 5 failures in 10 minutes → 10-min block, 10 failures in 24 hours → 24-hr block. Full RPC definitions are in `db/rls.sql`.

The migration file `db/migrations/auth_events_and_rate_limit.sql` contains the complete DDL, indexes, RLS, and both RPCs in one runnable block.

**MyTeacher equivalents** — same schema, separate tables:
- `teacher_auth_events` — same columns as `auth_events`
- `teacher_reset_requests` — same columns as `reset_requests`

Five SECURITY DEFINER RPCs are required for MyTeacher auth (defined in `db/rls.sql`):
- `log_mt_auth_event(...)` — inserts into `teacher_auth_events`
- `check_mt_login_rate_limit(p_identifier, p_fp_hash)` — reads `teacher_auth_events`, same thresholds as Licensure
- `log_mt_reset_request(...)` — inserts into `teacher_reset_requests`, checks `teacher_users` for email existence
- `check_mt_reset_rate_limit(p_email)` — reads `teacher_reset_requests`, same threshold (3 per 60 min)
- `mark_mt_reset_used(p_email)` — updates `teacher_reset_requests`

### 3.6 RLS
All tables have proper role-based RLS policies. The complete policy definitions are in `db/rls.sql`.

**Licensure helper functions** (run before Licensure RLS policies):
- `auth_user_role()` — returns the current user's role from `public.users`
- `auth_user_id()` — returns the current user's user_id (TEXT) from `public.users`

**MyTeacher helper functions** (run before MyTeacher RLS policies):
- `myteacher_user_role()` — returns the current user's role from `teacher_users`
- `myteacher_user_id()` — returns the current user's user_id (TEXT) from `teacher_users`

All four functions use `SECURITY DEFINER` to bypass RLS without recursion.

When cloning, run `db/rls.sql` in the Supabase SQL Editor after creating all tables. The file includes all DROP/CREATE statements in the correct order.

### 3.7 Supabase Auth Redirect URLs

In Supabase dashboard → Auth → URL Configuration → Redirect URLs, add all four:
- `https://yourdomain.com/mynmclicensure/login.html`
- `https://yourdomain.com/mynmclicensure/reset-password.html`
- `https://yourdomain.com/myteacher/login.html`
- `https://yourdomain.com/myteacher/reset-password.html`

These are required for Google OAuth and magic link flows to redirect back to the correct product login page.

### 3.6 Safe UI Helpers
`js/utils.js` provides `safeText()` and `safeAvatar()` — use these for any UI that displays user-controlled values. All pages that load a nav/sidebar script must also load `<script src="/js/utils.js"></script>` before it.

---

## 4. Supabase Storage

### rationale-images bucket
1. Supabase dashboard → Storage → New bucket
2. Name: `rationale-images`
3. Set to **Public**
4. Add one policy: name `rationale images access`, operation ALL, definition `true`

URL format: `https://[project-ref].supabase.co/storage/v1/object/public/rationale-images/[filename]`

Files are named after the question item_id e.g. `GP_001.jpg`. The `rationale_img` column stores the full public URL.

**Image guidelines:** Compress images before uploading (use squoosh.app or tinypng.com). Keep under 100KB per image. Free plan allows 1GB total storage.

---

## 5. Auth Setup

Both products share Supabase Auth (`auth.users`) as the login identity layer but have fully separate user tables, session tables, guard/auth JS files, and auth pages.

### MyNMCLicensure
- User table: `public.users` — `role = 'STUDENT' | 'ADMIN'`
- Auth pages: `mynmclicensure/login.html`, `forgot-password.html`, `reset-password.html`, `router.html`
- Guard/auth JS: `js/guard.js`, `js/auth.js`
- Session key: `qa_session_id` in localStorage
- After registration: `mynmclicensure/register.html` inserts into `public.users` with `role = 'STUDENT'`
- Trial subscription auto-assigned on registration based on `program_id`
- New students who pay via `subscribe.html` get their account created by the Worker via `setup-complete` route

### MyTeacher
- User table: `teacher_users` — `role = 'STUDENT' | 'TEACHER' | 'ADMIN'`
- Auth pages: `myteacher/login.html`, `forgot-password.html`, `reset-password.html`, `router.html`
- Guard/auth JS: `myteacher/js/myteacher-guard.js`, `myteacher/js/myteacher-auth.js`
- Session key: `mt_session_id` in localStorage
- After registration: `myteacher/register.html` inserts into `teacher_users`. Teachers also get a `teacher_profiles` row with `request_status = 'PENDING'` pending admin approval.
- Teacher approval: admin sets `teacher_profiles.active = true` and `teacher_users.role = 'TEACHER'` via `myteacher/admin/teachers.html`
- Access request page: `myteacher/access-request.html` — shows status (PENDING/REJECTED/DISABLED) and allows resubmission

### Shared
- Email/password auth enabled
- Email confirmation: OFF during build (turn ON before go-live — see Before Going Live Checklist)
- Root entry point: `product-select.html` — directs users to the correct product login
- Login rate limiting: 5 failed attempts in 10 min → 10-min block, 10 in 24 hr → 24-hr block. Logged to `auth_events` (Licensure) or `teacher_auth_events` (MyTeacher) via RPC.

---

## 6. Key Design Decisions

### Stacked Subscription Access
Sum remaining days across all active subscriptions covering each course. Display expiry as today plus that total. Admin views retain raw per-subscription data.

### Trial is a Product Kind
`kind` on products: `PAID | TRIAL | FREE`. Never write `TRIAL` to the status column — status is always `ACTIVE | EXPIRED | CANCELLED`.

### Subscription Status Sync
No pg_cron on Supabase free tier. Status is kept truthful via a manual **Sync Status** button on `admin/subscriptions.html`. It flips `ACTIVE → EXPIRED` where `expires_utc < now()`. One direction only. Run on each admin visit.

### Announcement Scope — AND Logic
Student must match every condition set in an announcement's targeting. Handled client-side by `filterAnnouncementsForStudent()` in `mynmclicensure-api.js`.

### Items Architecture
`maintopic` and `subtopic` are clean separate columns. Old build used a single `topic` column with colon-separated values like `"Anatomy: Cardiovascular"`. `getItemFilterOptions(courseId)` returns distinct values for both — no parsing needed.

### Builder Attempt — No Resume
Builder attempts are always fresh. No resume logic — every Build Quiz click creates a new attempt.

### Config Table — All Keys Are System Keys
Every key in the config table is referenced by platform code. Key names are read-only. Values and descriptions are editable. Deleting a key requires explicit confirmation warning.

### Mobile Sidebar
Hamburger button and overlay are injected by `js/mynmclicensure-admin-sidebar.js` and `js/mynmclicensure-student-sidebar.js` — no changes needed to individual page files. Desktop behaviour is unchanged.

### Payment Flow — Two Entry Points
1. **New student** (`subscribe.html`) → `init-public` → Paystack → `payment-confirmation.html` → `verify` → if no account: `SETUP_REQUIRED` → student completes registration on confirmation page → `setup-complete` → account + subscription created
2. **Existing student** (`mynmclicensure/student/upgrade.html`) → `init-upgrade` (requires Bearer token) → Paystack → `payment-confirmation.html` → `verify` → subscription activated immediately

### Grant Subscription — Admin Panel
The Grant Subscription button in `admin/subscriptions.html` side panel appears for ALL subscription statuses. It pre-fills the student via `openGrantForUser(userId, name, email)` — no manual search needed.

### Teacher Assess — Quiz Lifecycle
```
DRAFT ──publish──▶ PUBLISHED ──archive──▶ ARCHIVED
  │                                          ▲
  └────────────archive───────────────────────┘
```
- No unpublish. No unarchive. Clone creates a new DRAFT from any state.
- Questions are snapshotted into `teacher_quiz_items` at publish time — immutable after that.
- `sata_scoring_policy`, `duration_minutes`, `draft_items_json` are locked after publish (integrity fields).
- `title`, `subject`, `max_attempts`, `open_at`, `close_at` are editable on PUBLISHED quizzes.
- `results_release_policy`, `show_results`, `show_review`, `pass_threshold_pct`, `grade_bands_json` are editable on both PUBLISHED and ARCHIVED.
- `pass_threshold_pct`, `sata_scoring_policy`, and release settings are snapshotted onto each attempt at submit time.

### Teacher Assess — Library Architecture
- QAcademy library tables (`items_gp`, `items_rn_med`, etc.) are **read-only** for teachers.
- Teachers browse and add library items to quiz drafts as `LIB:COURSE_ID:ITEM_ID` refs.
- At publish, LIB refs are resolved from the library tables and snapshotted like bank items.
- If a teacher edits a LIB item, it's automatically copied to their personal bank (`source_type: 'LIBRARY'`, `source_course_id`, `source_item_id` set for traceability). The LIB ref in the draft is swapped with the new `TBANK_` ref. The original library item is never modified.

### Teacher Assess — CSV Import
- Standalone page at `myteacher/teacher/import.html`
- Validates per-row: stem, correct, options, question type, marks
- Duplicate detection against existing bank items and within the file
- Only valid rows are imported; errors and duplicates are skipped
- Imported items get `source_type: 'IMPORT'`
- Includes AI help section with ready-made prompt for formatting questions using any AI tool

---

## 7. CSV Import — Question Bank (Admin)

The question bank page (`mynmclicensure/admin/question-bank.html`) has a built-in CSV importer.

Column order (24 columns):
```
item_id, question_type, stem,
option_a, fb_a, option_b, fb_b, option_c, fb_c,
option_d, fb_d, option_e, fb_e, option_f, fb_f,
correct, rationale, subject, maintopic, subtopic,
difficulty, marks, batch_id, shuffle_options
```

Key rules:
- `correct` for SATA must be a quoted comma-separated value e.g. `"a,c,e"`
- `item_id` blank = auto-generated
- Re-importing same `item_id` = update (upsert), not duplicate
- Export from Google Sheets/Excel as CSV — quoting is handled automatically
- Always download the template from the page before filling

---

## 8. Before Going Live Checklist
- [x] Replace dev_allow_all RLS with proper role-based policies
- [x] Set up custom SMTP for emails (Resend)
- [x] Set up Paystack webhook (Cloudflare Worker)
- [x] Build and wire admin pages (payments, user management)
- [x] Add teacher/student sidebar navigation
- [x] Seed QAcademy library tables
- [x] Set up dev/prod environment split
- [x] Deploy prod payments + email workers
- [ ] Turn on email confirmation in Supabase Auth (on hold — needs UI)
- [ ] Set up custom domain on Cloudflare
- [ ] Remove test accounts from dev database
- [ ] Review and clean up question bank content
- [ ] Seed prod database with production question content
- [ ] Test full quiz lifecycle end-to-end on prod
- [ ] Rotate Supabase anon key if ever committed publicly

---

## 9. Test Accounts (dev only — prod starts clean)
| Role | Email | Notes |
|---|---|---|
| ADMIN | mybackpacc@gmail.com | role=ADMIN |
| TEACHER | samquatleumas@gmail.com | role=TEACHER |
| STUDENT | Albert Owusu-Ansah | role=STUDENT, RN / L300 / 2024 cohort / TRIAL |
| STUDENT | Justice Asiamah | RM / L100 / 2023 cohort / TRIAL |
