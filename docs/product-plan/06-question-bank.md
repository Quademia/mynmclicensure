# 06 — Question bank

The one store of questions every practice feature draws from: how a
question is written, classified, published, versioned and imported, and
who can read which part of it. The admin's Question Bank page is its
door.

Detail and history: `archive/product-plan/08-question-bank.md` (B1–B8).

## How it works

### One bank, gated

- **One table holds every course's questions**, each row carrying its
  course; its id is course-prefixed, unique across the bank, and never
  changes (Sam, 2026-09-19).
- **A student reads a question only in a course they hold** (Sam kept
  the course gate, 2026-09-19), or a question marked free (03). The
  admin reads all.
- **A student's browser can read only the ten filter columns** — id,
  course, subject, topic, subtopic, difficulty, type, batch, published,
  free — never the question, its options or its answer (S19). The
  answer reaches a student only through a sitting (04's seal).
- **Every write goes through the server behind the admin's check**
  (Sam, 2026-09-21); the browser has no write access at all.
- Every read of a whole course reads past the 1,000-row cap, in batches.

### A question

- **Types**: single answer (MCQ), True / False (TF), select all that
  apply (SATA). Six options, a feedback for each, the answer stored as
  letters ("b", "a,c,e"), a rationale and an optional image.
- **One answer rule**, used by the editor, the import report and the
  import: letters A–F; exactly one on MCQ and TF; a TF has options A and
  B only, both filled; every letter named has text; stored lower case,
  each letter once.
- **A question's type is fixed once saved** (Sam: A, 2026-09-27) — to
  change it, create a new question; the import refuses a row that would
  change one.
- **Difficulty** Easy / Moderate / Hard; **level** Remember, Understand,
  Apply, Analyse, Evaluate, Create (Ghana's spelling; "Analyze" in a
  file lands as "Analyse") (Sam, 2026-09-26).
- **Subjects and topics come from a list per course** (S18): the subject
  is the academic module, the paper is the course. Renaming a word in
  the list reaches every question; a word in use cannot be deleted.
  Subtopic stays free text. An empty subject or topic is **Not set** —
  no built-in "Other"; a Not set question reaches students only through
  "All topics". **One topic per question**; a second area is a tag.
- **Tags** are free text (Sam, 2026-09-26), suggested from the tags
  already in use across the bank, snapped to the spelling in use;
  semicolons between tags in a file.
- **Source** records where a question came from — internal, never shown
  to a student, never copied into a sitting.

### Publishing, versions, deleting

- **A new question is a draft** until published; a draft reaches no
  student read, search or draw, and a sitting refuses one.
- Unpublishing a question that live papers or mocks use asks first:
  "N quizzes will refuse to start until this question is published
  again". "Publish all shown" publishes the visible set.
- **A content change to a published question keeps the old version** in
  a history table (who, when) and adds one to its version; a label
  change or any change to a draft writes nothing; deleting a published
  question keeps a deleted row. **Restore is a save** (Sam,
  2026-09-26). The History panel to view a version is *(to build)*.
- **A question any paper or mock uses cannot be deleted**; the refusal
  names them and suggests unpublishing (Sam, 2026-09-27).

### Free, and held back

- **Free is a mark on a question** (Sam, 2026-09-26), not a separate
  pool; free questions stay in their paid course. The Free pool panel
  counts them per programme (the counts overlap across programmes).
- **A question a draft or active mock uses is held back**: the builder,
  the pack maker, the paper picker and the daily challenge skip it, and
  it can never be marked free — both the free tick and the mock's save
  refuse. Archiving the mock releases it (04).

### The importer

- Per course, from a template, with a row report; a row with an
  existing id updates it.
- Refuses an unknown or retired subject or topic, or a type,
  difficulty or level not on its list, naming the word; matching
  ignores case and stores the list's spelling; a blank cell is Not set.
- Per file the admin chooses "publish now or drafts" and "free or not";
  the choices reach only the rows the file creates.

### Search

- **Concept search runs on the server**: a literal match on subtopic,
  topic, question and rationale, ignoring case, over published questions
  only; it returns ids, never question text.

### The admin's page

- A course picker; Tags and Free pool panels (no course needed);
  Subjects & topics panel (a course needed) — add, rename, merge,
  retire, restore, split a topic holding "/". Filters for the five
  classifications plus Published, Free and Level; a Draft badge and
  Publish / Unpublish on each card. Everything stacks on a phone.
- **Paged fifty at a time, filtered by the database**, in place of
  loading the whole course. *(to build: B3)*

### Question reports *(to build)*

- **Report this question** replaces the "Send feedback" message threads
  (Sam, 2026-09-18): a reason from a list, the student's own answer
  attached, a status — new, reviewed, fixed, dismissed — and an admin
  page grouped by question with Mark fixed.

### Not taken

- MyNclex's whole quiz system (Sam, 2026-09-26) — revisit only for
  NGN-style or adaptive questions, and then as a planned rebuild.

## Open

- Whether students see a question's level (2026-09-26).
- What the importer does with an id that already sits in another
  course — today it moves the question into the page's course, or fails
  with the database's raw words when a quiz uses it (found 2026-09-27).
- A course filter over the whole bank on the admin page (never ruled).
- The answer of `RM_MID_PHILLI-S1-42`: "a & c" on a single-answer
  question, so nobody can get it right; its feedback reads as a SATA
  (Sam, 2026-09-27; likely live).
- Set-size targets per course — perhaps answered by Sam's "180 × 5
  fixed + about 180 × 5 for the builder" (2026-09-30); to confirm.
- Parked: a blueprint axis — adopted in principle, waiting on the NMC
  curricula Sam is getting in print (2026-09-26).
