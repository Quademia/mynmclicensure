# Question Bank — the items, the importer, the gate

The living plan for this feature (Sam, 2026-09-19: the feature docs
hold what a feature does today, what the diagnosis found, Sam's
rulings, and the sliced plan). The bank had no doc of its own — the
port's `00–07` covered it inside the quiz system and access control —
so this one was opened on 2026-09-19 by Claude when Sam ticked S2.

Sources it leans on: `post-rebuild-diagnosis.md` (D8, D9, D11, D22 and
*The inventory — everything that reads the bank*), `rebuild.md` §8 row
S2 (ticked 2026-09-19), the perf investigation of 2026-09-16 (the
per-row gate), `03-quiz-system.md` (the builders and the runner that
read the bank). The slice ids here (`B1`, `B2`, …) are the ids
`BUILD_LIST.md` uses under this doc's section.

---

## 1. What it does today

### Eleven tables of one shape

The bank is one table per course — `items_gp`, `items_rn_med`,
`items_rn_surg`, `items_rm_ped_obs_hrn`, `items_rm_mid`,
`items_rphn_pphn`, `items_rphn_disease_ctrl`, `items_rmhn_psych_nurs`,
`items_rmhn_psych_ppharm`, `items_nac_basic_clin`,
`items_nac_basic_prev` — the spreadsheet era showing through, where a
course was a tab. All eleven have the same 25 columns: `item_id` (the
key, course-prefixed like `GP-S1-78` on dev and `GP_001` on prod), the
question type (MCQ | TF | SATA), the stem, six options each with its
feedback, `correct` ("b", or "a,c,e" for SATA), the rationale and an
optional rationale image (a public URL in the
`licensure-gh-rationale-images` bucket), subject / main topic /
subtopic / difficulty, marks, a batch id, and a shuffle flag (off for
TF). Six indexes per table. Dev holds 5,281 questions across ten of
the tables (the disease-control one is empty); every id is unique
across the whole bank.

### One helper maps a course to its table

`lib/bank/tables.ts` holds the fixed list of eleven course ids and
turns one into a table name; a course outside the list cannot reach
the database. It is called from sixteen places in six files: the bank
reads (`getItemsByIds`, `getItemsByFilters`, `getItemFilterOptions`),
the bank writes (`saveQuestion`, `importItems`, `deleteQuestion`), the
attempt spawn and the runner's question read, the quiz picker, and the
offline-pack builder. **A new course is a new table, four policies, a
line in this list, and a deploy.**

### The gate

Each table's SELECT policy is `user_has_course('<its course>')`; INSERT,
UPDATE and DELETE are the admin's. Since 02 C2 the function is one
lookup in `my_course_access()`, but the policy still calls it **per
row** — the perf investigation measured ~230 ms per Quiz Builder
course pick, ~2.2 s at a 10,000-row course.

### The admin page and the importer

The admin Question Bank page: a course picker, five filters applied in
the browser over the whole loaded course, cards 25 at a time, an edit /
new panel whose option area follows the type, SATA checkboxes, the
rationale image attach and remove, Save and Delete. The CSV importer
beside it: a template per course, a parse with a row report, an upsert
on `item_id` into the course's table.

### Who reads it

The Quiz Builder and the Offline Pack Builder (a course's items by
filters, and its topic / difficulty options), the attempt spawn (the
chosen ids, served to the runner), the runner's resume and review, the
admin quiz picker, the offline pack renderer (follows the pack's id
list back to the live bank). Attempts, quizzes and packs all keep
**lists of item ids** — the ids are the bank's public handle.

---

## 2. What the diagnosis found

One line each; the full text with proof is in
`post-rebuild-diagnosis.md`.

- **D22 — eleven tables make every bank change eleven changes, and
  every new course a deploy.** S7 (the attempts snapshot) must pick a
  table by course; D8's column revoke would be eleven revokes; a
  twelfth course is a migration and code. Reversed the 2026-09-10
  "keep eleven" recommendation; **ticked as S2 on 2026-09-19.**
- **D8 — the bank is readable from the browser, answers included.** A
  student holding a course can pull every row and every column of it
  with their own credential. Carried from legacy; the fix waits on S7
  (the runner must stop reading the live bank first).
- **D9 — both builders ship a whole course's stems and rationales** so
  the concept search can filter in the browser. The criteria never
  needed the text.
- **D11 — the admin bank reads are a speed problem, not a leak.** The
  whole course, every column, into the admin's browser; MyNclex pages
  at 50 with server-side filters (and its own note that the cap is a
  real to-do).
- **The per-row gate** (perf, 2026-09-16): the policy re-runs the
  access function for every row read.

---

## 3. Rulings (Sam, 2026-09-19)

- **One table, named `question_bank`** (S2 ticked). The rows move in
  with their course id; the ids do not change, so every id list in
  attempts, quizzes and packs stays valid.
- **Ids stay course codes** (the 2026-09-19 ruling on course ids): the
  key is the course-prefixed item id as it is.
- **D8's warning stands:** do not copy MyNclex's "every signed-in user
  reads the published bank" — this product's course gate is the
  stricter of the two and stays.
- **Order:** B1 next after the subscriptions stretch, before S7 and
  before A1 — it is the last shape that multiplies other work.

**Sam, 2026-09-21 (with B2):** the table's **write grants go too**. B1
left `question_bank` with the schema's default `grant all` to `anon`
and `authenticated` — SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
REFERENCES, TRIGGER on all 26 columns — with the RLS policies the only
gate, and TRUNCATE is not subject to RLS. The bank's one write path is
the admin Question Bank page, so Save, Delete and the CSV import move
to the service role behind `requireAdmin()` (the S10 shape) and the
browser roles keep SELECT on the public columns and nothing else. The
three admin write policies go with the privilege they policed: with no
role holding the write, RLS refuses by default, and a policy that can
never be reached reads like a live gate.

---

## 4. The plan

Each slice ends with Sam testing it at `localhost:3000`. A slice that
changes a table names its §8 row. Ids are this doc's own.

### B1 — One table (S2; D22, the per-row gate)

**Storage, one migration.**

- `question_bank`: the 25 columns as they are, plus `course_id text
  not null references courses (course_id)`; `item_id` stays the
  primary key. Indexes: `course_id`, and the six per-table indexes
  once with `course_id` leading.
- The rows copied in from the eleven tables, each with its course id;
  the count checked against the sum of the eleven.
- Four policies once. The read policy written so the gate runs **once
  per statement**, not per row:
  `auth_user_role() = 'ADMIN' or course_id in (select course_id from my_course_access())`
  — which closes the perf line as a side effect. Admin INSERT, UPDATE,
  DELETE.
- The eleven tables and their forty-four policies dropped. Both
  snapshots updated. `db/README.md`'s table list if it names them.
- Prod carries the same eleven ids; the same file applies at the next
  release, before cutover re-copies the bank into the one table.

**Code.** `lib/bank/tables.ts` goes; its sixteen callers read
`question_bank` filtered by `course_id`. Where the helper guarded a
*write* (save, import, delete) the guard becomes "the course exists"
(a `courses` read); where it guarded a read, a course with no rows
simply returns nothing. The importer writes `course_id` from the
page's course picker; the template and the parser keep their course.
The admin bank page's course picker becomes the filter it already is.
`Item` gains `course_id`.

**Done when** (SQL on dev, then the browser): `question_bank` holds
5,281 rows and the eleven tables are gone; as the RN student a read of
`question_bank` returns the RN and GP rows only (2,401) and none of
RM's, and the read is one gate call per statement (EXPLAIN shows an
InitPlan, not a per-row filter); the Quiz Builder's course pick, topic
list and build; a fixed quiz Start and the runner; the admin bank page
with its filters, a save, a delete, a CSV import of three rows into a
course; the offline pack builder and a pack's render; the admin quiz
picker.

### B2 — The answers server-only (D8, D9), after S7

- Once S7 serves the runner from a snapshot, `correct`, `rationale`,
  the six feedbacks and `rationale_img` leave the browser roles' reach
  (column-level REVOKE on the one table, the S10 / Q1 shape); the
  server reads them with the service role behind the gates it already
  makes (the attempt spawn, the pack builder, the admin pages).
- The builders' concept search moves server-side and returns counts
  and ids, never stems; the topic and difficulty options come from a
  counts-only read.

**Done when:** a student's own credential reads a course's stems but
not one `correct`; the Quiz Builder's concept search still finds the
same questions; a build and a pack still work.

**Built 2026-09-21** (`20260921120000_question_bank_secret_half.sql`).
`revoke all` from both browser roles, then SELECT granted back to
`authenticated` on the seventeen public columns; `anon` holds nothing.
The three admin write policies dropped with the write grants (the
ruling above). `search_question_bank_ids(course, query)` matches the
wizard's four fields — subtopic, main topic, stem, rationale — with
`position()`, the keyword a bound parameter: a student's own typing
cannot reach the query's shape, and there are no LIKE wildcards to
escape, so it is the browser's `String.includes()` exactly. EXECUTE
off the browser roles.

Code: `lib/bank/queries.ts` splits by client type — `ServiceDb` for the
whole row and the search, the cookie client for the filter options and
the id check — so a read needing the key cannot be handed a student's
client by accident. `getItemsByIds` became `knownItemIds()` (both
callers used nothing but `item_id`). `BuilderItem` lost `stem` and
`rationale`, so no wizard code can filter on question text. Both
wizards call `searchBuilderConcepts()` 300 ms after the last keystroke,
hold the previous result while a new one is in flight, show "Searching…"
and refuse Build until it lands. The admin bank page and the quiz
picker read and write through the service role.

The one visible change: the concept keyword waits about a third of a
second instead of filtering as you type. The chips, the counts, the
topic path and the pool are untouched and still instant.

**Proven on dev** as student4 (GP, RM_MID, RM_PED_OBS_HRN): 540 RM_MID
stems readable; `select correct`, `select *` and `update` all refused
with *permission denied for table question_bank*; the search function
refused. The search equals the old browser match exactly — `labour`
gives 116 rows both ways with no difference either direction,
case-insensitive, an empty query matching nothing, and a typed `%`
matching the 7 rows that literally contain one rather than all 540.
Walked: the Quiz Builder's keyword (116 on screen, 116 in SQL), its
chips and the topic path (Labour & Delivery 114), a build into the
runner with one question answered and its feedback and rationale
arriving from the server; the offline builder (`breastfeeding`, 33 and
33) and a pack rendered. The course load now sends six fields a row and
the search reply bare ids — D9's proof, read off the wire. Admin: the
page loads 540 with the answers, a question created, edited (writing a
`rationale`, a column the browser role cannot even read) and deleted,
a three-row CSV import (MCQ, TF, SATA) landing `correct`, the
rationales and the feedbacks; the quiz picker loads. Per-course id
fingerprints before and after the import: GP 601 → 604, the other nine
byte-identical.

### B3 — The admin page paged and filtered server-side (D11), later

Fifty at a time with an exact count, the five filters in the query,
as the mock admin list was done in 03 Q2. The importer's row report
unchanged.

### Later, under this doc

- **`quiz_items`** replacing the quiz tables' `item_ids` arrays — noted
  in 03 and in §8 S12 as "decided with S2"; a slice under 03 when Sam
  picks it, now that S2 is ticked.
- Content items on BUILD_LIST (the empty disease-control course, the
  midwifery shortfall, the set-size targets).
- A course *filter* on the admin bank page over every course at once
  (search the whole bank) — cheap once the table is one.
- **The free pool's door** (`09-free-account-and-gamification.md`
  F1): a free-forever account practises on a set-aside pool, per
  programme, with no `course_access` rows. The cheapest shape is a
  "free" mark on `question_bank` rows and a second door on the read
  policy — a row marked free readable by any signed-in student. That
  is a change to the gate, the security floor, so it is a `rebuild.md`
  §8 row (a candidate S14) before it is built, and the importer learns
  the mark. Captured 2026-09-20 from Sam's cloud session; not ruled.

---

## 5. Ladder

| Slice | Date |
|---|---|
| B1 One table | ✅ 2026-09-19 (`20260920010000_question_bank.sql`; proven on dev — 5,281 rows, the eleven gone, 2,401 visible to the RN student and none of RM's, EXPLAIN a hashed SubPlan once per statement; walked by Sam: the builder, the runner, the admin bank page, packs, the picker) |
| B2 The answers server-only | ✅ 2026-09-21 (`20260921120000_question_bank_secret_half.sql`; the secret half and every write grant off the browser roles, the three write policies with them, the concept search a service-role function; proven on dev and walked both sides — §4) |
| B3 The admin page paged | ⬜ later |
