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
| `pool` | The one place it belongs: `practice`, `free`, `paper` or `mock` (06.8) |
| `version` | Goes up by one on a content change to a published question |
| `created_at`, `updated_at`, `updated_by` | When made, last changed, by whom |

- Two read rules: the course rule, and the free rule (03 F1, built
  2026-10-04) — any signed-in student may read a published question in
  the Free pool, in any course. Why: the free account practises on it.
- `pool` (06.8, ticked by Sam and built 2026-10-15; replaced
  `is_free_sample`): one per question, default `practice`, set by the
  admin in the editor and the importer. Filled once from the rows then:
  listed by a mock → `mock`, by a paper → `paper`, marked free → `free`,
  the rest `practice` (dev: 245 / 9,500 / 90 / 3,210, none in two). A
  paper's list (`quiz_items`) takes only `paper` questions and a mock's
  (`mock_quiz_items`) only `mock` ones, and a question either lists
  cannot change pool (triggers). The Builder and packs read `practice` and
  `free`, the free set `free`, the daily challenge `practice`;
  `create_attempt` refuses a builder sitting holding any other. The
  history keeps `pool`. Prod: the bank is copied from `public.*` at going
  live; the same fill runs there. Why: a question's place is its own, not
  worked out from which papers and mocks list it today — that leaked on
  archive (04.21) and whenever a list changed (Sam, 2026-10-15).
- Browser: a student reads only `item_id`, `course_id`, `subject`,
  `maintopic`, `subtopic`, `difficulty`, `question_type`, `batch_id`,
  `is_published`, `pool`, of published questions in courses
  they hold or marked free — never the question or its answer; a
  signed-out visitor reads nothing. Writes through the
  server only.

### `question_bank_history` — past versions
- A copy of a question's columns each time a published question's
  content changes, plus `changed_by`, `changed_at`, and `deleted` (the
  copy kept when it was deleted).
- Browser: nothing.

### `question_reports` — students' reports of a mistake in a question
| Column | Holds |
|---|---|
| `report_id` | The report |
| `item_id`, `course_id` | The question (→ `question_bank`) and its course |
| `attempt_id` | The sitting it was sent from (→ `attempts`; emptied if the sitting goes) |
| `user_id` | The student (→ `users`) |
| `reason` | One of six words: `answer_wrong`, `unclear`, `typo`, `picture`, `explanation`, `other` |
| `note` | The student's words, at most 1,000 characters; required for `other` |
| `chosen` | The student's answer then, as `attempt_items.chosen` (a letter, or a comma list); empty if not answered |
| `status` | `new`, `fixed` or `dismissed` (no "reviewed": no button set it — Sam, 2026-10-17) |
| `created_at` | When sent |
| `closed_by`, `closed_at` | The admin who marked it fixed or dismissed, and when — set with the close, empty while new |

- Built 2026-10-17 (06.2, ticked by Sam that day). **One open report per
  student per question** (a unique index on the `new` ones). Written by
  `report_question()`, which checks the question is in the student's own
  sitting and still in the bank; closed by `close_question_reports()`,
  every open report of one question at once; read by the admin's page
  through `question_report_groups()`, with its options and answer: on
  the Open tab one row per question, most reports first; on Closed one
  row per close (a question's reports closed together), newest first,
  with who closed them. All three server only. No copy of the question's
  text.
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
| `first_mode` | The mode a student's first sitting of the paper must be in — one of `allowed_modes`, Free Navigation on a new paper; the other modes open once a sitting in it is completed (04.5, built 2026-10-12) |
| `shuffle` | Whether questions are shuffled |
| `time_limit_sec` | An exam's time limit, if set |
| `status` | `draft`, `active` or `archived` |
| `published`, `publish_at`, `unpublish_at` | Published, and its window |
| `notes` | The admin's notes |
| `created_at`, `updated_at` | When made, last changed |
| `open_in_trial` | The one paper of its course a trial opens; at most one per course |
| `sittings_allowed` | How many sittings a student may make of the paper, every mode together; empty = no limit (04.10, built 2026-10-14) |

- `open_in_trial` (03 F4, built 2026-10-04): the database refuses a
  second in a course. Why: the trial opens one paper a course, chosen by
  the admin. Set by hand for now; the paper editor gets the tick with
  its redesign *(to build: 03.1)*.
- Browser: a student reads open, published papers of courses they hold
  — every column but `notes` and `open_in_trial` (no page reads it yet).
- `first_mode` (04.5, ticked 2026-10-11, built 2026-10-12): a check
  keeps it inside `allowed_modes`; students read it, as they read
  `allowed_modes`. Papers whose modes lacked Free Navigation took their
  first exam mode, else their first allowed mode. Why: the first sitting
  is the honest measure, and the admin can change the mode if the
  official exam changes (Sam, 2026-10-11). `save_quiz` writes it (an edit
  that sends none keeps the stored one; a new paper takes Free
  Navigation); the admin sets it from "First sitting in" beside the mode
  ticks (2026-10-12).
- `sittings_allowed` (04.10, ticked 2026-10-14, built the same day): a
  whole number above 0 (a check), empty on every paper when added.
  `create_attempt` refuses a sitting once the student's sittings of the
  paper — in progress, completed or abandoned — reach it ("You have used
  your 2 sittings of this paper."), and, with a limit, while one of them
  is in progress ("Finish or resume your sitting in progress first." —
  one sitting at a time, Sam 2026-10-14); a retake counts. `save_quiz`
  writes it; students read it. Why: papers and mocks carry the same
  settings (Sam, 2026-10-13).
- `results_at` (04.12, ticked 2026-10-14, built 2026-10-15): a date and
  time; empty = Immediately, as on every paper when added. Until then
  the score, the report, the answers and the explanations of every
  sitting of the paper are held (a sitting submitted after the date is
  not); while they are held, `create_attempt` refuses a sitting in a mode
  other than `first_mode` (a retake too) and `check_answer` refuses, and
  `first_mode` must be an exam mode (a check). How many sittings stays
  `sittings_allowed`'s (Sam, 2026-10-15: no rule of its own). `save_quiz`
  writes it (empty clears it); students read it. The hold is the
  database's: see `attempts` and `attempt_items` below, and
  `student_attempts()`. Why: papers and mocks carry the same settings,
  and a mock reused across groups needs its answers kept from the next
  group (Sam, 2026-10-13, 04).
- `review` and `review_closes_at` (04.13, ticked 2026-10-15 in place of
  `review_days` — ticked 2026-10-14, never built — and built the same
  day; migration `20261015120000_review`):
  - `review` — `always` (the default, on every paper when added), `until`
    or `never`: whether a student may go through a finished sitting's
    questions with their answers.
  - `review_closes_at` — a date and time (Ghana time), set with `until`
    only (a check). One date for every student, independent of
    `results_at` (Sam: the review closes on its own date, not N days after
    results); a check refuses it on or before `results_at`, and `never`
    with Learning among the modes (Learning shows each answer).
  - While the review is closed (`never`, or `until` and the date has
    passed): the score and the report's summary, its topic breakdown
    included, stay; the question-by-question review and the question map
    close; `create_attempt` refuses Learning and `check_answer` refuses
    (Sam: only Learning shuts — the other modes show the summary only); a
    finished sitting's `attempt_items` rows are not readable by its owner.
    Live, not copied to a sitting (Sam, 2026-10-15): a change reaches
    sittings already taken, and the form says so.
  - `save_quiz` writes both; students read both.
  - Why: papers and mocks carry the same settings, and a mock reused
    across groups needs its answers kept (Sam, 2026-10-13/15).
- The close (04.14, built 2026-10-15, no column): a sitting still in
  progress when its paper's `unpublish_at` passes, with no clock running
  (an untimed mode, or an exam never started), is finished at the close on
  what was answered — or Abandoned there with no answer (Sam) — when it is
  next opened (`expire_attempt`); `save_answers`, `check_answer`,
  `finish_attempt` and `start_timed_attempt` refuse it ("This paper has
  closed."). A timed sitting already running keeps its own clock.
  `student_attempts()` returns `closes_at`.

### `quiz_items` — a paper's questions
| Column | Holds |
|---|---|
| `quiz_id`, `course_id` | The paper |
| `item_id` | The question → `question_bank` (its own course only) |
| `position` | Its place in the paper |

- A question a paper uses cannot be deleted.
- Browser: nothing.
- A paper lists only Paper-pool questions (06.8, 2026-10-15) — replacing
  04.6's "held back while a draft or active paper uses it" (2026-10-11).
  Why: a paper's questions are met first in the paper (Sam, 2026-10-11).

### `mock_quizzes`, `mock_quiz_items` — mock exams and their questions
- The same columns as `quizzes` and `quiz_items`. `visibility` (`ALL`,
  `PAID` or `TRIAL`, stored, never checked) was dropped (10.17, ticked
  2026-10-04, built 2026-10-15) — the package's mock yes / no is the gate.
- `first_mode` and `sittings_allowed` (04.11, 04.10, ticked 2026-10-14,
  built the same day): as on `quizzes` — Free Navigation on a new mock,
  the two mocks there were taking Free Navigation; `create_attempt`
  refuses a mock's other modes until a sitting in its first mode is
  completed ("Finish your first sitting of this mock …"), and holds its
  limit as a paper's; `save_quiz` writes both; students read both.
- `results_at` (04.12, ticked 2026-10-14, built 2026-10-15): as on
  `quizzes`, under the same rules, written by `save_quiz`.
- `review` and `review_closes_at` (04.13, ticked and built 2026-10-15):
  as on `quizzes`, under the same rules. The close (04.14, built
  2026-10-15) as for papers.
  Why: as on `quizzes`.
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

- *To build (04 G2) — ticked 2026-10-08:* a `source` value
  `challenge` and a mode of its own (Untimed's screen, timed by the
  server from Start to Submit, closed at its limit); a challenge sitting
  names the day's draw, and one per student per day. Why: the daily
  challenge (Sam, 2026-10-08).
- Indexed by student and date, newest first (`user_id`, `ts_iso`):
  the order Learning History lists a student's sittings in, twenty at a
  time, and its figures read them (05 Q12; ticked and built 2026-10-17).
- Browser: the owner and an admin read every column but the three
  scores (04.12, 2026-10-15); every write through the database's own
  functions. A student's pages read their sittings, scores included,
  through `student_attempts()` with the service role: the score empty
  while the paper's or mock's results are held, with the date and
  `held`, and the review setting with `review_closed` (04.13). The admin's pages read the table with the service role and
  see every score.

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
  through Check Answer and the review (the seal). A finished sitting
  whose results are held, or whose review is closed, is not readable by
  its owner at all (04.12, 04.13, 2026-10-15: the policy asks
  `_my_sealed_attempt_ids()`); the report reads the rows with the service
  role for its summary.

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
| `status` | `active` or `deleted` (07.7; archived is never set) |
| `created_utc`, `updated_utc` | When made, last changed |

- Browser: the owner and an admin read; writes through the server only
  (rule 9, 2026-10-15: the insert and update policies dropped).
- **Delete** (07.7, ticked and built 2026-10-15): the server sets
  `status` to `deleted`; a deleted pack leaves My packs and no longer
  opens, but its row stays and still counts against the allowance. Why: a
  student may delete a pack without getting the allowance back (Sam).
- **The allowance** (07.1, built 2026-10-15): `pack_allowance(user,
  course)`, server only — the course's live grants and the best of them
  (unlimited if any has no count, else the most left); every pack made
  since that grant began counts. `create_offline_pack` and the pages ask
  it; Config's `offline_packs_per_course` is retired.
- `create_offline_pack` refuses a question outside the Practice and Free
  pools (06.8).

### `offline_pack_items` — a pack's questions
- A copy of each question with its options and answer, and its
  `position` — **no explanation, picture or per-option feedback** (07.6,
  ticked and built 2026-10-15: those columns dropped, the packs already
  made lost theirs, `create_offline_pack` no longer copies them). Why: a
  pack leaves our control — a PDF is forwarded, a phone can be copied
  (Sam).
- Browser: the owner reads.

---

## Help and news — 08

### `announcements` — notices
| Column | Holds |
|---|---|
| `announcement_id` | The notice's id |
| `title`, `body_html`, `body_text` | The title; the body as written and as plain text |
| `kind` | The notice's kind, a name from `announcement_kinds`; News when none is picked |
| `picture_path` | Where its picture sits in the bucket `licensure-gh-announcement-images` (the list's square and the opened notice's size); empty when none |
| `status` | `draft`, `active` or `archived` |
| `start_at`, `end_at` | When it shows |
| `pinned`, `priority` | Order |
| `dismissible` | Whether ✕ is offered |
| `must_see` | Also pops up once on the dashboard (08.8) |
| `send_to_devices`, `sent_at` | Also sent as a device notice; when it went, so it goes once, when the notice goes live (08.15) |
| `scope_audience` | `ALL` or `STUDENTS` |
| `scope_programs`, `scope_courses`, `scope_level`, `scope_subscription_kind`, `scope_product_ids`, `scope_cohort`, `scope_user_ids` | Who it is for (lists, the subscription kind `PAID`, `TRIAL` or `FREE`); a student must match every scope set; a course scope reaches whoever has held one of its courses (08.1) |
| `created_at` | When made |

- Built 2026-10-18 (A1, ticked 2026-09-18; the redesign's columns ticked
  by Sam 2026-10-18; `20261018120000_announcements_floor.sql`): read only
  through `announcements_for_me()` — every scope checked in the database,
  the named students never leaving the server; the status, audience and
  subscription-kind words checked; `scope_level` a list; `kind` keyed to
  `announcement_kinds` on its name, on update cascade.
- With the new editor (08.14): `body_html` and `body_text` give way to
  one body, its form chosen with the editor (its own tick then).
- *Needs Sam's tick before the build (08.16, written 2026-10-18):*
  `ask_confirm` — yes or no: the opened notice shows "I've read this";
  Must-see always asks (`must_see` implies `ask_confirm`, checked).
  Why: Seen is "shown on screen"; a notice that matters needs the
  student to say they read it.
- Browser: nothing — the admin's page reads and writes through the
  server.

### `announcement_kinds` — the admin's list of kinds
| Column | Holds |
|---|---|
| `name` | The kind as students see it — "Exam date"; unique; a notice's `kind` points here |
| `icon` | One icon from the app's set, picked by the admin from a grid |
| `position` | The kind's place in the editor's list |
| `active` | No: retired — no longer offered for a new notice; notices that use it keep it |
| `created_at` | When added |

- Built 2026-10-18, the table (ticked by Sam that day; 08.13 — Sam: "the
  examples given may not be enough"): a rename reaches every notice
  inside the database (the key is the name, on update cascade, as the
  bank's topics, 08 B5); a kind in use cannot be deleted, only retired;
  one name per kind whatever its case. Started with Exam date (calendar),
  New questions (book), Offer (tag), Alert (alert) and News (megaphone).
  The admin's page to add, rename, re-icon, order and retire them is
  08.13, to build.
- Browser: nothing — the student's reader hands each notice its kind's
  name and icon; the admin's page reads through the server.

### `user_notice_state` — what each student did with a notice
| Column | Holds |
|---|---|
| `id` | The row's number |
| `user_id`, `item_type`, `item_id` | Who, and which notice (`ANNOUNCEMENT`, keyed to the notice) |
| `seen_at` | **Seen** — when the notice first showed in full |
| `tapped_at` | **Tapped** — the first tap on its button (sets Seen too) |
| `dismissed_at` | **Dismissed** — when the student dismissed it |

- Built 2026-10-18 (A2, ticked 2026-09-18; named by Sam 2026-10-18 after
  the follow-up's words; `20261018120000_announcements_floor.sql`): each
  date set once, never cleared, by `notice_mark()` only — the student's
  own notices, Dismiss only where it is allowed. The overwritten word
  (`state`) and `updated_at` went; old rows kept their date as Seen, a
  clicked one as Tapped too, a dismissed one as Dismissed. A Must-see
  notice pops up while Seen is empty (08.8).
- *Needs Sam's tick before the build (08.16, written 2026-10-18):*
  `confirmed_at` — **Read (confirmed)**: when the student pressed "I've
  read this", set once, never cleared, only on a notice that asks to
  confirm. A Must-see notice then pops up while `confirmed_at` is empty
  (Later hides it until the app is next opened), no longer while Seen is.
- Browser: nothing — a student's marks come with their notices.

### `messages_threads` — conversations
| Column | Holds |
|---|---|
| `thread_id`, `user_id` | The thread and the student |
| `status` | `open` or `closed` |
| `context_type`, `course_id` | The label — `payment`, `account`, `technical`, `course`, `other` — and the course, set exactly for `course` |
| `last_message_at`, `last_sender_role` | The latest message, and whose (`student` or `admin`) |
| `student_read_at`, `admin_read_at` | When each side last read it: unread = the other side's message after it |
| `created_at` | When opened |

- Built 2026-10-17 (08.2, ticked 2026-09-18 and 2026-10-17): the read
  stamps (filled from the old flags), the five labels (old `general`
  threads became `other`; the `question` threads were deleted with their
  messages, Sam), the leftover columns dropped (`subject`, `admin_id`,
  `quiz_id`, `question_id`, `attempt_id`, `bulk_batch_id`, `ref_text`),
  checks on the words, and the table in the live feed so a close reaches
  an open page. A new message goes to the newest open thread of its label
  (a course's: that course) or a new one — not a unique index: a reply
  into an older closed thread reopens it even when its label has another
  open thread.
- Every write is a server-only function: `msg_student_send` (into the
  student's own thread, or by label — the "Message us" box's one trip),
  `msg_admin_send`, `msg_admin_start` (New Thread), `msg_set_status`,
  `msg_mark_read`, and the badges `msg_unread_count` and
  `msg_admin_unread_count`; ids are made there (`THR_`/`MSG_` + 16 hex).
  The admin's list of students is `msg_admin_students()` (built
  2026-10-17, 08.2 step 4): one row per student, grouped and paged in the
  database, waiting first; an index on the waiting threads serves it. A
  wait is timed from the student's first message after Quademia's last
  reply in that conversation, so writing again does not move them down
  (Sam, 2026-10-17; `20261017210000_admin_messages_wait.sql`).
- Browser: SELECT only — the student their own threads, an admin all.

### `messages` — the messages
| Column | Holds |
|---|---|
| `message_id`, `thread_id` | The message and its thread |
| `sender_id`, `sender_role` | Who sent it: `student`, `admin`, or `system` for the line "Reopened by a reply." |
| `body_text` | The text, at most 2,000 characters (new messages; old rows unchecked) |
| `created_at` | When sent |

- Built 2026-10-17 (08.2): the read flags dropped (the thread's stamps
  replace them); a message cannot be changed once written (a trigger);
  written only by the functions above — a reply into a closed thread
  writes the reopen line first.
- Browser: SELECT only — the thread's student and an admin.

### `notification_devices` — the phones and computers that said yes to notifications
| Column | Holds |
|---|---|
| `device_id` | The row |
| `user_id` | Whose device (→ `users`) |
| `session_id` | The sign-in it was allowed under (→ `sessions`) |
| `endpoint` | The device's delivery address at its maker's post office (Google, Apple, Mozilla); one row per address |
| `key_p256dh`, `key_auth` | The browser's two keys that seal each envelope |
| `kinds` | What it is sent: `reply` (a student), `student_message` (an admin); a later kind is added to the check, each Sam's call |
| `created_at` | When it said yes |
| `last_sent_at` | When a notice was last handed to its post office |

- Built 2026-10-17 (08.5b, ticked by Sam that day;
  `20261017230000_notification_devices.sql`). No message text, phone
  number or place. A sign-out or a bump by the two-device limit deletes
  the device's row as the sign-in ends (a trigger on `sessions`); the
  week running out keeps it, and the next sign-in of the **same** person
  on that phone takes it over (`notify_device_relink`) — another person
  must say yes themselves. One person per address: a new person's yes
  moves the row to them with only their kind (`notify_device_save`, which
  checks the sign-in is theirs and live). The admin's switch off drops
  the kind, the row going with its last (`notify_device_drop_kind`). A
  notice goes to `notify_targets()` — a student's own devices, or every
  admin's — never a deactivated account's; an address the post office
  calls gone (404, 410) is deleted. All four functions server only.
- *Needs Sam's tick before the build (08.15, written 2026-10-18):*
  `kinds` gains `announcement`; whether a student's yes to replies
  brings it or it asks its own yes is open (08).
- Browser: nothing.

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
- *To build (04 G2) — ticked 2026-10-08:* a setting for the daily
  challenge's number of questions, 5 to start; its time limit uses
  `builder_minutes_per_question` (Sam, 2026-10-08).
- `offline_packs_per_course` retired (07.1, 2026-10-15): the package
  says how many packs per course.
- `offline_checkin_days` (07.3, 2026-10-15) — how many days a phone keeps
  its offline packs open without connecting; 30 to start. My packs and Save
  to this phone hand it to the phone. Why: a phone signed out while offline
  cannot know it until it connects (Sam, 2026-10-15).
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
- **The email outbox** (10.2) — needs Sam's tick at the build.
- **The badges already shown** (05 G3) — needs Sam's tick at the build.
- **The daily challenge's draw** — *ticked 2026-10-08 (04 G2)*: one
  row per programme per day — the date, the programme, the course, the
  questions in order, and any voided — made by the first student to
  open that day's challenge and fixed after. Read only through the
  database's own functions; no browser access.

## The database's own functions

Every write a student makes, and every grade, happens inside these;
the browser can call only the first two lines and
`announcements_for_me()`.

- **Who is asking**: `auth_user_id()`, `auth_user_role()`.
- **The gate**: `my_course_access()` (each course's latest live end),
  `user_has_course()`.
- **The sitting** (server only): `create_attempt`, `start_timed_attempt`,
  `save_answers`, `check_answer`, `advance_attempt`, `finish_attempt`,
  `abandon_attempt`, `expire_attempt`; grading inside (`grade_answer`).
  `create_attempt` applies the package's limits to a student with a live
  grant for the course — a paper only on all papers or the ticked one, a
  mock only with mocks, builder quizzes within the count (retakes free);
  the most generous of two grants wins. A paper's or mock's first sitting
  in its `first_mode`, then the other modes; within its `sittings_allowed`,
  one sitting at a time (04.5, 04.11, 04.10). Without a live grant it allows
  only a builder quiz (or its retake) of published free questions, in a
  course of the student's programme, in a Study mode. A grant whose
  builder count is used up still allows a builder quiz of published
  free questions of that course, in a Study mode — what a free account
  gets, so a trial student past 3 quizzes never has less (04.4; ticked
  and built 2026-10-11). A paper's sitting (or its retake) in a mode
  other than its `first_mode` is refused until the student has a
  completed sitting of that paper in the first mode — abandoned or
  unfinished does not count (04.5, 2026-10-12).
- **The dashboard** (server only, reads only): `student_dashboard` — one
  student's numbers in one read: the streak (a study day is one answer,
  the UTC day; one missed day a week, Monday to Sunday, forgiven; today
  never breaks it), questions met and mastered (right the first time
  met, not in under 5 s), the weakest topic (from 20 answers, at least 5
  in the topic), questions met of each course's published bank, the
  latest unfinished sitting, and a recap inside a window the page passes
  (05.4, G1a; built 2026-10-04).
- **The history's figures** (server only, reads only):
  `student_history_figures(student, course or all)` — one row: the
  sittings (every status), the average and the best score of finished
  sittings (read through `student_attempts()`, so a held one is left
  out until its date), and the count by kind — practice papers, mocks,
  quiz builder, free practice (a builder quiz all of whose questions are
  published questions of its course in the Free pool, judged by today's
  pool). A retake counts as its original's kind: its paper or mock when
  it has one, else the builder. The true totals over the whole history
  (05), counted in one trip (05 Q12; ticked and built 2026-10-17).
- **Packs and the bank** (server only): `create_offline_pack` (the same
  live-grant check, and packs per course since the grant began within
  its limit), `search_question_bank_ids`, `save_quiz`.
  `search_question_bank_ids(course, word, free only)` matches the word
  from the start of a word in the question, its rationale, its main
  topic or subtopic ("malar" finds malaria, "iron" not environment),
  published questions only, and with the third argument the free ones
  only — both builders' keyword (04.4; ticked and built 2026-10-11).
- **Announcements** (A1, A2, 08.1; built 2026-10-18):
  `announcements_for_user(person, course)` (server only) — the notices a
  person should see now, in order (pinned, priority, newest), with their
  own marks and the kind's icon; every scope checked: audience,
  programme, level, cohort, the subscription kind and package of their
  latest live receipt (FREE when none), named students, and courses —
  whoever has held one, live or ended, revoked grants apart; with a
  course, only that course's news. `announcements_for_me(course)` — the
  same for the signed-in caller, the one a student's session may call.
  `notice_mark(person, notices, mark)` (server only) — seen, tapped or
  dismissed, each set once. `announcement_marks_counts()` (server only) —
  seen, tapped and dismissed per notice, for the admin's page.
  The rule is written once (08.11, 08.12; built 2026-10-18,
  `20261018200000_announcement_followup.sql`, server only):
  `notice_people(person or all)` — the facts the scopes read; 
  `notice_scope_ok(…)` — the eight scopes against those facts, used by
  the student's reader and by `announcement_reach_counts()` (each notice's
  reach today: the active students it matches, whatever its status),
  `announcement_reach_preview(scopes…)` (the editor's "This will reach N
  students today") and `announcement_followup(notice)` (everyone reached
  today and everyone with a mark: name, programme, kind, last sitting,
  reached, the three dates).
- **Notifications** (server only; 08.5b, built 2026-10-17):
  `notify_device_save`, `notify_device_relink`, `notify_device_drop_kind`,
  `notify_targets` — see `notification_devices`.
- **Sign-in and payments** (server only): `check_login_rate_limit`,
  `check_reset_rate_limit`, `check_payment_rate_limit`,
  `log_auth_event`, `log_reset_request`, `mark_reset_used`.
- Housekeeping triggers: timestamps, lowercasing the email, writing the
  question history, copying a package's limits onto a receipt.
