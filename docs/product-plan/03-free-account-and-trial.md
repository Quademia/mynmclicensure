# 03 — Free account and trial

Every account is a free account underneath, and keeps it for good: a
student whose trial or package ends falls to a floor, not to nothing.
On top of it a student can take the 14-day trial — limited access to
the real bank — or a package (02). How an account is made — the three
ways in — is in 01.

Detail and history: `archive/product-plan/09-free-account-and-gamification.md` §3–§5.

## How it works

### The free account

- A free account practises without limit on the **free set**: bank
  questions the admin marks free (06), per programme. It holds no
  course access. The free set is not the bank.
- A free question stays inside its own paid course; a question any mock
  uses can never be free (06).
- A programme's free set is the free questions of its courses plus the
  General Paper's, so the General Paper's free questions are free to
  every programme.
- **A free sitting belongs to the real course its questions come from**
  (Sam, 2026-10-04): the student picks a course of their programme in
  the builder and draws that course's free questions. No stand-in
  course. Learning History, the report and "Practise this topic" work
  as they do for any sitting. *(to build: F1)*
- **Two doors let the free set in** (12, `question_bank`): any signed-in
  student may read a question marked free, and a sitting may be made
  from a set where every question is free. Every place that checks a
  course's access lets an all-free set through — the builder, its
  keyword search, starting and opening a sitting, the report. *(to
  build: F1)*
- Timed mode, mock exams and offline packs are not free. Mocks and
  packs are for packages only (Sam, 2026-10-02).
- The daily challenge, the streak and questions mastered are open to
  free accounts (04, 05).
- The wording: "free practice questions, forever" is true and is used;
  "unlimited access" is not (Sam, 2026-09-20).
- The dashboard says plainly which the student is on — "Free: practice
  on the free set" or the trial's line (11). *(to build: F2)*

### The trial — limited access

The limits are built in the database (F4a, 2026-10-04): a trial
student is refused a locked paper, a mock, a fourth builder quiz and a
pack, with a plain sentence. Still to build: the SMS check *(F4b)*, the
admin's forms for the limits and the tick *(03.1)*, and the pages that
show the locks *(F2, 11)*.

- The word is **the trial**. The full grants an admin makes by hand are
  **Free Full Access** (30 days, everything, admin only) — not a trial.
- **14 days, counted from when the student takes the trial** (Sam,
  2026-10-04).
- **One Practice Paper per course is open**: the one the admin ticks
  "Open in trial" in the paper's editor — at most one per course,
  refused by the database past one. It is listed first as "Included in
  your trial"; the others show locked. A course with no ticked paper
  opens none. Every account gets the same papers, so a second account
  opens nothing new. The General Paper is a course like any other.
- **Three Quiz Builder quizzes in all**, in any courses, at the normal
  builder size. A quiz is used when it is built, not when finished;
  retakes do not count.
- **No mock exams and no offline packs** in the trial.
- **Each package carries its own limits** (02): builder quizzes, packs
  per course, papers (all, or the trial paper only), mocks (yes / no).
  The trial's: 3 · 0 · the trial paper only · no. They are copied onto
  the subscription when it is written, and use is counted inside the
  database from the student's own sittings — no stored tally. Where two
  grants cover one course, the more generous wins.
- **The phone number is checked by SMS before the trial starts**: a code
  sent through a Ghanaian SMS company, the trial granted once it is
  entered. **One trial per verified number**, every number kept in one
  form (+233…). A second person on the same phone gets the free account
  and no trial. Arkesel is the closest fit (it checks the code itself);
  mNotify and Hubtel the others; about GHS 35 per 1,000 sign-ups. The
  company is picked at the build. *(to build: F4b)*
- The welcome trial product (`WELCOME_TRIAL`) is unchanged and not
  granted by registering.

### After the trial — locked, not gone *(to build: F2)*

- What the student did stays theirs; what needs a package shows with a
  lock and one way to open it: **Choose a package**.
- The scores and the report's summary stay open; the
  question-by-question review is locked (Sam, 2026-10-03).
- **A sitting left unfinished when the trial ends can still be
  finished**, Check Answer included — its answers stay sealed until
  Check Answer, and it is bounded to that one sitting (corrected
  2026-10-04).
- **Retake is locked** after the trial (Sam, 2026-10-04): a retake
  would hand back the locked review.
- A course's announcements still reach a student who once held it (08).
- The end of a paid package uses the same recap card on the dashboard.
- What each page shows, page by page, and the wording: `11-pages.md`.

## Storage

Written on the tables in `12-tables.md`:

- The free set's second read rule — `question_bank` — ticked 2026-09-26
  (F1). The free mark itself is built.
- The trial — ticked 2026-10-04. **Built (F4a, 2026-10-04):** the four
  limits on `products`, copied onto `subscriptions` by the database; the
  trials 14 days; `open_in_trial` on `quizzes`; mocks gated by the
  package. **Still to build (F4b):** the verified number on `users` and
  a new list of the numbers that have had a trial. The mock's unused
  `visibility` is left for removal (10).

## Open

- Whether a free student can start the trial later, from the dashboard
  (once per verified number, the 14 days from the press) — at the build.
- Whether the SMS code is asked only when a trial starts, not for a
  free account — at the build.
- At the SMS build: the sender name and delivery times per network; a
  WhatsApp number that is not the phone's own; foreign numbers; a code
  that does not arrive.
- The free set's size per programme and how often it is refreshed —
  authoring work, "perhaps monthly".
- Which trial package NAC, NAP and RCN get once the programmes split
  (02 C5).
- F1 lists the pack maker drawing free questions for a free student,
  while packs are for packages only — keep or drop.
