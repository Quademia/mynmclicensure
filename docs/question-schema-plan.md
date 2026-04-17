# Plan: Question Schema Enhancements + Library Rebuild

**Status:** Phase 1 COMPLETE — Phase 2 COMPLETE — Phase 3 COMPLETE
**Created:** 2026-04-08

## Context

MyTeacher's question bank (`teacher_bank_items`) needs three new fields: `question_ref` (teacher's own reference code for numbering questions), `tags` (freeform labels), and `batch_id` (upload batch tracking). The shared library currently borrows NMC Licensure `items_*` tables — this is temporary and needs replacing with dedicated library tables (`teacher_library_anatomy`, `teacher_library_physiology`, etc.) decoupled from NMC. Both systems get the new columns. Phased rollout.

### Key Decisions Made
- NMC and MyTeacher question schemas stay separate — no alignment needed
- Library keeps the one-table-per-course pattern (e.g. `teacher_library_anatomy`) — not a single unified table
- `teacher_library_courses.items_table` stays — it just points to new `teacher_library_*` tables instead of NMC `items_*`
- `question_ref` is unique per teacher (two teachers can independently use the same ref code)
- `tags` is a TEXT[] array column (not a junction table)
- Library content is admin-managed only — teachers browse and copy, they don't contribute
- Both library tables and `teacher_bank_items` get the new columns

---

## Phase 1: Add question_ref, tags, batch_id to `teacher_bank_items`

### 1A. Schema — ALTER teacher_bank_items

```sql
ALTER TABLE teacher_bank_items
  ADD COLUMN question_ref TEXT,
  ADD COLUMN tags         TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN batch_id     TEXT,
  ADD COLUMN year_level   TEXT,
  ADD COLUMN bloom_level  TEXT;

-- question_ref is unique per teacher (two teachers can have same ref)
CREATE UNIQUE INDEX idx_bank_question_ref
  ON teacher_bank_items (teacher_id, question_ref)
  WHERE question_ref IS NOT NULL;

CREATE INDEX idx_bank_tags ON teacher_bank_items USING GIN (tags);
CREATE INDEX idx_bank_batch ON teacher_bank_items (batch_id);
CREATE INDEX idx_bank_year ON teacher_bank_items (year_level);
CREATE INDEX idx_bank_bloom ON teacher_bank_items (bloom_level);
```

- `question_ref`: nullable TEXT, unique per teacher (partial unique index ignoring nulls)
- `tags`: TEXT[] with GIN index for `@>` (contains) queries
- `batch_id`: nullable TEXT for grouping bulk uploads
- `year_level`: e.g. 'Year 1', 'Year 2', 'Level 100', 'Level 200'
- `bloom_level`: Remember | Understand | Apply | Analyse | Evaluate | Create

### 1B. Schema — ALTER teacher_quiz_items (snapshot)

```sql
ALTER TABLE teacher_quiz_items
  ADD COLUMN snap_question_ref TEXT,
  ADD COLUMN snap_tags         TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN snap_year_level   TEXT,
  ADD COLUMN snap_bloom_level  TEXT;
```

No `batch_id` on snapshots — batch is an organisational concept, not a question property worth freezing.

### 1C. API Changes — `js/myteacher-api.js`

**`createBankItem()`** (line ~685): Add `question_ref`, `tags`, `batch_id`, `year_level`, `bloom_level` to the insert row.

**`updateBankItem()`** (line ~743): Already accepts any patch — no change needed, but add validation that `question_ref` uniqueness error is surfaced clearly.

**`getBankItemsPaginated()`** (line ~606): Add `question_ref`, `tags`, `batch_id`, `year_level`, `bloom_level` to the select list. Add filter support:
- `question_ref` — exact match or ilike
- `tags` — `@>` contains filter (e.g. filter by tag)
- `batch_id` — exact match
- `year_level` — exact match
- `bloom_level` — exact match

**`getBankFilterOptions()`** (line ~520): Add `tags` to the distinct values returned (flatten all arrays, deduplicate). Add `batch_id`, `year_level`, `bloom_level` to distinct values.

**`publishTeacherQuiz()`** (line ~1434): Include `snap_question_ref`, `snap_tags`, `snap_year_level`, `snap_bloom_level` in snapshot rows.

### 1D. UI Changes — `myteacher/teacher/bank.html`

**Editor panel** (line ~799): Add fields in Classification section:
- Question Ref: text input
- Tags: text input with comma-separated entry or chip-style UI
- Batch ID: text input
- Year Level: dropdown (Year 1, Year 2, Level 100, etc.)
- Bloom's Level: dropdown (Remember, Understand, Apply, Analyse, Evaluate, Create)

**Filter bar** (line ~725): Add:
- Tags dropdown (populated from `getBankFilterOptions()`)
- Batch dropdown (populated from `getBankFilterOptions()`)
- Year Level dropdown
- Bloom's Level dropdown

**Question cards** (line ~1252): Display question_ref badge and tag chips if present.

---

## Phase 2: New Library Tables (separate future work)

### 2A. Library Table Template

Each new course gets a table like `teacher_library_anatomy`:

```sql
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
-- year_level: e.g. 'Year 1', 'Year 2', 'Level 100', 'Level 200'
-- bloom_level: Remember | Understand | Apply | Analyse | Evaluate | Create

CREATE INDEX ON teacher_library_anatomy (maintopic);
CREATE INDEX ON teacher_library_anatomy (subtopic);
CREATE INDEX ON teacher_library_anatomy (difficulty);
CREATE INDEX ON teacher_library_anatomy USING GIN (tags);
CREATE INDEX ON teacher_library_anatomy (batch_id);
CREATE INDEX ON teacher_library_anatomy (year_level);
CREATE INDEX ON teacher_library_anatomy (bloom_level);
```

Compared to NMC `items_*` tables, library tables add: `question_ref`, `tags`, `batch_id`, `year_level`, `bloom_level`. Also `marks` is INTEGER (not NUMERIC).

### 2B. Reshape teacher_library_courses

Drop `program_scope` (NMC concept). Add columns for browsing and filtering.

```sql
ALTER TABLE teacher_library_courses
  DROP COLUMN program_scope,
  DROP COLUMN sort_order,
  ADD COLUMN description TEXT,
  ADD COLUMN programme   TEXT,
  ADD COLUMN faculty     TEXT,
  ADD COLUMN category    TEXT,
  ADD COLUMN year_group  TEXT,
  ADD COLUMN tags        TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX idx_lib_courses_programme ON teacher_library_courses (programme);
CREATE INDEX idx_lib_courses_faculty ON teacher_library_courses (faculty);
CREATE INDEX idx_lib_courses_category ON teacher_library_courses (category);
CREATE INDEX idx_lib_courses_year ON teacher_library_courses (year_group);
CREATE INDEX idx_lib_courses_tags ON teacher_library_courses USING GIN (tags);
```

- `programme`: academic programme — e.g. 'Nursing', 'Pharmacy', 'Midwifery'
- `faculty`: academic department — e.g. 'Health Sciences', 'Engineering', 'Arts'
- `category`: broad grouping — e.g. 'Sciences', 'Clinical', 'General'
- `year_group`: target student level — e.g. 'Year 1', 'Year 2', 'Postgraduate'
- `tags`: freeform labels — e.g. ['nursing', 'preclinical', 'elective']
- `description`: short course description for teachers browsing

Then replace seed data:

```sql
DELETE FROM teacher_library_courses;

INSERT INTO teacher_library_courses
  (course_id, title, description, programme, faculty, category, year_group, tags, status, items_table)
VALUES
  ('ANATOMY', 'Anatomy', 'Human anatomy questions', 'Nursing', 'Health Sciences', 'Sciences', 'Year 1',
   '{preclinical}', 'active', 'teacher_library_anatomy'),
  ('PHYSIOLOGY', 'Physiology', 'Human physiology questions', 'Nursing', 'Health Sciences', 'Sciences', 'Year 1',
   '{preclinical}', 'active', 'teacher_library_physiology');
  -- add more as needed
```

`items_table` column stays — it still points to the table name, just new `teacher_library_*` tables instead of NMC `items_*`.

### 2C. API Changes

**`resolveLibraryRefs()`** (line ~3347): No structural change needed — it already reads `items_table` from `teacher_library_courses` and queries dynamically. The new table names just work.

**`getLibraryItems()`** (line ~3270): No change — already takes `tableName` as parameter.

**`getLibraryFilterOptions()`** (line ~3296): Add `tags` to the distinct values returned (like bank filters).

**`library.html`**: Add tags filter dropdown. Minor UI updates for new filter.

### 2D. Existing LIB: Refs

Old refs like `LIB:GP:GP_001` in existing quiz drafts will break once NMC courses are removed from `teacher_library_courses`. Options:
- Keep NMC rows in `teacher_library_courses` as read-only legacy entries (safe)
- Or accept that unpublished drafts referencing NMC items will show as "missing" (acceptable if no active drafts use them)

**Already-published quizzes are safe** — they use frozen snapshots in `teacher_quiz_items`, not live refs.

---

## Files to Modify

### Phase 1
| File | Change |
|---|---|
| `db/schema.sql` | Add question_ref, tags, batch_id columns + indexes to teacher_bank_items and teacher_quiz_items |
| `js/myteacher-api.js` | Update createBankItem, getBankItemsPaginated, getBankFilterOptions, publishTeacherQuiz |
| `myteacher/teacher/bank.html` | Add editor fields, filter dropdowns, card display for new columns |

### Phase 2
| File | Change |
|---|---|
| `db/schema.sql` | Add teacher_library_* table definitions, update teacher_library_courses comments |
| `db/prod-setup/04_seed_data.sql` | Replace NMC seed rows with academic course rows |
| `js/myteacher-api.js` | Update getLibraryFilterOptions to include tags |
| `myteacher/teacher/library.html` | Add tags filter |

---

## Phase 3: Update CSV Import to support new columns (COMPLETE — 2026-04-10)

The CSV import page (`myteacher/teacher/import.html`) was built before Phase 1. It needs updating to support the new columns.

### 3A. Update `ALL_COLS` array (line ~395)

Add `question_ref`, `tags`, `batch_id`, `year_level`, `bloom_level` to the column list.

### 3B. Update `doImport()` payload (line ~668)

Add the new fields to the payload passed to `createBankItem()`:
- `question_ref` — straight from CSV
- `tags` — parse comma-separated string into array (e.g. "cardio, exam" → ['cardio', 'exam'])
- `batch_id` — straight from CSV
- `year_level` — straight from CSV
- `bloom_level` — straight from CSV

### 3C. Update CSV template download (line ~414)

Add the new columns to the header and example rows so teachers downloading the template see them.

### 3D. Update AI prompt text (line ~192)

The prompt that teachers copy to AI assistants for converting questions to CSV format needs to mention the new columns and their valid values (especially `bloom_level`: Remember | Understand | Apply | Analyse | Evaluate | Create).

### Files to Modify

| File | Change |
|---|---|
| `myteacher/teacher/import.html` | ALL_COLS, doImport payload, template download, AI prompt, instructions section |

---

## Verification

### Phase 1
1. Run ALTER statements in Supabase SQL editor
2. Create a bank item with question_ref, tags, and batch_id — verify it saves and displays
3. Create a second item with same question_ref under same teacher — verify unique constraint rejects it
4. Filter by tag and batch — verify results
5. Publish a quiz with items that have ref/tags — verify snapshots capture them
6. Preview the bank page — verify ref badges and tag chips render

### Phase 2
1. Create teacher_library_anatomy table in Supabase
2. Insert test items
3. Add row to teacher_library_courses pointing to teacher_library_anatomy
4. Browse library page — verify items load with filters
5. Add library item to quiz draft — verify LIB: ref resolves
6. Publish quiz — verify snapshot captures library item
