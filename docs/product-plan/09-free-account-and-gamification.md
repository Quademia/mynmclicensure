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
This record keeps the cloud session's word, the *taste*; later the same
day Sam named it the **trial, with limited access**, the word used from
*The limited trial settled* (below) on.

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
  not yet confirmed. **Superseded the same day** — one ticked paper per
  course and three builder quizzes (*The limited trial settled*, below).
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

### The limited trial settled — Sam, 2026-10-02 (desktop session)

Settled the same day as the above, in a second conversation (Claude, in
the desktop app); not yet a §8 row or a tick. **The word is the
trial** — Sam: "trial, with limited access", not a taste. The full ones
Sam grants by hand are **Free Full Access**, their products' own name.

- **The trial is today's trial, reshaped.** Registration already
  grants the programme's trial product (`programs.trial_product_id`:
  `RN_TRIAL`, `RM_TRIAL`, `RMHN_TRIAL`, `RPHN_TRIAL`, `NACNAP_TRIAL`).
  Those five become **14 days** — 60 today on dev (the 2026-05-27
  stopgap; the original was 7) — with the limits below in place of the
  whole bank. Unchanged: the five `*_FULL_FREE` products (30 days,
  everything, granted by an admin only), the paid products, and
  `WELCOME_TRIAL` (7 days, General Paper only, which registration does
  not grant).
- **The 14 days start at registration** (Sam: the simple way, and what
  most platforms do). Weighed: at the first trial quiz, its start
  screen saying the 14 days begin there (Claude's recommendation —
  nobody loses the trial by signing up early). MyNclex was read first:
  its readiness pack's 21 days start on the student's "Start my 21
  days", but a pack is a product sold on its own and the trial is not
  (Sam), so that precedent does not carry; its 7-day bank trial also
  starts on the student's request, Sam's ruling there of 2026-09-04
  that registering grants nothing. At registration fits what is built:
  registration already grants a row with an end date.
- **In each course of the programme, one Practice Paper is open** (a
  fixed quiz; the name is 03 Q21) — the one the admin ticks **"Open in
  trial"** on the quiz editor, at most one per course, **listed first**
  with the badge **"Included in your trial"**; the course's other
  papers show, locked, as what subscribing opens (their wording at the
  build). A tick rather than "the first listed": the student's list is
  in title order, so a paper added, renamed or scheduled would change
  which one is open without anyone choosing. The tick is a column on the
  quizzes and joins F4's §8 row. **Every account gets the same trial
  papers**, so a second account never opens another paper; their
  questions become public over time, and swapping one is a tick. A
  course with no paper ticked opens none in the trial.
- **Three Quiz Builder quizzes in all**, spent in whichever courses the
  student likes (Sam: two per course is too generous), each at the
  normal builder limit (`builder_max_questions`, 50 on dev) — no
  trial-specific cap. The builder draws at random per build, so these
  differ for every student.
- **A trial quiz is used when it is built**, not when finished: its
  questions reach the student at creation (03 Q4), and an unfinished
  one stays in Learning History with Resume. **Retakes do not count** —
  the same questions back, nothing new exposed.
- **General Paper is treated like every other course** — one paper
  open. Sam recalled that the Sheets-era trial opened General Paper in
  full and nothing else (`WELCOME_TRIAL`'s shape, still a product);
  mentioned as an earlier idea, not taken.
- **Mocks and packs stay paid.** Packs already refuse a student who
  holds only a trial (`trial_not_allowed`, legacy's rule).
- **Each product carries its own limits** (Sam's proposal, agreed). A
  product says today only which courses it opens and for how many days;
  it gains what the student gets of each feature: **Quiz Builder
  quizzes** (empty = unlimited, a number = that many in all over the
  product's length); **offline packs** (per course; empty = unlimited,
  0 = none — the Config page's `offline_packs_per_course` moves here);
  **Practice Papers** (**all**, or **the trial paper only** — a choice,
  since with a ticked paper a number has no meaning); **mock exams**
  (yes or no — each mock's own `visibility` overlaps and is settled at
  the build). The trial: 3, 0, the trial paper only, no; Free Full
  Access and paid: unlimited, 5, all, yes. **MyNclex's shape:** its
  products carry `cat_allowance` (empty = unlimited) and
  `readiness_credits` (0 = none), **copied onto the subscription when
  it is granted**, so editing a product changes new grants only — the
  same here. **Use is counted from the student's own sittings** (the
  builder quizzes built under the grant, retakes left out), checked
  inside the database when a sitting is created, with no tally of its
  own; where two grants cover one course, the more generous wins. A new
  kind of offer — a school's promotion — is then a product row, not a
  build. This replaces the Config settings offered for the trial's
  numbers; the 14 days are the product's existing length.
  `builder_max_questions` (a quiz's size, not access) stays in Config.
- **What one account sees**, on the content's target size rather than
  dev's sample bank (Sam: a course will hold at least 180 × 5 questions
  for its papers and perhaps 180 × 5 more for the builder): one trial
  paper per course (180, or 100 for General Paper) and up to 150
  builder questions. A first estimate made the same day from dev's
  counts was withdrawn on that correction.
- **Weighed for the size:** three builder quizzes of up to 20 and no
  paper (Claude's recommendation, the least exposed); the first 20–30
  questions of one paper; a short trial quiz made by the admin. Sam
  chose the papers.
- **Still open:** the end-of-trial screen (F2) — settled page by page
  2026-10-03 (*After the trial, page by page*, below); the locked papers'
  wording; how each mock's `visibility` meets the product's yes or no.
  Repeat sign-ups settled 2026-10-03: SMS verification, one trial per
  verified number (§4).

### After the trial, page by page — Sam, 2026-10-03 (desktop session)

Ruled; not yet a §8 row or a tick. Asked as the end-of-trial screen on
the dashboard; **Sam widened it to every page** — the course pages,
Learning History and the rest — and gave the reason it is written
rather than built: **Sam plans to redesign every student page**, since
they are legacy's, carried like for like, and "probably don't serve good
purposes at the moment". So nothing here is built onto today's pages;
it is what each page's redesign builds in, for a student whose trial
has ended and who holds nothing else live.

- **Locked, not gone** (Sam: yes). After the trial nothing the student
  had disappears: what is paid shows with a lock and one way to open it
  (Choose a package), and what they did stays theirs. Most products with
  a trial work this way — a locked course on view sells, an empty page
  does not. MyNclex goes part of the way: its access wall says why a
  door is locked ("Your free trial has ended on …, choose a plan to pick
  up where you left off"), but the locked things are not kept on view.
- **Their own past sittings: the scores and the report's summary stay
  open; the question-by-question review is locked** (Sam: b). The
  report keeps how they did and what to work on; each question with its
  answer and explanation says "Choose a package to review your
  answers". Their results stay theirs; the answers and explanations stay
  part of what is paid. Weighed: everything open, review included (a);
  only the list, as today (c).
- **A sitting started in the trial and unfinished when it ends can be
  finished** (Sam). Its questions reached the student when it was built
  (03 Q4), so finishing it shows nothing new — the same ruling as a
  device signed out mid-quiz (04 item 6, Sam 2026-09-18: the attempt
  finishes, the next page refuses).

Page by page. "Today" was read in the code on 2026-10-03; the right-hand
column is what each page's redesign builds.

| Page | Today, after the trial | After the trial, redesigned |
|---|---|---|
| Dashboard | "No active subscription" in red with Subscribe Now; "No courses available yet."; the recent attempts listed | A recap card: the trial in numbers (questions answered, % correct, quizzes done), up to three topics to work on (03 Q10's advice from three), Choose a package |
| Sidebar, My Courses | the courses vanish | the courses stay, marked locked |
| Course page | "Access Denied — No Access" | the course stays: what it holds and what the student did in it, locked |
| Practice Papers (03 Q21) | "You are not enrolled in any courses yet." | every paper listed: the trial paper with its score, the rest locked |
| Mock Exams | the same | listed, locked |
| Quiz Builder | "No builder access" | the three trial quizzes shown as used, the builder locked; once F1 is built, it builds from the free set |
| Learning History | the attempts listed, but course names show as codes and the course filter is empty | every attempt under its course's name |
| Attempt report (03 Q10) | "No Course Access" | the summary open, the question list locked |
| A sitting — review, resume | "No Course Access"; an unfinished one cannot be finished | the review locked; an unfinished one finishes |
| Offline packs | unchanged — a trial cannot make one, a pack made earlier still opens | unchanged |
| Messages, profile, procedures, portal guide | unaffected | unaffected |

The dashboard, ruled the same day (Sam; "we will talk more about it when
we actually build it", so the details are settled at the build):

- **The recap card stays on the dashboard while nothing is live** —
  nothing to remember, no storage. Weighed: a pop-up the first time back,
  which must remember it was shown (on the phone, so again on another
  phone, or in the account, a §8 row).
- **The trial's bar** says "Trial, limited access — N days left" from day
  one, amber in the last three days, with Choose a package (today:
  "Platform access · Active · Expires <date>", amber from seven days).
- **The end of a paid package takes the same card**, its first line "Your
  access ended on …" (MyNclex words the two apart).

Left with its own line: the email at the end (BUILD_LIST 02, expiry reminders — a daily
timer and the email queue first, and the Resend plan shared with
MyNclex caps at 100 a day). Not discussed: Retake after the trial (a new
sitting, refused today); announcements scoped to a course stop reaching
the student (today's behaviour). The redesign's order, and whether it
gets a plan doc of its own as the design system got doc 10, were asked
and are Sam's.

### G1, part by part — Sam, 2026-10-03 (desktop session)

Taken in order — the streak, points, the leaderboard — since the
leaderboard ranks on points. Sam asked first whether these three are
gamification's pillars; answered: they are its most visible pieces (the
textbook trio is points, badges and leaderboards), resting on four
reasons people come back — **habit** (streak, daily challenge,
reminder), **progress** (03 Q10–Q13: what to fix, accuracy by topic, a
readiness band), **recognition** (points, G3's tiers) and **social**
(leaderboard, how others did) — and points and a leaderboard alone fade
within weeks unless tied to real progress, which for an exam student is
"am I ready to pass". Three pieces outside the plan were offered as
candidates and not taken up: a daily goal ("answer 20 today"), days to
the student's exam, badges for milestones.

**The streak** (Sam: agreed, all four):

- **Private** — only the student sees their own streak; the leaderboard
  ranks on points only. A streak is the student against yesterday, a
  leaderboard against others; kept private, a low bar fools only whoever
  games it, and nobody's no-data week or offline-pack days are shown to
  others. Weighed: shown beside each name but not ranked; earning points
  that rank (NMC Prep's streak points — 3% of its points, 2026-09-24).
  Duolingo keeps the streak on the learner's own profile and ranks its
  leagues on the week's points.
- **A study day is one question answered** — MyNclex's rule (Sam's
  ruling there, 2026-07-23): opening a quiz and closing it does not
  count. Weighed: a quiz finished (doc 09's first plan — a half-done
  180-question paper would count for nothing); at least 10 answered.
- **One missed day a week is forgiven**, automatically — a rule in the
  count, nothing bought or stored; for weak-data days and offline-pack
  days, which record nothing. Weighed: strict.
- **The student sees** the current streak, their best, and the last
  seven days as a strip (MyNclex's three); where on the page waits for
  the redesign.

Counted from the graded rows already saved, so no new table; every
student — free, trial, paid — keeps one; a day is the calendar day
(Ghana is UTC all year).

**Points — replaced by questions mastered** (Sam: A). Sam asked whether
something could stand in for points, an idea taken from NMC Prep. Four
were offered, combinable: **A**, count something real — questions
mastered; **B**, compare without a list — a private percentile ("better
than 62% of RN students who sat this paper", first sittings only;
UWorld's way, already 03 Q13); **C**, compete as a school — a weekly
board of schools, not people, which rests on students picking their
school (D50); **D**, badges for milestones. Sam took A, with how many of
the questions answered were right shown beside it.

- **A question is mastered when the student gets it right the first
  time they meet it.** Repeats — a retake, a builder question drawn
  again, revision — earn nothing, though they keep the streak: new
  ground earns, showing up keeps the streak. Each question can give a
  student one, ever. The same for papers, builder quizzes and mocks.
- **The student sees the effort beside the result**: "300 answered · 195
  mastered · 65% right first time", "answered" being new questions met.
  A ranking, if there is one, is on mastered only, since the answered
  count can be pushed up by tapping.
- **An answer given in under 5 seconds counts as answered, never as
  mastered** (03 Q11 records the engaged seconds per question). Random
  tapping takes a second or two; an honest reader rarely answers that
  fast. Offered with A and kept unless Sam says otherwise, as is **no
  bonus for timed quizzes or mocks** (the plan below had one): one rule
  is easier to explain, and a bonus can be added later.
- **Every question carries one mark** (dev, all 5,581 rows), so a point
  per mastered question would only repeat the number — why "points"
  became the count itself.

Tested against the app's own features with three made-up students in a
week — an honest one (300 new questions, 195 right), one retaking a
50-question quiz nine times in instant mode after its answers were
shown, one tapping at random through 600 new questions: **a point for
every right answer, every time** (NMC Prep's; this doc's first plan)
put the retaker first, 480 to 195; **Claude's effort points of
2026-10-02** (every answer, capped per day) paid wrong answers, so
random tapping earned in full — withdrawn; **right the first time**
left only random tapping, about one in four right on four-option
questions — hence the 5-second floor. Weighed for that gap and set
aside: a daily cap (it also stops the hardest workers in exam season);
accepting it and watching. B, C and D stay for the leaderboard talk
and later: B is 03 Q13; C a shape for the leaderboard; D in place of
G3's tiers, which were names on point bands. "The first time a student
met a question" is each student's earliest graded row for it — derived,
no new table; at many students the weekly board may need a stored tally
refreshed every few minutes, a §8 row decided at the build.

### The leaderboard settled — Sam, 2026-10-04 (desktop session)

Sam opened unsure of the 10-03 shape (a weekly board on questions
mastered, four questions unanswered) — "there seems to be no one better
way" — and offered three ideas: a board from the daily challenge that
runs through the week (a reason to come every day); a leaderboard for
each school, its own students ranked (a reason to invite friends), from
the challenge and from questions mastered across the bank; and counting
who got a question right in the best time. Talked through; **Sam
accepted every recommendation below.**

**The numbers come from the daily challenge only (G2).**

- Every student in a programme answers the same five a day — free,
  trial or paid alike — and can score at most 5 a day, 35 a week, so
  turning up wins, not hours of study or a package. A board on the whole
  bank ranks by how much of it a student can open, which is who paid; a
  free student could never place.
- Each day's five can be answered only on that day, and once (otherwise
  all seven on Sunday). The week runs Monday to Sunday, Ghana time (UTC).
  **The best 6 of the 7 days count** — the streak's forgiven day.
- **Questions mastered stays the student's own progress number** (10-03),
  on no board; its 5-second floor stays (not contested).
- So **G2 comes before the leaderboard**; the streak and questions
  mastered need nothing from it.

**Order on a board: right answers first, then the quicker time** (Sam's
best time, as the tie-break; speed adds no points of its own). Everyone
has the same five, so time compares like with like; a fast wrong answer
never beats a slow right one, so random tapping cannot win and the
challenge needs no 5-second floor. Not on the bank: a one-line question
and a case scenario take different reading, so time there would rank the
questions, not the students. The time is the phone's (03 Q11's engaged
seconds): waiting on the network costs nobody, which matters on weak
data; someone who knows how can fake it, which matters only with a
prize.

**Three views of one score:**

- **My school** — the student's own school's board (Sam's idea: people
  you know are the reason to come back, and to bring a friend). Shown
  first. **One board per school, every programme together** — each
  answers its own programme's five, scored out of 5 the same way; split
  by programme the boards would be tiny. **Everyone sees the school's top
  10; each student sees their own rank privately** ("You: 41st of 58"),
  so nobody sees who is at the bottom of a class they sit in.
- **All of my programme** — the national board: the top 3, and the two
  above and two below the student with their own rank (strangers, so the
  neighbours are shown).
- **Schools** — schools ranked against each other (Claude's first
  reading of Sam's school idea, kept by Sam as a second board): **the
  average of each school's best 10 players**, like a team's eleven on the
  pitch — a small college can beat a big university, and one heavy user
  cannot carry a school; a school with fewer than 10 shows "N more players
  and your school enters the board", an invite prompt. Only school names
  show. Weighed: the total (the biggest schools always win); the plain
  average (an inactive classmate drags it down, so inviting is
  discouraged).
- The school is the one picked at registration — required, from the
  regulator's list of 141. A student who chose "My school isn't listed"
  has no school board until the typed name is matched to the list: admin
  work, and today the list cannot be changed (D50). A student can change
  their school on the profile at any time; points count for the school
  they were in when they earned them.

**Names: a username on the profile, generated, with spins** (Sam).

- **Display only** — sign-in stays email, Google or the email link.
  Unique; seen and changed on the Profile page; the admin sees it beside
  the real name, so a name can be traced to its owner. Alpha's
  `users.username` (a login name, made from the first name) was never
  written after sign-in moved to email and was dropped with S9 on
  2026-09-19; this is a new field for a new purpose. Sam chose a
  username over a name used only by the game: one name for every social
  part of the app, now and later.
- **Generated, Kahoot's way** — its friendly nickname generator gives an
  adjective and an animal (800 pairs) and three spins, made because
  players typed rude names. Ours: an adjective and a noun from word
  lists, a number added when two would clash. Nobody polices it.
  Weighed: typed by the student — more personal, but it needs rules, a
  "that name's taken" check, a blocked-words list that misses Twi, Ga
  and Ewe slang, an admin reset, and many would type their real name.
  The word lists are a proposal Sam sees before anyone gets a name.
- **Given at the student's first daily challenge, with up to 3 spins
  then; changed once a week after that.** Registration stays short.
- **The boards show the username and an avatar, never the real name or
  the photo** — which retires the hide-my-name switch accepted earlier
  the same day. The photo stays the account's (top bar, admin, messages).
- **Avatars: a ready-made set, not the photo** (Sam's idea), bundled in
  the app — a few KB each, arriving with the page, where a board of 13
  photos would be 13 downloads (today's photo is served at 1.38 MB, a
  queued speed line). MyNclex has neither usernames nor avatars (checked
  2026-10-04).
- **The set: Google's Noto animals, the animal matching the username**
  (Sam, 2026-10-04, from ten sets shown side by side): "SwiftLion 27"
  has a lion — Google Docs' "Anonymous Capybara" shape. No skin-tone or
  hair question; one rule a student can say. The files come from
  `googlefonts/noto-emoji` (`2D/svg`, Apache 2.0: free for commercial
  use, the licence notice kept with the files), about 4 KB each, bundled
  in the app. Only animals with a drawing can be in the word list (no
  hornbill, no antelope), and the list leaves out monkeys and apes and
  any animal used as an insult; Sam sees the list first. **Documented
  alternative: DiceBear's Avataaars** (Pablo Stanley; free for
  commercial use, no credit), the people set with the widest hair —
  locs, afros, a hijab — drawn by code with no files; its skin tones and
  hairstyles limited to ones that fit our students. Weighed: Big Smile,
  Personas, Adventurer (people, CC BY, a credit line); Notionists (black
  and white line art, no skin tone, CC0); Open Peeps (CC0); Twemoji's
  flat animals (CC BY); DiceBear's Thumbs and Bottts' robots (neither
  people nor animals; may read as childish for nurses-to-be). **The
  student picks the animal from a grid and spins only the word** (Sam:
  a) — the choice of an avatar was Sam's idea, and the word stays
  generated, so nothing needs policing. Weighed: one spin changing both,
  Kahoot's way (simpler; no choice of animal). With the first-challenge
  rule above: the card arrives with an animal and a word already filled,
  so one tap accepts it; another animal from the grid, or up to 3 spins
  of the word, before it is kept.
- Two columns on `users` (the username, the avatar) — a §8 row before
  the build.

**Inviting: a "Share on WhatsApp" button** sending a register link with
the school filled in; no storage. Who invited whom (credit, a reward)
would be new storage — later, if ever.

**No prizes for now** (Sam). A prize would first need a server check on
the phone's time, and a defence against a school's group chat sharing
the day's answers (on a school board, sharing helps the school); the
answer options shuffled per student blunt "the answer is C" — a view,
for the build.

Derived from the challenge's graded rows; a stored weekly tally if the
reads grow slow, decided at the build with its own §8 row (as 10-03).
**Still open:** the word lists (the adjectives and the animals); G2's
pool size and rotation; where the boards sit in the redesign.

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
  start (at registration) and what the trial opens (one ticked paper
  per course, three builder quizzes, limits on each product) were
  settled the same day (§3, *The limited trial settled*). The record of
  the question as it stood:
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
  **Settled 2026-10-04 (Sam: option 1): a free sitting belongs to the
  real course its questions come from.** The question was written on
  09-20, when the pool was to be a place of its own with no course;
  since 09-26 a free question is a bank row with a mark, so it already
  sits in a real course. A free student picks a course of their
  programme in the builder and draws that course's free rows; the sitting
  is that course's, as every sitting is today — `create_attempt` copies
  only the named course's questions, and that stays. No storage change,
  no stand-in course; Learning History, the report and "Practise this
  topic" work as built, the course named; free practice sits inside the
  course the student knows, so the upgrade reads "unlock the rest of
  this course". The work is F1's as planned (§8 S16 ✅): the places that
  check a course's access — the builder's load, its keyword search, the
  start, opening a sitting, the report, the pack maker — let in a set
  whose every question is marked free. **The daily challenge takes one
  course a day, in turn** (Sam), so it fits the same rule; the order at
  G2. Weighed: a stand-in course per programme (every course list must
  hide it, and the one-course rule bends anyway, since the questions sit
  in the real courses); a sitting with no course (a storage change — the
  course optional, the programme stored, every course reader handling
  none, and each question's course kept for the report's topic advice) —
  the route if a challenge mixing courses is ever wanted, with its own §8
  row.
- **Programme scoping.** A midwife should not get RN questions. The
  pool is per programme, and `users.program_id` picks it. **Read
  2026-10-04:** each programme has its two own courses and the General
  Paper, which all five share (`courses.program_scope`); a programme's
  free pool is the marked rows of those three, so the General Paper's
  free questions are free to every programme.
- **The leaderboard:** per programme or platform-wide; weekly reset or
  all time; real names, first names, or a chosen display name with an
  opt-out. NMC Prep's answer (walked 2026-09-24): all time, the top
  100, full real names, per track with an all-tracks view, no rank
  shown to anyone outside the hundred. **Settled 2026-10-04** (§3, *The
  leaderboard settled*): weekly, from the daily challenge only; three
  views — my school, my programme, schools; generated usernames and
  ready-made avatars, never real names.
- **Who plays:** trial and paid students too (the view: yes, all
  attempts count). **Settled 2026-10-04:** everyone plays, on the same
  five a day; only the daily challenge counts towards a board.
- **Repeat sign-ups** (opened 2026-10-02). A trial per account is a
  trial per email: a student can register again for another. A verified
  phone number at registration would make that harder; whether the app
  verifies the WhatsApp number today was not checked. **Read
  2026-10-02:** an account is unique by its email only
  (`users_email_lower_idx`); the WhatsApp number is checked for length
  (9 digits or more), neither verified nor unique; email confirmation
  at sign-up is parked (BUILD_LIST, 04), so a second trial costs a
  made-up address. **Smaller since the trial was settled:** the trial
  papers are the same for every account, so a second account opens no
  new paper — what it adds is up to 150 new builder questions.
  **Settled 2026-10-03 (Sam): SMS verification, with F4.** At
  registration the student's number gets a code by SMS through a
  Ghanaian SMS company; the trial is granted once the code is entered;
  **one trial per verified number**, every number saved in one standard
  form (+233…) so "024 123 4567" and "+233241234567" are one number.
  The Ghanaian companies to consider (Sam), read 2026-10-03, the pick
  at the build: **Arkesel** (from GHS 0.02 an SMS in bundles; its code
  service generates, sends and checks the code, GHS 0.035 a check; 10
  free SMS and a test mode at sign-up), **mNotify** (GHS 0.035 down to
  0.027; 50 free at sign-up), **Hubtel** (from GHS 0.03; bundles to
  about 0.019). Arkesel is the closest fit because it checks the code
  itself — neither Supabase's phone sign-in (a switch on the shared
  gamma project) nor a code store of our own is needed. About GHS 35
  per 1,000 registrations; none has a free tier beyond sign-up credits.
  Twilio, one of Supabase's built-in senders: US$0.3741 an SMS to
  Ghana. **Weighed and set aside:** one trial per email only (a made-up
  address gets another); the server drawing the builder's questions
  instead of the page (the builder's own topic and keyword filters let
  a patient person narrow to pools of 50 or fewer and take each whole —
  about 12 accounts for a 1,800-question course either way; the server
  takes the page's list today, checking course, held-back and count);
  one trial per unverified number (a made-up number passes; two people
  on one phone); a marker left in the browser (cleared in a moment),
  one trial per internet address (Ghana's mobile networks and campus
  Wi-Fi put many students behind one), a device fingerprint
  (unreliable on phones; Act 843) — the device rule that exists is 2
  live sign-ins per account, which stops sharing an account, not many
  accounts on a device; email confirmation (addresses are free to make;
  the shared Resend plan's 100 a day); **WhatsApp** — software cannot
  send from an ordinary WhatsApp number without breaking WhatsApp's
  terms (numbers are banned for it), so any WhatsApp check needs Meta's
  WhatsApp Business Platform: the student sending us a code ("reverse
  OTP") is free to run (Meta: a message from a user to a business is
  not charged; the business's replies are charged from 2026-10-01
  beyond 1,000 a month), a code sent by us is a paid message — both
  wait on a Meta business account. **Open at the build:** the sender
  name's registration and delivery times per network; a student whose
  WhatsApp number is not the phone's own (the field says WhatsApp
  Number); a foreign number (an international SMS costs more — Hubtel
  lists GHS 0.25); a code that does not arrive (Resend; Arkesel also
  offers a voice code, GHS 0.20 a minute); two people on one phone —
  the second registers and gets the free account, no trial.
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
  2026-09-26 (§4 above). **A free sitting belongs to the real course its
  questions come from** (Sam, 2026-10-04; §4): the free student picks a
  course of their programme, and the places that check a course's access
  let in an all-free set.
- **F2 — The free account.** The floor beneath the trial (Sam's call,
  answered 2026-10-02: registration keeps a trial row, the limited one
  of F4), the builder and the runner drawing from the pool for a
  student with no live course, the dashboard saying plainly "Free:
  practice on the free set" against "Trial: N days left". Attempts
  snapshot from the pool like any other (03 Q4), so the runner needs
  nothing new; the seal holds (03 Q6). Since 2026-10-02 registration
  grants only the limited trial (§3), so every new student meets these
  pages — the locked papers during the 14 days, all of them after.
  **The pages a student with no live course
  meets today** (read 2026-10-02): the course page says "No Access";
  the attempt report says "No Course Access", so past attempts cannot
  be reviewed; Learning History lists the attempts but its course
  filter is empty and course names show as their ids; the fixed-quiz
  list and the builder offer nothing. Each needs a free-account state.
  An end-of-trial screen ("you answered N questions from the full
  bank") is the upgrade moment. **Both were set page by page on
  2026-10-03** (§3, *After the trial, page by page*): locked, not gone;
  the scores and the report's summary open, the review locked; an
  unfinished sitting finishes — built into each page's redesign (Sam
  plans one for every student page), not onto today's pages.
- **F4 — The limited trial** (Sam, 2026-10-02; settled in §3, *The
  limited trial settled*). Today's five programme trial products,
  reshaped: 14 days from registration; in each course the Practice
  Paper the admin ticks "Open in trial", listed first as "Included in
  your trial", the others shown locked; three Quiz Builder quizzes in
  all, at the normal builder limit, in any courses; a quiz used when
  built, retakes free; mocks and packs excluded. **Each product carries
  its own limits** (builder quizzes, packs per course, papers all or
  the trial paper only, mocks yes or no), copied onto the subscription
  at the grant, as MyNclex does; use counted from the student's own
  sittings, inside the database. **SMS verification at registration**
  through a Ghanaian SMS company, the trial granted once the code is
  entered, **one trial per verified number** in one standard form (Sam,
  2026-10-03; §4). Columns on the products and the subscriptions, the
  tick on the quizzes, and the verified number — storage changes, so it
  needs its §8 row.
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
  nothing of their standing. **Superseded in part on 2026-10-03** (§3,
  *G1, part by part*): a study day is one question answered, one missed
  day a week forgiven, the streak private; points replaced by questions
  mastered (right the first time met, not under 5 seconds), shown beside
  the questions answered, no bonus for timed. **The leaderboard settled
  on 2026-10-04** (§3, *The leaderboard settled*): weekly, from the daily
  challenge only (G2), right answers then the quicker time, the best 6
  of 7 days; three views — my school (top 10 shown, the student's own
  rank private), my programme (top 3 and neighbours), schools (the
  average of each school's best 10); a generated username on the profile
  and an animal matching it on the boards (Noto's animals; Avataaars the
  documented alternative), never the real name or photo; a
  Share on WhatsApp button. The board waits on G2; the streak and
  questions mastered do not. The username and avatar are two columns on
  `users`, so G1 is no longer reads only — its §8 row comes first.
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
  opened. **Since 2026-10-04 the challenge feeds the leaderboard** (§3),
  so it comes before G1's board: each day's five answered only on that
  day, once; the engaged seconds kept, since time breaks a tie. **The
  day's five come from one course, the programme's courses in turn**
  (Sam, 2026-10-04; §4, *What a free attempt belongs to*) — a sitting
  stays one course's; the order, and whether a General Paper day is the
  same five for every programme, at the build.
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
| F1 The pool and its door | candidate; settled as the mark + two doors 2026-09-26; §8 S16 ✅ 2026-09-26; the column is 08 B4; a free sitting is the real course's (2026-10-04) |
| F2 The free account | candidate; what each page shows after the trial ruled 2026-10-03 (§3) — locked, not gone; built into each page's redesign |
| F3 Landing and copy | candidate |
| F4 The limited trial | candidate; decided in principle 2026-10-02 (14 days, admin-granted full access); settled the same day — from registration, a ticked paper per course, three builder quizzes, the limits on each product; SMS verification, one trial per verified number (2026-10-03); needs its §8 row |
| G1 Streak, points, leaderboard (derived) | candidate; the NMC Prep walk done 2026-09-24; the streak settled and points replaced by questions mastered 2026-10-03 (§3); the leaderboard settled 2026-10-04 (§3) — from G2, three views, generated usernames; avatars Noto's animals, Avataaars the alternative; needs its §8 row |
| G2 The daily challenge | candidate; from the free pool (Sam, 2026-09-26); feeds the leaderboard, so before G1's board; one course a day in turn (2026-10-04); rotation and pool size open |
| G3 Tiers | later |

---

## Diagnosis findings for this surface

**None.** This surface postdates `post-rebuild-diagnosis.md` — it is a
new feature from Sam's cloud session of 2026-09-20, not a finding about
the ported product. Recorded here so the surface-by-surface map is
complete (2026-09-21); the index is the diagnosis's *Where each finding
lives*.
