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

One migration: `bank_subjects`, `bank_topics`, the keys, seeded from
the words already in the bank per course — the seed is the first-draft
list, and Sam corrects it in the panel. Code: the editor's dropdowns,
the importer's refusal with the word named, the Topics panel on the
Courses page. The clean-up per course — the two RMHN files relabelled,
NACNAP regrouped, General Paper's subject sorted into perhaps eight —
is content work in the CSVs, re-imported through the same door.
Before 03 Q10's report, which groups by these words.

### B6 — The draws (no storage change)

The three student draws and the fixed-quiz picker skip any question a
mock names; a free account's draws see free rows only; every draw sees
published rows only. The migration's overlap list for Sam. Written
into 03 Q3 as its first settled ingredient.

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
| B5 The lists and their panel | ⬜ adopted 2026-09-26; §8 S18 ✅ 2026-09-26; the clean-up is content work |
| B6 The draws | ⬜ adopted 2026-09-26; no storage change |
| B7 Whole-course reads past the 1,000-row cap | ⬜ queued 2026-09-26 (Sam); found walking B4; before cutover |
