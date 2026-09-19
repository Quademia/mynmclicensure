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

Every sitting is an `attempts` row: the item ids in order, the answers,
the score, the time, in-progress or completed. Learning History lists
them all with Resume / Review / Retake and filters. The attempt tables'
own restructure is `rebuild.md` §8 S7, ticked 2026-09-18, and lands
under this doc when Sam picks it (its slices will be `Q4…`).

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
- **D1–D12 — the runner and the attempt tables** (the first
  diagnosis, 2026-09-17): the runner leaks answers, the score is
  writable, the blobs are TEXT. Open; they sit on S7 and land here
  with it.

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

### Later, under this doc

- **S7 — the attempts restructure** (ticked 2026-09-18): `attempt_items`
  sealed / unsealed, the score server-side, the blobs typed. Slices
  `Q4…` when Sam picks it; D1–D12 dispositions with it.
- **`quiz_items`** replacing the `item_ids` array — decided with S2
  (one items table), not before.
- **The legacy-check gaps 1, 2 and 7** (autosave timer, the dropped
  connection at Submit, the builder's stuck status line) and the
  Learning History items on BUILD_LIST — runner and history work that
  belongs here when queued.

---

## 5. Ladder

| Slice | Date |
|---|---|
| Q1 The floor | ✅ 2026-09-19 (`20260919170000_quiz_floor.sql`; walked by Sam: both student lists, Start, the course previews, admin Edit, Mock Exams, Attempts) |
| Q2 The lifecycle rules | ⬜ |
| Q3 Mock exams as a premium exam experience | design item, not sliced |
