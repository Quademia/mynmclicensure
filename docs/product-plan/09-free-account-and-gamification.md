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
  engagement, not content.
- **Where we are ahead:** offline packs (nothing they do works without
  data), the admin and messaging side (cohorts, grants, support at
  scale), a self-serve funnel a Passwell visitor cannot get.
- **Where they are ahead:** a free tier with no expiry, a daily habit,
  the AI tutor, and a price that makes ours look expensive if ours is
  much above GHS 6 a month — **ours is unchecked** (the prices live in
  `products`).

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

- **Where the pool lives.** The cheapest is a mark on `question_bank`
  rows ("free", tagged by programme) and a second door on the read
  policy: a row marked free is readable by any signed-in student. That
  changes the SQL policy, the security floor, so it is a `rebuild.md` §8
  row before it is built (a candidate S14, under 08). A separate pool
  table is the alternative; it keeps the bank's policy untouched at the
  cost of a second importer path.
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
  opt-out.
- **Who plays:** trial and paid students too (the view: yes, all
  attempts count).
- **Our prices beside GHS 6.** Unchecked; decides how the free floor
  and the trial are worded against each other.
- **NAC and NAP as separate programmes; RPHN and RCN the same exam or
  not.** A programme question NMC Prep's track list raised.
- **The past-papers claim** — to be checked when Sam hands over a
  browser session on his NMC Prep account, alongside the walk of their
  daily challenge and leaderboard that the gamification design waits
  on.

---

## 5. The plan — candidates, none sliced

Each becomes a slice with a done-when once the questions above it are
answered. The design system (BUILD_LIST) is expected to land first, so
these screens are built on the shared components rather than adding
one-off buttons and cards.

### F — the free account

- **F1 — The pool and its door.** The mark (or table) and the policy's
  second door; the importer learning the mark; a §8 row first. The one
  storage change in this doc.
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
  graded row, so this is reads only.
- **G2 — The daily challenge.** Five questions per programme, the same
  five for everyone, chosen by a seed from the date, run through the
  instant runner; a new attempt source (every list that switches on
  source is touched). From the free pool (the view above).
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
| F1 The pool and its door | candidate; a §8 row first |
| F2 The free account | candidate |
| F3 Landing and copy | candidate |
| G1 Streak, points, leaderboard (derived) | candidate; after the NMC Prep walk |
| G2 The daily challenge | candidate; after G1 |
| G3 Tiers | later |

---

## Diagnosis findings for this surface

**None.** This surface postdates `post-rebuild-diagnosis.md` — it is a
new feature from Sam's cloud session of 2026-09-20, not a finding about
the ported product. Recorded here so the surface-by-surface map is
complete (2026-09-21); the index is the diagnosis's *Where each finding
lives*.
