# 04 — Practice

How a student practises: practice papers, mock exams and builder
quizzes all play in one sitting screen with four modes, each ending in
a results pop-up and an attempt report. The daily challenge is a fourth
kind of sitting. What a free or trial student may open is in 03; what
each page shows per state is in 11.

Detail and history: `archive/product-plan/03-quiz-system.md` (Q1–Q21)
and `archive/product-plan/09-free-account-and-gamification.md` (G2).

## How it works

### Three kinds of sitting

- **Practice papers** — a fixed list of questions an admin picks, the
  same for everyone (stored as "fixed quizzes").
- **Mock exams** — the same shape, in a table of their own; the two
  stay two (Sam, 2026-09-18).
- **Builder quizzes** — the student picks a course, topics or a
  keyword, the difficulty, a count up to the builder's limit (Config),
  and a mode; the bank draws the questions, so every build differs.
- **The name readers see is "Practice Papers"** — sidebar, titles,
  dashboard, course page, history, help, public copy, admin. Each paper
  is "Practice Paper N", with the course's full name above it wherever
  it shows away from its course; the address `/student/practice-papers`.
  "Fixed quiz" stays the word in the code (Sam, 2026-10-02). *(to
  build: Q21)*
- A paper or mock is offered only when active, published and inside its
  window, on the server's clock — one check serves the lists, Start and
  Retake; outside it the card says UPCOMING or CLOSED. A student reads
  only the open papers and mocks of courses they hold; a paper's
  question list and admin notes never reach the browser.
- A paper's questions are rows keyed to the bank — its own course's
  questions, each once, in order. A question a paper or mock names
  cannot be deleted (unpublishing retires it).
- Archiving a paper is one-way; a restore lands on draft. The admin's
  stats keep papers and mocks apart and show retakes and abandons
  separately.

### Modes

- **Four modes in two groups** (Sam, 2026-09-27; MyNclex's codes):
  - **Study** — *Learning* (the answer and rationale after each
    question, no clock) and *Untimed practice* (no clock, results at
    the end).
  - **Exam** — *Free Navigation* (a wall clock, move freely) and
    *Sequential* (a wall clock, one question at a time, an answer
    required to move on, no going back, no flags; the lock held in the
    database).
- The admin ticks which modes a paper or mock allows (at least one);
  the lists show a section per allowed mode; the builder offers all
  four. One mode table drives every screen.
- An exam's time is the paper's limit, or one minute a question when
  none is set. **The database holds the deadline**, with 10 s of grace:
  late saves are refused, a late Submit closes at the deadline, a
  sitting left open is closed at the deadline on its next open.

### The sitting

- One address, `/session/<id>`, plays whatever the sitting is: in
  progress plays, finished opens its review, abandoned shows a card.
  Every way out goes to the sitting's home (the builder, Practice
  Papers or Mock Exams). At most one sitting in progress per paper per
  mode.
- **The start screen stands alone**: no question is sent until Start or
  Resume; an exam's clock starts at the press. It shows on every open —
  Start, then Resume; a resumed exam shows the minutes left. "Don't
  show this again" is per mode, remembered by the browser.
- Three question types: single answer (A–F), True / False (never
  shuffled), select all that apply (the exact set needed). Questions in
  pages, with a question grid and flags.
- **A sitting copies its questions when it is made**, so a later bank
  edit never changes it; a retake copies afresh from the live bank in
  the original order; abandoning keeps the answers.
- **Answers save per question**, half a second after the last tap; a
  failed save or Submit shows a toast and gives the button back. Every
  write and all grading run in the database; the browser never supplies
  a score.
- **The answer key is sealed**: a live sitting gets only the public half
  of each question; Learning's Check Answer returns that one question's
  key and rationale ("Checking…" on the option until it lands); an exam
  gets no keys; the review gets all of them.
- **Time per question counts engaged time only** (Sam, 2026-09-29):
  while the question is on screen and the page in view, at most 10
  minutes a stretch, never in review or preview. A Study sitting's time
  is the sum of its questions; an exam's comes from the server clock.
  Study shows a stopwatch and a question clock under one Hide / Show
  per sitting (not remembered); an exam's countdown is never hidden.
- **Report this question** in the sitting, in place of Send feedback
  (06). *(to build)*

### Results and the report

- **A results pop-up, once, at the finish**: "Quiz complete", "Exam
  complete" or "Time is up"; the grade word (at 80 / 70 / 50, Sam
  2026-09-22), the percentage, N of M correct, correct / wrong /
  unanswered, the mode, the time. Buttons: See your report (the main
  one), Review answers, Retake where allowed, the way back. A score pill
  in the header reopens it.
- **The attempt report is its own page**, `/student/report/<id>` (Sam,
  2026-09-30): views by topic, difficulty, subject and type (each only
  when the sitting has two or more values); the weakest 8, then Show
  all; advice only from a topic with at least 3 questions, "Practise
  this topic" opening the builder at that topic; a question map
  (All / Wrong / Unanswered) into the review; time on task, pace and the
  three longest questions. Reached from the pop-up and from each
  finished card in Learning History.
- A pass mark per paper and Passed / Didn't pass on the results — later
  (Sam, 2026-09-27). *(to build)*
- Partial credit for select-all-that-apply, with a three-state display
  — the rule first (open). *(to build: Q7)*

### The daily challenge *(to build: G2, before the leaderboard)*

- **Five questions a day per programme**, the same five for everyone in
  it — free, trial and paid — drawn from the free set (03) by a seed
  from the date, played in the instant runner (Sam, 2026-09-26).
- **One course a day**, the programme's courses in turn (Sam,
  2026-10-04); a sitting stays one course's.
- Each day's five can be answered only that day, and once. The engaged
  seconds are kept — time breaks a tie on the board (05). The seal
  holds. A question may return after some months.
- A new kind of sitting: every list that sorts sittings by kind learns
  it.
- A student's first challenge brings the username card (05).

### Mock exams

- **A mock's questions live nowhere else** (Sam, 2026-09-26): while a
  draft or active mock names a question, the builder, the pack maker,
  the paper picker and the daily challenge skip it, and it can never be
  marked free. Archiving a mock releases them.
- **Mocks open only when the package says yes** (03 F4) — and **only
  Premium Prep packages say yes** (Sam, 2026-10-04): mocks are seasonal,
  built for the main August/September sitting (02). *(to build: 02.10)*
- Mocks as a premium exam experience is a design item not yet started
  (Q3, parked). Noted for it: mocks serve members who come near the
  exam and leave; a mock stays active across cohorts; its questions are
  written as drafts and published when it goes live.

### For the admin

- Mode ticks under Study and Exam on the paper and mock editors; the
  "Open in trial" tick on a paper (03). The mock list shows 50 at a
  time.
- The admin can preview any sitting, read-only. It will say Preview on
  the card and in the sitting, with no "Don't show this again". *(to
  build: Q19)*
- A Preview button on the paper editor: the paper's questions, answers
  and rationales as a student sees them, with no sitting made. *(to
  build: Q20)*

## Open

- **Q3 — mock exams' design**, none decided: an exam window with one
  timed sitting, no retake, no Study modes; results released on a date;
  cohort standing; notices when a mock opens and results land; a
  closing window submitting what is in progress; timing like the real
  paper; how many mocks per programme.
- **Q7 — the partial-credit rule**: a fraction of the options;
  MyNclex's plus-and-minus with a floor of zero; or all-or-nothing kept
  for mocks.
- **The builder's minimum of 5 questions** (Sam, 2026-09-30): what
  happens when fewer match, where the check lives, whether packs too.
- **A timed build taking its limit from the page** (10-03, unruled) —
  its reason ("matters once points score sittings") went with points.
- **Q15** — a "Marked" pool for the builder, marks kept across sittings
  (captured 2026-09-26, never ruled; needs storage).
- **Q16** — the keyword step never says what matched: A, say "N
  questions match" and build the chips from the matches (recommended);
  B, fill subtopics as content; C, both. Sam: not now (2026-09-27).
- **The word on screen** — "attempt", "sitting" or "session" (2026-09-20).
- **The daily challenge**: the size of its question set and how it
  rotates; the courses' order; whether a General Paper day is the same
  five for every programme; shuffling options per student (a view).
- **Wording waiting for Sam** (2026-09-27): the pop-up's words, a
  resumed exam's brief, the help page's "Study and Exam modes".
- An admin's view of a student's report — not done, not queued (10-01).
- Parked: undo "Don't show this again" — in a settings page, if one is
  ever built (Sam, 2026-09-27).
