# MyNMCLicensure Build List

The status of every piece of work, one line each, one section per plan
file in [`docs/product-plan/`](docs/product-plan/). The decision is
written once, in its plan file; its status once, here. Started fresh on
2026-10-04 (Sam) with only what is queued or parked; everything built
before then, and the old list's history, is in
[`archive/BUILD_LIST.md`](archive/BUILD_LIST.md).

## Rules for this file

- **One line per piece:** `- <mark> <id> <name> — <short>`. Under 120
  characters. No explanation, no commit hashes, no merge or release
  status (git holds that).
- **Marks:** ✅ built (with the date) · ⬜ queued · ⏸ parked, with a
  one-line reason · ✖ cancelled.
- **Ids:** an old id is kept (C5, F4, Q21, DS17…); a new line takes its
  file's number and a count (`01.1`).
- **Built** means the line turns ✅ with the date, and the plan file's
  "(to build)" tag goes, in the same commit — and, for a change to the
  database, its line in `12-tables.md` becomes plain description.
- **There is no "next" marker.** The build order is in
  [`00-the-map.md`](docs/product-plan/00-the-map.md); Sam decides each
  session.
- **Unplanned work still gets a line** when done, marked `(unplanned)`.
- **Found mid-build and out of scope:** a ⬜ or ⏸ line in the right
  section. Never a paragraph. A question for Sam goes to the plan
  file's Open list instead.

---

## [01 Accounts and sign-in](docs/product-plan/01-accounts-and-sign-in.md)

- ⬜ 01.1 A deactivated account refused at sign-in — "This account has been deactivated", logged
- ⬜ 6 Signed out mid-sitting — the sitting finishes, the next page refuses (Sam, 09-18)
- ⬜ 8 A reset signs the student in straight after (Sam, 09-18)
- ⬜ 01.2 Security page: Sessions — a drawer panel and a platform list, Revoke on every live row
- ⬜ 01.3 Security page: Login events — filters by email, person, outcome, date; Lift the block
- ⬜ 01.4 Security page: Reset requests — Send reset link, Lift the block, the admin's sends logged
- ⬜ 01.5 Invite by email — student or admin, optional package, a set-password link; replaces Create User
- ⬜ 01.6 Last sign-in — written at sign-in, shown in the drawer, a dormant filter on Users
- ⬜ 01.7 One Quademia account — "sign in to add this product"; "complete your profile"
- ⏸ 01.8 Email confirmation at sign-up — parked under the port's rule, which has ended; to re-rule

## [02 Packages and payments](docs/product-plan/02-packages-and-payments.md)

- ✅ C5a Programmes Open to the public — the switch, the refusals, open lists; NAC, NAP, RCN closed — 2026-10-04
- ⬜ C5b NACNAP's switch-over — courses and packages to NAC and NAP, both opened, NACNAP closed — on the day
- ⬜ 02.9 The Open to the public tick on the admin's Courses page — with its redesign
- ✅ 02.10 Mocks on Premium Prep packages only — the mocks limit follows the premium tick — 2026-10-04
- ⬜ 02.11 Public pages' words Sam's to edit — Premium Prep's text, a season banner — with their redesign
- ⬜ 02.12 Premium Prep's page reads its prices from the packages — GHS 99 and 150 typed in today
- ✅ 02.1 Ended means ended — the four places that trusted "active" now read the dates — 2026-10-04
- ⬜ D31 The account made at payment — a set-password link; the setup token and its rescue go
- ⬜ D33 The same browser sees the password form, another the emailed link; a check tells status only
- ⬜ D34 A nightly sweep — unfinished payments checked with Paystack; paid activated, rest abandoned
- ⬜ 02.2 For sale everywhere — the in-app Packages page and Premium Prep check it too (D23 item 3)
- ⬜ 02.3 Expiry reminders — a daily job, the email through the outbox, a dashboard status line
- ⬜ 02.4 Courses: the form suggests a code from programme and title; drop page_slug when next touched
- ⬜ 02.5 The webhook on the dev site — the test URL in Paystack, one payment with the tab closed
- ⏸ 02.6 A price per course — the package stays the unit until a package per course is a chore
- ⏸ 02.7 A basket — one package a payment until buyers are seen paying twice a day
- ⏸ 02.8 Editing one course's access row by hand — until a real support case asks

## [03 Free account and trial](docs/product-plan/03-free-account-and-trial.md)

- ✅ F1 The free set's two doors in the database — the read rule, free builder quizzes in Study modes — 2026-10-04
- ⬜ F2 The free account, the floor — the builder on the free set, the dashboard's free line (no door)
- ⬜ F2 After the trial — locked, not gone; the summary open, the review locked; Retake locked
- ⬜ F3 The home page and its copy — free questions, forever; the trial and packages the way in
- ✅ F4a The trial's limits in the database — on packages and receipts, the trial paper, 14 days — 2026-10-04
- ⬜ F4b The trial's SMS half — the verified number, one trial per number; needs an SMS account (tables ✅)
- ⬜ 03.1 The admin's forms — the four limits on Packages, the Open in trial tick — with their redesign

## [04 Practice](docs/product-plan/04-practice.md)

- ⬜ Q21 Practice Papers — the name, "Practice Paper N", the course in full above, the address
- ⬜ G2 The daily challenge — five a day per programme from the free set, one course a day
- ⬜ Q19 The admin's preview says Preview — on the card and in the sitting
- ⬜ Q20 Preview this paper — an editor button: questions, answers, rationales, no sitting
- ⬜ Q7 Select-all partial credit — the rule first (open), then the three-state display
- ⬜ 04.1 The builder's minimum of 5 questions (Sam, 09-30) — its details open
- ⏸ 04.2 A pass mark per paper, Passed / Didn't pass on the results — Sam: later (09-27)
- ⏸ Q3 Mock exams as a premium exam experience — a design item; Sam picks when
- ⏸ Q16 The keyword step says what matched — options offered; Sam: not now (09-27)
- ⏸ 04.3 Undo "Don't show this again" — in a settings page, if one is ever built

## [05 Progress](docs/product-plan/05-progress.md)

- ⬜ G1a The streak and questions mastered — from the saved answers, no storage change
- ⬜ Q12 Progress across sittings — true totals, topic accuracy over time, a nudge, a trend
- ⬜ Q13 Readiness and standing — the percentile first on the trial paper; a band; how others did
- ⬜ G1b The leaderboard — from G2; three views; usernames and Noto animals; its storage tick first
- ⬜ G3 Badges — milestones on mastered and the streak, in place of tiers; after G1a
- ⬜ 05.1 Attempts analytics as database queries — "which questions everyone fails"; no 5,000 cap
- ⏸ 05.2 Days left to the exam — needs the NMC's dates (Sam: later, 10-04)
- ⏸ 05.3 A daily goal (Sam: later, 10-04)

## [06 Question bank](docs/product-plan/06-question-bank.md)

- ⬜ B3 The admin's bank page paged — fifty at a time, filtered by the database
- ⬜ 06.1 The History panel — a question's past versions; restore as a save
- ⬜ 06.2 Question reports — reasons, the student's answer, a status, by question; replaces Send feedback
- ⬜ 06.3 Content: subjects and topics tidied in the panel — merges, doubles, Not set
- ⬜ 06.4 Content: `RM_MID_PHILLI-S1-42` answers "a & c" on a single-answer question (Sam, 09-27)
- ⬜ 06.5 Content: the RPHN disease-control course has no questions while active
- ⬜ 06.6 Content: the midwifery course short of its set target
- ⏸ 06.7 A blueprint axis — adopted in principle; waiting on the NMC curricula in print

## [07 Offline packs](docs/product-plan/07-offline-packs.md)

- ⬜ 07.1 The pack page reads its allowance from the package; Config's setting retires — with its redesign

## [08 Help and news](docs/product-plan/08-help-and-news.md)

- ⬜ A1 Announcements' floor — one scoping function, the table admin-only, the level scope a list
- ⬜ A2 Each notice's state — read, clicked, dismissed; server writes; ✕ dismisses
- ⬜ 08.1 Course news to everyone who has held the course, revoked grants apart (Sam, 10-04)
- ⬜ A4 A real quiz-link picker in the announcement editor
- ⬜ A3 The body stored once, no extra line break per edit, the dead read removed — later
- ⬜ 08.2 The support desk (tables ✅) — general and course threads, server writes, a paged inbox, Bulk Send out
- ⬜ 08.3 NMC procedures — the manual links into a table the admin manages
- ⬜ 17 The premium channel — one per programme, all year; link codes; the bot admits and removes members

## [09 Design system](docs/product-plan/09-design-system.md)

- ⬜ 5 Shell data loaded once and kept fresh — the unread badge, My Courses, name and photo
- ⬜ DS17 About 15 name chips still on .badge — both builders, Premium Prep, Packages
- ⬜ DS20 About 20 stylesheets drawing their own white box — onto .card as each is touched
- ⬜ DS21 The app's drawer opens from the right, like the public menu (Sam, later)
- ⬜ 09.1 One form field — three copies of one field today
- ⬜ 09.2 One link style — a link inside a sentence always underlined (Sam, later)
- ⬜ 09.3 A content width limit above 1440px
- ⬜ 09.4 Dark mode — after the above
- ⬜ 09.5 The old token names retired once no page uses them
- ⏸ DS9 About eight pages on their own button classes — they join as each is touched

## [10 Launch and platform](docs/product-plan/10-launch-and-platform.md)

- ⬜ 16 Going live — the domain, live keys, content copied fresh, old logins deleted, legacy removed
- ⬜ 10.1 Security headers — HSTS, framing, nosniff, referrer, a content policy
- ⬜ 10.2 The email outbox — a queue, scheduled retries, an admin Emails page with Retry
- ⬜ 10.3 The sign-in emails taken over from Supabase — our templates, through the outbox
- ⬜ 10.4 Supabase's sender set to Resend as the fallback, its templates in neutral Quademia words
- ⬜ 10.5 Resend's paid plan — the shared free plan stops at 100 emails a day
- ⬜ 10.6 Supabase's sign-in settings recorded and the live address added
- ⬜ 10.7 The settings registry (table ticked ✅) — admin-only, typed keys, a stricter Config page; levels
- ⬜ 10.8 One limiter — one counter table, a rule per door in the settings
- ⬜ 10.9 A nightly purge of old devices and sign-in log rows (D29)
- ⬜ 10.10 A "couldn't load, try again" page
- ⬜ 10.11 Speed: the photo resized and kept — 1.38 MB for a 24px circle
- ⬜ 10.12 Speed: the admin and public links stay inside the app
- ⬜ 10.13 Speed: the student layout's three reads stop holding up every page
- ⬜ 10.14 Speed: two lists name their columns instead of reading every sitting column
- ⬜ 10.15 Scale: indexes on sittings by date, and by student and date
- ⬜ 10.16 Storage hygiene: ~14 columns and one settings row with no reader or writer — one at a time
- ⬜ 10.17 Storage hygiene: the mock's unused visibility column removed
- ⬜ 10.18 `db/schema.sql` and `db/rls.sql` brought up to date
- ⬜ 10.19 A check on prod whether sharing the project slows it
- ⏸ 10.20 The app's own offline page and a "You're offline" banner — Sam: later (09-29)
- ⏸ 10.21 Paystack's live key on prod — waits on the company / Paystack account decision
