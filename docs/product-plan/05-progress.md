# 05 — Progress

What the student can see of their own progress — their history, the
streak, questions mastered, where they stand — and the weekly
leaderboard that runs on the daily challenge (04). Open to every
student: free, trial and paid.

Detail and history: `archive/product-plan/09-free-account-and-gamification.md`
§3 (*G1, part by part*; *The leaderboard settled*; *Four parked ideas*)
and `archive/product-plan/03-quiz-system.md` (Q10–Q13).

## How it works

### Learning history

Redesigned (Sam, 2026-10-17), drawn in the chat. A plain list of every
sitting: where a student finds one and opens it, not a report. How
they are doing across a course belongs on the course page (below,
parked). *(to build: 05.5)*

- **A row per sitting**, newest first: its name (two lines at most),
  the course in full, the mode (the one mode table, 04), the date; on
  the right one thing — the score, Resume, "Results on …" (04.12) or
  Abandoned. Twenty at a time, Load more.
- **A tap on the row** opens the sitting's report (which holds Review
  answers and Retake), or the sitting itself for Resume; an abandoned
  row opens nothing.
- **Three dots on each row** open a menu of what the sitting allows
  now: unfinished — Resume, Abandon this sitting (the confirm box,
  04.20); finished — See your report, Review answers, Retake; results
  held — the date, and Retake where a further sitting is allowed;
  abandoned — Retake where allowed. **What is closed is told in grey,
  not hidden**: "Review closed on …" (04.13), "No sittings left"
  (04.10); for an ended student, Review answers and Retake with a lock,
  "Choose a package" (03). The menu is a new shared piece (09.10).
- **A course dropdown** — "All courses" chosen to start, then each
  course the student has sat something in — is the only filter (Sam,
  2026-10-17: in place of chips, which took five lines on a phone with
  long course names). Search, mode, status, source and sort go (any can
  come back if students ask).
- **The figures**, above the list, following the dropdown, **true totals
  over the whole history**, not over the loaded rows: sittings, the
  average and the best (finished sittings; a held one from its date),
  and a count by kind — practice papers, mocks, quiz builder, free
  practice (a builder quiz of free questions only). A retake counts as
  its original's kind. The count by mode goes. *(to build: Q12)*
- Offline pack practice is not listed (07: no sync).
- **A course's topics on its course page** — its strongest topics and
  its topics to work on (each with Practise), over the course's whole
  history, perhaps a score trend; no page of its own (Sam,
  2026-10-17). Drawn and found too busy; parked until after Learning
  History. Queries only: each saved answer already carries its subject,
  topic, difficulty, type, marks, correctness and time. This is what
  makes the help page's and the home page's promise true ("identify
  topics you repeatedly miss", "monitor improvement over time").
  *(parked: 05.6)*
- Paper cards show attempts and the best score per mode; the dashboard
  shows the last five sittings.

### The streak and questions mastered

Settled by Sam, 2026-10-03. Counted from the answers every student
already saves — no new table.

- **The streak is private**: only the student sees it. A study day is
  one question answered. One missed day a week is forgiven
  automatically; nothing is bought or stored. The student sees the
  current streak, their best, and the last seven days as a strip. The
  day is the calendar day in UTC, which is Ghana's time.
- **Questions mastered** in place of points: a question is mastered
  when the student gets it right the first time they meet it. One per
  question, ever, the same for papers, the builder and mocks; repeats
  earn nothing but keep the streak. An answer in under 5 seconds counts
  as answered, never as mastered. No bonus for timed quizzes or mocks.
- The student sees "300 answered · 195 mastered · 65% right first
  time", where answered means new questions met.
- Questions mastered is on no board.

### The leaderboard *(to build: G1b, after the daily challenge)*

Settled by Sam, 2026-10-04.

- **Where it sits**: its own page, one item under Progress in the menu,
  and a "your rank" line on the dashboard's challenge card that opens it
  (00, The menu).

- **From the daily challenge only** — the same questions a day for free,
  trial and paid students: at most the day's number (an admin setting,
  5 to start; 04) a day; the week Monday
  to Sunday (UTC); the best 6 of the 7 days count.
- **Order**: right answers first, then the quicker time — the server's
  time from Start to Submit, the challenge's own mode (04; Sam,
  2026-10-08, replacing the phone's engaged seconds, which leaving the
  page stopped). Speed adds no points of its own.
- **Every board is one programme's** (Sam, 2026-10-08): each programme
  plays its own questions, so only students who played the same ones are
  ranked together.
- **Three views:**
  - **My school**, shown first — the student's school and programme
    ("St Mary's · RN"). The top 10 are public; the student's own rank is
    private ("You: 41st of 58").
  - **My programme** — the top 3, plus the two above and two below the
    student.
  - **Schools** — per programme ("RN schools"): the average of each
    school's best 10 in it; a school with fewer shows "N more players
    and your school enters the board". Only school names show.
- Points count for the school the student was in when they earned them.
  A student who typed in an unlisted school waits for an admin to match
  it (01).
- **A username and an animal, never the real name or photo.** The
  username is generated — an adjective and an animal, a number added on
  a clash — given at the student's first daily challenge with up to 3
  spins of the word, changeable once a week on the profile; unique, for
  display only; the admin sees it beside the real name. The student
  picks the animal from a grid; the card arrives filled, one tap
  accepts it.
- **The animals are Google's Noto emoji animals** (Apache 2.0, about
  4 KB each, bundled with the app, the notice kept), the animal
  matching the username. Only animals with a drawing are in the list;
  no monkeys, apes or any animal used as an insult. DiceBear's
  Avataaars is the documented alternative.
- **Share on WhatsApp** — a register link with the school filled in.
- No prizes for now.

### Where the student stands

- **The percentile** — "Better than 62% of RN students on this paper",
  on the report and the end-of-trial recap card. First on the trial
  paper; first sittings only; shows once about 30 have sat the paper;
  no storage (Sam, 2026-10-04). Part of Q13. *(to build: Q13)*
- **The rest of Q13**: a readiness band from the student's own history;
  how everyone did on each question, shown only above a minimum count;
  standing among everyone who sat the same paper or mock — whose
  natural home is the mock results screen (04 Q3). *(to build: Q13)*

### For the admin

- "Which questions does everyone fail" and the by-topic figures as
  database queries over the saved answers, in place of the Attempts
  page's read of at most 5,000 sittings (where past that the numbers are
  the newest 5,000's). *(to build)*

### Badges *(later: G3)*

- Badges in place of tiers, once G1a has real numbers (Sam,
  2026-10-04): milestones on questions mastered and the streak ("first
  100 mastered", "a 7-day streak", "a first full Practice Paper"),
  never on questions answered. The art is a set Sam approves.

## Storage

- Q12 — a read-only function counting the history's figures, and an
  index on a student's sittings by date (on the speed list in 10):
  written on `attempts` and the functions in 12, ticked 2026-10-17.
- Q13 — none.
- G1a — none.
- G1b — two columns on `users`, the username and the animal: needs
  Sam's tick before the build.
- G3 — a small table remembering which "New badge!" has been shown:
  needs Sam's tick at the build.

## Open

- **A course's topics (05.6)** — drawn again smaller, after Learning
  History: how many, the minimums (the dashboard's are 20 answers and
  5 in a topic), whether a trend.
- **Q13** — the minimum before "how everyone did" shows (MyNclex uses
  30); the readiness band's signals and words.
- The username word lists — adjectives and animals; Sam sees them
  before anyone gets a name.
- The badge milestones and the art set.
- The percentile's threshold (about 30) — set at the build.
- Later, parked (Sam, 2026-10-04): days left to the exam (needs the
  NMC's dates — asked, not answered; the student's sitting asked once,
  which also lets the premium channel address "August candidates") and
  a daily goal.
