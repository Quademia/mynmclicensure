# 05 — Progress

What the student can see of their own progress — their history, the
streak, questions mastered, where they stand — the leaderboards that
run on the daily challenge (04), and achievements. Open to every
student: free, trial and paid. In the menu, Progress holds Learning
history · Leaderboards · Achievements (00; Sam, 2026-10-20).

Detail and history: `archive/product-plan/09-free-account-and-gamification.md`
§3 (*G1, part by part*; *The leaderboard settled*; *Four parked ideas*)
and `archive/product-plan/03-quiz-system.md` (Q10–Q13).

## How it works

### Learning history

Redesigned (Sam, 2026-10-17), drawn in the chat. A plain list of every
sitting: where a student finds one and opens it, not a report. How
they are doing across a course belongs on the course page (below,
parked). *(built 2026-10-17: 05.5)*

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
  its original's kind. The count by mode goes. *(built 2026-10-17: Q12)*
- Offline pack practice is not listed (07: no sync), nor the daily
  challenge (04; Sam, 2026-10-20).
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

### Leaderboards *(G1b: the database, joining, the page and its ways in built 2026-10-24 — 05.7, 05.9–05.11; Profile's switch and rename, the schools' pages, Remove picture and photos made small to build)*

Settled by Sam, 2026-10-04 and 10-08; gone over again on 2026-10-20,
planned with the daily challenge (04) — both to be built before going
live.

- **The name is Leaderboards**: one page, a row under Progress (00),
  and a line on the dashboard's challenge card that opens it — the
  student's rank once they have joined, else "See this week's
  leaderboard ›". *(built 2026-10-24: 05.11 — the line beneath the played
  challenge line, this week's place on the school board, the
  programme's with no school)*
- **From the daily challenge only.** Every challenge keeps the right
  answers, the server's time from Start to Submit (the challenge's own
  mode, 04; Sam 2026-10-08) and the school the student was in — from the
  first challenge, joined or not.
- **Every ranking is worked out; the page picks what shows** (Sam,
  2026-10-20). A switch **Today · This week · All time** and four views
  **My school · My programme · All of Ghana · Schools**; it opens on
  **This week · My school**, the board a student can climb.
  - **Today** — the day's right answers, then the quicker time.
  - **This week** — Monday to Sunday (UTC, Ghana's time), restarting
    every Monday, so a student who joins late competes on equal terms
    (Duolingo's weekly leagues; Stack Overflow's users open on the week).
    A day's result is its right answers and time, a day not played 0;
    the best 6 of the 7 days count; the week's score is their right
    answers, the lower total time on a level, a shared rank on a full
    tie.
  - **All time** — **the average right answers per challenge**, shown
    once a student has played 10; on a level average, more challenges
    played first, then the quicker average time (Sam, 2026-10-20, like
    a batting average after its minimum — in place of totals, which a
    late joiner can never catch, and of counting from each viewer's
    start, which gives everyone a different board). How long a student
    has kept at it is honoured by Achievements, not a board.
  - **My school** and **My programme** are one programme's: each
    programme plays its own questions (Sam, 2026-10-08). **All of
    Ghana** puts every programme's students together (Sam, 2026-10-20) —
    less exact on one day, evened out over a week. **Schools** ranks a
    programme's schools by the average of each school's best 10 in the
    chosen time, "N more players and your school enters the board"; only
    school names show.
  - A voided question (04) leaves everyone's score.
- **One look for every board** (Sam, 2026-10-20, in place of a shape
  per view): the top 10, then the student — outside the top 10 their
  line with the one above and the one below ("You: 41st of 58").
- **The page** (Sam, 2026-10-20: B, drawn — in place of four view
  tabs): the time switch, then **the board as a dropdown** naming it in
  full ("My school · St Mary's · RN", "My programme · RN", "All of
  Ghana", "Schools · RN"); then **the student's own place first**, a small
  card ("You're 41st of 58 · 22 right · 17 min 31 s · ends Sunday"), then
  the top 10 and the neighbours; Share on WhatsApp at the foot (what it
  shares waits on the challenge's home page, 04). A row opens nothing —
  there are no student profiles to visit. Before joining, the card
  reads "Join to see where you rank" with Join. The Schools view: the
  student's school marked ("St Mary's is 3rd of 24"), then "Not on the
  board yet" with how many more players each needs. *(built 2026-10-24:
  05.10 — Share on WhatsApp left out until the challenge's home page,
  05.12; with no school, My school says to add it on Profile (Sam,
  2026-10-24); a suggested school says it joins the Schools board once
  added to the list; the board kept in the address, ?period=&board=)*
- **My school is the student's school in their programme** (Sam,
  2026-10-08, reconfirmed 2026-10-20): a school training RN and RM has
  a board for each, and appears on the RN and the RM schools boards by
  each programme's students. A board of the whole school, all
  programmes together, only if students ask for it.
- **Joining is the student's choice** (Sam, 2026-10-20). The first time
  a student goes to play a challenge, before its questions, a screen of
  its own says what the boards are — ranked by right answers then time,
  you pick how you appear, leave any time from Profile — with **Join**
  and **Not now, just play**. Join opens **How you'll appear**, both
  ways on one screen (drawn 2026-10-20): the username card chosen
  already, its word spun in place, Change animal a panel from below; or
  "Ama O." with the photo. Done goes on to the start screen (04).
  Asked once; after that a quiet "Join the leaderboards" on the
  challenge's card and its results, and Profile's switch **Show me on
  the leaderboards**, to join or leave at any time. Before joining, the
  boards show "Join to see where you rank" in place of their line, and
  the challenge's start screen does not speak of the ranking. Joining
  later costs nothing: the past challenges count. *(built 2026-10-24:
  05.9 — the offer, How you'll appear as 2A (Sam, 2026-10-24: two cards
  in place of 2B's preview row and switch), Cancel there counting as Not
  now from the offer, and the start screen's Join the leaderboards going
  straight to How you'll appear; Profile's switch and the challenge card's
  and results' quiet Join lines to build)*
- **How a student appears is their choice at joining, changed on
  Profile** (Sam, 2026-10-20 — bringing back as a choice what 10-04's
  "never the real name or photo" ruled out): **a username and an
  animal** (the default) or **their first name and surname's initial
  with their profile photo** ("Ama O."), never the full name. Every
  joined student holds a username and an animal either way, so a switch
  is one tap; with no photo, the animal shows.
- **The username**: a word and an animal ("Brave Lion"), a number on a
  clash; the animal picked from a grid of drawings, the word spun up to
  3 times; unique, for display only, changed at most once a week on
  Profile; the admin sees it beside the real name. **The lists, in
  English, approved by Sam 2026-10-20** — plain words, only kind ones;
  no animal used as an insult or linked with witchcraft or bad luck in
  Ghana:
  - Words (52): Agile, Alert, Bold, Brave, Bright, Brilliant, Calm,
    Cheerful, Clever, Cosmic, Daring, Dazzling, Eager, Epic, Fearless,
    Focused, Gentle, Glowing, Golden, Grand, Happy, Hardy, Heroic,
    Honest, Jolly, Joyful, Keen, Kind, Lively, Loyal, Lucky, Merry,
    Mighty, Nimble, Noble, Quick, Radiant, Rapid, Royal, Sharp, Shining,
    Smart, Speedy, Steady, Stellar, Sunny, Swift, Trusty, Valiant,
    Vibrant, Wise, Witty.
  - Animals (38): Lion, Leopard, Tiger, Elephant, Giraffe, Zebra,
    Rhino, Camel, Horse, Deer, Bison, Bear, Panda, Koala, Kangaroo, Fox,
    Wolf, Rabbit, Squirrel, Hedgehog, Otter, Beaver, Eagle, Peacock,
    Flamingo, Swan, Dove, Penguin, Dolphin, Octopus, Turtle, Crocodile,
    Butterfly, Bee, Ladybird, Spider, Unicorn, Dragon.
  - Left out: monkey, gorilla, ape, chimp, pig, dog, donkey, goat, cow,
    sheep, rat, chicken, turkey, dodo (insults); snake, owl, bat,
    parrot (bad links); hippo, whale, sloth, snail (unkind jokes); the
    words Patient and Zesty.
  - A set in Ghanaian languages may be added later, written or checked
    by speakers (Sam: English for now); the name maker only reads lists.
- **The animals are Google's Noto emoji animals** (Apache 2.0, bundled
  with the app in `public/animals`, the notice kept; a face where Noto has
  one). Fetched 2026-10-24: about 9 KB each as files, about 5 KB as sent
  compressed — the same as Noto's sharp 128-pixel pictures, so the SVGs
  were kept; the grid fetches only the drawings on screen. DiceBear's
  Avataaars is the documented alternative.
- **Schools.** A challenge counts for the school the student was in
  when they played it. A suggested school (01) has its My school board
  at once and joins the Schools ranking only when the admin approves it,
  so a joke name never reaches it.
- **Pictures.** Profile photos are shown small — made small first (10's
  speed list, built with this). The admin's **Remove picture** on a
  student's row in Users takes the photo off the profile entirely
  (profile pictures can be abused anywhere, not only here); the boards
  then show the animal. Whether the student is told why (a line from
  Quademia on the support desk) — at the build.
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

### Achievements *(later: G3, after the leaderboards)*

- **Achievements, in place of badges** (Sam, 2026-10-20; badges in
  place of tiers, 2026-10-04): their own row under Progress. Three
  kinds:
  - **Doing** — a first Practice Paper, a first mock, a first challenge.
  - **Keeping at it** — questions mastered (100, 500, 1,000…), never
    questions answered, which tapping anything would farm; streaks;
    challenges played (50, 100) — where staying with it is honoured,
    rather than on a board.
  - **Placing** — 1st, 2nd or 3rd on a This week board, given when the
    week closes (Sunday midnight), only on a board of at least 10
    players, and only to students who joined the leaderboards.
- The list and the pictures: Sam sees them before the build.

## Storage

- Q12 — a read-only function counting the history's figures, and an
  index on a student's sittings by date (on the speed list in 10):
  written on `attempts` and the functions in 12, ticked 2026-10-17.
- Q13 — none.
- G1a — none.
- G1b — a table of its own, a leaderboard card per student
  (`leaderboard_cards`, in place of the two columns on `users` planned
  2026-10-04), suggested schools on `schools` and `school_other` retired
  (01): ticked by Sam 2026-10-24 and built the same day, the boards
  worked out as the page opens, no stored totals (12). The school kept on
  each challenge play was ticked with the challenge's tables
  (`challenge_plays`, 12; Sam, 2026-10-20).
- G3 — a small table remembering which "New achievement!" has been
  shown: needs Sam's tick at the build.

## Open

- **A course's topics (05.6)** — drawn again smaller, after Learning
  History: how many, the minimums (the dashboard's are 20 answers and
  5 in a topic), whether a trend.
- **Q13** — the minimum before "how everyone did" shows (MyNclex uses
  30); the readiness band's signals and words.
- Achievements' list and their pictures.
- Whether a student is told why the admin removed their picture.
- The percentile's threshold (about 30) — set at the build.
- Later, parked (Sam, 2026-10-04): days left to the exam (needs the
  NMC's dates — asked, not answered; the student's sitting asked once,
  which also lets the premium channel address "August candidates") and
  a daily goal.
