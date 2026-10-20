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
  "Fixed quiz" stays the word in the code (Sam, 2026-10-02). *(built 2026-10-12 on the student side)*
- **The first sitting of a paper is in its first-sitting mode** (Sam,
  2026-10-11). The admin picks it per paper from a dropdown, "First
  sitting in", with Free Navigation already picked on a new paper (the
  official exam is like Free Navigation: one clock, move freely). The
  paper's other ways, which the admin ticks, open to a student once they
  have **finished** it in that mode — submitted, or the time ran out; an
  abandoned or unfinished sitting does not count. Every first sitting of
  a paper is then alike, which the percentile counts on (05). *(built
  2026-10-12)*
- **A paper's questions are kept out of the Quiz Builder** (Sam,
  2026-10-11), as a mock's are: the builder, the pack maker, the free
  set and the daily challenge skip them (06). A student studies them
  through the paper, in its other ways, once the first sitting is done.
  So a course needs questions beyond its papers — five papers of 180
  (General Paper 100) and about as many again for the builder: about
  1,800 a course (General Paper 1,000), mocks on top. *(built 2026-10-12)*
- **Practice Papers, redesigned** (Sam, 2026-10-12; drawn on the canvas
  https://claude.ai/artifact/XyTdnfwmtswW6Xf6Wq69Cg, boards D, E, F; the
  page described in `11-pages.md`). Three screens, none sized by a
  number: **the courses** (one row each: name, one line, a bar of the
  course's papers), **a course** (an "Up next" card, then one plain row
  per paper) and **a paper's own page**. No chips, badges, filters or
  strips. A paper the student cannot open is a grey line, "Opens with a
  package", no button; Choose a package appears once, at the bottom.
  A paper's page has one main card that follows the student: Start in
  the first-sitting mode, then Resume, then the score with See your
  report and **Practise again**; Practise again opens the shared dialog
  with the four ways, each with a Start. Before the first sitting is
  finished one grey line says more ways open after it. The page lists
  the student's sittings, each with its score or Resume. **Nothing
  counts a paper's questions, time or number of papers into the page:**
  each comes from the paper (its size, its time limit or one minute a
  question, as many papers as the course has). Not a single-course
  shortcut (the General Paper makes two courses the norm). *(built 2026-10-12)*
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

### A paper's and a mock's settings *(04.10, 04.11 built 2026-10-14; 04.12, 04.13, 04.14 built 2026-10-15)*

Papers and mocks carry the same settings (Sam, 2026-10-13: "they are
the same settings almost"). Drawn with the Mock exams page at
https://claude.ai/artifact/5QQCWH9ECauT7k69cUUxC3 (board B).

- **First sitting in** — a mock's first sitting is in its own mode, as
  a paper's is (04.5): the same dropdown on the mock form. *(built
  2026-10-14; the student's mock page shows it with 04.15)*
- **Sittings allowed** — how many times a student may sit it; empty is
  no limit, and every paper and mock starts empty. One count for every
  mode together, the first sitting included, so "1" is one sitting only.
  A sitting counts when it starts — finished, in progress or abandoned
  (else Abandon is a free look and restart); one in progress resumes,
  never a second. The database counts, so Start, Practise again and
  Retake (Learning History, the report) are refused alike. The student
  sees it only when it is set: "You can sit this mock 2 times", "1 of 2
  sittings left", "Your last sitting of this mock is in progress"; with
  none left the score and the report stay, and Practise again and Retake
  go. With a limit set, one sitting at a time (Sam, 2026-10-14): while a
  sitting is going the card offers Resume, not Practise again. The start
  screen always shows, with "This is sitting 1 of 2 for this paper" ("It
  is your last" on the last) and no "Don't show this again". A trial's
  sittings count too. Moodle's "Attempts allowed" works so. Parked: an
  admin giving one student an extra sitting. *(built 2026-10-14 for
  papers; a mock's page shows it with 04.15)*
- **Results** — Immediately (the default) or On a date and time (Ghana
  time). On a date holds everything — the score, the report, the
  answers and the explanations — until the date, or until Submit when
  that is later. The results pop-up says "Submitted. Your results come
  out on …"; every place a score shows says "Results on …"; questions
  mastered and the weakest topic wait too, or they would give the score
  away. While results are held, a further sitting is in the first
  sitting's mode only — Practise again offers that mode alone, and the
  others open on the date (Sam, 2026-10-15: Learning would show the
  answers) — and the first sitting must be in an exam mode (the form
  refuses a Study mode). How many sittings is the admin's, through
  Sittings allowed: no rule of its own (Sam, 2026-10-15: "if admin wanted
  to use the feature well, he will allow only one sitting"); the form's
  hint says so, and that the date is best at or after the close. The
  database holds them, not only the page. Papers normally stay on
  Immediately; the trial paper has no rule of its own (Sam). The two new
  screens — the pop-up after Submit (with the mode, the time and how many
  were answered) and a held sitting opened again — were drawn and picked
  at https://claude.ai/artifact/WAmbBUrhVzsy5scNkfQD1k (pop-up B, held
  sitting A). *(built 2026-10-15)*
- **Review** — Always (the default), Until a date and time, or Not
  allowed (Sam, 2026-10-15, replacing "open for N days after results"):
  its own date, one for every student, independent of the results date —
  before the results date nothing is reviewed anyway (04.12); after the
  review's close nothing is, whatever the mode. Not allowed: the score
  and the summary only, ever. While closed the score, the report's
  summary (its topic breakdown and what to fix next included) and the
  sittings stay; the question-by-question review and the question map
  close — "The review of this mock closed on 4 November." / "The answers
  to this mock are not shown." — and only Learning shuts among the ways
  to practise (Sam: the other modes show the summary only); a sitting
  finished then shows its score and counts, no Review answers. While
  open with a date the card says "Review open until …". The form refuses
  Until with no date, a close on or before the results date ("choose Not
  allowed"), Not allowed with Learning ticked, and Until with a Learning
  first sitting; it warns when students could sit after the close. The
  settings are live, not copied to a sitting (Sam): the form says
  changes reach sittings already taken. The database holds it. *(built
  2026-10-15)*
- **When a paper or mock closes** — no new sitting starts. A timed
  sitting started before the close runs to the end of its own clock; an
  untimed one is finished at the close, scored on what was answered, the
  next time it is opened or an answer is saved; with no answer saved it
  is Abandoned at the close instead — not scored, still a sitting — and an
  exam whose Start was never pressed cannot start after the close (Sam,
  2026-10-15). The card's Resume follows the same rule, straight to the
  sitting: Resume while an exam's own clock runs ("Your sitting runs to
  the end of its time."), See your score otherwise ("This paper closed on
  20 October, so this sitting is finished on what you answered."), the
  line alone when nothing was answered. The sitting opened, or the next
  tap in an open one, finishes it and shows the line. *(built 2026-10-15)*
- **What a student keeps of a closed paper or mock they sat**: the
  score, the report, the review (inside its period) and the sittings —
  no new sitting. A student whose package ended keeps the score and the
  summary, the review locked (03 F2). A student who moved from Premium
  Prep to Full Access keeps the review of the mocks they sat (Sam).

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
- The pack builder is this builder with a pack's extras (07.2, 2026-10-15).

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
  the original order; abandoning keeps the answers. **Abandon** (04.20, Sam, 2026-10-14, back after 04.15 dropped it): a quiet link under Resume on a paper's or mock's page, while a sitting is going, with the app's confirm box ("It won't be scored, and you can start a new one"; with a limit, "It still counts as one of your N sittings"). The sitting ends unscored, answers kept; it does not unlock the other modes, count toward the percentile, or give back a sitting.
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
- **Report an issue** in the sitting, in place of Send feedback
  (06). *(built 2026-10-17: 06.2)*

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
and "instant runner", which predate the four modes; gone over again
with the leaderboards on 2026-10-20 (05), both to be built before going
live.

- **For signed-in students only** (Sam, 2026-10-20): free, trial and
  paid alike; no play for visitors — today's answers would be out before
  the boards count, and "once a day" needs a person.
- **A set number of questions a day per programme** — an admin setting,
  5 to start — the same for everyone in it, free, trial and paid, from
  **the Practice pool** (06.8, Sam 2026-10-15; reconfirmed 2026-10-20).
  Not the free set: about 50 a course, drawn every third day, it would
  repeat within a month and show nothing new; Practice (about 900 a
  course) returns a question after a year or more, so the boards measure
  knowing, not remembering. A free student sees five Practice questions
  a day this way, never chosen and never kept (below). A change to the
  number applies from the next day's draw.
- **The draw, made once a day**, by the first student to open it, and
  kept: the day, the programme, the course, the questions in order.
  - **One course a day**, the programme's own courses in turn, in the
    order the app lists them — by name (Sam, 2026-10-20); a new course
    takes its place by name. A General Paper is one of those courses
    only where the programme has one; no draw is shared between
    programmes (a programme may lack a General Paper or have its own).
  - A course with fewer Practice questions than the day needs is
    skipped; if none has enough, no challenge that day ("Back
    tomorrow").
  - Published, in the Practice pool (so never a paper's or a mock's,
    06.8); the least recently drawn first, at random among equals, so a
    question returns as late as the pool allows.
  - The same order for everyone; the options shuffled per student.
  - An admin may swap a question before anyone has played that day;
    after that, void it — it leaves every score.
- **Kept apart from the quizzes** (Sam, 2026-10-20; the tables in 12):
  a challenge is not a sitting — it has its own plays and answers, so
  papers, mocks and the builder are untouched. The day's questions are
  stored once, on the day's paper, for everyone (Sam's idea, in place of
  a copy in every student's sitting); a play's answer lines say what was
  chosen and are marked against the paper. A question a paper has used
  is unpublished, never deleted, as a paper's. One number of questions
  for every programme. Played on the quiz screen every sitting uses, from
  a page of its own, `/challenge/play` (Sam: "a player on a different
  route that uses the shared things"; built 2026-10-20, 04.25); `/challenge`
  waits for its home page. The clock shows "1:23 / 5:00". Report an
  issue waits for 04.31.
- **Built first without the leaderboards** (Sam, 2026-10-20): the
  challenge plays, marks and shows "4 of 5 right" on its own; the join
  offer, the start screen's leaderboards box and the results' rank lines
  come with the leaderboards (05 G1b). Every play keeps its school and
  time from the first day, and past challenges count once a student
  joins.
- **Its own mode, Challenge mode** (named 2026-10-20): Untimed
  practice's screen — a clock counting up, move freely, change answers
  until Submit, the answers and rationales straight after Submit.
  Unlike Untimed, the time is the server's from Start to Submit,
  leaving the page does not stop it, and the sitting submits what is
  answered at the limit: the number of questions × the builder's
  minutes per question (`builder_minutes_per_question`; NMC questions
  share one pace). The name shows in the sitting's header.
- **A start screen of its own** (Sam, 2026-10-20: A, drawn), not the
  card every quiz shares: "Today's challenge", the course, the date;
  the number of questions, the minutes and "Challenge mode"; its five
  rules, each with a small icon — the clock starts at Start and keeps
  running if you leave; move and change answers until you submit; at
  the limit what is answered is submitted; answers and explanations
  straight after, until midnight; one go a day. A box beneath: "Your
  time counts towards the leaderboards — right answers first, then
  time", with this week's rank, to a student who has joined; "Join the
  leaderboards ›" to one who has not. Start, Cancel, and "Don't show
  this again" as every mode has it (remembered by the phone), so a
  regular player goes from Play straight to the questions; the screen
  still shows the first time.
- **Once a day**: one challenge sitting per student per day, counted for
  the day it started.
- **The results: the pop-up every quiz has, over the answers** (Sam,
  2026-10-20: A, drawn — in place of a screen of its own or the answers
  with a strip): "Challenge done" (or "Time is up"), "4 of 5 right" —
  a count, no percentage or grade word — the time, five dots of right
  and wrong that jump to a question; to a student who has joined, today's
  rank and this week's with "See the leaderboards ›", else "Join the
  leaderboards to see where you rank ›"; "Answers stay open until
  midnight." See answers (the main button) and Back to dashboard. No
  report page and no Retake. Reopened from the dashboard's Answers ›, it
  lands on the answers; the score pill brings the pop-up back.
- **Its answers only on its day** (Sam, 2026-10-20), for every student
  whatever their account: the day's challenge, its answers and
  rationales, can be reopened until midnight (UTC, Ghana's time); after
  that it is gone from view. Nobody builds a library of answers from it.
- **Not in Learning History** (Sam, 2026-10-20): not listed and not
  counted in the history's figures; its record is the leaderboards (05).
  Its answers count toward the streak and questions mastered like any
  others (05).
- **The first time a student goes to play, before its questions, the
  offer to join the leaderboards** (05; Sam, 2026-10-20, drawn), asked
  once: a screen of its own on the way to play — Join, then How you'll
  appear, then the start screen; Not now, just play, straight to the
  start screen.
- **On the dashboard, one slim line under the title** (Sam, 2026-10-20:
  C, drawn — in place of the top card or a card of its own), for every
  status; the top card stays as it is. Before playing, tinted: "Today's
  challenge · Midwifery · 5 questions" and Play ›. After: "Today's
  challenge done · 4 of 5 right" and Review the answers › until midnight
  (Sam, 2026-10-20, in place of "Today · 4 of 5 right" and Answers ›; on
  a phone the link under the words), then the rank line ("4th in St
  Mary's this week", or "See this week's leaderboard ›" before joining). On
  a day with none, "Back tomorrow". No menu item of its own (Sam,
  2026-10-04; 00, The menu).
- **A home of its own** (Sam, 2026-10-20): a page that houses the daily
  challenge — the dashboard and other places only feature it. Who can
  open it and what it shows are open (below).
- **A reminder on the phone** (Sam, 2026-10-20): "Today's challenge is
  ready", under Notifications' Reminders row (08). A reminder at a set
  hour needs the app's clock (10), which this would bring.

### Mock exams

- **A mock's questions live nowhere else** (Sam, 2026-09-26): a mock
  holds only Mock-pool questions, which nothing else draws (06.8,
  2026-10-15); archiving a mock releases nothing.
- **Mocks open only when the package says yes** (03 F4) — and **only
  Premium Prep packages say yes** (Sam, 2026-10-04): mocks are seasonal,
  built for the main August/September sitting (02, built 2026-10-04).
- **How many mocks is not fixed** (Sam, 2026-10-13): they come with the
  exam periods, so nothing is sized by a count. Mocks serve members who
  come near the exam and leave; a mock stays active across cohorts; its
  questions are written as drafts and published when it goes live.
- **The Mock exams page, redesigned** (Sam, 2026-10-13: layout A; drawn
  at https://claude.ai/artifact/5QQCWH9ECauT7k69cUUxC3, boards A and B;
  the page described in `11-pages.md`): one screen, by time. A card for
  the mock to start — a sitting in progress first, else the open mock
  that closes soonest — then plain rows under Open now (the soonest to
  close first), Coming up and Past mocks; a row opens the mock's own
  page, built as a paper's. Not by course (board C): one tap more, and
  between exam periods every course would say the same. *(built
  2026-10-13; walked whole 2026-10-15: Coming up, Past mocks, desktop)*
- Q3, the premium exam experience, is ruled in part (2026-10-13): the
  settings above and the page. The rest is in Open.

### For the admin

- On the paper editor, "First sitting in" (a dropdown, Free Navigation
  already picked) and the other ways allowed after it (ticks) (04.5); on
  the mock editor, mode ticks under Study and Exam and, to build,
  "First sitting in" as on a paper (04.11, built 2026-10-14). Both
  editors: Sittings allowed beside "First sitting in" (04.10, built
  2026-10-14); Results (Immediately / On a date and time) and Review
  (Always / Until a date and time / Not allowed) (04.12, 04.13, built
  2026-10-15). The "Open in trial"
  tick on a paper (03). The mock list shows 50 at a time.
- **The mock form refuses a live mock holding a draft question** —
  Active and Published are refused while any of its questions is a
  draft, saying how many (Sam, 2026-10-13). A one-step "publish its
  questions too" can come with the admin redesign.
- **Editing a mock's questions after students have sat it warns**:
  "12 students have sat this mock. Their scores stay on the questions
  they had." Their sittings keep their own copy; a lock waits until one
  is needed (Sam, 2026-10-13). *(parked 2026-10-14: 04.17)*
- Status (Draft / Active / Archived — the mock's life) and Published
  (a pause: hidden) both stay; they
  become one at the admin redesign (Sam, 2026-10-13, parked: 04.18).
- The admin can preview any sitting, read-only. It will say Preview on
  the card and in the sitting, with no "Don't show this again". *(to
  build: Q19)*
- A Preview button on the paper editor: the paper's questions, answers
  and rationales as a student sees them, with no sitting made. *(to
  build: Q20)*

## Open

- **The daily challenge's home page** — whether anyone may open it
  (shareable, Play asking a visitor to sign in) or only signed-in
  students, and what it shows. Sam is looking into it (2026-10-20); a
  first suggestion — today's course per programme, how it works, the
  week's top schools and counts, never the questions or a student's
  name — did not sit right with him.
- **Q3 — the rest of mock exams' design** (ruled 2026-10-13: the first
  sitting, sittings allowed, results on a date, the review period, the
  close, the page — above): notices when a mock opens and when results
  land (with the announcements and the email outbox); timing like the
  real paper; standing among those who sat it (05 Q13).
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
