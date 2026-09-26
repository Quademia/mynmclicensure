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

**Sam, 2026-09-26 (MyNclex's bank compared column by column; nine
things taken one at a time).** MyNclex's bank has 32 columns to this
one's 26; the overlap is the question itself. Ruled, in order:

1. **`bloom_level` adopted** — the taxonomy level. Six levels or three,
   the spelling (Ghana writes "Analyse"), and whether students see it,
   open until the slice is written.
2. **`is_published` adopted, draft by default** for a new row; the
   existing rows published at migration.
3. **`is_free_sample` adopted, as a mark on the bank rows** — not a
   separate pool table (09 §4's open question, answered: the same rows,
   importer, editor and snapshot serve both, and a second table would
   duplicate all of them and every column adopted here). Free rows stay
   inside their paid course. The daily challenge draws from the free
   rows, the same five per programme, rotating; five a day is about
   1,800 a year per programme, so the pool's size and refresh are still
   to be set. F1's "second door" is two doors, the read policy and
   attempt creation — §8 S16.
4. **Mock questions are never builder-visible — as a rule, not a
   column.** A question is reserved while any mock names it, derived
   from the mock lists (a join once the link table lands, 03 Q14); the
   builder, the pack maker, the fixed-quiz picker and the daily
   challenge skip it; a mock question can never be marked free. Fixed
   quizzes stay from the course bank and visible everywhere. Existing
   overlaps are listed at migration for Sam to decide. MyNclex's stored
   switch (`is_builder_visible`, flipped when a question joins a pack
   and never back) was offered and not taken: reserved rows would
   accumulate silently as mocks are edited.
5. **`created_at` / `updated_at` adopted.**
6. **`question_ref` adopted, internal** — where the question came from,
   free text with commas, never shown to a student, never copied.
   **`tags` adopted (Sam, against the recommendation)** as the
   student-facing label: free text with suggestions from tags in use,
   matched without case, a Tags panel to rename, merge and delete;
   shown in review, a builder filter, a report grouping. A canonical tag
   list was offered and judged the hard way: tags gate nothing, so a
   stray costs tidying, not a wrong report — which is also why the
   subject and topic lists are canonical and tags are not.
7. **The classification lists, in the database, per course** —
   subjects and topics as tables with a management panel on the Courses
   page, subtopic free text, the importer refusing unknown words, keys
   on the bank rows, CHECKs on `question_type` and `difficulty`.
   Subject means the academic module a question draws on (the paper is
   the course); per course, no programme column. §8 S18.
8. **Copied into the sitting: the level, the tags and the version.**
   Not the source, the switches or a date. A version on every row and a
   history table; versions cut only for content changes to published
   rows; drafts and label changes unversioned; a delete goes to history
   marked deleted; restore is a save. §8 S17.
9. **A blueprint axis, adopted in principle, blocked** on the NMC
   curricula. The council's site was checked 2026-09-26: eleven cadres,
   four sitting windows, procedure manuals, the scope of practice, fees;
   no syllabus, no paper breakdown, no format. A college library lists a
   printed *Curriculum for the RGN Programme* (NMC, Accra, 2021), so the
   documents exist in print; Sam is obtaining them. The topic lists
   stand in.

**Not taken:** MyNclex's two JSON columns holding twelve question
shapes, the adaptive-testing columns, the case-study and trend links,
`body_system`, the five-step difficulty, `instruction`, the
type-prefixed ids (ours encode the course, the more useful fact here).
**Adopting MyNclex's whole quiz system and cutting it down** was asked
again (first answered as D4, 2026-09-10) and answered for the
improvement era: 56,000 lines in 249 files over 24 tables against this
product's 6,700 in 36, woven for twelve question types and an adaptive
engine Ghana's paper does not use; the removal is the expensive part,
with a reshaped bank, a rewritten importer and a re-hardening pass
behind it. Ideas come across one at a time; a self-contained piece may
be copied. Revisit only if the product's future is NGN-style items or
adaptive testing, and then as a planned rebuild.

**Sam, 2026-09-26 (B5 talked through, one decision at a time).** The
shape of S18's lists, settled before B5 is scoped; they amend the S18
row:

1. **Two separate lists per course, subjects and topics** — no tree of
   topics under subjects (most courses have one subject, so a tree
   would make an author pick it first for nothing; MyNclex's only
   two-level list is the fixed NCLEX blueprint). Subtopic stays free
   text.
2. **The migration seeds the lists from the words already in the bank
   and changes no question's words** (the one exception is item 4).
   The clean-up is done afterwards, in the panel, at Sam's pace, so
   every step is visible — rather than a drafted mapping applied in one
   move nobody can check line by line. For it the panel gains
   **Merge** (a rename onto an entry already on the list, which moves
   every question) and, for topics, **Split** (a double such as
   "Cardiovascular/Emergency" becomes the topic plus a tag — item 6).
3. **An empty subject or topic is "Not set"** — a null, not a word on
   the list. It is the dropdowns' first choice, a blank CSV cell means
   it, the panel counts "N questions not set" per course as the
   clean-up's to-do, and such a question reaches a student only through
   "All topics" in the builder (as the RMHN questions do today). There
   is no built-in "Other" or "Unspecified": two ways of saying "none"
   would drift, and "Other" becomes a place the list never grows from.
   A course that wants "Other" adds it as an ordinary word, and it is
   then on the list.
4. **The course-name subjects are cleared to Not set at migration** —
   the eight courses whose every subject is the course's own name
   ("Medical Nursing", "NAC", "MHN" …), which S18 already counted as
   unlabelled.
5. **One combined panel, Subjects & topics, on the Question Bank page**
   — a button beside Tags, working on the course picked, the two lists
   side by side (stacked on a phone): add, rename, merge, retire
   (hidden from the dropdowns, questions untouched), delete refused
   while in use; Split on topics only. Not a Topics panel on the
   Courses page as S18 said: the clean-up means reading the questions
   while merging their words, and it sits where Tags sits. The subject
   list needs its panel too — the importer never creates a word, so
   without one the list could never grow (S18 named only topics).
6. **One topic per question.** A question that spans two areas takes
   its main one as the topic and the other as a tag. Reports and a
   blueprint need each question counted once — so the NCLEX blueprint,
   UWorld and MyNclex all do it this way (MyNclex's body systems carry
   a "Multisystem" entry for the ones that span). Many topics per
   question, and one main topic with "also" topics from the list, were
   offered and not taken; the second can be added later without undoing
   anything. The ~170 doubles are entries at migration and split during
   the clean-up.
7. **The importer refuses a subject or topic not on its course's list**
   with the word named (S18), and **accepts a blank cell** as Not set —
   without that the RMHN courses, which have no topics at all, could
   import nothing until their lists were written.
8. NAC_BASIC_PREV and RPHN_PPHN hold the same 180 questions on dev —
   intended (sample questions). No action.
9. **At the scoping (the five details, all as recommended):** a
   question keeps its words, and the database checks each against its
   course's list (a key made of the course and the word), so a rename
   reaches every question inside the database and no screen that shows
   a topic changes; a retired word is refused by the importer, named as
   retired, and kept on a question that already carries it; Split lets
   the admin pick which half is the topic (the first by default) and is
   offered only on topics with a "/"; the CSV template's example row
   leaves subject and topic blank; and a sitting keeps the word it was
   given (S17's "names, not keys"), so a later rename shows the old
   word on old attempts — 03 Q12's concern, not B5's. No readers' check
   before the build (Sam).

**Sam, 2026-09-26 (B6 talked through).**

1. **A question is held back from practice while a draft or active
   mock names it; an archived mock releases its questions** (restoring
   it holds them back again, since the rule is derived from the mock
   lists, not stored). A draft mock must hide its questions before it
   goes live; once a mock is archived everyone who sat it has seen
   them, and locking them for ever would shrink the practice pool as
   mocks pile up — the accumulation that ruled out MyNclex's stored
   switch (§3 item 4). "Any mock, whatever its status" was offered and
   not taken.
2. **No overlap handling.** The overlap B6's first draft planned to list
   — a question in both a mock and a fixed quiz — existed on dev only
   because the seven dev quizzes were re-pointed by hand at "the first
   N questions of the course" on 2026-09-14, so each GP and RN_MED fixed
   quiz was a subset of its mock. Sam: test data, not a problem to
   build for. The two fixed quizzes were re-pointed the same day through
   the admin editor to the first 10 questions no mock names; no dev
   quiz shares a question with a mock. The clean way to author a mock
   is the one B4 made possible: write its questions as drafts (no
   student sees a draft), add them to the mock, publish them when the
   mock goes live — from then on B6 holds them back. The "In a mock"
   badge, the overlap list and a refusal in the mock's save were offered
   and not taken.
3. **S19 adopted:** a student's own login no longer reads a question's
   wording or options (`rebuild.md` §8 S19) — ticked 2026-09-26.
4. **No retake rule.** A retake takes its question list from the
   student's original attempt, not the quiz as it is now, so an old
   attempt could carry a question that has since joined a mock. With
   mock questions authored fresh as drafts no practice attempt ever
   holds one; the only such attempts are dev test data made before the
   rule, left as they are (Sam: the same shape as the overlap). A
   question may sit in several mocks.
5. **One meaning of "in a mock"**: the free tick's refusal uses the
   hold-back's definition, so an archived mock's question, back in
   practice, may be marked free.
6. **A fixed quiz that later comes to hold a held-back question** keeps
   showing it in its editor, marked "In a mock", rather than dropping it
   silently; the save refuses it until it is removed; the quiz's start
   serves it meanwhile.
7. Sam's framing of mocks — premium members, transient, a mock kept
   active across cohorts and archived only to retire it — is noted in
   03 Q3.

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

### B4 — The columns, the version and the history (S17)

Scoped 2026-09-26 against the code as it stands; the five open
details ruled the same day (Sam: the recommendations on all five); the
draft then checked against the code, the dev database and the rest of
the record by three readers (36 findings, 18 distinct points taken —
the session entry names them). Two sessions: the migration, the
actions and the editor first; the importer's choices and the two
panels second, with Sam's walk between.

**Storage, one migration.**

- `question_bank` gains nine columns: `bloom_level text` (null, or one
  of the six: Remember, Understand, Apply, **Analyse**, Evaluate,
  Create — the existing rows have none; Ghana's spelling on screen and
  in the data, MyNclex's list in meaning), `is_published boolean not
  null default false`, `is_free_sample boolean not null default
  false`, `question_ref text`, `tags text[] not null default '{}'`,
  `created_at` / `updated_at timestamptz not null default now()` with
  a trigger stamping the update, `version integer not null default
  1`, and `updated_by text` — the admin's `U_` id, written by every
  admin write, because a plain PostgREST statement carries only the
  row's columns and the trigger cannot see the actor under the service
  role; the actor travels on the row. Backfill: every existing row
  `is_published = true`, both dates the migration's time, version 1,
  `updated_by` null.
- Three CHECKs: `question_type in ('MCQ','TF','SATA')`; `difficulty in
  ('Easy','Moderate','Hard')` or null; `bloom_level` in the six or null
  (the same refuse-a-stray-word method as the other two — the file's
  reviewer counted the spec's "two" against the file's three, and the
  third stays). Today's 5,281 rows pass all three (counted on dev:
  5,277 / 0 / 4; 2,437 / 2,125 / 719; no level yet).
- `question_bank_history`: `history_id bigint generated always as
  identity primary key`, the bank's columns, `version`, `changed_by
  text`, `changed_at timestamptz not null default now()`, `deleted
  boolean not null default false`; an index on `(item_id, version)`,
  not unique — a deleted id re-imported starts at version 1 again. One
  trigger, before update and before delete: when `old.is_published`
  and the content row (`stem`, the six options, `correct`,
  `rationale`, `rationale_img`, the six feedbacks, `question_type`,
  `marks`) `is distinct from` the new one, insert `old` with
  `changed_by = new.updated_by` and set `new.version = old.version +
  1`; on delete of a published row, insert `old` with `changed_by =
  old.updated_by` and `deleted = true`. Label-only changes (subject,
  topic, subtopic, level, tags, `question_ref`, batch, course,
  difficulty, shuffle, the two switches) and any change to an
  unpublished row write nothing. **A question unpublished for rework
  is a draft again and its edits are unversioned; republishing is a
  switch flip and writes nothing either, so the row keeps its version
  number over the reworked content** (the literal reading of the rule,
  ruled 2026-09-26; the alternative — the flip back cutting a version
  when the content differs from the last history row — was not taken).
  A new table in this schema is born with `grant all` to both browser
  roles (the schema's default privileges), so the migration ends with
  `revoke all on question_bank_history from anon, authenticated`, the
  same on its sequence, and RLS enabled with no policy;
  `role_table_grants` shows neither role after the apply. The admin
  reads it through the service role behind `requireAdmin()`.
- `question_bank_select` gains the published condition for
  non-admins: `auth_user_role() = 'ADMIN' or (is_published and
  course_id in (select course_id from my_course_access()))`. A draft
  cannot be read by a browser that asks directly. (S16's second door,
  the free rows, is a later change to the same policy — 09 F1.)
- `search_question_bank_ids` is redefined with `and q.is_published`
  in its WHERE: it is SECURITY INVOKER but called by the service role
  (`searchConceptItemIds`), which RLS never filters, and its ids go to
  the browser bare — a draft's id must never leave the database.
- `attempt_items` and `offline_pack_items` gain `bloom_level text`,
  `tags text[] not null default '{}'`, `version integer`;
  `create_attempt` and `create_offline_pack` copy them beside the four
  classification fields. Both copiers **refuse an unpublished id**
  before the copy — `if exists (select 1 from unnest(p_item_ids) i
  join question_bank q on q.item_id = i where not q.is_published) then
  raise exception 'This quiz has a question that is not published'`
  (the pack's message says pack) — rather than copying or dropping it;
  a deleted id keeps today's rule and is dropped, since there is
  nothing to republish. Existing rows show blanks, which is honest.
- Rule 9 after the apply. `question_bank`: `authenticated`'s
  column-level SELECT list (anon holds nothing since B2 and gets
  nothing here) gains `is_published` and `is_free_sample` only — the
  student-side reads filter on them and a cookie-client filter needs
  SELECT on the column; `bloom_level`, `tags`, `version` and the dates
  are not granted in B4, because no student read uses them yet and the
  bank page reads them through the service role (the slice that puts a
  level or tag filter before a student grants them); **`question_ref`
  and `updated_by` are never granted** — internal, server-only.
  `attempt_items`: its column-level list stays as it is, without the
  three (the runner and the review read through the service role).
  `offline_pack_items`: holds table-level SELECT today, which would
  carry the three to `authenticated` by itself — narrowed to a column
  list without them. `information_schema.role_column_grants` and
  `role_table_grants` checked for all three tables.

**Code.**

- `lib/bank/types.ts`: `Item` gains the nine fields; `BLOOM_LEVELS`
  beside `DIFFICULTIES` (a constant, so here and not in the `'use
  server'` module); `CSV_COLUMNS` gains `bloom_level`, `question_ref`,
  `tags` — **tags in a CSV cell separated by semicolons** (commas are
  the file's own separator; ruled 2026-09-26). The two switches are not
  CSV columns.
- `lib/bank/csv.ts` (`parseCsv`, which builds the row report in the
  browser when the file is picked): a row whose type, difficulty or
  level is not on its list is refused with the word named — 'Row 7:
  question type "T/F" is not MCQ, TF or SATA — skipped'; the match is
  without case and the row lands in the list's spelling (`easy` →
  Easy), so a spelling variant is corrected and an unknown word
  refused. `importItems` repeats the check on what it receives, as it
  repeats the other rules. **One alias: the level "Analyze"**,
  MyNclex's spelling, lands as "Analyse" rather than being refused
  (Sam, 2026-09-26, after the walk) — the same word, so a file carried
  over from MyNclex's bank imports; "Analysis" and the like are still
  refused by name.
- `lib/bank/actions.ts`: `saveQuestion` carries the new fields, stamps
  `updated_by`, and **refuses the free tick on a question any
  `mock_quizzes` row names** ("This question is in a mock exam and
  cannot be free") — a TypeScript check through the service role
  (`item_ids @> array[id]`; the column is off the browser roles),
  enough here because the tick gates nothing until S16's door lands
  with the policy; the SQL check comes with 03 Q14's link table. The
  rule's other door is built with it: `lib/quizzes/actions.ts`
  `saveQuiz` for a mock refuses an id marked free by name ("Question
  RN_MED_… is a free question and cannot be in a mock exam"), so the
  two writes hold the rule from both sides and B6's draws are only its
  read side. New `setPublished(courseId, itemIds, published)` for one
  row or the shown set, stamping `updated_by`; **Unpublish first counts,
  through the service role, the active published fixed quizzes and
  mocks whose lists name the rows, and when the count is not zero
  confirms with the app's dialog** — "N quizzes will refuse to start
  until this question is published again" (`useConfirm()`, never
  `window.confirm`) — and returns the count for the toast.
  `importItems` takes two choices per file — publish now or leave as
  drafts, import as free or not — **applied to the rows the file
  creates**: the action reads which of the file's ids exist first, and
  an existing row keeps its own `is_published` and `is_free_sample`
  (the upsert on `item_id` writes the file's content and label columns,
  never the two switches, so a re-import cannot unpublish a live
  question or free one; "Publish all shown" is the door for publishing
  existing drafts); "import as free" is refused row by row for an id
  any mock names, with the tick's message; the importer stamps
  `updated_by` like the save, so a re-imported published row whose
  content changed gets a history row that names the importer.
  `deleteQuestion` is **not** unchanged: it stamps `updated_by` in one
  statement (label-only, no history row) and deletes in the next, so
  the deleted row's history names who deleted it.
- `lib/offline-packs/queries.ts`: the renderer's read of
  `offline_pack_items` names its 27 columns instead of `*` — the
  student's SELECT is a column list now, and PostgREST hands `*` to
  Postgres as a literal `*`, which needs SELECT on every column it
  expands to, the three new ones included. Found by the migration's
  reviewer; with `*` the pack page failed with "permission denied" from
  the apply until the change (built the same hour on the branch).
- Reads. `knownItemIds` and `getBuilderCourseItems` (student-only) add
  `.eq('is_published', true)`, belt and braces with the policy.
  `getItemFilterOptions` serves both audiences — the builder through
  `loadBuilderCourse`, the admin page's dropdowns through
  `loadCourseItems` — so it takes a `publishedOnly` flag: true from
  the two builders, false from the admin, whose dropdowns must show a
  draft's topic and batch. `getItemsByFilters` (admin, service role)
  untouched. `createAttemptRows` **passes the function's message
  through** as `rpcError()` does for the six write doors — today it
  replaces every error with "Could not start this attempt. Please try
  again.", which would swallow the refusal — so the Start button's
  toast carries the words, **a retake included** (a retake is a start
  that copies fresh from the live bank; an origin holding a question
  since unpublished waits for the republish, builder retakes too); the
  quiz editor lists the offending ids with a Draft badge.
- The bank page (`question-bank-client.tsx`): the editor gains a Level
  dropdown, a Published switch, a Free tick, a Source field
  (`question_ref`), a Tags field with suggestions from tags in use
  (matched without case, trimmed); the list gains Published, Free and
  Level filters and a Draft badge; Publish / Unpublish per row and
  "Publish all shown"; two panels — **Tags** (every tag with its
  count; rename flows to every row; merge folds one into another;
  delete removes it everywhere; merge and delete are irreversible bulk
  writes behind the app's confirm dialog, type-to-confirm for delete;
  results as toasts) and **Free pool** (the free count per programme
  from the courses' `program_scope`: a course in several programmes
  counts under each — General Paper is in all five, so its free rows
  are in every programme's pool and the five figures overlap rather
  than sum; the panel says so in one line and lists the per-course
  counts beneath each programme). Both panels and the new filters
  stack under 768px in `admin-question-bank.css` like the rest of the
  page. Subject and topic stay free text until B5 swaps them for
  dropdowns (**B4 before B5**, ruled).

**Not in B4.** The History panel (view a version, restore — a save
that writes the chosen version's content onto the row) follows the
capture, the order MyNclex took. Nothing student-facing: the level's
visibility to students is Sam's open call (§3 item 1), so no builder
filter on it here; tags are ruled student-facing (§3 item 6 — the
label in review, a builder filter, a report grouping) and are built
before students with 03 Q10's report and the builder work, not here.
The free rows' door is 09 F1 (S16).

**Done when.** A new question saves as a draft and is absent from the
builder, the pack builder, the concept search and a quiz start;
published, it appears. Editing a published question's stem writes a
history row naming the admin and moves the version to 2; editing its
topic writes nothing; unpublishing, editing and republishing writes
nothing and keeps the number; deleting it writes a row marked deleted
that names who. A fixed quiz holding an unpublished question refuses
to start with the message on the card, and Unpublish had first said
how many quizzes would; the editor lists the id. A file imported as
drafts lands as drafts; the same file with "publish now" lands live;
a re-import of a live course file changes no switch; a row with "T/F"
is refused by name; `easy` lands as Easy. The free tick on a question
in a mock is refused, and a mock's save naming a free question is
refused. A tag typed twice in different case is one tag; renaming it
in the panel changes every row; merge and delete ask first.
`role_column_grants` shows `authenticated` with `is_published` and
`is_free_sample` added and nothing else new, `question_ref` and
`updated_by` absent; `role_table_grants` shows no browser role on the
history table and `offline_pack_items` narrowed to columns. Sam walks
all of it at `localhost:3000`; `npm run build` green.

**Reach.** Dev only. The migration reaches the deployed dev site
before the merge, where `main`'s code keeps working: the existing rows
are published, the new columns have defaults, `main`'s editor picks
the type and the difficulty from its two lists, and its importer
upper-cases the type. Three things change there until the merge, none
reaching a student: a question saved or imported from `main`'s admin
page lands as a draft, with no Publish control on that build, so it
stays out of every draw until the merge; a CSV row whose difficulty is
not exactly Easy, Moderate or Hard (`main` writes it as typed) fails
its batch of 50 at the CHECK with Postgres's message, where before it
landed; and any history row written meanwhile carries a null
`changed_by`. **And one thing that does break there until the merge:
the student's offline-pack page**, whose renderer on `main` reads the
pack rows with `*` — refused once the grant is a column list (above).
Applied 2026-09-26 with Sam's "apply it now", the renderer fixed on the
branch the same hour; the dev site's pack page waits for the merge.
The refusal's course scope was corrected by a second file the same
afternoon (`20260926160000_copiers_refuse_any_draft.sql`): a draft is
refused whichever course it sits in, as the clause above says.

**Built 2026-09-26** — the migration above, then the code in two
sittings with Sam's walk after each; ticked on his walk. As the spec
says, with these choices made at the build:

- **The two panels are cards on the bank page**, opened by Tags and
  Free pool buttons in the toolbar, above the list and needing no
  course — not dialogs (the shared dialog is 420px). Sam kept them as
  built (2026-09-26); tabs on the bank page (*Questions · Tags · Free
  pool*, MyNclex's bank shape) were offered as the later home if they
  grow.
- **The Tags panel covers the whole bank** (Sam): the save and the
  importer snap a tag to the spelling in use anywhere in the bank, a
  file's rows to each other's too. Rename asks nothing (it can be
  undone by another rename); a rename onto a tag in use is a merge and
  asks first; delete asks with the tag typed. The rewrite runs in
  TypeScript through the service role, grouping rows by their new list
  — no database function, so no second migration.
- **The importer's choices reach new rows only because new and
  existing rows go in separate batches**: a batch's columns are the
  union of its rows' keys, so one new row's switch in a mixed batch
  would have reached every existing row in it.
- **The level "Analyze"** lands as "Analyse" (above).
- The start's refusal passes through to the card; the free tick and a
  mock's save refuse from both sides; Publish / Unpublish per card and
  "Publish all shown"; the quiz and mock editors mark a draft and the
  review names them.

**Proven on dev** (as Sam's admin, and as an RN_MED student's role in
a rolled-back read): a new question saved as a draft, invisible to the
student (900 of 901) and the concept search; a stem edit moved a
published row to version 2 with a history row naming the admin; a
topic edit wrote nothing; unpublish, edit, republish wrote nothing and
kept version 2; delete wrote a row marked deleted, a draft's delete
nothing; Unpublish on `RN_MED-S1-1` counted its two live quizzes and
`create_attempt` then refused with the message; the free tick on a
mock's question and a mock naming a free question both refused; a
file imported as drafts, then re-imported with both choices on — the
published row kept its switches and gained a version naming the
importer, the draft stayed a draft, the new row landed published and
free; the Free pool counted it under Registered Nursing; rename, merge
and delete in the Tags panel, no history written; the CSV rules in
the real dialog; 375px. Not walked: "import as free" refused for a new
id a mock names (no such id on dev; the tick's check is the same one).
The walks left five test rows in `question_bank_history`, each naming
the admin.

### B5 — The lists and their panel (S18)

Shaped by Sam's rulings of 2026-09-26 (§3, the B5 block, items 1–8)
and scoped against the code and the dev database the same day, the
five details ruled as recommended (item 9). Two sessions: the
migration, the editor and the importer; then the panel.

**What the scoping found.** The words are clean on dev: no leading or
trailing spaces, no empty strings, no two spellings of one word in a
course; 721 questions have no topic (the 720 RMHN and one in GP) and
one has no subject. **Subject reaches no student screen** — it is
copied into a sitting and a pack row and never shown — so clearing the
course-name subjects changes nothing a student sees. Topic and subtopic
reach students through the builders' chips, the runner's topic line and
the pack; every one reads the word stored on the question, so keeping
the word there leaves all of them untouched. The bank already has
indexes on `(course_id, subject)` and `(course_id, maintopic)`, which
the key below needs on the referencing side. Four database functions
read the words (`create_attempt`, `create_offline_pack`,
`search_question_bank_ids`, the history trigger) — all by name, none
changes.

**Storage, one migration.**

- `bank_subjects` and `bank_topics`, the same shape: `id bigint
  generated always as identity primary key`, `course_id text not null
  references courses (course_id)`, `name text not null` with a CHECK
  that it is trimmed and not empty (a rule against commas was drafted
  and dropped at the build: nothing needs it, and a prod word holding
  one would fail the release), `retired boolean not null default false`,
  `created_at timestamptz not null default now()`; `unique (course_id,
  name)` — the key the bank rows point at — and a unique index on
  `(course_id, lower(name))`, so "Pain" and "pain" cannot both be on a
  course's list.
- **The words tidied so they can be keys** — spaces trimmed, an empty
  string made Not set, two spellings of one word in a course made the
  commoner. Nothing to do on dev; it guards the prod bank, whose words
  were never read by the importer, so the release cannot fail on them.
- **The eight course-name subjects cleared to Not set**, named pair by
  pair (course, word): NAC_BASIC_CLIN "NAC", NAC_BASIC_PREV "NAP",
  RM_MID "Midwifery", RMHN_PSYCH_NURS "RMHN", RMHN_PSYCH_PPHARM "MHN",
  RN_MED "Medical Nursing", RN_SURG "Surgical Nursing", RPHN_PPHN
  "Principles of Public Health Nursing". A label change: no history
  row, no new version; `updated_at` moves, since the subject did.
- **Seeded** from the distinct non-null words per course, as they stand
  (§3 item 2).
- **The keys:** `question_bank (course_id, subject) references
  bank_subjects (course_id, name) on update cascade`, and the same for
  `(course_id, maintopic)` to `bank_topics`. A null word is not
  checked, which is Not set. A rename of a list entry reaches every
  question carrying it inside the database — a label change, so the
  history trigger writes nothing; a delete of an entry still in use is
  refused by the database (the default `no action`). Subtopic stays
  free text.
- **Rule 9:** both tables are born with `grant all` to the browser
  roles (the schema's default privileges), so `revoke all` from `anon`
  and `authenticated` on the tables and their sequences, RLS on, no
  policy; the admin reads and writes them through the service role
  behind `requireAdmin()`. No student read uses them — the builders
  read the word on the question. `question_bank`'s own grants are
  unchanged (no new column). `role_table_grants` checked after the
  apply.
- Proven in rolled-back runs before the apply (AGENTS.md): the counts
  seeded per course, the eight cleared, every row passing both keys; a
  rename cascading with no history row; a delete in use refused; a word
  not on the list refused; a case twin refused; no browser grant.

**Code, first session.**

- `lib/bank/types.ts`: `ListEntry` (`id`, `name`, `retired`) and
  `CourseLists` (`subjects`, `topics`); `CourseItemsResult` carries the
  course's lists.
- `lib/bank/queries.ts`: `courseLists(db, courseId)` through the service
  role.
- `lib/bank/csv.ts`: `parseCsv` takes the course's lists and refuses a
  row whose subject or topic is not on them, naming the word — 'Row 7:
  topic "Cardio" is not on RN_MED's list — skipped' — or names it
  retired; the match is without case and the row takes the list's
  spelling; a blank is Not set. The template's example row leaves
  subject and topic blank.
- `lib/bank/actions.ts`: `loadCourseItems` returns the lists with the
  rows. `saveQuestion` checks the subject and topic against the course's
  list the same way — a retired word only when the question already
  carries it — before the key refuses it in Postgres's words.
  `importItems` repeats the list check on what it receives.
- The bank page (`question-bank-client.tsx`): Subject and Main Topic
  become dropdowns from the lists, "— Not set —" first, retired words
  left out unless the question carries one (shown "(retired)"). The CSV
  dialog is handed the lists for its report.

**Code, second session — the Subjects & topics panel.** A button
beside Tags, enabled once a course is picked, opening a card above the
list as Tags does (`subjects-topics-panel.tsx`, beside its caller). The
two lists side by side, stacked under 768px, each entry with its
question count and a line for the questions not set; the counts read
in pages (RM_PED_OBS_HRN holds 1,080). Per entry: **rename** (the list
row's name changes and the key carries it to every question; onto an
entry already there it is a **merge** and asks first), **merge** (the
questions move to the chosen entry, then the emptied entry is
deleted; asks first), **retire / restore**, **delete** (refused while
any question uses it, with the count). On a topic holding a "/",
**Split**: the admin picks which part is the topic (the first by
default), the questions move to it — added to the list if new — and the
other parts join their tags, snapped to the spellings in use; the
emptied entry is then deleted; asks first. Every move stamps
`updated_by`. Actions in `lib/bank/actions.ts` through the service
role.

**Done when.** The migration applied on dev: both tables seeded, the
eight subjects cleared, every row passing both keys, neither browser
role holding a grant on the new tables. The editor offers the course's
words and Not set; a save with a word not on the list is refused by
name; a CSV row naming an unknown or retired word is refused by name
in the report and by the action, `cardiology` lands as the list's
"Cardiology", a blank lands as Not set. In the panel: add a word and
use it; rename one and see every question carry it with no history row;
merge two; retire one and see it leave the dropdown; delete one in use
refused, unused accepted; split a double into its topic and a tag. The
builders, the runner and a pack unchanged. `npm run build` green; Sam
walks it.

**Reach.** Dev until the merge; from the apply, the dev site runs
`main`'s code against the new keys, where the admin page's free-text
Subject and Topic are refused by Postgres when the word is not on the
course's list — a save or an import batch of 50 fails with the
database's message. That reaches only Sam; no student read changes. At
the release the migration seeds prod's lists from prod's own words (a
course-name subject spelled differently there is seeded, not cleared,
and tidied in the panel). **At cutover the bank's re-copy (§11) must
seed the lists before the rows**, or the keys refuse the copy — a line
for the cutover script (queued on BUILD_LIST under 00).

**Built 2026-09-26**, ticked on Sam's walk, with no readers' check
(Sam). As the spec says, with these made at the build:

- The tidy step (spaces, empty strings, two spellings of one word)
  was added to the migration so the prod release cannot fail on the
  prod bank's words; it found nothing on dev. The comma rule was
  dropped from the name CHECK.
- A rename onto a word already on the list is refused by the action;
  the panel sees it first and asks as a merge, as the Tags panel does.
- The panel re-reads with every course read — after a save, an
  import, a question delete, or a change of its own — so its counts
  never lag the page.

**Proven on dev.** The migration in a rolled-back run, then applied:
151 subjects and 457 topics seeded, 3,600 course-name subjects cleared
and only those rows' `updated_at` moved, no version or history; a
rename cascading to 62 questions with no history row; delete in use,
an unknown word, a case twin and a padded name refused; `authenticated`
refused on both lists. Session 1: RN_MED's editor (no subjects, with
the hint; 78 topics); a retired topic kept and saved on its question
and not offered to another; the CSV report refusing "Cardio", a retired
"hematology" and a subject "Anatomy" by name; "cardiovascular" stored
as "Cardiovascular" and a blank as Not set. Session 2, on throwaway
words and questions since removed: add; a case twin refused; a rename
with no dialog reaching its question; a rename onto an existing word
turned into a merge that asked; a split keeping one part and tagging
the other, an existing tag kept; retire and restore; a delete in use
refused with its count, unused deletes accepted; 375px. The dev bank
was left as found (151 / 457, no drafts, nothing retired); one real
question, `GP_360697`, carries the tag "Prioritization" from Sam's own
walk of B4.

What the clean-up starts from (dev, 2026-09-26): RN_MED 78 topics,
RN_SURG 32, GP 31 — about 170 of them doubles like
"Cardiovascular/Emergency"; NACNAP Clinical 148 topics for 180
questions; NACNAP Preventive and RPHN PPHN 68 each; the two RMHN
courses no topic on any of 720 questions; the RM courses tidy (12 and
20); General Paper's subject 149 values, mostly source codes ("FUND",
"FUND – IPC"). The clean-up is content work for Sam and the writers,
done in the panel after the build. Before 03 Q10's report, which groups
by these words.

### B6 — The draws, and the student's read (S19)

Talked through and ruled 2026-09-26 (§3, the B6 block); scoped against
the code the same day. One session.

**What is already done, and what waits.** Every draw sees published
rows only — built in B4 (the builders' reads, the id check, the concept
search, both copiers refusing a draft). A mock's question can never be
free — built in B4, both doors. A free account's draws seeing free rows
only waits for free accounts: 09 F1 / F2. What B6 builds is the
hold-back, and S19.

**What the scoping found.** The two builders share their course load and
concept search (`loadBuilderCourse`, `searchBuilderConcepts` in
`lib/attempts/actions.ts`), so one filter covers both. A mock's
question list is readable only by the service role (03 Q1), so the
hold-back is worked out on the server and the browser is never told
which questions a mock holds — it simply never receives them. The
admin quiz editor is one component for both kinds (`quiz-manager.tsx`,
`loadPickerItems`). The builders do not use the batch option. The four
database functions that read the bank are definer or run by the
service role, and no browser-client read uses the nine columns S19
revokes.

**Storage.** No change for the hold-back — it is derived from
`mock_quizzes.item_ids` for mocks whose status is draft or active (a
join once 03 Q14's link table lands). One migration for S19:
`revoke select (stem, option_a … option_f, marks, shuffle_options) on
question_bank from authenticated`, proven in a rolled-back run under
`set role authenticated` (the nine refused, the ten filter columns and
the builders' reads passing) and checked in `role_column_grants` after
the apply.

**Code.**

- `lib/bank/queries.ts`: `heldBackIds(db, courseId?)` — the ids named
  by draft or active mocks, through the service role; null when the
  mocks cannot be read, and every caller then refuses rather than
  guesses.
- `lib/attempts/actions.ts`: `loadBuilderCourse` drops held-back rows
  from the pool and builds the topic, subtopic, difficulty and type
  options from what is left — a topic whose only questions are in a
  mock is not offered — instead of a second read of the table;
  `searchBuilderConcepts` drops held-back ids from its answer;
  `spawnBuilderAttempt` drops a held-back id sent by a stale or
  tampered browser, as it drops an unknown one.
- `lib/offline-packs/actions.ts`: `createOfflinePack` does the same.
- `lib/quizzes/actions.ts`: `loadPickerItems` takes the quiz's kind and
  returns the held-back ids with the rows; `saveQuiz` for a fixed quiz
  refuses a held-back id by name ("Question X is in a mock exam and
  cannot be in a fixed quiz"). The mock picker is unchanged — it shows
  every published question of the course, mock questions included.
- `components/quizzes/quiz-manager.tsx`: the fixed-quiz picker does not
  offer a held-back question (detail 3 for one it already holds).
- The daily challenge (09 G2) inherits the rule when it is built.

**The details, ruled** (§3, the B6 block, items 4–6): no retake rule
(a drafted "drop a now-held-back question from a practice retake" was
set aside — with mocks authored as drafts no practice attempt holds
one); the free tick's refusal moves from "any mock" to the hold-back's
draft-or-active; a fixed quiz that comes to hold a held-back question
shows it marked "In a mock" and refuses to save it, its start
unchanged. `mockReservedIds` becomes `heldBackIds` for both uses.

**Done when.** As a student holding RN_MED: the Quiz Builder's pool is
880, not 900 (the RN_MED mock's 20 held back), and a topic with only
mock questions is not offered; the keyword search leaves them out; a
build sent with a mock question drops it; the offline-pack builder the
same. The admin fixed-quiz picker for RN_MED shows 880; the mock picker
900. Archiving the mock returns its 20 to the pool, restoring it holds
them back. The free tick on an archived mock's question is accepted,
on an active one's refused. Under the student's role, `stem` refused
and the ten filter columns read. `npm run build` green; Sam walks it
on a student account (the builders need course access).

**Reach.** Dev only until the merge. The S19 migration reaches the dev
site's `main` code, which reads no question text through a student's
client — nothing breaks there. A student sees fewer questions in the
builders (a mock's own) and no other change.

### B7 — Whole-course reads past the 1,000-row cap (no storage change)

Found 2026-09-26 walking B4; queued the same day (Sam). The API hands
back at most 1,000 rows a request and says nothing when it stops.
RM_PED_OBS_HRN holds 1,080 questions, so the admin bank page shows
"1000 questions", and every read that takes a whole course is short
by the same 80 (the last by id, or an arbitrary 80 where the read has
no order): the two builders' pool (`getBuilderCourseItems`), their
topic, difficulty and type options (`getItemFilterOptions`), the
fixed-quiz and mock pickers and the admin page (`getItemsByFilters`).
The fix pages each such read until a short page comes back — the
shape `tagSpellingsInUse` already uses — or moves it server-side (the
admin list is B3's, which pages it fifty at a time).

**Reach.** Dev only today — the new app is not live. At cutover,
every student and admin of a course past 1,000 rows: RM_PED_OBS_HRN
now, and any course that grows past it. Before cutover.

### Later, under this doc

- **The link table** replacing the quiz tables' `item_ids` arrays —
  decided with §8 S12, queued 2026-09-26 as 03 Q14; the reservation
  check in B6 becomes a join when it lands.
- Content items on BUILD_LIST (the empty disease-control course, the
  midwifery shortfall, the set-size targets).
- A course *filter* on the admin bank page over every course at once
  (search the whole bank) — cheap once the table is one.
- **The free pool's door** (`09-free-account-and-gamification.md`
  F1): settled 2026-09-26 as the mark (B4's `is_free_sample`) and two
  doors, the read policy and attempt creation — §8 S16. The mark is
  built here; the doors are built under 09 F1 (S16 ticked 2026-09-26).

---

## 5. Ladder

| Slice | Date |
|---|---|
| B1 One table | ✅ 2026-09-19 (`20260920010000_question_bank.sql`; proven on dev — 5,281 rows, the eleven gone, 2,401 visible to the RN student and none of RM's, EXPLAIN a hashed SubPlan once per statement; walked by Sam: the builder, the runner, the admin bank page, packs, the picker) |
| B2 The answers server-only | ✅ 2026-09-21 (`20260921120000_question_bank_secret_half.sql`; the secret half and every write grant off the browser roles, the three write policies with them, the concept search a service-role function; proven on dev and walked both sides — §4) |
| B3 The admin page paged | ⬜ later |
| B4 The columns, the version and the history | ✅ 2026-09-26 (`20260926150000_question_bank_columns_history.sql`, `20260926160000_copiers_refuse_any_draft.sql`; the code in two sittings the same day; walked on dev and by Sam — §4) |
| B5 The lists and their panel | ✅ 2026-09-26 (`20260926170000_bank_subject_topic_lists.sql`; the code in two sittings the same day; walked on dev and by Sam — §4); the clean-up of the words is content work, in the panel |
| B6 The draws, and the student's read (S19) | ⬜ adopted 2026-09-26; talked through, scoped and ruled the same day (§3, the B6 block); S19 ✅ 2026-09-26; building |
| B7 Whole-course reads past the 1,000-row cap | ⬜ queued 2026-09-26 (Sam); found walking B4; before cutover |
