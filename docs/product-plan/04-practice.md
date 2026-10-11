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

### The Quiz Builder

Ruled by Sam, 2026-10-11: the old five-step wizard's look on the new
builder's rules. His 10-09 canvas "Quiz Builder Redesign", and the
four-step page built from it, were set aside the same day.

- **Five steps, the old wizard's**: 1 Course & selection mode (the
  course list, Topics | Keyword, Recent setups) · 2 Topics or Keyword ·
  3 Filters · 4 Count & mode · 5 Review & build. The circles at the top,
  a tick on each step passed, any circle a way there; Next and Back in
  the step; the quiz built from the Review step only (its pool, count
  and time, the summary with Edit, the status box). The status line
  (below) sits above the circles. **Recent setups**: the last 5, kept
  on that device for that student. A "Weakest topic" start is later.
- **Topics or Keyword** (Sam: they are different). Topics: Use all
  topics, or tick some; a filter box that only searches the list,
  Select all shown, Clear; the picked ones as chips under the list.
  Keyword (Sam's word for the old Concept): a word matched from the
  start of a word in the question, its rationale, its topic or subtopic
  ("malar" finds malaria, "iron" not environment); "N questions contain
  …"; the topics they sit in, to narrow. The old subtopic list goes
  (free text, uneven).
- **Filters**: Which questions — All, New to me (never answered), Got
  wrong before (the latest answer wrong); Difficulty; Question type. A
  tick the next course lacks is dropped.
- **Count**: a slider and a number box from 5 to the builder's limit.
  Fewer than 5 match: Build greyed, the status box says why (04.1). The
  quiz is named by what was chosen: "All topics" never names three
  topics.
- **One builder for every status** (Sam, 2026-10-04, kept 2026-10-11):
  the server decides once, per student and course, whatever page opened
  it — the whole bank, the free questions only (03), or nothing; the
  modes open (on the free questions the exam modes shown locked, "open
  with a package"); the trial's quizzes left; the status line (11).
- **A trial student whose 3 quizzes are used** keeps building from the
  free questions, Study modes only, until the trial ends (Sam,
  2026-10-11: b).
- A dropped connection says so and offers Try again; the page never
  freezes.
- The offline pack builder keeps today's steps until its own redesign.

### Modes

- **Four modes in two groups** (Sam, 2026-09-27; MyNclex's codes):
  - **Study** — *Learning* (the answer and rationale after each
    question, no clock) and *Untimed practice* (no clock, results at
    the end).
  - **Exam** — *Free Navigation* (a wall clock, move freely) and
    *Sequential* (a wall clock, one question at a time, an answer
    required to move on, no going back, no flags; the lock held in the
    database).
- The daily challenge plays in a fifth mode of its own, never offered
  elsewhere (below; Sam, 2026-10-08).
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

Settled by Sam, 2026-10-08, replacing the 09-26 "seed from the date"
and "instant runner", which predate the four modes.

- **A set number of questions a day per programme** — an admin setting,
  5 to start — the same for everyone in it, free, trial and paid, from
  the free set (03). A change applies from the next day's draw.
- **The draw, made once a day**, by the first student to open it, and
  kept: the day, the programme, the course, the questions in order.
  - **One course a day**, the programme's own courses in their listed
    order, in turn. A General Paper is one of those courses only where
    the programme has one; no draw is shared between programmes (a
    programme may lack a General Paper or have its own).
  - A course with fewer free questions than the day needs is skipped;
    if none has enough, no challenge that day ("Back tomorrow").
  - Published, free, not held by a mock; the least recently drawn
    first, at random among equals, so a question returns as late as
    the pool allows.
  - The same order for everyone; the options shuffled per student.
  - An admin may swap a question before anyone has played that day;
    after that, void it — it leaves every score.
- **Its own mode**: Untimed practice's screen — a clock counting up,
  move freely, change answers until Submit, the answers and rationales
  straight after Submit. Unlike Untimed, the time is the server's from
  Start to Submit, leaving the page does not stop it, and the sitting
  submits what is answered at the limit: the number of questions × the
  builder's minutes per question (`builder_minutes_per_question`; NMC
  questions share one pace). The start screen says the time counts
  towards the ranking.
- **Once a day**: one challenge sitting per student per day, counted for
  the day it started.
- A new kind of sitting: every list that sorts sittings by kind learns
  it.
- A student's first challenge brings the username card (05).
- **Opened from the dashboard's top card**, for every status; no menu
  item of its own (Sam, 2026-10-04; 00, The menu).

### Mock exams

- **A mock's questions live nowhere else** (Sam, 2026-09-26): while a
  draft or active mock names a question, the builder, the pack maker,
  the paper picker and the daily challenge skip it, and it can never be
  marked free. Archiving a mock releases them.
- **Mocks open only when the package says yes** (03 F4) — and **only
  Premium Prep packages say yes** (Sam, 2026-10-04): mocks are seasonal,
  built for the main August/September sitting (02, built 2026-10-04).
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

- **Practice Papers' look** (2026-10-11, unanswered): today's page kept
  and Q21, the trial's lock and the ended line added (recommended), or
  a design first.
- **A free student who never trialled, on Practice Papers** (2026-10-11,
  unanswered): the programme's papers listed and locked, "Opens with a
  package" (recommended), or the empty page of today.
- **Q3 — mock exams' design**, none decided: an exam window with one
  timed sitting, no retake, no Study modes; results released on a date;
  cohort standing; notices when a mock opens and results land; a
  closing window submitting what is in progress; timing like the real
  paper; how many mocks per programme.
- **Q7 — the partial-credit rule**: a fraction of the options;
  MyNclex's plus-and-minus with a floor of zero; or all-or-nothing kept
  for mocks.
- **The builder's minimum for packs** — the quiz builder's is 5
  (2026-10-11); whether the pack builder takes it too, at its redesign.
- **A timed build taking its limit from the page** (10-03, unruled) —
  its reason ("matters once points score sittings") went with points.
- **Q15** — a "Marked" pool for the builder, marks kept across sittings
  (captured 2026-09-26, never ruled; needs storage).
- **The word on screen** — "attempt", "sitting" or "session" (2026-09-20).
- **Wording waiting for Sam** (2026-09-27): the pop-up's words, a
  resumed exam's brief, the help page's "Study and Exam modes".
- An admin's view of a student's report — not done, not queued (10-01).
- Parked: undo "Don't show this again" — in a settings page, if one is
  ever built (Sam, 2026-09-27).
