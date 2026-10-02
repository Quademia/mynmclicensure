# Free Account and Gamification — the retention layer

The living plan for this feature (Sam, 2026-09-19: the feature docs hold
what a feature does today, what was found, Sam's rulings, and the sliced
plan). Opened on 2026-09-20 by Claude from a discussion Sam held in a
cloud session the same day (two competitor inspections, then the free
tier and gamification), which wrote nothing to the repo; this doc is its
record. Nothing here is built, and nothing is ticked.

The two halves are one idea: **retention**. Today a student whose trial
or subscription ends falls to nothing and stops opening the app. Under
this plan they fall to a free floor and keep a reason to come back — the
free account is the permission, the daily challenge is the reason.

Sources: the cloud session of 2026-09-20 (Passwell Consult and NMC Prep
inspected from saved pages), `02-subscriptions.md` (the trial, the
products, `course_access`), `08-question-bank.md` (the bank and its
gate), `03-quiz-system.md` (the runner and the attempt rows). The slice
ids here (`F1`, `G1`, …) are the ids `BUILD_LIST.md` uses under this
doc's section.

---

## 1. What exists today that this builds on

- **Access is by course and by time.** Registration grants the
  programme's trial product (kind `TRIAL`; 60 days on dev's products,
  the legacy copy says 7) and writes one `course_access` row per course
  of that product. A paid product does the same for its own length. A
  student with no live row holds nothing: no bank read, no quiz, no
  pack. There is no feature that is free on its own.
- **Products carry a kind** — `PAID`, `TRIAL`, `FREE` — and a length in
  days. `FREE` exists and nothing uses it.
- **Mock exams carry `visibility`** (`ALL`, `PAID`, `TRIAL`), kept as
  the flag for the premium mock-exam gate (03 Q3). The seam for "mocks
  are paid".
- **The bank is one table**, `question_bank`, read through a policy
  that tests the caller's live courses as a set (08 B1). Every attempt
  copies its questions out of it at creation and never reads it again
  (03 Q4); every answer is a graded row (03 Q5); the runner never holds
  a key it has not earned (03 Q6).
- **An attempt must belong to a course** (`attempts.course_id` not
  null, a key to `courses`), and a course belongs to one or more
  programmes (`courses.program_scope`).
- **Every student has a programme** (`users.program_id`), and the
  dashboard already shows the subscription bar, the course cards and
  the recent attempts.

---

## 2. What the competitor inspections found (cloud session, 2026-09-20)

- **Passwell Consult** — a bought Laravel-and-Next.js quiz template run
  as a closed tutoring business: sign-in only, accounts issued by the
  operator after payment, cohort exam sets, coins, five score tiers to
  "Expert Quiz Master", a Top Players page; placeholder handles and
  vendor boilerplate never edited. A weak competitor. Its one lesson is
  the leaderboard.
- **NMC Prep** — purpose-built on Next.js, Clerk, shadcn and Vercel,
  paid through Paystack: free unlimited practice forever, mock exams at
  **GHS 6 for 30 days**, an AI tutor on every rationale, "past papers by
  year" (Sam: probably a hoax — the NMC does not publish its papers),
  a five-question daily challenge, streaks, a leaderboard, a community
  area; six tracks (RGN, RM, RMN, RCN, NAC, NAP — NAC and NAP split,
  community health named RCN). The real competitor. Its moat is
  engagement, not content. **Walked on Sam's account 2026-09-24**
  (below).
- **Where we are ahead:** offline packs (nothing they do works without
  data), the admin and messaging side (cohorts, grants, support at
  scale), a self-serve funnel a Passwell visitor cannot get.
- **Where they are ahead:** a free tier with no expiry, a daily habit,
  the AI tutor, and a price that makes ours look expensive if ours is
  much above GHS 6 a month — **ours is unchecked** (the prices live in
  `products`).

### The NMC Prep walk (2026-09-24, on Sam's Premium account)

Walked by Claude in Sam's own Chrome (the desktop app's browser pane
refused the site's scripts), signed in by Sam, who allowed any test to
be taken. A practice test (RGN Anatomy & Physiology, 20 questions), the
day's Daily Challenge and one mock (three answered, submitted early)
were sat on his account; notifications were left unopened. Other
students' names are left out of this record.

**The offer.** Free, no expiry: practice by programme and course, timed
or untimed, explanations, the Daily Challenge, progress and the
leaderboard, the community, "AI Study" with two uploads a month.
Premium, GHS 6 for 30 days, paid once through Paystack, no renewal:
mocks, the "past questions", shuffled mocks with a breakdown, the AI
tutor, unlimited AI Study. **The mock page itself says "Mock exams are
currently free"** — the pricing page and the product disagree.

**The Daily Challenge.** Five questions a day, one graded attempt, a
prompt on sign-in ("Answer now / Maybe later"). Each answer shows right
or wrong and a one-line explanation at once; no going back; each
question carries a topic label. **All five were midwifery questions on
an account that practises RGN** — the set looks like one five for
everyone, not one per track. +5 points for 5 correct: a point per
correct answer. One question named a "Midwife Amo" absent from its own
stem — lifted from elsewhere unchecked.

**Streaks, points, the leaderboard.** Points for every correct answer
plus points for daily sign-in streaks; the streak ("1 day · 2 streak
pts") sits at the top of the side menu on every page. The leaderboard
is **all-time** (no weekly reset), the **top 100** by **full real
name**, no opt-out seen; columns rank, name, track, points, streak,
attempts, best score; a track filter (its subtitle says "compare
players within the same school", no school filter seen). Points are
**per track** — one person appears twice under two tracks. The leader
held 1,426 points over 32 attempts. The "Streak" column shows **streak
points, not days** (the payload has no day count; Sam's 1-day streak
is 2 points), so its highest value, 70, is not a 70-day streak — first
written as days and corrected the same day. **A student outside the
top 100 sees no rank of their own.** The challenge and the mock do not
count in "My progress"; practice does.

**How engaging the Daily Challenge has been** (measured 2026-09-24
from the leaderboard payload the app sends a signed-in student, which
splits each row's points into `examPoints`, `streakPoints` and
`dailyPoints`; totals only, no names). The 100 rows are 96 people and
are, by construction, the most active students — the whole base is
less engaged, and its size is not visible.

- **32 of the 100 have never scored a challenge point**; 68 have.
- The median player has **7 challenge points** — about two days at up
  to 5 a day (1 point per correct answer). Only 5 of the 100 have more
  than 25 (six days or more); the highest is 80 (at least 16 days).
- All 100 together hold 730 challenge points — roughly 180 completed
  challenges over the site's life (its launch date unknown).
- **Where the points come from:** practice and mocks 25,057 of 26,624
  (**94%**), sign-in streaks 837 (3%), the challenge 730 (3%).
- **Recency:** 14 active in the last day, 46 in 3 days, **73 in 7
  days**, 93 in 30 days; the least recent 125 days ago. The 100th row
  held 121 points.

Reading (Claude's): their best students return to **practise**; the
daily five is a light extra, not the engine. For this doc it supports
G1 (points and a leaderboard from practice) before G2 (the daily
challenge), the order already planned.

**"Past papers" — settled: not NMC papers.** Nothing is "by year".
Five courses (General Paper, Medical, Surgical, Psychiatric Nursing,
Nursing), 27 papers, each naming its source: 25 volumes of "Road to
Licensure MCQs" (a question book) and two from "PerfectGhana", one
titled "KNUST Nursing Past Questions" (a university's exam). Mostly
RGN-shaped.

**Practice and the runner.** Track → subject (twelve for RGN, each with
a one-line description) → a choice of Practice or Mock → a settings
card. Settings are saved per student: timer on or off, free or linear
navigation, feedback per question or at the end, a default count (10
to All). RGN Anatomy & Physiology holds **80 questions**. The question
screen watermarks **the student's email** behind every question. The
result: score, correct / wrong, time, each question with its answer
and "Why", filters all / wrong / correct. **"Explain with AI"** (the
paid tutor) sat under every question and **did nothing** in three
tries. Content is uneven: heavy clinical cases filed under Anatomy &
Physiology, and the right answer was B in 12 of 20.

**The mock.** One per course across all six tracks. A pre-exam page:
rules (a strict timer, no going back, randomised order, no feedback),
"instructions from the instructor", an "I understand" tick and a
"Start the timer?" confirm; refreshing or closing the tab ends the
attempt. During: a countdown, a **difficulty label and a topic on each
question**, and a "Mark for review" that cannot be used (no going
back). Submitting takes two confirms and warns that skipped questions
are marked wrong. **The results page is their best screen:** score
against the pass mark, correct / wrong / skipped, total time and share
of the allowance, average per question, the fastest and slowest
questions, a breakdown by difficulty and by topic, and all 101
questions for review. **The content is weak:** at least six repeated
pairs (two word for word), pharmacology, surgery and obstetrics inside
an "Anatomy & Physiology" paper, "101 questions" in the header against
"100" in the instructions — machine-written and unchecked.

**Also there.** A ten-step welcome tour on first sign-in; the side menu
on the **right**, folding to an icon strip; a bell for community
replies and team announcements; "Report a bug"; "Install app" (the
home screen); dark mode. **AI Study**: a PDF becomes AI flashcards or a
multiple-choice quiz; sets can be shared publicly, one titled like a
real NMC exam review. **Community**: threads with votes and images,
filtered by type and track — three threads, two of them the team's.

**What it means for us** (Claude's reading; views, not decisions).
Their strength is the habit — the daily five, the streak, a detailed
mock results page; their weakness is the questions. Ours is a bank
checked by hand and scoped by programme. Worth taking: the mock
results breakdown (now `03-quiz-system.md` Q10–Q13); a student's own
rank shown when outside the list (G1); a daily five **per programme**
(G2, as already planned — theirs is not).

---

## 3. Sam's decisions in principle (cloud session, 2026-09-20)

Decisions of shape, not yet §8 rows or BUILD_LIST ticks; each open
question in §4 is settled before its slice is built.

- **Keep everything built.** The trial and the paid products stay the
  only route to the real bank. Timed mode, mock exams and offline packs
  stay trial or paid.
- **A free-forever account practises without limit on a set-aside
  pool** of questions, per programme, and holds **no `course_access`
  rows**. The pool is not the bank: a free account never sees the paid
  content, so nobody copies the bank by practising patiently, and
  "unlimited" is a promise we can keep. (The daily-quota shape was
  considered and set aside: harder to explain, and it could not protect
  the bank.)
- **Gamification is open to free accounts:** a daily challenge, a
  streak, points, a leaderboard; tiers later, as decoration on points.
- **The free tier is retention.** A lapsed student is the cheapest one
  to win back; the floor keeps them warm until exam season.
- **Wording:** "free practice questions, forever" is true; "unlimited
  access" is not, since the pool is a sample. The full bank is where the
  trial and the paid tiers live.

Views given in the session, awaiting Sam's yes: the daily challenge
draws from the free pool (it gives the pool a daily purpose and keeps
the leaderboard fair, since everyone answers the same five); paid
attempts also earn points, with a weekly reset so a free account can
still reach the top ten in a good week.

### What a new student gets — Sam, cloud session 2026-10-02

Decided in principle; not yet a §8 row or a tick. It answers §4's
"what the trial gives" question, and replaces the automatic trial.

- **No automatic full trial.** A 7-day (or 60-day) full-programme trial
  lets a student drain or copy the bank in a week (Sam's concern). A
  full trial becomes **admin-granted only** — schools, promotions, a
  student who asks — through the existing `*_FULL_FREE` products
  (already admin-grant-only in Sam's view, 2026-09-22).
- **Free forever:** the free pool without limit, the daily challenge,
  the streak and the leaderboard (as §3 above).
- **A taste of the real bank**, once per account: proposed as **1 fixed
  quiz of the student's choice and 2 Quiz Builder quizzes of up to
  about 20 questions** — at most ~60–70 real questions an account,
  enough to judge the bank, too little to copy. The size is a proposal,
  not yet confirmed. **Superseded the same day** — a taster paper per
  course and three builder quizzes (*The taste settled*, below).
- **The taste lasts 14 days** (Sam). The clock protects nothing — the
  quiz cap does — it adds the deadline that makes a student decide.
  **When the 14 days start is open**: at registration (simpler; an
  early sign-up can lose it unused) or at the first taste quiz (one
  more date stored; nobody loses it by signing up early — Claude's
  preference). MyNclex's readiness pack carries 21 days; how its days
  are counted (from the grant or from first open) was not checked —
  that repo was not in the session — and is the precedent to read
  first. When the 14 days end, only the unused taste is lost; the free
  account stays. **Settled the same day: at registration** (below).
- **Paid only:** the full bank, mock exams, offline packs.

Weighed and set aside the same day: the full 7-day trial (exposes the
bank); the taste with no time limit (no reason to decide); a 7-day
trial with a daily cap (two limits at once, harder to word). Sam's
reason for preferring a taste over a timed trial was less code; it was
checked and is not so — a time-limited trial reuses `course_access`'s
end dates as built, the taste needs a new use counter — so the choice
rests on protecting the bank, not on build cost. Whichever shape, a
student with no live course meets today's locked pages (below, F2).

### The taste settled — Sam, 2026-10-02 (desktop session)

Settled the same day as the above, in a second conversation (Claude, in
the desktop app); not yet a §8 row or a tick.

- **The 14 days start at registration** (Sam: the simple way, and what
  most platforms do). Weighed: at the first taste quiz, its start
  screen saying the 14 days begin there (Claude's recommendation —
  nobody loses the taste by signing up early). MyNclex was read first:
  its readiness pack's 21 days start on the student's "Start my 21
  days", but a pack is a product sold on its own and the taste is not
  (Sam), so that precedent does not carry; its 7-day bank trial also
  starts on the student's request, Sam's ruling there of 2026-09-04
  that registering grants nothing. At registration fits what is built:
  registration already grants a row with an end date.
- **In each course of the programme, one Practice Paper** (a fixed
  quiz; the name is 03 Q21) — **the one the admin ticks as that
  course's taster, listed first**; the course's other papers show,
  locked, as what subscribing opens. A tick on the quiz editor, at most
  one per course, rather than "the first listed": the student's list is
  in title order, so a paper added, renamed or scheduled would change
  which one is open without anyone choosing. The tick is a column on the
  quizzes and joins F4's §8 row. **Every account gets the same taster
  papers**, so a second account never opens another paper; the
  tasters' questions become public over time, and swapping one is a
  tick. A course with no taster ticked opens no paper.
- **Three Quiz Builder quizzes in all**, spent in whichever courses the
  student likes (Sam: two per course is too generous), each at the
  normal builder limit (`builder_max_questions`, 50 on dev) — no
  taste-specific cap. The builder draws at random per build, so these
  differ for every student.
- **A taste quiz is used when it is built**, not when finished: its
  questions reach the student at creation (03 Q4), and an unfinished
  one stays in Learning History with Resume. **Retakes do not count** —
  the same questions back, nothing new exposed.
- **General Paper is treated like every other course** — one taster
  paper. Sam recalled that the Sheets-era trial opened General Paper in
  full and nothing else (`WELCOME_TRIAL`'s shape, still a product);
  mentioned as an earlier idea, not taken.
- **Mocks and packs stay paid.**
- **What one account sees**, on the content's target size rather than
  dev's sample bank (Sam: a course will hold at least 180 × 5 questions
  for its papers and perhaps 180 × 5 more for the builder): one taster
  paper per course (180, or 100 for General Paper) and up to 150
  builder questions. A first estimate made the same day from dev's
  counts was withdrawn on that correction.
- **Weighed for the size:** three builder quizzes of up to 20 and no
  paper (Claude's recommendation, the least exposed); the first 20–30
  questions of one paper; a short taster quiz made by the admin. Sam
  chose the papers.
- **Still open:** repeat sign-ups (§4, now smaller); whether the 14
  days and the three quizzes are Config settings, as the builder's
  limit is (offered, not answered); the end-of-taste screen (F2).

### Real-world comparison — Claude's views, 2026-10-02, not ruled

Asked by Sam: is there a better approach from real products? Sources
were read on the web the same day (Duolingo's published figures and
write-ups, a 2024 randomised trial on leaderboard leagues, Elena
Verna's "reverse trial", Pocket Prep, Archer Review, Eneza Education,
Meta's WhatsApp pricing). To go through with Sam before G1 is sliced:

- **The free floor is a known pattern.** Free forever plus a sample of
  the bank is Pocket Prep's shape (25–80 free questions plus a Question
  of the Day). Dropping a lapsed student to a free floor rather than to
  nothing is what "reverse trials" do (Toggl, Airtable).
- **Leaderboard (G1): weekly, small, the student's neighbours.**
  Duolingo's leagues are 30 people at a similar pace, reset weekly. A
  2024 RCT with leagues of 30 found low performers +0.27 SD on exam
  grades, top performers −0.25 SD and low performers more stressed — no
  ranking is free. For small programmes: weekly, per programme, the top
  3 plus the two above and two below the student. First name and
  initial or a chosen name, with an opt-out (Act 843; NMC Prep shows
  full names and has no privacy policy).
- **Points (G1) are farmable as planned.** Instant mode shows the
  answer after each question and Retake gives the same questions back,
  so "a point per correct answer" pays for a second go at 100%.
  Proposed: effort points (questions answered, sittings finished) with
  a daily cap, plus a bonus for a first correct answer to a question —
  still derived, no new tables.
- **Streaks (G1): allow a missed day.** Duolingo reports its Streak
  Freeze cut churn 21% among at-risk users. A strict daily streak
  punishes offline-pack study, which writes no graded rows. Proposed: a
  streak survives one missed day a week — a rule, not storage.
- **The daily challenge (G2) needs a reminder.** NMC Prep's challenge
  only waits to be opened and is 3% of its points. Cheapest first: the
  day's link posted in the Telegram channel the sidebar already links;
  email (Resend); web push once the PWA (queued under 00) lands;
  WhatsApp Business messages reach furthest but cost about US$0.0225
  each (Rest of Africa marketing rate, Oct 2026) — about US$675 a month
  for 1,000 daily students.
- **Repeats are fine.** A question returning after a couple of months is
  retrieval practice, not a flaw; a pool of a few hundred per programme
  with a ~60-day non-repeat window cuts the authoring load roughly
  tenfold against §4's 1,800 a year.
- **Readiness over points.** Licensure prep leads with "am I ready"
  (Archer's Low / Borderline / High / Very High; UWorld's
  self-assessments). 03 Q12 / Q13 are that, and a weak-topic readiness
  line is the natural upgrade prompt for a free student.
- **Proposed order:** F1 → F2 (with the end-of-taste screen) → F4 →
  G1 as revised above → 03 Q12 / Q13 → G2 with its reminder → G3.

---

## 4. Open questions (Sam's, before slicing)

- **Where the pool lives — settled 2026-09-26: a mark on the bank
  rows** (`is_free_sample`, 08 B4), not a separate table. Sam's case
  for a separate table was the volume the challenge needs (about 1,800
  a year per programme with no repeats) and that the runner checks
  course access; the answer given was that volume decides authoring
  and rotation, not storage — the same rows, importer, editor and
  snapshot serve both, a second table duplicates all of them and every
  column B4 adds, and the paid bank is protected the same way, because
  the door opens marked rows only. The door is two doors: the read
  policy lets any signed-in student read a marked row, and attempt
  creation accepts a set of ids when every one is marked free. That is
  the security floor, so it is `rebuild.md` **§8 S16** (drafted
  and ticked 2026-09-26; this said S14 until 2026-09-22 and S15
  until 2026-09-23). Free rows stay inside their paid course; a
  question named by any mock can never be free. The pool gets a Free
  pool view on the bank page, per programme with its count, and an
  "import as free" choice on the importer, so it feels like its own
  bank without being one. Still open: the pool's size per programme and
  the challenge's rotation.
- **What the trial gives — answered in principle 2026-10-02** (§3,
  *What a new student gets*): no automatic full trial; a taste of the
  real bank for 14 days; full trials admin-granted. When the 14 days
  start (at registration) and the taste's size (a taster paper per
  course, three builder quizzes) were settled the same day (§3, *The
  taste settled*). The record of the question as it stood:
  **What the trial gives, which this doc depends on and does not set**
  (opened 2026-09-22). The free-forever account is positioned here as
  retention, with the trial and the paid products as the only route to
  the real bank — but the trial currently gives **60 days of the entire
  programme bank**, a quarter of Premium Prep's 240 days, for nothing.
  A free pool of sample questions adds little on top of that, and the
  paid tier competes with its own giveaway. **The 60 days were a
  stopgap, not a decision:** traced to 2026-05-27, when gamma paused its
  paid plans (`dfc5545`) and the same day bumped every programme trial
  from 7 days to 60 and dropped "7 Day" from their names (`e7a0ae6`),
  so Sam's audience kept something free while he was building MyNclex.
  The pause ends at cutover; the 60 days have outlived their reason. The
  stale "7" in `rebuild.md` §3.2 and doc 02 is the ORIGINAL intent, not
  an error.
  Sam's question, 2026-09-22: a **7-day programme trial** (the whole
  programme, briefly) or **`WELCOME_TRIAL`** (General Paper only, 7
  days)? The recommendation given was the programme trial, because
  General Paper is the one paper every programme sits — the least
  differentiated content — so it cannot answer "is this good for MY
  exam", which is what a buyer is deciding; because `GP_ONLY` is itself
  a product sold at GHS 59; and because once this doc's free pool
  exists, a 7-day taste of one course adds little on top of *forever*,
  while the programme trial is the step the pool cannot replace. The
  case against: if the pool is never built, General-Paper-only is the
  safer floor, leaving the professional banks unexposed. **The two
  decisions are coupled and neither is made.** Nothing needs retiring
  either way — `products.status` is one column, and `getProducts`
  already filters on it, so a product is hidden and restored in a click.
- **Pool size per programme and its refresh.** Unlimited practice on a
  fixed pool runs dry — fifty a day finishes three hundred in a week.
  The pool needs a size that lasts and a refresh habit, perhaps monthly.
  Authoring work, not code: the real running cost of the idea.
- **What a free attempt belongs to.** An attempt needs a course. Either
  a stand-in "free practice" course per programme, or `course_id` made
  optional (a storage change). Small either way; it has to be chosen.
- **Programme scoping.** A midwife should not get RN questions. The
  pool is per programme, and `users.program_id` picks it.
- **The leaderboard:** per programme or platform-wide; weekly reset or
  all time; real names, first names, or a chosen display name with an
  opt-out. NMC Prep's answer (walked 2026-09-24): all time, the top
  100, full real names, per track with an all-tracks view, no rank
  shown to anyone outside the hundred.
- **Who plays:** trial and paid students too (the view: yes, all
  attempts count).
- **Repeat sign-ups** (opened 2026-10-02). A taste per account is a
  taste per email: a student can register again for another. A verified
  phone number at registration would make that harder; whether the app
  verifies the WhatsApp number today was not checked. **Read
  2026-10-02:** an account is unique by its email only
  (`users_email_lower_idx`); the WhatsApp number is checked for length
  (9 digits or more), neither verified nor unique; email confirmation
  at sign-up is parked (BUILD_LIST, 04), so a second taste costs a
  made-up address. **Smaller since the taste was settled:** the taster
  papers are the same for every account, so a second account opens no
  new paper — what it adds is up to 150 new builder questions.
- **Our prices beside GHS 6.** Unchecked; decides how the free floor
  and the trial are worded against each other.
- **NAC and NAP as separate programmes; RPHN and RCN the same exam or
  not.** A programme question NMC Prep's track list raised.
- ~~**The past-papers claim**~~ — **settled 2026-09-24** by the walk
  (§2): question books and a university's papers, labelled "past
  questions"; nothing by year, nothing from the NMC. The daily
  challenge and the leaderboard were walked the same day; G1 no longer
  waits on the walk.

---

## 5. The plan — candidates, none sliced

Each becomes a slice with a done-when once the questions above it are
answered. The design system (BUILD_LIST) is expected to land first, so
these screens are built on the shared components rather than adding
one-off buttons and cards.

### F — the free account

- **F1 — The pool and its door.** The mark is 08 B4's column; this
  slice is the two doors (§8 S16): the read policy's second condition
  and `create_attempt` accepting an all-free set of ids, plus the
  builder and the pack maker drawing free rows only for a student with
  no live course. The one storage change in this doc. Settled
  2026-09-26 (§4 above).
- **F2 — The free account.** Registration without a trial row (or the
  trial kept and the floor beneath it — Sam's call), the builder and the
  runner drawing from the pool for a student with no live course, the
  dashboard saying plainly "Free: practice on the free set" against
  "Trial: everything, N days left". Attempts snapshot from the pool like
  any other (03 Q4), so the runner needs nothing new; the seal holds
  (03 Q6). Since 2026-10-02 there is no automatic trial (§3), so this
  is every new student. **The pages a student with no live course
  meets today** (read 2026-10-02): the course page says "No Access";
  the attempt report says "No Course Access", so past attempts cannot
  be reviewed; Learning History lists the attempts but its course
  filter is empty and course names show as their ids; the fixed-quiz
  list and the builder offer nothing. Each needs a free-account state.
  An end-of-taste screen ("you answered N questions from the full
  bank") is the upgrade moment.
- **F4 — The taste** (Sam, 2026-10-02; settled in §3, *The taste
  settled*). Once per account, for 14 days from registration: in each
  course, the Practice Paper the admin ticks as its taster, listed
  first, the others shown locked; three Quiz Builder quizzes in all, at
  the normal builder limit, in any courses; a quiz used when built,
  retakes free; mocks and packs excluded. A use counter checked at
  attempt creation, the 14-day window, and the taster tick on the
  quizzes — storage changes, so it needs its §8 row.
- **F3 — Landing and copy.** "Free practice questions, forever"; the
  trial and the products as the route to the full bank.

### G — gamification

- **G1 — Derived, no new tables.** Streak = consecutive days with a
  completed attempt; points = a formula over graded rows (one per
  correct answer, a bonus for timed); the leaderboard = the top ten in
  the student's programme this period plus their own rank. One SQL
  function, one dashboard card, one page. Since 03 Q5 every answer is a
  graded row, so this is reads only. The own rank is the one thing NMC
  Prep leaves out (walked 2026-09-24): a student below its hundred sees
  nothing of their standing.
- **G2 — The daily challenge.** Five questions per programme, the same
  five for everyone, chosen by a seed from the date, run through the
  instant runner; a new attempt source (every list that switches on
  source is touched). From the free pool — Sam's yes, 2026-09-26; the
  same five for everyone in a programme, so a free and a paid student
  compete on one set. Five a day is about 1,800 a year per programme
  with no repeats, so the pool rotates: a question may return after
  some months, and the pool's size per programme is the open number.
  The seal (03 Q6) holds for the challenge as for any quiz — the NMC
  Prep walk found theirs sends the answers to the browser before it is
  opened.
- **G3 — Tiers.** Names on point bands, Passwell's shape, once real
  numbers exist. Cosmetic.

### Later, under this doc

- A points ledger table (awards, badges, rewards) if G1's formula ever
  needs history it cannot recompute — a storage change, its own row.
- Notifications and a community area — NMC Prep has them; not borrowed
  now.

---

## 6. Ladder

| Slice | Date |
|---|---|
| F1 The pool and its door | candidate; settled as the mark + two doors 2026-09-26; §8 S16 ✅ 2026-09-26; the column is 08 B4 |
| F2 The free account | candidate |
| F3 Landing and copy | candidate |
| F4 The taste | candidate; decided in principle 2026-10-02 (14 days, admin-granted full trials); settled the same day — from registration, a ticked taster paper per course, three builder quizzes; needs its §8 row |
| G1 Streak, points, leaderboard (derived) | candidate; the NMC Prep walk done 2026-09-24 |
| G2 The daily challenge | candidate; after G1; from the free pool (Sam, 2026-09-26), rotation and pool size open |
| G3 Tiers | later |

---

## Diagnosis findings for this surface

**None.** This surface postdates `post-rebuild-diagnosis.md` — it is a
new feature from Sam's cloud session of 2026-09-20, not a finding about
the ported product. Recorded here so the surface-by-surface map is
complete (2026-09-21); the index is the diagnosis's *Where each finding
lives*.
