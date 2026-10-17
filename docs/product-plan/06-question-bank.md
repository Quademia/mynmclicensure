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
  the course gate, 2026-09-19), or a question in the Free pool (03). The
  admin reads all.
- **A student's browser can read only the ten filter columns** — id,
  course, subject, topic, subtopic, difficulty, type, batch, published,
  free — never the question, its options or its answer (12). The
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
- **Subjects and topics come from a list per course** (12): the subject
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

### Pools *(06.8, built 2026-10-15)*

Ruled by Sam, 2026-10-15, replacing "free is a mark" and "held back":
**every question belongs to one pool**, set by the admin when it
is written or imported, and each place that draws from the bank reads
only its own — so nothing depends on a paper's or mock's state, and
archiving releases nothing.

- **Practice** — the Quiz Builder, offline packs and the daily challenge.
- **Free** — the free set (03); a paid student's Builder and packs read
  Free with Practice, so free questions are never lost to them.
- **Paper** — a practice paper may hold only its course's Paper questions.
- **Mock** — a mock may hold only its course's Mock questions; one
  question may sit in several mocks, across years.
- The database holds it: a paper's or mock's list refuses another pool's
  question, and the Builder's, the packs', the free set's and the
  challenge's draws read their pools. Moving a question to another pool
  (retiring an old mock's questions to Practice) is the admin's own
  change; a question a paper or mock still lists cannot leave its pool.
- **Free per course: 50 as the admin's guide** (Sam), not a rule in the
  code; more as the bank grows. A student usually has three courses.
- Why: "held back while a draft or active paper or mock lists it" leaked
  whenever the listing changed — archiving before the results date
  (04.21), a question taken off a mock, a mock question not yet added.
  The challenge reads Practice, not a pool of its own: about 365 new
  questions a course a year was not worth it (Sam).
- The admin's page: a Pool choice in the editor (with its hint), a Pool
  filter, the pool on each card; the importer's pool per file; a paper's
  and a mock's question picker offer their own pool only. The Free pool
  panel counts the Free pool per programme.
- Replaced (history): "free is a mark" (2026-09-26) and "held back while
  a draft or active mock or paper uses it" (2026-09-26, 2026-10-11).

### The importer

- Per course, from a template, with a row report; a row with an
  existing id updates it.
- Refuses an unknown or retired subject or topic, or a type,
  difficulty or level not on its list, naming the word; matching
  ignores case and stores the list's spelling; a blank cell is Not set.
- Per file the admin chooses "publish now or drafts" and "free or not";
  the choices reach only the rows the file creates. Since 06.8 the
  second choice is the file's pool — Practice, Free, Paper or Mock.

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

### Question reports *(built 2026-10-17: 06.2)*

Ruled by Sam, 2026-09-18, and in full 2026-10-17 — planned with the
support desk (08.2) and built with it, the two kept apart: a mistake in
a question goes here, a conversation goes to Messages. Only questions
are reported: one question is seen by many students and fixed once.

- **"Report an issue"** under each question, beside Flag, with a speech
  bubble holding "!" (in place of "Send feedback"; not "Feedback", which
  the sitting already uses for the explanations, nor "Flag").
- **A tap opens a box inside the sitting** — the app's dialog, no new
  tab, the sitting stays; in a timed exam the clock runs on. The box,
  "Report an issue with this question" (drawn as B, the smallest), a
  reason chosen from a dropdown — The answer is wrong ·
  The question is unclear · A spelling mistake or typo · The picture is
  missing or wrong · The explanation is wrong · I don't understand the
  answer · Something else (a note required) — an optional note, Send.
  **"I don't understand the answer" sends no report**: it opens Messages
  with the course and the question quoted.
- Wherever a question shows — answering, review, a timed exam — for
  every student, free, trial, paid or ended. **One open report per
  student per question**; a second tap says "You've already reported
  this question". The student hears nothing back: a toast, "Thanks,
  we'll look at it".
- A report keeps the question, its course, the sitting, the reason, the
  note, the student's answer, a status — new, fixed, dismissed
  ("reviewed" dropped, no button set it) — and who closed it and when
  (the table ticked 2026-10-17, 12).
- **The admin's Question reports page** (drawn as B with C's detail,
  Sam, 2026-10-17): a quiet list, **most reports first**, a line per
  question — the count, the start of the question, its course and
  reasons, the newest date. A tap opens the line in place onto the whole
  question: its options with the bank's answer marked, each student's
  report with their own answer, Open in the bank, Dismiss and Mark fixed
  — the last two close all its open reports. Twenty questions a page.
  **Two tabs, Open · Closed** (Sam, 2026-10-17): Closed is read only —
  each close a line, newest first, "Fixed by …" or "Dismissed by …" and
  the date, opening onto the question and the reports it closed. No
  Reopen for now: a student can report the question again.
- Parked: a thumbs-up on a question ("Was this question helpful?"), so
  praise has its own place; decided once students use the app (06.9).

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
