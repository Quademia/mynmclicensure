# 12 — Tables

Every table the app keeps, in plain words: what it is for, what each
column holds, who can read or change it from a browser, and every
decided change still to build — written on the table it changes, with
Sam's tick and its date.

Written on 2026-10-04 (Sam) from the dev database itself, so it
describes what is really there. **Every change to the database updates
this file in the same commit**, and **no change is built before its
line here carries Sam's tick** (AGENTS.md).

All tables live in the database schema `licensure_gh`. Changes ticked
before 2026-10-04 were numbered S1–S24; the numbers and their history
are in `archive/product-plan/rebuild.md` §8 and are not needed to read
this file.

**How to read a "Browser" line.** The app's pages are built on the
server, and every write goes through the server's own key behind a
check that the person is a signed-in student or an admin. "Browser"
says what a signed-in student's or a visitor's own browser could reach
directly — the floor under the server's checks. *Old defaults* means the
table still carries the broad permissions every new table started with;
the row rules keep the rows safe, and the permissions are taken back
table by table as each is next changed (AGENTS.md rule 9).

---

## Accounts — 01

### `users` — one row per person
| Column | Holds |
|---|---|
| `user_id` | The person's id (`U_…`), used by every other table |
| `auth_id` | The link to the sign-in record, which all of Quademia's apps share |
| `email` | Lowercased; unique |
| `phone_number` | The WhatsApp / phone number, as typed |
| `name`, `forename`, `surname` | The full name and its two parts |
| `program_id` | The student's programme → `programs` |
| `school_id`, `school_other` | The school → `schools`; or the name typed when it is not on the list |
| `cohort` | The year group, as typed |
| `level` | The study level, as typed |
| `referral_source` | How they heard of Quademia (asked at registration) |
| `role` | `STUDENT` or `ADMIN` |
| `active` | Off = deactivated |
| `avatar_url` | The profile photo's address, with a version stamp so a new photo shows at once |
| `signup_source` | How the account was made: registering, or the setup step after a payment |
| `created_utc` | When the account was made |
| `last_login_utc` | Last sign-in — exists, not written yet *(to build: 01.6)* |

- *To build — ticked 2026-10-04 (03 F4b, the SMS half):* `phone_number` kept in one
  form (+233…) with **the time it was verified**; a change to it goes
  through the server and clears the verification, so it leaves the
  browser's list. Why: one trial per verified number.
- *To build — ticked 2026-09-18 (10):* `level` keyed to `levels`;
  `cohort` becomes a year (a number). Why: today both are free text the
  admin's pickers can't rely on.
- *Needs Sam's tick before the build (05 G1b):* `username` (generated,
  unique, display only) and the animal. Why: the boards never show a
  real name or photo.
- Browser: a student reads their own row and can change only `name`,
  `forename`, `surname`, `phone_number`, `school_id`, `school_other`,
  `cohort`, `level`, `avatar_url`; an admin reads all. Three leftover
  permissions (truncate, references, trigger) go with the SMS half (F4b).

### `schools` — the regulator's list of nursing schools (141)
| Column | Holds |
|---|---|
| `id` | The school's number |
| `name`, `region`, `ownership` | As the regulator lists them |
| `programmes` | The programmes the school trains |
| `active` | Off = no longer offered |
| `created_at` | When added |

- No way to change the list from the app (open, 10).
- Browser: anyone reads. *Old defaults.*

### `levels` — study levels (L100–L400)
| Column | Holds |
|---|---|
| `level_id`, `label` | The level's code and its name |
| `created_at` | When added |

- Not read by anything yet — the pickers read it once `users.level` is
  keyed to it (ticked 2026-09-18, 10).
- Browser: signed-in read; admin write. *Old defaults.*

### `sessions` — signed-in devices
| Column | Holds |
|---|---|
| `session_id` | The device's id, kept in a cookie |
| `user_id` | Whose device |
| `kind` | `LOGIN` |
| `issued_utc`, `expires_utc` | Signed in; expires 7 days later |
| `last_seen_utc` | Updated on every page |
| `device_label` | "Windows · Chrome" |
| `ua_hash`, `ip_hash` | The browser and the address, hashed |
| `login_via` | `EMAIL`, `GOOGLE` or `MAGIC_LINK` |
| `active` | Off = signed out (two live at most; rows are never deleted) |

- Browser: the owner and an admin read. *Old defaults.*

### `auth_events` — every sign-in attempt
| Column | Holds |
|---|---|
| `event_id` | The entry's id |
| `event_type` | `LOGIN_SUCCESS`, `LOGIN_FAIL`, … |
| `identifier` | The email typed |
| `user_id` | The person, when known |
| `fail_reason` | Why it failed |
| `fp_hash`, `ua_hash`, `ip_hash`, `device_label` | The device and address, hashed |
| `created_utc` | When |

- Browser: nothing (no row rule lets it in). *Old defaults.*

### `reset_requests` — every "forgot password"
| Column | Holds |
|---|---|
| `request_id` | The entry's id |
| `email` | The email typed |
| `user_exists` | Whether it matched an account (the page never says) |
| `status` | `EMAIL_SENT`, `RATE_LIMITED` or `EMAIL_FAILED` |
| `fp_hash`, `device_label` | The device |
| `used`, `used_utc` | Whether and when the link was used |
| `created_utc` | When |

- Browser: nothing. *Old defaults.*

### `rate_limits` — the lockout counters
| Column | Holds |
|---|---|
| `key` | What is counted (an email, a device, an address, a payment) |
| `window_start`, `count` | The window and the count in it |

- Becomes the app's one limiter, a rule per door *(to build: 10.8)*.
- Browser: nothing.

---

## Programmes, courses and packages — 02

### `programs` — the programmes
| Column | Holds |
|---|---|
| `program_id` | The short code — RN, RM, RMHN, RPHN, NACNAP (NAC, NAP and RCN to come) |
| `program_name` | The full name shown to students |
| `trial_product_id` | The package a student gets on this programme's trial → `products` |
| `is_open` | Open to the public — the one place it is set |

- `is_open` (02 C5a, built 2026-10-04). On: the programme shows on the
  home page, at registration and in the shop. Off: hidden, and the
  server refuses it at registration and checkout; the admin can still
  grant its packages for testing; turning it off stops new sign-ups
  only. A new row starts off. Open: RN, RM, RMHN, RPHN, NACNAP; closed:
  NAC, NAP, RCN (added 2026-10-04, no courses or packages yet — 02 C5b).
  Why: programmes are released in batches as each question bank is
  ready. Set by hand until the Courses page gets its tick *(to build:
  02.9)*.
- Browser: anyone reads; writes through the server only.

### `courses` — the courses
| Column | Holds |
|---|---|
| `course_id` | The course's code |
| `title` | The full name |
| `program_scope` | The programmes it belongs to (the General Paper belongs to all) |
| `status` | Active, draft or archived |
| `page_slug` | Unused — dropped when the table is next changed *(02.4)* |

- Browser: signed-in read (a signed-out visitor reads nothing — public
  pages use the server's key; open, 02); admin write. *Old defaults.*

### `products` — the packages for sale or grant
| Column | Holds |
|---|---|
| `product_id` | The package's code |
| `name` | The name shown |
| `kind` | `PAID`, `TRIAL` or `FREE` (Free Full Access) |
| `status` | Active, draft or archived |
| `price_minor`, `currency` | The price in pesewas, GHS |
| `duration_days` | How long a grant lasts (the programme trials 14, the welcome trial 7) |
| `is_premium` | Shown on Premium Prep |
| `telegram_group_keys` | The Telegram groups it admits — free text (open, 10) |
| `allow_builder_quizzes` | Quiz Builder quizzes over the whole grant, in any of its courses; empty = unlimited |
| `allow_packs_per_course` | Offline packs per course; empty = unlimited, 0 = none (new packages start at 5) |
| `allow_papers` | `all`, or `trial_paper` — only each course's paper ticked "Open in trial" |
| `allow_mocks` | Whether mock exams open — follows `is_premium`: set from the tick when a package is added or its tick changes; a new package starts without |

- The four limits (03 F4, built 2026-10-04): the trials 3 · 0 · trial
  paper · no; Free Full Access and paid packages unlimited · 5 · all;
  mocks yes on the Premium Prep packages only (02.10, built 2026-10-04 —
  Sam: mocks are seasonal and, with the channel, what Premium Prep has
  and Full Access does not). Why: each package says what it opens, not
  only which courses and for how long. Set by the database for now; the
  admin's form gets the four fields with its redesign *(to build:
  03.1)*.
- Browser: anyone reads; writes through the server only.

### `product_courses` — which courses each package opens
| Column | Holds |
|---|---|
| `product_id`, `course_id` | One row per course in the package |

- Browser: anyone reads; admin write. *Old defaults.*

---

## Access and payments — 02

### `subscriptions` — a receipt: what was bought or granted
| Column | Holds |
|---|---|
| `subscription_id` | The receipt's id |
| `user_id`, `product_id` | Who, and which package |
| `start_utc`, `expires_utc` | Copied from its access rows |
| `status` | `ACTIVE`, `EXPIRED` or `REVOKED` |
| `source` | `PAYSTACK`, `ADMIN` or `SELF_TRIAL_SIGNUP` |
| `source_ref` | The Paystack reference — one receipt per payment, ever |
| `requested_start_utc` | A start the admin chose |
| `created_utc` | When written |
| `expiry_reminded` | Unused — goes or moves with the expiry reminders *(02.3)* |
| `allow_builder_quizzes`, `allow_packs_per_course`, `allow_papers`, `allow_mocks` | A copy of the package's four limits |

- The copy is made by the database when a receipt is written, whatever
  the writer sends, and again only if its package changes — re-saving a
  receipt keeps it (03 F4, built 2026-10-04). Why: one place for every
  writer, and what was bought is kept when a package is edited later.
- Browser: the owner and an admin read; writes through the server only.

### `course_access` — the gate: one row per course per receipt
| Column | Holds |
|---|---|
| `access_id` | The row's id |
| `user_id`, `course_id`, `subscription_id` | Who, which course, from which receipt |
| `start_utc`, `expires_utc` | This course's own window |
| `revoked_utc` | When revoked |
| `created_utc` | When written |

- The one thing every gate reads.
- Browser: the owner and an admin read; writes through the server only.

### `payments` — every Paystack payment
| Column | Holds |
|---|---|
| `reference` | Paystack's reference |
| `status` | `INIT` → `PAID` → `ACTIVATED`, or `FAILED`; `SETUP_REQUIRED` today |
| `email`, `phone_number`, `program_id` | What the buyer gave at checkout |
| `user_id` | The account, once known |
| `product_id`, `product_name` | The package |
| `amount_minor_expected`, `amount_minor_paid`, `currency` | The price and what was paid |
| `paid_utc`, `activated_utc` | When paid; when access was given |
| `subscription_id` | The receipt it made |
| `failure_note` | Why it failed |
| `raw` | Paystack's reply, trimmed (card type and last four kept) |
| `setup_token`, `setup_created_utc`, `setup_completed_utc` | The setup link for a buyer with no account |

- *Ruled 2026-09-18, no tick recorded (02, open):* the three setup
  columns and `SETUP_REQUIRED` go when the account is made at payment
  (D31); `ABANDONED` comes with the nightly sweep (D34).
- Browser: admin read. *Old defaults.*

---

## The question bank — 06

### `question_bank` — every question
| Column | Holds |
|---|---|
| `item_id` | The question's id, course-prefixed, never changed |
| `course_id` | Its course |
| `question_type` | `MCQ`, `TF` or `SATA` — fixed once saved |
| `stem` | The question |
| `option_a` … `option_f` | The options |
| `fb_a` … `fb_f` | The feedback for each option |
| `correct` | The answer, as letters ("b", "a,c,e") |
| `rationale`, `rationale_img` | The explanation and its picture |
| `subject`, `maintopic` | The subject and topic → the course's lists below |
| `subtopic` | Free text |
| `difficulty` | `Easy`, `Moderate`, `Hard`, or empty |
| `bloom_level` | The level: Remember … Create, or empty |
| `tags` | Free-text tags |
| `marks` | Marks for the question |
| `shuffle_options` | Whether its options are shuffled |
| `batch_id` | The import it came in |
| `question_ref` | Where it came from — internal |
| `is_published` | Off = a draft no student sees |
| `is_free_sample` | In the free set |
| `version` | Goes up by one on a content change to a published question |
| `created_at`, `updated_at`, `updated_by` | When made, last changed, by whom |

- Two read rules: the course rule, and the free rule (03 F1, built
  2026-10-04) — any signed-in student may read a question that is
  published and marked free, in any course. Why: the free account
  practises on it.
- Browser: a student reads only `item_id`, `course_id`, `subject`,
  `maintopic`, `subtopic`, `difficulty`, `question_type`, `batch_id`,
  `is_published`, `is_free_sample`, of published questions in courses
  they hold or marked free — never the question or its answer; a
  signed-out visitor reads nothing. Writes through the
  server only.

### `question_bank_history` — past versions
- A copy of a question's columns each time a published question's
  content changes, plus `changed_by`, `changed_at`, and `deleted` (the
  copy kept when it was deleted).
- Browser: nothing.

### `bank_subjects`, `bank_topics` — each course's two lists
| Column | Holds |
|---|---|
| `id` | The entry's number |
| `course_id`, `name` | The course and the word; a word once per course |
| `retired` | Hidden from new use |
| `created_at` | When added |

- A question's subject and topic must be on its course's lists;
  renaming a word renames it on every question.
- Browser: nothing.

---

## Practice — 04

### `quizzes` — practice papers
| Column | Holds |
|---|---|
| `quiz_id`, `course_id` | The paper and its course |
| `title` | Its title |
| `n` | Number of questions |
| `allowed_modes` | The modes it offers (at least one of the four) |
| `shuffle` | Whether questions are shuffled |
| `time_limit_sec` | An exam's time limit, if set |
| `status` | `draft`, `active` or `archived` |
| `published`, `publish_at`, `unpublish_at` | Published, and its window |
| `notes` | The admin's notes |
| `created_at`, `updated_at` | When made, last changed |
| `open_in_trial` | The one paper of its course a trial opens; at most one per course |

- `open_in_trial` (03 F4, built 2026-10-04): the database refuses a
  second in a course. Why: the trial opens one paper a course, chosen by
  the admin. Set by hand for now; the paper editor gets the tick with
  its redesign *(to build: 03.1)*.
- Browser: a student reads open, published papers of courses they hold
  — every column but `notes` and `open_in_trial` (no page reads it yet).

### `quiz_items` — a paper's questions
| Column | Holds |
|---|---|
| `quiz_id`, `course_id` | The paper |
| `item_id` | The question → `question_bank` (its own course only) |
| `position` | Its place in the paper |

- A question a paper uses cannot be deleted.
- Browser: nothing.

### `mock_quizzes`, `mock_quiz_items` — mock exams and their questions
- The same columns as `quizzes` and `quiz_items`, plus `visibility`
  (`ALL`, `PAID` or `TRIAL`) — stored, never checked.
- *To build:* `visibility` removed *(10.17)* — the package's mock yes /
  no is the gate (ticked 2026-10-04).
- Browser: as for papers.

### `attempts` — a sitting
| Column | Holds |
|---|---|
| `attempt_id`, `user_id` | The sitting and whose |
| `quiz_id`, `course_id` | The paper or mock (empty for a builder quiz) and the course |
| `mode` | `UNTIMED_LEARNING`, `UNTIMED_TEST`, `TIMED_FREE_NAV`, `TIMED_SEQUENTIAL` |
| `source` | `fixed`, `builder`, `retake` or `mock` |
| `n` | Number of questions |
| `seed` | The shuffle's seed |
| `duration_min` | An exam's time |
| `status` | `in_progress`, `completed` or `abandoned` |
| `score_raw`, `score_total`, `score_pct` | The score |
| `time_taken_s` | Time taken |
| `origin_attempt_id` | For a retake, the sitting it repeats |
| `display_label` | The name shown in the history |
| `ts_iso` | When made |
| `started_utc`, `ended_utc` | An exam's clock: started, ended |

- *To build (04 G2):* a new `source` for the daily challenge.
- Browser: the owner and an admin read; every write through the
  database's own functions.

### `attempt_items` — a sitting's questions and answers
- **A copy of each question** when the sitting is made (type, question,
  options, feedback, answer, rationale, picture, subject, topic,
  subtopic, difficulty, level, tags, marks, shuffle, version) and its
  `position`, so a later bank edit never changes the sitting.
- **The answer**: `chosen` (the student's choice), `flagged`,
  `sata_checked` (Check Answer pressed), `time_spent_s` (engaged
  seconds), `is_correct`, `score_awarded`, `answered_utc`, `graded_utc`,
  `passed_utc` (Sequential: moved past it).
- Browser: the owner reads the question and their own answers — never
  `correct`, the rationale or the feedback, which reach the student only
  through Check Answer and the review (the seal).

---

## Offline packs — 07

### `offline_packs` — a pack
| Column | Holds |
|---|---|
| `pack_id`, `user_id`, `course_id` | The pack, whose, which course |
| `pack_name`, `display_label` | Its name and the owner's label |
| `selection_mode` | `topics` or `concept` |
| `maintopics`, `subtopics`, `difficulties`, `question_types`, `concept_query` | What was picked |
| `question_count` | How many questions |
| `watermark` | The owner's name, masked email and label, stamped when made |
| `status` | `active` (archived and deleted are never set) |
| `created_utc`, `updated_utc` | When made, last changed |

- Browser: the owner and an admin read. *Old defaults* (an owner could
  still write a header row directly; packs are made through the server).

### `offline_pack_items` — a pack's questions
- A copy of each question with its answer, rationale and feedback (the
  pack prints its answer key), and its `position`.
- Browser: the owner reads.

---

## Help and news — 08

### `announcements` — notices
| Column | Holds |
|---|---|
| `announcement_id` | The notice's id |
| `title`, `body_html`, `body_text` | The title; the body as written and as plain text |
| `status` | `draft`, `active` or `archived` |
| `start_at`, `end_at` | When it shows |
| `pinned`, `priority` | Order |
| `dismissible` | Whether ✕ is offered |
| `scope_audience`, `scope_programs`, `scope_courses`, `scope_level`, `scope_subscription_kind`, `scope_product_ids`, `scope_cohort`, `scope_user_ids` | Who it is for; a student must match every scope set |
| `created_at` | When made |

- *To build — ticked 2026-09-18 (08 A1):* read only through one database
  function that returns what the signed-in student should see; the
  table itself admin-only; checks on the status and scope words;
  `scope_level` a list. Why: today every signed-in account reads every
  notice, the named-students list included.
- Browser today: every signed-in account reads every row; admin write.
  *Old defaults.*

### `user_notice_state` — what each student did with a notice
| Column | Holds |
|---|---|
| `id` | The row's number |
| `user_id`, `item_type`, `item_id` | Who, and which notice |
| `state` | One word, overwritten (read, then dismissed, loses the read) |
| `seen_at`, `updated_at` | When |

- *To build — ticked 2026-09-18 (08 A2):* `read_at`, `clicked_at`,
  `dismissed_at` — each set once, never cleared — replace `state`,
  `seen_at`, `updated_at`; `item_id` keyed to the notice; written
  through the server only.
- Browser: the owner reads and writes their own. *Old defaults.*

### `messages_threads` — conversations
| Column | Holds |
|---|---|
| `thread_id`, `user_id` | The thread and the student |
| `status` | Open or closed |
| `context_type`, `course_id`, `subject` | `general` or `course` (old rows: `question`); its subject line |
| `last_message_at`, `last_sender_role` | The latest message, and who sent it |
| `created_at` | When opened |
| `admin_id`, `quiz_id`, `question_id`, `attempt_id`, `bulk_batch_id`, `ref_text` | Left from Bulk Send and question feedback |

- *To build — ticked 2026-09-18 (08, the support desk):*
  `student_read_at` and `admin_read_at` (unread = a later message from
  the other side); the six leftover columns dropped; checks on the
  status, context and sender words; live updates on close; writes
  through the server only.
- Browser: the student reads and writes their own threads; an admin all.
  *Old defaults* — a student can today rewrite a thread's status.

### `messages` — the messages
| Column | Holds |
|---|---|
| `message_id`, `thread_id` | The message and its thread |
| `sender_id`, `sender_role` | Who sent it |
| `body_text` | The text |
| `read_by_user`, `read_by_admin` | Read flags |
| `created_at` | When sent |

- *To build — ticked 2026-09-18 (08):* the read flags go (the thread's
  stamps replace them); at most 2,000 characters; no changes once sent;
  a `system` sender for the line "reopened by a reply"; writes through
  the server only.
- Browser: the thread's student and an admin read and write. *Old
  defaults* — a student can today edit an admin's reply.

---

## Platform — 10

### `config` — settings
| Column | Holds |
|---|---|
| `key`, `value` | The setting and its value |
| `description` | What it is for |
| `updated_at` | Last changed |

- *To build — ticked 2026-09-18 (10):* admin-only to read; read through
  a typed list of known settings with their bounds; the unused
  `builder_default_questions` dropped. Why: today any signed-in account
  reads every setting, and any text is accepted for any key.
- Browser: signed-in read; admin write. *Old defaults.*

### `migrations` — the record of database changes
| Column | Holds |
|---|---|
| `version`, `name`, `applied_at` | Each change file applied, and when |

- Written only by the repo's own runner. Browser: nothing.

---

## Decided, no table yet

- **The numbers that have had a trial** — *ticked 2026-10-04 (03 F4b)*:
  the database refuses a second trial for a number on it. No browser
  access. (No table of SMS codes — the SMS company checks the code.)
- **Question reports** (06.2) — needs Sam's tick at the build.
- **The email outbox** (10.2) — needs Sam's tick at the build.
- **The badges already shown** (05 G3) — needs Sam's tick at the build.

## The database's own functions

Every write a student makes, and every grade, happens inside these;
the browser can call only the first two lines.

- **Who is asking**: `auth_user_id()`, `auth_user_role()`.
- **The gate**: `my_course_access()` (each course's latest live end),
  `user_has_course()`.
- **The sitting** (server only): `create_attempt`, `start_timed_attempt`,
  `save_answers`, `check_answer`, `advance_attempt`, `finish_attempt`,
  `abandon_attempt`, `expire_attempt`; grading inside (`grade_answer`).
  `create_attempt` applies the package's limits to a student with a live
  grant for the course — a paper only on all papers or the ticked one, a
  mock only with mocks, builder quizzes within the count (retakes free);
  the most generous of two grants wins. Without a live grant it allows
  only a builder quiz (or its retake) of published free questions, in a
  course of the student's programme, in a Study mode.
- **Packs and the bank** (server only): `create_offline_pack` (the same
  live-grant check, and packs per course since the grant began within
  its limit), `search_question_bank_ids`, `save_quiz`.
- **Sign-in and payments** (server only): `check_login_rate_limit`,
  `check_reset_rate_limit`, `check_payment_rate_limit`,
  `log_auth_event`, `log_reset_request`, `mark_reset_used`.
- Housekeeping triggers: timestamps, lowercasing the email, writing the
  question history, copying a package's limits onto a receipt.
