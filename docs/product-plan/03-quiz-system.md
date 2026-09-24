# Quiz System — fixed quizzes, mock exams, the builder, the runner

The living plan for this feature (Sam, 2026-09-19: the feature docs
`00–07` hold what a feature does today, what the diagnosis found,
Sam's rulings, and the sliced plan). Written for the port as a
description of the legacy product on 2026-09-12; rewritten into this
shape on 2026-09-19 by Claude. Git holds the earlier text.

Sources it leans on: `post-rebuild-diagnosis.md` (D1–D12 the runner
and attempts, D44–D45 and D48 the quiz tables), `rebuild.md` §8 rows
S7 (attempts) and S12 (the quiz floor), `mock-exams-reference.md`
(gamma's description of the mock exam as built). The slice ids here
(`Q1`, `Q2`, …) are the ids `BUILD_LIST.md` uses under this doc's
section.

---

## 1. What it does today

### Two quiz types

**Fixed quizzes** — created by an admin from the question picker, with
a set list of questions (`item_ids`). Every student who takes one gets
the same questions. Used for structured practice: "Week 3 Anatomy
Quiz".

**Mock exams** — a second table with the same shape (`mock_quizzes`),
born in gamma on 2026-03-21 as a copy of the quiz table plus a
`visibility` column (ALL | PAID | TRIAL) that no page has ever set or
read. Today a mock exam behaves exactly like a fixed quiz. **Sam's
intention (2026-09-18):** the mock was meant for premium members as an
exam-period experience, different from a quiz. That experience is
designed, not built — see §4, Q3.

**Custom quizzes (Quiz Builder)** — built by the student on the spot:
a course, topics or a concept search, difficulty, a question count up
to `builder_max_questions`, a mode. The bank picks the questions; every
build is different.

### Two modes

**Instant (practice)** — feedback after each answer: the correct
option, the rationale, per-option feedback, an optional rationale
image. **Timed (exam)** — a countdown, no feedback, submit at the end
or auto-submit on time-out; review afterwards. The time limit is the
quiz's `time_limit_sec`, or one minute per question when unset.

### Availability

A quiz is shown and can be started only when `status = 'active'`,
`published = true`, and now is inside `publish_at … unpublish_at`.
Outside the window the card says UPCOMING or CLOSED. The state machine
is one function, `lib/quizzes/availability.ts`, used by the list
pages, the course page and the attempt spawn. Since the port, Start
runs on the server and refuses what the card would only grey out.

### Starting

*Fixed or mock:* the course accordion on the list page → a card with
title, count, the modes offered, the schedule line, and per mode the
student's stats and Start / Resume / Abandon / Retake / Review →
`spawnQuizAttempt` creates the attempt (one in-progress slot per quiz
per mode) and opens the runner. *Builder:* five steps, then Build
opens the runner at once.

### The runner

Questions in pages (`runner_questions_per_page`), the question grid,
flags, autosave every `runner_autosave_interval_sec`, resume of an
in-progress attempt, the pre-submit summary, the score screen. MCQ
(A–F), True/False (never shuffled), SATA (exact set). Retake copies
the attempt's own item order, so a mock cannot be re-rolled.

### Attempts and history

Every sitting is an `attempts` row: the item ids in order as one
comma-joined text, the answers as one JSON string (each record carrying
a second copy of the correct answer), the score, the time, in-progress
or completed. The runner re-reads the live bank by those ids on every
open and receives every column of every question. The student's own
browser holds INSERT and UPDATE on the row. Learning History lists
them all with Resume / Review / Retake and filters. The restructure is
`rebuild.md` §8 S7, ticked 2026-09-18 and sliced here on 2026-09-20 as
Q4–Q6.

### Offline packs

A course's questions as a downloadable pack — [06-offline-packs.md](06-offline-packs.md).

---

## 2. What the diagnosis found

One line each; the full text with proof is in
`post-rebuild-diagnosis.md`.

- **D44 — every signed-in account reads every quiz and mock exam,
  question ids included.** The SELECT policies on both tables are
  "any signed-in user". Proven on dev: an RN student reads the RM
  quizzes and all 45 mock question ids. The pages filter in
  TypeScript and hand the browser the rows whole, `item_ids` and the
  admin-only `notes` included. Reaches every student.
- **D45 — the lifecycle rules disagree with each other.** Retake skips
  the availability check; the list page uses the phone's clock and
  Start the server's; archive ↔ active is a two-way toggle, so a
  restored draft becomes active; `saveQuiz` never checks `status` or
  `allowed_modes` and no CHECK pins them; the attempt-stats box
  merges the two tables and counts retakes and abandons; the mock
  admin list loads the whole table and caps silently; an in-progress
  attempt on a mock that closes is orphaned.
- **D48 — residue.** `visibility` never set or read (kept, see §3);
  `n` has no default on `mock_quizzes`; no CHECK on any status word;
  doc 03 had no mock exams.
- **D5 — the runner hands every answer to the browser.** The page
  loads the questions with every column and passes them to the client
  runner, so the key and the rationale for every question are in the
  page before the student answers. Timed mode hides them on the
  screen, not from the browser. Reaches every paying student; the
  cost is exam integrity, the product's central claim.
- **D6 — `answers_json` stores the correct answer a second time.** The
  server never trusts the copy (it recomputes at submit), so its only
  effects are the leak on a resumed timed attempt and a drifting
  duplicate if the question is ever edited.
- **D7 — a student can write their own attempt row, including the
  score.** The policies are row-scoped, not column-scoped, and the
  browser holds a live database client. Nothing rides on the score
  today, but it silently corrupts the admin Attempts analytics.
- **D12 — a saved offline pack is a pointer list, not a snapshot.** The
  renderer follows the ids back to the live bank on every open: an
  edited question changes the pack, a deleted one vanishes from it,
  and the renderer already apologises for the missing count.
- **The analytics parse the blob.** The admin Attempts page reads every
  answer JSON in app code and gives up at 5,000 rows; "which questions
  does everyone fail" is not a query today.
- **The legacy-check gaps 1 and 2** (the autosave timer restarts on
  every answer, so steady answering never saves; a dropped connection
  at Submit leaves the spinner forever) sit on the same save path.

---

## 3. Rulings (Sam, 2026-09-18)

- **The two tables stay two.** The merge into one table with a `kind`
  was proposed and withdrawn: the mock is a different product whose
  experience was never built, and one table would bake the accident
  in.
- **`visibility` is kept**, no longer as residue but as the flag for
  the premium gate the mock exam was meant to have (D48 amended).
- **S12, the floor:** course-scoped SELECT policies on active,
  published rows; `item_ids` and `notes` leave the browser roles'
  reach; CHECK constraints on the status words. Ticked into
  `rebuild.md` §8.
- **The lifecycle rules (D45) as recommended**, code beside the
  migration: one availability check on the server's clock, archive
  one-way with restore landing on `draft`, `saveQuiz` validating,
  stats keyed by table, the mock list paged.
- **Mock exams as a premium exam experience** is a design item on
  BUILD_LIST — ingredients noted, none decided (§4, Q3).

### Rulings on S7 (Sam, 2026-09-20)

Read against MyNclex's attempt tables, its seven attempt functions and
its session page (read through `gh api` on 2026-09-20; we built it,
and its record says where it later corrected itself).

- **One row per question, one table.** The question snapshot and the
  student's answer share a row in `attempt_items`; the separate
  `attempt_answers` table of the diagnosis's draft is not built. The
  reasons for two tables (write-once versus write-often, the seal on
  one table, small autosave writes) all hold on one table once every
  write is a server function; MyNclex's own record agrees — it later
  put a mutable flag column on its snapshot table, fused the two into
  one row for note-embedded questions, and fixed a bug (a finished
  attempt with no answer row for an unreached question) that one row
  per question from creation cannot have.
- **Two clock columns on the header**, `started_utc` and `ended_utc`,
  instead of overwriting `ts_iso` at the timed start and using
  `time_taken_s = 0` as the "started" flag. `ts_iso` keeps its meaning
  as "created".
- **Grading inside the database function.** Three question types, so
  the function reads the key and grades; the browser never supplies a
  score. MyNclex grades in TypeScript and bounds the number in the
  function because it has nine types; not needed here.
- **The secret half revoked from the browser role**, not only sealed at
  the page. MyNclex seals at the page and accepts that a student with
  the console open can query their own rows for the key mid-exam; for
  a timed mock exam the second door is closed too. The server reads
  those columns with the service role after its ownership check.
- **Every S7 function is callable by the service role only.** The
  Server Actions gate with `requireStudent()` and pass the user; the
  browser role holds SELECT and nothing else on every attempt table
  (the `course_access` shape, "no browser write path").
- **SATA stays all-or-nothing through S7.** `marks` and a numeric
  `score_awarded` already hold what partial credit needs; the rule and
  the three-state display are a later slice (Q7), so S7's walk compares
  like for like.
- **Discard keeps the rows.** An abandoned attempt keeps its answers;
  "I am not going back to this" is not "this never happened" (MyNclex
  reversed a hard delete on 2026-09-01 for this reason).
- **Retake copies fresh from the live bank** in the original's order:
  a new sitting records what it was shown today; the old one keeps
  what it saw.
- **Order: the tables first, then the write door, then the seal** (the
  diagnosis staged it seal-first). The seal then lands once, on the new
  table, instead of on the bank read and again a slice later.

---

## 4. The plan

Each slice ends with Sam testing it at `localhost:3000`. A slice that
changes a table names its §8 row. Ids are this doc's own.

### Q1 — The floor (S12, D44, D48)

**Storage, one migration.**

- `quizzes_select` and `mock_quizzes_select` become
  `auth_user_role() = 'ADMIN' or (status = 'active' and published and user_has_course(course_id))`.
  A student reads only the open quizzes of the courses they hold;
  drafts and archived rows are the admin's alone.
- `item_ids` and `notes` leave the browser roles' reach: SELECT on
  both tables is revoked from `authenticated` and granted back on
  every column but those two (the S10 shape, column-level). The
  admin's cookie client is `authenticated` too, so **every read of
  `item_ids` or `notes` goes through the service role behind a gate**:
  the attempt spawn (`spawnQuizAttempt`, after `requireStudent()` and
  the access check it already makes), the admin edit step
  (`loadQuiz`), the whole-table admin reads (`loadAllQuizzes`, the
  mock admin list, the attempts analytics page). Nothing else reads
  them.
- CHECK constraints: `status in ('draft','active','archived')`,
  `allowed_modes in ('BOTH','INSTANT_ONLY','TIMED_ONLY')`,
  `mock_quizzes.visibility in ('ALL','PAID','TRIAL')`;
  `mock_quizzes.n default 0` like its sibling.
- The two snapshots updated.

**Code.** `getQuizzesForCourse` selects the columns the card renders
(`quiz_id, course_id, title, n, allowed_modes, shuffle,
time_limit_sec, published, publish_at, unpublish_at, status`) — never
`'*'`. The service-role reads above. The `Quiz` type splits into the
list row and the full row so a missing column fails the build, not the
page.

**Done when** (proven by SQL as a dev student, rolled back, then in
the browser): the RN student's read of `quizzes` returns only their
courses' active published rows and a read of `item_ids` is refused;
both student list pages still list the same cards; Start still opens
the runner with the right questions; the admin's Edit still loads the
question list and notes; the course page's quiz previews unchanged.

### Q2 — The lifecycle rules (D45, code only)

- **One availability check** on the server: `spawnQuizAttempt` and
  `retakeAttempt` both call it, on the server's clock. The list pages
  take `now` from the server render and pass it to the card, so a
  phone with a wrong clock shows what the server will allow.
- **Archive is one-way from any status; restore lands on `draft`.**
  A quiz is made active again only by an admin choosing it.
- **`saveQuiz` validates** `status` and `allowed_modes` against their
  lists before writing, as `saveAnnouncement` does; the CHECKs from Q1
  are the floor beneath.
- **The attempt-stats box** keys by `(source, quiz_id)` so a fixed
  quiz and a mock exam with the same id never mix, and shows retakes
  and abandons apart from first sittings.
- **The mock admin list pages** fifty at a time with an exact count,
  like the fixed one; the whole-table read goes.
- **Not in this slice:** an in-progress attempt on a mock that closes
  (D45 g) — answered by the premium design, where a closed window
  submits what is in progress; until then it stays as it is. The 5a
  fix that made admin Edit load the whole row (D45 h) — **kept (Sam,
  2026-09-19)**: Edit would otherwise open empty.

**Done when:** Retake on a closed or archived quiz is refused with the
Start message; a card's UPCOMING / CLOSED badge follows the server's
clock; an archived draft restored shows as draft; a save with a bad
status word is refused before the database sees it; the stats box on
a mock exam counts only that mock's attempts; the mock admin list
shows "Showing 50 of N".

### Q3 — Mock exams as a premium exam experience (design item)

Not sliced. Designed when Sam picks it. The ingredients noted on
2026-09-18, none decided: premium-only through S8's subscription
kind, gated by `visibility`; an exam window with one timed sitting, no
retake, no instant mode; results and review released together on a
date (S7's sealed attempt fits); standing against the cohort; notices
when it opens and when results land (announcements, the outbox); a
closed window submits whatever is in progress. Until it is designed,
both tables get the same fixes.

### Q4 — The questions as rows (S7; D12)

The read side. On screen nothing changes.

**Storage, one migration.**

- `attempt_items`: `attempt_item_id bigint identity`, `attempt_id →
  attempts` (cascade), `position` (unique per attempt), `item_id` (no
  key to the bank, on purpose: the snapshot is the truth); the public
  half `question_type, stem, option_a…option_f, marks,
  shuffle_options`; the secret half `correct, rationale, rationale_img,
  fb_a…fb_f`; the analytics columns `subject, maintopic, subtopic,
  difficulty`; the answer group `chosen` (a letter or a comma list, the
  bank's own convention), `flagged`, `sata_checked`, `time_spent_s`,
  `is_correct`, `score_awarded`, `answered_utc`, `graded_utc` — empty
  until Q5 writes them. Index on `(attempt_id, position)`.
- `offline_pack_items`: the same row without the answer group, keyed
  `pack_id → offline_packs`.
- `attempts` gains `started_utc` and `ended_utc`; backfilled from
  `ts_iso` for the timed rows already started, `ended_utc` left null
  for old completed rows (unknown).
- Grants: `revoke all` from the browser roles on both new tables, then
  SELECT to `authenticated` on every column but the secret half; the
  policy `attempt_id in (select attempt_id from attempts where user_id
  = auth_user_id())` or ADMIN, evaluated once per statement (the B1
  shape). `offline_pack_items` the same through `offline_packs`.
- `create_attempt(p_user_id, p_course_id, p_item_ids text[], p_mode,
  p_source, p_quiz_id, p_duration_min, p_display_label,
  p_origin_attempt_id)`: inserts the header and copies the rows from
  `question_bank` in one `insert … select … from unnest(...) with
  ordinality`, keeping the given order and dropping an id the bank no
  longer has (as `getItemsByIds` does today); raises if none resolve;
  returns the attempt id with its `n`. `create_offline_pack(...)` the
  same for a pack. EXECUTE revoked from the browser roles.
- **No backfill (Sam, 2026-09-20): the existing attempts and packs are
  deleted** — dev's 21 and 3, and prod's test sittings when the file
  runs there; D5 leaves both tables empty on launch day regardless. An
  old row would otherwise sit on the history pages with a Resume that
  finds no rows. `item_ids` and `answers_json` stay on the header until
  Q5.
- The two snapshots and `db/README.md` updated.

**Code.** The four creators (`spawnBuilderAttempt`, `spawnQuizAttempt`
for fixed and mock, `retakeAttempt`) and the pack builder call the
functions through the service role after their gates. `loadRunner`
reads the rows with the service role after CHECK 4 (ownership) and
passes them to the runner as it passes the bank rows today; the pack
renderer and Build Similar read `offline_pack_items`; the "missing
count" apology goes. `Item` for the runner becomes the row type.

**Done when:** a builder attempt, a fixed-quiz attempt, a mock attempt
and a retake each create their rows (proven by SQL: `n` rows in
`attempt_items`, positions 1…n, the retake's order equal to the
original's); a question edited in the bank after the attempt is
created leaves the attempt's row unchanged; a pack built today renders
from its own rows and survives a bank edit; as the dev student a
direct SELECT of `correct` on `attempt_items` is refused and a SELECT
of `stem` on another student's rows returns nothing; every runner page,
the review page and the pack renderer look as they do today.

### Q5 — The answers as rows and the write door (S7; D6, D7)

The write side. The blobs go; the browser stops writing.

**Storage, one migration.** Six functions, EXECUTE revoked from the
browser roles, each taking `p_user_id` and refusing a row the user does
not own or an attempt not in progress:

- `start_timed_attempt` — sets `started_utc` once, returns the stored
  value (idempotent, the second tab loses).
- `save_answers(p_attempt_id, p_rows jsonb)` — writes `chosen`,
  `flagged`, `sata_checked`, `time_spent_s`, `answered_utc` for the
  given rows; never the graded columns.
- `check_answer(p_attempt_item_id)` — instant mode's Check Answer:
  grades the one row in SQL (MCQ / TF: `chosen = correct`; SATA: the
  same set), sets `is_correct`, `score_awarded`, `graded_utc`, and
  returns the row's secret half.
- `finish_attempt(p_attempt_id, p_time_taken_s)` — grades every
  ungraded row (an empty `chosen` grades as wrong), sums `score_raw`,
  `score_total`, `score_pct`, sets `time_taken_s` (a timed attempt's
  from the server clock), `status = 'completed'`, `ended_utc = now()`.
- `expire_attempt(p_attempt_id)` — timed only; refuses while the
  server's clock is before `started_utc + duration_min`; grades as
  finish does with `ended_utc` = the true deadline, not the moment it
  was noticed.
- `abandon_attempt(p_attempt_id)` — `status = 'abandoned'`,
  `ended_utc = now()`, the rows kept.

Then the backfill of the answer group from `answers_json` for dev's
rows, `attempts.item_ids` and `answers_json` dropped, the student
INSERT and UPDATE policies on `attempts` dropped (SELECT own stays), a
CHECK on `status`, the two snapshots updated. §9 #17's "a late save
must not reopen a completed attempt" holds by the functions' status
check.

**Code.** The Server Actions become thin: gate, then one function
call. The runner saves per question half a second after the last tap
(the `runner_autosave_interval_sec` timer goes; the config key stays
until S13 reviews it) — gap 1 closed; a failed Submit, Save & Resume
Later or expiry shows the error as a toast and re-enables the button —
gap 2 closed; the timed page expires an overdue attempt on load, so a
closed tab is finished on its next open. `hydrateAnswers` reads the
rows, `buildAnswersJson` and `recomputeAnswers` go. The admin Attempts
detail reads the rows; the history and dashboard readers are
unchanged (they never read the blobs).

**Done when:** as the dev student a direct UPDATE of `score_pct` is
refused (permission denied) and a direct INSERT into `attempts` is
refused; an instant attempt's Check Answer grades one row and the score
screen's figures equal today's for the same answers; a timed attempt
started in one tab keeps its first `started_utc` from a second; a timed
attempt left open past its deadline is completed on the next open with
`ended_utc` at the deadline; a steadily answered attempt has its
answers saved within a second of each tap (rows read back by SQL);
pulling the network before Submit shows a toast and Submit works again
after; abandon leaves the rows; every figure on Learning History and
the admin Attempts page equals today's for the backfilled rows.

### Q6 — The seal (S7; D5)

- `SealedItem` (the public half plus the answer group) and
  `UnsealedItem` (plus the secret half); the live runner's props accept
  `SealedItem[]` only, so handing it the review list is a compile
  error.
- A live page sends the sealed rows. Instant mode's Check Answer reply
  carries the one row's secret half (Q5's function already returns
  it); on resume the page sends the secret half of the rows already
  graded, so feedback survives a reload; a timed sitting receives no
  secret half at all.
- The review page (`?review=1`, status completed) sends the unsealed
  rows, read with the service role after CHECK 4; admin preview the
  same.
- The browser-side scoring (`computeScore`, `isCorrectOption` on live
  rows) goes; the score screen shows what `finish_attempt` returned.

**Done when:** the page source of a live timed attempt contains no
rationale sentence and no `correct` value (the D5 half-minute check);
the same page after finish contains them; an instant attempt shows the
rationale only for questions already checked, and still after a
reload; a console query for `correct` on the student's own rows is
refused; tsc fails when a review list is passed to the live runner (a
one-line experiment, reverted).

### Later, under this doc

- **Q7 — SATA partial credit** (Sam, 2026-09-20): the rule first (a
  fraction of the options; MyNclex's plus-and-minus with a floor of
  zero; or all-or-nothing kept for mock exams), then the three-state
  display in the runner, the review page, history and the analytics.
  After S7, its own conversation.
- **The analytics by SQL:** "which questions does everyone fail" and
  the by-topic figures as queries over `attempt_items`; the admin
  Attempts page's 5,000-row cap goes. Its own slice once Q5 has the
  rows. The student's side of the same queries is Q10–Q13 below.
- **`quiz_items`** replacing the `item_ids` array — decided with S2
  (one items table), not before.
- **The legacy-check gap 7** (the builder's stuck status line) and the
  Learning History items on BUILD_LIST — runner and history work that
  belongs here when queued.

### The runner as a player (captured 2026-09-20; to be discussed when it comes up)

Sam's observation after S7: MyNclex's runner is a player — it reads the
attempt header (intent, mode, duration) and behaves, and does not care
where the attempt came from; the source changes only where Exit goes.
Now that a sitting carries its own rows, ours can be the same thing
cleanly. Captured here, not ruled; the conversation is for when it comes
up, after 08 B2.

**What the runner does today.** One component
(`components/runner/quiz-runner.tsx`) fed by two routes
(`/runner/instant`, `/runner/timed`) through one loader
(`lib/attempts/runner-load.ts`, the ten preflight checks). It obeys
the header: the mode decides practice or exam behaviour, `duration_min`
the clock, `display_label` the title, `status` live or review; the rows
give the questions and their order. It never reads the source — a
fixed quiz, a builder quiz, a retake and a mock play identically for
the same mode. Since Q5 it saves one patch per question half a second
after the tap; since Q6 it receives the public half of each row and a
secrets map the server fills (one question at Check Answer in
practice, none in a live exam, all in review). Admin preview runs in
memory and writes nothing.

**Where it falls short of the player, found 2026-09-20:**

- **The mode is in the URL as well as the row.** Two routes, one per
  mode, a leftover of legacy's two HTML pages; the loader bounces an
  attempt to the other route when they disagree (CHECK 6). MyNclex has
  one route, `/session/[attempt_id]`.
- **Exit always goes to Fixed Quizzes**, whatever the source — a
  builder quiz exits there too. Legacy did the same; MyNclex resolves
  the exit from the source.
- **The words are keyed by mode only** (`WORDS.instant` /
  `WORDS.timed`); nothing per source, so a mock is "Exam Quiz".
- **The first Check Answer waits on a cold Worker** (1.7 s seen on
  dev). Before Q6 the feedback was instant because the browser held
  the key; now it asks the server. A pending state on the option while
  the check is in flight.
- **The builders load a whole course into the browser** to filter and
  count (D9) — not the runner's, and it is 08 B2's; noted here because
  it is the one bank read left on the student side.

**What MyNclex's runner has that ours does not** (reference, not plan;
read 2026-09-20): one route; the exit resolved per source; an intent
(STUDY / EXAM) and five modes collapsing into three behaviours (per-
question submit with the rationale at once; answers saved as drafts
and everything revealed at finish; sequential, no going back); a per-
question-type component (nine types there, three here); the mobile
layout (a bottom bar, the grid as a sheet); a runner tutorial in a
no-writes sandbox; an engagement clock that pauses when the student
looks away. Its student-facing word is "session" or "sitting" while
its storage says attempt; ours says attempt on screen too (legacy's
word). Whether the screen word changes is a copy decision, mattering
most for the exam.

**Candidate slices, to be ruled on when the conversation happens:**

- **Q8 — the runner as a player.** One route, the mode and the exit
  read from the header (the exit per source: the builder back to the
  builder, a quiz to its list), CHECK 6 gone, the two pages one; the
  words per mode still. Small — an afternoon; no storage change.
- **Q9 — the Check Answer pending state.** The picked option shows it
  is being checked until the reply lands; a failure already toasts.
  Small.
- **With Q3's design, as instructions on the header the runner obeys:**
  results withheld until a date (the seal already knows how to hold the
  secret half back); no retake; one sitting in a window; a sequential
  mode (parked on BUILD_LIST as a new feature); the screen word for an
  exam sitting.

### Attempt reports and progress (captured 2026-09-24; candidates, none ruled)

Sam, 2026-09-24, after walking NMC Prep on his own account: plans made
before MyNclex was built may not have been built here, and MyNclex
"really breaks down attempts". Checked the same day against MyNclex's
code, this repo's docs, `legacy/` and the code. Written into the plan on
Sam's yes; nothing here is ruled or built.

**What a student gets today.** After an attempt: the score, a
percentage and a grade word (`lib/attempts/scoring.ts`, 80 / 70 / 50),
and the review — each question right or wrong with its rationale and
its topic › subtopic. Across attempts: Learning History's five figures
(total, instant, timed, average, best — over the loaded pages only,
BUILD_LIST), the per-quiz attempts and best on the quiz cards, the
dashboard's last five attempts. **Nothing breaks an attempt down** by
subject, topic, difficulty or question type, for the student or the
admin, and nothing shows progress over time. The only line that
mentions it is BUILD_LIST's parked "Student analytics", a gamma-era
leftover with no design behind it.

**A promise made and never kept.** The portal guide (`portal-guide-
client.tsx`: "Identify topics you repeatedly miss", "Monitor
improvement over time", "identify 1–2 weak topics") and the landing
page ("Review weak areas… watch your scores climb") promise what
neither this app nor legacy does. Legacy carries the same words, so
the live site makes the promise today.

**What the data already holds.** Every `attempt_items` row carries
`subject`, `maintopic`, `subtopic`, `difficulty`, `question_type` and
`marks`, copied from the bank at creation "for the analytics" (Q4), and
since Q5 its `is_correct`, `score_awarded` and `chosen` (null =
unanswered). On dev the bank's tagging is near-complete (one row in
5,281 untagged; two maintopics misspelt). So a breakdown by any of
those, for one attempt or across a student's history, is **queries
only — no storage change.** The one gap: **`time_spent_s` exists and is
never written** — the column and the save path (`AnswerPatch`,
`saveAnswers`) accept it; the runner never measures it, and legacy
never did either. `answered_utc` is the time of the last change of
answer, not time on the question.

**What MyNclex has, for reference** (read 2026-09-24; reference, not
plan). A report after every sitting: the score, outcome counts
(correct / partial / wrong / unanswered), **"Where you slipped"** —
percentage fully correct per value, weakest first, on four switchable
axes (its client-needs category, subject, difficulty, question type) —
a **fix list** of up to three actions (the weakest areas with at least
three questions, each a link to the builder pre-filtered to it; the
unanswered; the bookmarked), time on task and pace, every question in a
table with its time and a "changed your mind" count, filters by
outcome. A readiness-pack report adds bands (Building / Approaching /
Ready / Excelling), a trend line across sittings, pacing against a
budget with "rushed" answers, a per-question map, and a percentile
among everyone who sat the pack (hidden under 25 sittings). The review
screen shows how everyone did on each question (hidden under 30
students). Across sittings, a bank dashboard: a streak, accuracy by
area over all history with a "weakest area" nudge, a readiness panel
from three signals, and a "practise my weak spots" button. Per-question
time is its own engine (engaged seconds, paused when the student looks
away); answer changes are stored as a history on each answer. Its own
student analytics page (trends, coverage) is planned there, not built.

**What NMC Prep has** (walked 2026-09-24, `09-free-account-and-
gamification.md` §2): a mock results page with the score against the
pass mark, total time, time per question, the fastest and slowest
questions, and a breakdown by difficulty and by topic; review filters
all / wrong / correct / skipped. No breakdown after practice.

**Candidate slices** (proposed 2026-09-24, in the order recommended;
Sam orders them):

- **Q10 — The attempt report.** After every finished attempt, one page
  (or the review's head): the score and outcome counts; the breakdown
  by subject, topic, difficulty and question type, weakest first, a
  slice shown only above a minimum number of questions; **what to fix
  next** — up to three weakest areas, each a link to the Quiz Builder
  set to that course and topic; review filters (wrong / unanswered /
  flagged). Queries over the attempt's own rows, gated like the review
  (a live exam's report exists only once it is finished — the seal).
  No storage change. Open when sliced: the minimum per slice; whether
  it replaces the runner's score card or sits beside it; the grade
  bands' words.
- **Q11 — Time per question.** The runner measures the time on each
  question and sends it with the answer it already saves; the report
  gains time on task, average pace and the slowest questions. The
  column and the write path exist. Open: whether the clock pauses when
  the tab is hidden (MyNclex's engagement clock does); "rushed" against
  a budget needs a budget, which only a timed quiz has.
- **Q12 — Progress across attempts.** Learning History and the
  dashboard: accuracy by subject and topic over the student's whole
  history with a weakest-area nudge to the builder, a score trend, and
  the history's true totals (closing BUILD_LIST's "counts the loaded
  pages" lines). The slice that makes the portal guide's promise true.
  Queries only; an index on `attempts (user_id, …)` is already queued
  under *Speed and scale*.
- **Q13 — Readiness and the cohort.** Later: a readiness band from a
  student's own history; how everyone did on each question (a minimum
  count before it shows); standing among those who sat the same fixed
  quiz or mock. Belongs with Q3's mock design — the mock's own results
  screen is where NMC Prep is strongest.

Not proposed: an answer-change history ("you changed N answers") —
it needs a change log on every answer, a storage change and its own
§8 row; the attempt keeps only the final choice.

---

## 5. Ladder

| Slice | Date |
|---|---|
| Q1 The floor | ✅ 2026-09-19 (`20260919170000_quiz_floor.sql`; walked by Sam: both student lists, Start, the course previews, admin Edit, Mock Exams, Attempts) |
| Q2 The lifecycle rules | ✅ 2026-09-19 (code only; walked by Sam: the paged mock list, the six-figure stats box, archive → restore to draft, Retake refused on a closed quiz) |
| Q3 Mock exams as a premium exam experience | design item, not sliced |
| Q4 The questions as rows | ✅ 2026-09-20 (`20260920120000_attempt_items.sql`; walked as student4: builder attempt, fixed quiz, retake in the origin's order, pack built and rendered from its rows, history and My Packs) |
| Q5 The answers as rows and the write door | ✅ 2026-09-20 (`20260920150000_attempt_answers.sql`; walked as student4: per-tap saves and a flag read back, a reload restoring them, finish at 4 / 10, an exam closed at its deadline on the next open, a failed Submit's toast with the runner unlocked) |
| Q6 The seal | ✅ 2026-09-20 (code only; walked as student4: a live exam's page with 0 keys, the closed exam's with 10, a practice quiz reloaded with exactly the 2 checked, the review filled from the finish reply) |
| Q7 SATA partial credit | later, after S7 |
| Q8 The runner as a player | candidate, captured 2026-09-20; ruled when it comes up, after 08 B2 |
| Q9 The Check Answer pending state | candidate, captured 2026-09-20 |
| Q10 The attempt report | candidate, captured 2026-09-24 |
| Q11 Time per question | candidate, captured 2026-09-24 |
| Q12 Progress across attempts | candidate, captured 2026-09-24 |
| Q13 Readiness and the cohort | candidate, captured 2026-09-24; with Q3 |
