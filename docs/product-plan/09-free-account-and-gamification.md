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
- **What the trial gives, which this doc depends on and does not set**
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
  (03 Q6).
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
