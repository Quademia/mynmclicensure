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
- ⬜ 01.10 "Can't sign in?" on the sign-in page — WhatsApp or email; Messages needs a sign-in (10-17)
- ✅ 01.9 (unplanned) A sign-out ends only its own device, not all; a password reset still ends all — 2026-10-17

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
- ✅ F2 The free account, the floor — the builder on the free set, the dashboard's free line — 2026-10-11
- ✅ F2 After the trial — locked, not gone; the summary open, the review locked; Retake locked — 2026-10-17
- ⬜ F3 The home page and its copy — free questions, forever; the trial and packages the way in
- ✅ F4a The trial's limits in the database — on packages and receipts, the trial paper, 14 days — 2026-10-04
- ⬜ F4b The trial's SMS half — the verified number, one trial per number; needs an SMS account (tables ✅)
- ⬜ 03.1 The admin's forms — the four limits on Packages, the Open in trial tick — with their redesign

## [04 Practice](docs/product-plan/04-practice.md)

- ✅ Q21 Practice Papers — the name, "Practice Paper N", the course in full above, the address `/student/practice-papers` (student side built 2026-10-12; `/student/fixed-quizzes` redirects; the admin's "Fixed Quizzes" wording, the help page and the public copy are not changed)
- ✅ 04.5 The first sitting in the paper's own mode — `first_mode` and the database's rule, the admin's "First sitting in" dropdown, the paper's page (built 2026-10-12; the admin form not yet walked by eye, needs an admin sign-in)
- ✅ 04.6 A paper's questions kept out of the builder, packs, free set and challenge — as a mock's (no column; built 2026-10-12; the challenge reads it when G2 is built; the bank page's "In a paper" mark not done)
- ✅ 04.8 The My courses page — `/student/courses`, a card per course; the menu row plain, its dropdown gone (drawn and ruled 2026-10-12, 11-pages) — built 2026-10-12, walked as paid, trial, ended and free students
- ✅ 04.9 The course page redesigned — tabs on a computer, Up next, three rows into the stand-alone pages, news; the four states (drawn and ruled 2026-10-12, 11-pages) — built 2026-10-12, walked as paid (computer, 375px), trial, ended and free students; a course with news and an open mock not yet seen (none in dev)
- ✅ 04.7 Practice Papers redesigned — drawn and ruled 2026-10-12 (04, 11), built the same day: courses → a course → a paper's page with Practise again; walked as an RM paid student (computer, 375px, a failed request); the trial, ended and free states and the locked rows to walk as those students (one link each, Sam)
- ✅ 04.10 Sittings allowed — papers and mocks; every sitting counts, one at a time; start screen always — 2026-10-14
- ✅ 04.11 A mock's first sitting in its own mode — the database and the mock form; its page with 04.15 — 2026-10-14
- ✅ 04.12 Results on a date — papers and mocks; everything held to the date, by the database (student_attempts(), the score columns and a held sitting's rows out of the browser's reach); only the first mode while held, the number of sittings the admin's; the admin's Results field and hint; pop-up B and held sitting A — 2026-10-15
- ✅ 04.13 The review — Always / Until a date / Not allowed (Sam, in place of N days): its own date, independent of results; while closed the score and summary stay, the question review and map close, only Learning shuts; the database holds it; the form's refusals and warning — 2026-10-15
- ✅ 04.14 At the close — a sitting going with no clock running is finished at the close on what was answered (Abandoned with no answer, Sam); an exam never started cannot start; the card's Resume / See your score straight to the sitting; the database refuses saves past the close — 2026-10-15
- ✅ 04.15 The Mock exams page redesigned — by time: Open now, Coming up, Past mocks; a mock's own page — built 2026-10-13, walked whole 2026-10-15 (the no-Premium grey lines still Sam's to see)
- ✅ 04.22 (unplanned) After the close: a closed paper's page drops "More ways … after your first sitting", its row says Closed for a sitting due at the close; the Abandon link a 44px tap — 2026-10-15
- ✅ 04.16 The mock form refuses a live mock holding a draft question — says how many — 2026-10-14
- ⏸ 04.17 The mock form warns when its questions are edited after students have sat it — parked 2026-10-14 (Sam): scores are safe without it (each sitting keeps its own copy); worth building if standing across students (05 Q13) or more editors arrive; the better place then is the Question Bank edit
- ⏸ 04.18 Status and Published as one switch — at the admin redesign (Sam, 2026-10-13)
- ⏸ 04.19 An admin's extra sitting for one student — when a support case asks
- ⏸ 04.21 Replaced by 06.8 (pools, Sam 2026-10-15) — not built on its own. A paper or mock archived before its results date keeps its questions held back — today archiving releases them to the Quiz Builder (whose Learning mode shows the answers) and to packs, so the next group could see them; found while building 04.12 (2026-10-15), not built
- ✅ 04.20 Abandon back, on the sitting's own page — a quiet link under Resume on a paper's and a mock's card while a sitting is going; the app's confirm box, the sitting still counts toward sittings allowed; no migration — 2026-10-14
- ⬜ G2 The daily challenge — 5 a day per programme, one course a day in turn, its own mode (storage ticked 10-08)
- ⬜ Q19 The admin's preview says Preview — on the card and in the sitting
- ⬜ Q20 Preview this paper — an editor button: questions, answers, rationales, no sitting
- ⬜ Q7 Select-all partial credit — the rule first (open), then the three-state display
- ✅ 04.4 The Quiz Builder — the old five-step wizard's look on one door for every status (Sam) — 2026-10-11
- ✅ 04.1 The builder's minimum of 5 questions — Start greyed below 5, the words say why — 2026-10-11
- ⏸ 04.2 A pass mark per paper, Passed / Didn't pass on the results — Sam: later (09-27)
- ⏸ Q3 The rest of the mocks' design — notices, the real paper's timing, standing (ruled in part 10-13: 04.10–04.17)
- ✅ Q16 The keyword says what matched — "N questions contain …", the topics it sits in — 2026-10-11
- ⏸ 04.3 Undo "Don't show this again" — in a settings page, if one is ever built

## [05 Progress](docs/product-plan/05-progress.md)

- ✅ G1a The streak and questions mastered — the dashboard's streak card, with 05.4 — 2026-10-10
- ✅ 05.4 The dashboard redesigned — D2a, D2b; six states walked, the words approved — 2026-10-10
- ✅ 05.5 Learning History redesigned — a course dropdown, the figures, one tap to the report, dots menu — 2026-10-17
- ✅ Q12 The history's figures — sittings, average, best, a count by kind, by the database — 2026-10-17
- ⏸ 05.6 A course's topics on its course page — strongest and to work on; too busy as drawn (10-17); after 05.5
- ⬜ Q13 Readiness and standing — the percentile first on the trial paper; a band; how others did
- ⬜ G1b The leaderboard — from G2; three views; usernames and Noto animals; its storage tick first
- ⬜ G3 Badges — milestones on mastered and the streak, in place of tiers; after G1a
- ⬜ 05.1 Attempts analytics as database queries — "which questions everyone fails"; no 5,000 cap
- ⏸ 05.2 Days left to the exam — needs the NMC's dates (Sam: later, 10-04)
- ⏸ 05.3 A daily goal (Sam: later, 10-04)

## [06 Question bank](docs/product-plan/06-question-bank.md)

- ⬜ B3 The admin's bank page paged — fifty at a time, filtered by the database
- ⬜ 06.1 The History panel — a question's past versions; restore as a save
- ✅ 06.2 Question reports — "Report an issue" in the sitting; an admin list by question, Open · Closed — 2026-10-17
- ⏸ 06.9 A thumbs-up on a question, so praise has its own place — decided once students use the app (10-17)
- ⬜ 06.3 Content: subjects and topics tidied in the panel — merges, doubles, Not set
- ⬜ 06.4 Content: `RM_MID_PHILLI-S1-42` answers "a & c" on a single-answer question (Sam, 09-27)
- ⬜ 06.5 Content: the RPHN disease-control course has no questions while active
- ⬜ 06.6 Content: the midwifery course short of its set target
- ⏸ 06.7 A blueprint axis — adopted in principle; waiting on the NMC curricula in print
- ✅ 06.8 Pools — every question in one: Practice, Free, Paper or Mock (Sam); papers and mocks hold only their own, the Builder and packs read Practice + Free, the challenge Practice; is_free_sample and the held-back logic gone; the database holds it — 2026-10-15

## [07 Offline packs](docs/product-plan/07-offline-packs.md)

- ✅ 07.1 The allowance from the package — pack_allowance(), one rule for the maker and the pages; Config's offline_packs_per_course retired — 2026-10-15
- ✅ 07.2 The pack builder is the Quiz Builder plus a pack's extras — Count & name, 5 to the pack limit, the allowance line, earlier packs' questions first-unused; the pack door; the old wizard deleted — 2026-10-15
- ✅ 07.3 Offline in the app — our own small service worker (public/sw.js) keeping /offline; the packs in the phone's IndexedDB; Save to / Remove from this phone, kept at once on the phone it was made on; the check-in from every signed-in page, locked past Config's 30 days; cleared on Sign out or a bump, kept when the week runs out; the icon opens the Dashboard; How to install the app on your phone (the Dashboard's closable line, My packs' line, the account menu's row; each phone's Add to Home screen steps; no Install button: Sam's phone blocked it) — 2026-10-15
- ⏸ 07.3 A practice in progress kept on the phone to continue — not drawn; the last score is kept (2026-10-15)
- ✅ 07.4 The offline player — its own small one from the runner's pieces (components/offline-player, /pack-practice/[id]); Practise on the pack's page, the two ways in the app's dialog; marked by the database's rule; no sync — online 2026-10-15, offline with 07.3
- ✅ 07.5 The PDF redesigned — made on the phone with pdfmake 0.3.11 (Sam), Roboto from public/fonts; View or download PDF on the pack's page with the answers' place (last page, or after each question), View showing it on screen in a tab opened at the tap (Sam); the drawn cover, two flowing columns, the answers grid; the slanted pattern, the footer, the file's details, no copying; the old print page (/offline-pack) removed — 2026-10-15
- ⏸ 07.5 A PDF from the offline screen with no signal — the maker (~330 KB) would have to be kept on the phone too; parked (2026-10-15)
- ✅ 07.5 The pattern's strength — Sam printed a page on an ordinary printer and kept it as drawn (PATTERN_OPACITY 0.08) — 2026-10-15
- ✅ 07.6 No explanations in a pack — the rationale and feedback no longer copied or stored, old packs' dropped — 2026-10-15
- ✅ 07.7 Delete a pack — the database and the server action (status deleted, still counts; rule 9 on offline_packs) — 2026-10-15; its button with the pack's page (07.8, built the same day)
- ✅ 07.8 My packs and a pack's own page, online — by course with the five-step bar, Build a pack per course, Made earlier, the locked and empty cards; the pack page with Delete; the menu one row — 2026-10-15. The offline state, On this phone and the last score built with 07.3 the same day. Redrawn as C the same evening (Sam): course cards like Practice Papers, a tap opening the course's packs (course/[course_id]); the pack page and Delete lead back there; the pack page's main button Save to this phone until it is saved, then Practise (Sam)

## [08 Help and news](docs/product-plan/08-help-and-news.md)

- ✅ A1 Announcements' floor — one reader in the database, the tables closed to the browser, levels a list — 2026-10-18
- ✅ A2 Each notice's marks — seen, tapped, dismissed, each dated once; server writes; ✕ dismisses — 2026-10-18
- ✅ 08.1 Course news to everyone who has held the course, revoked grants apart (Sam, 10-04) — 2026-10-18
- ✅ 08.7 The Announcements page redesigned — Messages' layout, the hybrid list, Seen by itself, Ask about this — 2026-10-18
- ✅ 08.8 The dashboard's New from Quademia card, near the top; the Must-see pop-up, once — 2026-10-18
- ✅ 08.9 The number of new notices on the bell (computer), the menu's row and the menu button's dot — 2026-10-18
- ✅ 08.10 One picture per notice — uploaded only, two small sizes made in the admin's browser — 2026-10-18
- ✅ 08.11 The admin's follow-up — Reaches today, Seen, Tapped, Dismissed; the names behind each — 2026-10-18
- ✅ 08.12 "This will reach N students today" in the editor as the scopes are set — 2026-10-18
- ✅ 08.13 Kinds — the admin's own list, a name and an icon from a 25-icon grid; the editor's Kind — 2026-10-18
- ⬜ 08.14 The editor without codes — the tool chosen with Sam; the body stored once (takes in A3)
- ⬜ 08.15 Announcements to devices — a tick in the editor, sent once when the notice goes live
- ✅ A4 A button pointing inside the app, picked from a list — pages, courses, mocks; opens in the app — 2026-10-18
- ⏸ A3 The body stored once, no extra line break per edit — taken into 08.14 (2026-10-18)
- ✅ 08.2 The support desk — server only, five labels, Message us box, both pages; admin by student — 2026-10-17
- ✅ 08.2 (unplanned) A new reply marked in blue — the dot, the bold preview ("Quademia: …"), a New reply badge — 2026-10-18
- ⬜ 08.4 "Message us" on other pages, each picking its label — as each page is touched (after 08.2)
- ✅ 08.5a The badge keeps itself fresh — a live line while the app is open; recounts on return, reconnect — 2026-10-17
- ✅ 08.5b Phone notifications both ways — the ask after a send, the label only, the admin's switch — 2026-10-17
- ⏸ 08.6 Supabase Broadcast for the badge's line — a rule outside our schema; only at thousands at once (10-17)
- ⬜ 08.3 NMC procedures — the manual links into a table the admin manages
- ⬜ 17 The premium channel — one per programme, all year; link codes; the bot admits and removes members

## [09 Design system](docs/product-plan/09-design-system.md)

- ⬜ 5 Shell data loaded once and kept fresh — My Courses, name and photo (the unread badge: 08.5a)
- ⬜ DS17 About 15 name chips still on .badge — both builders, Premium Prep, Packages
- ⬜ DS20 About 20 stylesheets drawing their own white box — onto .card as each is touched
- ⬜ DS21 The app's drawer opens from the right, like the public menu (Sam, later)
- ⬜ 09.1 One form field — three copies of one field today
- ⬜ 09.2 One link style — a link inside a sentence always underlined, a control (row, card, button, tab) never, the global hover-only underline in base.css gone (recommended and logged 2026-10-12; Sam's yes still to give before it is built)
- ⬜ 09.3 A content width limit above 1440px
- ⬜ 09.4 Dark mode — after the above
- ⬜ 09.5 The old token names retired once no page uses them
- ⬜ 09.12 One switch — the announcements editor and the admin's notifications switch draw their own (10-17)
- ✅ 09.11 The page title — one line, teal fading to grey over 240px; subtitles below; tabs lineless — 2026-10-17
- ✅ 09.10 A row menu (three dots) — what a row allows, closed items in grey; on Learning History — 2026-10-17
- ✅ 09.6 The phone's bottom bar and sub-tab row — four fixed tabs, a row per group, the drawer kept — 2026-10-04
- ✅ 09.7 The student menu in its groups — a heading per group, every row visible, the phone's names — 2026-10-04
- ✅ 09.9 The menu's Home group — Dashboard and My courses under Home; the phone's first tab Home with Dashboard · Courses (Sam, 2026-10-12)
- ✅ (unplanned) Leftover code removed — the sidebar's dropdown, the layout's course reads, the fixed-quiz side of the quiz list and older unused code and styles; CSS 534 → 519 (2026-10-12)
- ⏸ DS9 About eight pages on their own button classes — they join as each is touched
- ✖ 09.8 The builder's own chips, switch, cards, circles, search box — gone with the four-step page (10-11)

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
- ✅ 10.17 Storage hygiene: the mock's unused visibility column removed — 2026-10-15
- ⬜ 10.18 `db/schema.sql` and `db/rls.sql` brought up to date
- ⬜ 10.19 A check on prod whether sharing the project slows it
- ⏸ 10.20 The app's own offline page and a "You're offline" banner — Sam: later (09-29)
- ⏸ 10.21 Paystack's live key on prod — waits on the company / Paystack account decision
