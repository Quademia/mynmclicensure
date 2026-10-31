# 11 — Pages

One entry per page: what it shows to a **free**, **trial**, **paid** and
**ended** student (ended = the trial or a package has ended and nothing
else is live), and which decisions land on it. A page's entry is
completed when its redesign starts, not before. What is here now is
what is already ruled for that page, plus **Check** — small faults on
today's page to look at then, most of which the redesign will remove.

The rules themselves live in the feature files; this file only says
where they show.

## Student

One menu for every status; a locked item carries a lock and says what
opens it (00, The menu).

### Dashboard
- **Where sign-in lands, for every status; its top card is this
  student's next step** (Sam, 2026-10-04: A).
- **The blocks, top to bottom** (Sam, 2026-10-04 — a redesign, not
  today's page; drawn in the chat): today's challenge as one slim line
  under the title, with the rank line (Sam, 2026-10-20: C, drawn; 04;
  the line built 2026-10-20, 04.26 — the rank line comes with G1b) →
  the top card → the streak and questions
  mastered → your weakest topic, one tap into the builder (shown from
  20 answers, naming only a topic with at least 5 — Sam, 2026-10-04,
  MyNclex's gate) → my courses, a compact list with days left and
  questions met out of the course's bank ("212 of 1,080 met" — Sam,
  2026-10-04) → recent
  sittings, the last 3–5 with Resume and Report. **News moves up**
  (Sam, 2026-10-18: C, drawn): a "New from Quademia" card under the
  welcome, only while something is new — up to two, a tap opens, ✕
  dismisses — and a Must-see notice pops up once (08.8, built
  2026-10-18); on a phone the old box sat last, under the courses. A profile nudge only
  while something is missing (the school). Off the page: the plan
  status bar (into the top card), the channels card (to Help and
  news), the Create a Custom Quiz and NMC Procedures cards (the menu
  has them).
- Trial: the top card — "Trial · limited access", the days left (amber
  in the last three), carry on where they left off, Choose a package
  (03).
- Paid: the package and its days left, carry on. With only a future
  access row: "RN Standard Prep starts 13 Oct 2026" in place of an offer
  (02). A Standard paused by Premium shows as the next one, on the
  existing line: "Then RM Standard Prep until 28 Aug 2028" (02, Premium
  goes first; built 2026-10-30). Profile's panel, the Upgrade page and
  Messages' package line read each package by its access rows too, so a
  paused Standard is never shown as the live one (02.14, 2026-10-30).
- **On the floor** — a trial or package ended, or free with no trial
  (03): the recap card, then **the free practice card** ("Build a free
  quiz" from the free questions of their courses), then today's
  challenge; the courses locked, "free questions only"; Report links
  stay. The recap, no storage: a trial's 14 days in numbers (answered,
  % correct, quizzes), up to three topics to work on, the percentile on
  the trial paper (05), Choose a package; a package's in numbers, Renew
  your package. **The full recap shows for 2 weeks after the end, then
  shrinks to one line above the free practice card** (Sam, 2026-10-04).
- On a phone, the bottom bar's Dashboard tab; no row of sub-tabs (00).
- Open: the cards' words, all new.

### My courses and the course page
- **Redesigned (Sam, 2026-10-12; 04.8, 04.9)**, drawn at
  https://claude.ai/artifact/QmaN7QNr2gZ4D62LC1WuER. The course page is a
  **front door and a progress summary**, not a second copy of the papers
  and mocks: those keep their own pages (Practice papers, Mock exams, Quiz
  builder), and the course page leads into them set to this course.
- **The menu**: "My courses" is one plain row, no dropdown (its child
  rows go); it opens `/student/courses`.
- **My courses** (`/student/courses`): a card per course the student
  holds — the name, a days-left chip from the stored end (amber at 7 or
  fewer), a thin bar of questions met out of the course's bank, "N of M
  papers", and a carry-on line (the sitting in progress, else the next
  paper to start). A student holding nothing sees their programme's
  courses, locked. Ended: the courses stay, an "Ended" chip, "See your
  scores", the ended note. A card opens its course page.
- **The course page** (`/student/course/[id]`), top to bottom: on a
  computer a row of tabs — "‹ My courses" and the student's other
  courses, the current one in navy, no line (the teal is the title's,
  09.11) — and on a phone only "‹ My
  courses"; the title, the days-left chip with the end date, "Message us
  about this course" (opens a draft about the course, 08); one progress
  card (questions met out of the bank, papers done); **Up next**, one
  card and one button — the sitting in progress first, else the next
  paper not yet done; three rows, each a link into its stand-alone page
  set to this course — Practice papers ("Paper 4 in progress", "All
  done"), Mock exams ("Mock 1 opens 20 October", "With Premium Prep"),
  Quiz builder ("Practise {topic}, 41%" when the dashboard's weakest topic
  is in this course, else "Build a quiz"); the course's news, the two
  newest announcements scoped to it, "No news for this course yet." when none (Sam, 2026-10-12: shown, not hidden). Off the page: the
  papers' and mocks' own lists, the Procedures block (in the menu), the
  programme badges.
- **Trial**: "Trial · N days left"; Up next is the trial paper, "Included
  in your trial"; mocks a locked line, "With Premium Prep"; the builder
  row "N of 3 trial quizzes left"; Choose a package once, at the bottom.
- **Ended**: an "Ended 5 October" chip and the note "Your package ended
  on 5 October. Your scores are still here."; the progress stays; no Up
  next; papers "Your scores are here"; mocks locked; the builder "Free
  questions only"; Choose a package once.
- **Free, no package ever**: a "Free" chip, no days; papers and mocks
  locked lines; the builder "Free questions only"; Choose a package once.
- No days, count, paper number or paper name is written into either
  page: each is read from the student's own data and the course.
- The course page's mocks row opens the course's open mock's own page
  when there is one, else the Mock exams page (2026-10-13, with 04.15).
- Parked (Sam, 2026-10-17): a card of the course's strongest topics and
  topics to work on (05.6) — drawn too busy; drawn again after Learning
  History.

### Practice papers
- **Redesigned (Sam, 2026-10-12; 04.7)**, drawn at
  https://claude.ai/artifact/XyTdnfwmtswW6Xf6Wq69Cg (boards D, E, F);
  the rules are in 04. Three screens: the courses → a course → a
  paper's own page. Computer: a narrow column in the app's shell; only
  the paper's page takes two columns (the card, the sittings).
- Names: "Practice Paper N", the course in full above it (04 Q21).
- **The course header and the cards** (Sam, 2026-10-12): inside a course the
  page wears the course page's header — tabs ("‹ Practice papers" and the
  other courses, the tabs staying in Practice Papers; on a phone only the
  way back), the title, the days-left chip and the end date; no Message us,
  no progress card. The courses list is cards like My courses', the bar one
  segment per paper and the line about papers. The paper's own page keeps
  its own title and its way back to the course.
  UPCOMING / CLOSED by the server's clock; a paper holding a draft
  question refuses to start, with the message on the card.
- **Courses**: a row per course the student holds — name, one line
  ("Paper 3 in progress", "Next: Paper 1", "All done"), a bar with one
  segment per paper (done, in progress, to do).
- **A course**: "Up next" (the paper in progress, else the next
  unstarted one) with Resume or Start; then a row per paper — name and
  one word on the right (the score, In progress, Not started).
- **A paper's page**: the main card by moment — before: "Your first
  sitting", the mode, size and time, Start; in progress: progress bar,
  time left, Resume; finished: the score, See your report, Practise
  again (the dialog: the four ways, each Start). Before the first
  sitting is finished, one grey line: more ways open after it (04.5). A
  list of the student's sittings with their score or Resume.
- Trial: Paper 1's card "Included in your trial" with Start; the others
  grey lines, "Opens with a package"; Choose a package once, at the
  bottom (03).
- Ended: the trial paper's card with its score and See your report;
  the others grey lines; at the top "Your trial ended on 18 October.
  Your scores are still here."; Choose a package at the bottom.
- Free, with no package (Sam, 2026-10-11): every paper of the
  programme's courses listed as grey lines, "Opens with a package",
  Choose a package — the ended view, with scores only where they exist.
- No size, time or paper count is written into the page: each is read
  from the paper.
- **Sittings, results and review** (04, Sam, 2026-10-13): a paper's card
  says the sittings left when the admin sets a number; held results and
  a closed review show as on a mock's page (below). *(the sittings built
  2026-10-14, 04.10; held results and the review built 2026-10-15, 04.12, 04.13)*

### Mock exams
- **Redesigned (Sam, 2026-10-13: layout A; 04.15)**, drawn at
  https://claude.ai/artifact/5QQCWH9ECauT7k69cUUxC3 (A, A with several
  open, B; C by course declined). One screen, by time; the rules in 04.
- **Abandon (04.20, 2026-10-14)**: while a sitting is going, a quiet red link under Resume on the card ("Abandon this sitting"), and on a mock's page after a first sitting "Abandon the {mode} sitting in progress"; the same on a paper's page (see 04).
- **The list**: one card for the mock to start — a sitting in progress
  (answered so far, time left, Resume), else the open mock that closes
  soonest (Start); then plain rows under **Open now** (the soonest to
  close first, the course and "until 30 Oct" under the name), **Coming
  up** (a grey line, "Opens 6 November") and **Past mocks** (closed and
  sat by this student, whatever the mock's status since). A row's right
  side: Not started, In progress, the score, "Results 30 Oct". With every
  open mock sat the card says so; between exam periods "No mock is open
  right now". A row opens the mock's own page; Start is two taps from the
  menu.
- **A mock's own page**, as a paper's: the card that follows the student
  — Your first sitting (the mode, size, time, closing date), Resume, then
  the score, See your report and Practise again; "You can sit this mock N
  times" or "N of M sittings left" when a limit is set; the student's
  sittings. Held (04.12): "Results on Friday 30 October at 6:00 pm" on
  the card, the sittings showing "Results on 30 Oct" in place of a score
  and no report link until then; Practise again offers the first
  sitting's mode only, the others opening with the results (Sam,
  2026-10-15). Every sitting used: the score and See your report. A
  closed mock: the score, the report and the review, no new sitting.
- **Every student without Premium Prep is alike** — free, trial, ended,
  or paid without it (Sam, 2026-10-14); only the season changes the page.
  With a mock open or coming: "Mock exams come with Premium Prep."; Open
  now and Coming up as grey lines, "With Premium Prep"; Choose a package
  once, at the bottom, to the in-app Packages page (Sam, 2026-10-13).
  With none: one card — "Mock exams come with Premium Prep", "Timed
  papers like the real exam, opened around each exam period" — and
  Choose a package. A student who sat mocks also sees Past mocks with
  their scores (an ended student's review locked, 03 F2). Start is
  refused with "Mock exams aren't included in your package." (02.10).
- Paid with Premium Prep: open (02.10). No name, date, count or time is
  written into the page: each is read from the mock.

### Quiz builder
- The page: 04, The Quiz Builder (the old five-step wizard's look, Sam
  2026-10-11). Opened with a course and topic already set from the
  report and the dashboard, at step 2.
- Paid: the whole bank of the courses held, all four modes, no banner.
- Trial: "Trial · 2 of 3 quizzes left — a quiz counts when you build
  it; retakes don't count". Used up: "You've used your 3 trial quizzes
  — keep practising on the free questions, or choose a package", then
  as free.
- Free and ended (the floor): "Free practice — you build from the free
  questions in each course, in the Study modes"; the programme's
  courses with their free counts; the Exam modes locked, "The exam
  modes open with a package."
- **Check** (today's page, gone with 04.4): the status line sticks after
  a failure; picking another course leaves the previous course's topics
  and counts; an "All topics" quiz is named after the course's first
  three topics; a trial's fourth quiz shows "We could not build your
  quiz" instead of the database's sentence.

### Daily challenge
- The same in every state: free, trial, paid and ended students all
  play; signed in only (04).
- The first time a student goes to play, before its questions: the
  offer to join the leaderboards — Join or Not now, just play — asked
  once; Join opens the choice of how to appear and, for a username, the
  card: an animal from the grid and a word already filled, up to 3 spins
  of the word, one tap to accept (05). *(built 2026-10-24: 05.9, How
  you'll appear as 2A)*
- Its answers reopen from the dashboard's slim line until midnight; not
  in Learning History (04).
- Its own start screen, A: the five rules of Challenge mode, the
  leaderboards box, Don't show this again (04; Sam, 2026-10-20, drawn).
- Its results, A: the quiz's pop-up over the answers — the count, the
  time, five dots, the ranks; See answers; no report, no Retake (04).
- A home page of its own — who opens it and what it shows, open (04).

### The sitting — start screen, sitting, review
- **Parked (Sam, 2026-10-15):** the sitting and the report are special
  cases; Sam is considering changing the sitting's screen. Their redesign
  waits; the practice pages go on without them.
- The start screen alone; Start or Resume; a resumed exam's minutes
  left; per-mode "Don't show this again" (04). With a sitting limit set
  it always shows, with "This is sitting 1 of N for this paper" ("It is
  your last" on the last) and no "Don't show this again" (04.10, Sam,
  2026-10-13; built 2026-10-14).
- Hide / Show timer; Sequential's Next stays off until answered, no
  Previous; the review moves freely. Submitting with flags: "You still
  have N flagged questions" — Go back and review / Submit anyway; with
  blanks: "You have N unanswered questions" — Go back / Submit anyway.
  No leave-page warning after Save & Resume Later or Submit & Exit.
- Report an issue (06). The admin's preview says Preview (04 Q19).
- Ended: an unfinished sitting finishes; the review is locked; Retake
  kept with a lock — "Choose a package to retake" (03).
- **Check**: a resumed exam's brief still opens with "The clock starts
  when you begin…" before "The clock is still running".

### Results pop-up and the report
- As in 04. On the report the sidebar marks Learning History.
- Ended: the summary open; the question list locked — "Choose a package
  to review your answers". The percentile on the trial paper's report
  (05).
- Held results (04.12, built 2026-10-15): the pop-up ("Exam submitted")
  says when the results come out, with the mode, the time and how many
  were answered, and one way back — to the paper's or mock's own page;
  the sitting opened again, and the report, show the date and nothing
  else until then. With the review closed (04.13, built 2026-10-15): the
  summary open, "Every question" says "The review of this mock closed on
  …" in place of the map, no Review answers; the sitting opened again
  shows a lock, the line, See your report and the way back; the start
  screen of a later sitting says it shows the score and report only.

### Learning history
- **Redesigned (Sam, 2026-10-17; 05.5)**, drawn in the chat; the rules
  are in 05. Top to bottom: the title; the course dropdown ("All
  courses" first); the figures
  (sittings, average, best, the count by kind); a row per sitting —
  one tap to its report or Resume, three dots for what else it allows;
  Load more. Phone first; on a computer the same list in the page's
  column.
- Free: their free sittings like any other (03). Trial: as paid.
  Ended: every sitting stays, See your report open, Review answers and
  Retake locked in the menu with "Choose a package"; an unfinished
  sitting still finishes (03). Held: "Results on …" in place of the
  score (04.12).
- No count, name or date is written into the page.
- **Check** (today's page, for the build to fix): for a student with no live course the names show as codes
  and the course filter is empty; the stats bar, Source and Sort count
  only the loaded pages; no Mock option in Source, and a mock shows the
  raw word "mock".

### Leaderboards
- Today · This week · All time; the board a dropdown — My school (the
  school in the student's programme) · My programme · All of Ghana ·
  Schools; opens on This week · My school. The student's place first,
  then the top 10 and the neighbours, Show more the next 20 a tap until
  every player shows (Sam, 2026-10-24); a row opens nothing; "Join to see
  where you rank" before joining; Share on WhatsApp (05; Sam,
  2026-10-20: B, drawn). *(built 2026-10-24: 05.10 — Share left out
  until the challenge's home page; with no school, My school says to add
  it on Profile)*
- The same in every state.

### Achievements
- The 15 (05 G3; approved by Sam 2026-10-24): "5 of 15 earned", then
  Doing, Keeping at it, Placing; earned in colour with its date, locked
  in grey with what it needs, a level family with a bar to its next
  level; a tap opens its levels and dates; Placing before joining, "Join
  the leaderboards to compete for these". Noto pictures.
- The same in every state; a free student's Exam Explorer stays locked
  until a mock can be sat (locked, not gone).
- **The dashboard**: the "New achievements" box at the next visit, once,
  after any Must-see notice.

### Offline packs — my packs, build, the pack
- **Redesigned from 07's ruling (Sam, 2026-10-15)**: My packs one page,
  online and offline; a pack's own page; the builder the Quiz Builder's;
  the offline player; the PDF. What each shows is in 07, drawn at
  https://claude.ai/artifact/NrEnZUieGVsFmZkZEmjbFm. Built 2026-10-15: the
  builder (07.2), My packs and the pack's page online (07.8), the player
  online (07.4).
- The same in every state: a trial cannot make a pack; one made earlier
  still opens (07).
- **Check**: the pack's cover prints "Prepared for" twice; it shows the
  course code once the course is inactive; Print and Download both open
  the print dialog; My packs offers Archived and Deleted filters nothing
  ever sets, and counts only the loaded rows; the builder's status line
  (as the Quiz builder).

### Announcements
- **Redesigned (Sam, 2026-10-18; drawn on the app's own styles at 375px
  and 1280px)**: Messages' layout — the list, and the opened notice
  beside it on a computer (the newest opening by itself) or in its place
  on a phone. The list: the pinned notice a big picture card, the rest
  rows with the picture's square or the kind's icon; one list, no tabs,
  Mark all as read, the dismissed ones at the foot. Opened: the picture
  on top, kind · programme · date, the title, the words, the button, Ask
  about this, Dismiss. The rules are in 08.
- The same in every state: free, trial, paid and ended students see
  what their scopes reach; a course's news reaches whoever has held the
  course (08.1).

### Messages
- **Redesigned (Sam, 2026-10-17; 08.2 step 3, drawn as B)**: the labels are
  the list, then "Your courses" (the My courses list, a row each), then
  "Earlier conversations"; each row its newest conversation or "Start a
  message ›"; the conversation beside the list on a computer, in its place
  on a phone. The rules are in 08.
- The same in every state: free, trial, paid and ended students all write
  and read here; the course rows follow My courses (held, else the
  programme's).

### Portal guide, NMC procedures
- The same in every state.
- The help page's "Study and Exam modes" wording — not yet approved
  (04).

### Profile
- The username, changed once a week; the school, any time, by region
  with suggested schools (01); the phone number changed through the
  server, clearing its verification (01, 03, 05).
- Show me on the leaderboards, and as name and photo or username and
  animal (05; Sam, 2026-10-20). *(built 2026-10-24: 05.13, a panel after
  Academic Details, with the weekly rename)*
- **Check**: the subscription panel shows one subscription only, the
  first returned.

### Packages (today "Upgrade")
- Its redesign starts from the plans row (Home page, below) and 02's two
  tiers — drawn and set aside 2026-10-30 (Sam). Every signed-in student
  reaches it, trial and free ones too, from each "Choose a package".
- **Check**: its own card styles and its own for-sale list (02); a
  failed read shows "No active subscriptions found yet." instead of an
  error.

## Visitor

### Home page
- **The page, in order** (Sam, 2026-10-30): the hero, words only for
  now — a headline, one line, **Start your 14-day trial** (the page's
  first filled button) and Sign in; the plans row C (below); the open
  programmes as one compact row of names, read from the database; the
  footer. Pictures come later (Sam). **Gone**: the stats strip (typed
  counts, three already wrong), About the exam (NMC facts that neither
  sell nor route; the Portal Guide could take it), What you get and How
  it works (the plans row says both), the closing band (a short page
  needs none), the old quiz drawing, the green trial badge. The social
  links move to the shared public footer, on every public page, until
  Sam updates them. Why: the page was eleven phone screens; MyNclex's is
  a hero and one routing section.
- **Built 2026-10-30** (03 F3) from Claude Design's canvas "Home page",
  with Sam's choices on it: the programmes row **under the hero**;
  **Premium Prep stands out** (its teal border, "Best for the exam", the
  row's filled "Get Premium Prep"; the trial card's button outlined, no
  "Start here" — in place of 10-05's trial-first C); **each card keeps its
  drawing**, code written into the page (no picture files, no extra
  downloads: Sam); the hero's words "Practise for the NMC licensure exam
  the way you'll sit it." and "Exam-style questions for every NMC Ghana
  programme, timed like the real paper, each with the reason behind the
  answer. On your phone, tablet or computer. Start with a 14-day trial."
  (Sam: the exam is sat on a computer or tablet, so the phone is not the
  headline). The hero's filled button is **See plans**, a jump to the
  plans row (Sam, 2026-10-30: the hero should not lead straight into the
  trial); Start your 14-day trial stays on the trial card and in the
  footer. The footer redesigned with it, on
  every public page: the wordmark and a line, Follow us, the open
  programmes each linking to the shop with its packages first (Sam: kept),
  the pages, Back to Quademia and the year. Every number is read: the
  trial's days and builder quizzes from the trial packages, prices
  ("from" when a tier's differ) and days from the packages on sale, the
  packs a course from Standard Prep; "or Premium Prep" on the single
  courses line waits for a Premium single course on sale; the channel's
  line, and "and the channel" in Premium's tagline, wait for 17. On the
  design system: tokens, Inter, `.card`, the button family. 2,095px on a
  computer and 3,892px on a phone (4,734 and 8,674 before).
- **The hero's pictures** (Sam, 2026-10-30): the words stay still and a
  picture beside them (under them on a phone) fades through four of
  Sam's Cloudinary photos, one a programme — not a slider (sliders hide
  their later slides and move what is being read). 6 s each, in the
  stylesheet with no JavaScript; held under a finger or a mouse; one
  picture only, and the rest not downloaded, with "reduce motion".
  Cloudinary cuts each to 3:2 at its economy quality, 480 or 720px wide:
  the four 159 KB at 720px, the first loaded with the page and the rest
  after it. When the security headers come (10.1), the content policy
  must allow `res.cloudinary.com` for pictures.
- **The plans row, design C** (Sam, 2026-10-05), under "Start your
  14-day trial, then free practice, forever", in place of today's
  "Where do you start?": three cards — Trial ("Start here"), Standard
  Prep, Premium Prep. The Free forever box once, on the trial card, then
  "Plus, for 14 days", the page's one filled button ("Start your 14-day
  trial") and "After 14 days, Free forever stays."; the two paid cards a
  one-line strip ("Free forever included, and kept when the package
  ends"), what they pay for, an outlined button; under the row, "Only
  need one course? Take it on its own, as Standard Prep or Premium Prep,
  from GHS …" and See single courses. Why C: A's Free card had no button
  (a dead end on a phone); B said the free list three times. The approved
  words and the drawings: `docs/home-page-plans-2026-10-05.html` (§3,
  §8) and Sam's canvas "Home page plan cards"; the taglines and the strip
  are Claude's words, Sam's to change.
- Prices read from the packages, never typed in; a feature not live at
  launch comes off its card (today: the premium channel). No Free card,
  no "free account" button (03). The two ways in — register (the trial)
  or buy a package (03 F3, 01); only programmes open to the public (02).
  Built last, on the pages that exist (00).
- The old page's faults went with it (2026-10-30): "Create Free Account"
  three times, the typed stats ("2 Quiz modes"), the Extend / Upgrade
  card, the private colours and the device font.
- **Open**: the open programmes are listed by name, so NACNAP (its name
  today) comes first; an order of Sam's would need a column.
- **More to come on the page** (Sam, 2026-10-30: "we will need to do more
  on the page"; to scope next time). Today it goes from the headline
  straight to prices and leaves a student's questions unanswered. Talked
  through, not yet ruled, each short so the page stays near six phone
  screens: **See it working** after the hero — two or three real
  screenshots (a question, its explanation, a timed paper), a caption
  each; **Proof** before the plans — only real things, numbers read live
  (questions in the bank, students practising this week) and two or
  three quotes Sam collects from real students, never written for him;
  **Common questions** after the plans — five that open on a tap (is it
  free; after the trial; paying by mobile money or card through
  Paystack; offline; which programmes and exam); and a line by the plans,
  "Pay with mobile money or card". Claude's suggestion: the screenshots
  and the questions first (they need nothing from anyone), drawn by
  Claude Design from a short brief, then built.

### Register, sign in, forgot and reset password
- Register: registering starts the 14-day trial (01); the school
  required — region, then the list, then suggested schools, then Add
  your school (01; Sam, 2026-10-20); closed programmes not offered; the
  SMS code here, before the trial starts (03 F4b).
- **Sign in, redesigned** (Sam, 2026-10-30; 01): layout B from the
  canvas https://claude.ai/artifact/5vmaSLpvdCZtyxKhchQCTU, after
  Claude's sign-in page. The shared wordmark (to the home page), "Pick up
  where you left off." and one line; the card — email, password, Sign in,
  "or", Continue with Google and Email me a sign-in code as equal
  buttons; "New here? Start your N-day trial" (the days read) and "Can't
  sign in? Message us on WhatsApp". On a computer one Cloudinary photo
  beside it (Sam's: students sitting an exam on computers), on a phone
  none and not downloaded. Messages as toasts: a wrong password, and a dropped
  connection that gives the button back. A phone bumped by a sign-in
  elsewhere: "You were signed out because your account was signed in on
  another device." Gone: the blue "New here?" box, "Register here", the
  faint photo, the email-link box. "This account has been deactivated"
  (01.1) still to come. Headline and lines Claude's, Sam's to change.
- **Register, forgot and reset on sign in's look** (Sam, 2026-10-31,
  01.15; drawn on the same canvas): the same frame and photo (one
  download for all four), the photo held in place while register's form
  scrolls on a computer. Register: "Start your N-day trial." / "Then free
  practice, forever. No card needed." (the days read; the old per-programme
  hint, which never showed, gone), first and last name side by side, the
  password once with Show, "Start your N-day trial", "Almost done!" in the
  app's dialog, "Creating your account…" on the please-wait screen, then
  straight in — the welcome screen, the dashboard. Forgot: "← Back to sign
  in", "Forgot your password?", "Email me a reset link", the answer in the
  card's place with Send it again and Use another email. Reset: "Set a new
  password." for the link's email, "Save and sign in" (signed in on
  success, 01); a used or old link "This link no longer works.", no link
  "Open the link in your email.", each with "Send me a new link". A
  dropped connection on any of the three says so and gives the button
  back. Gone: the old card, lockup and private colours (`styles/auth.css`),
  the home-made "Almost done!" and "Your account is ready!" overlays, the
  confirm-password fields, Supabase's own words for a taken email.

### Packages (the shop) and Premium Prep
- On a computer, a side panel of tickable filters in place of the chip
  row (Sam, 2026-09-22).
- Premium Prep's words and a season banner, Sam's to edit (02.11).
- No price typed into the words, and Standard Prep named in place of
  Full Access (2026-10-30, 02.12): the cards carry each package's price.

### Checkout
- The package with "Change package"; the details; a side panel with the
  summary, Pay and "What happens next" (which changes with 02 D31);
  stacked on a phone; Pay never held disabled; problems as toasts.
- **Check**: a signed-in buyer with no WhatsApp number on the profile
  pays without one.

### Payment confirmation
- Five states; Buy another package; under 02 D31 / D33, a password field
  only, or "we've emailed you a link".

## Admin

### Users
- The Sessions panel and last sign-in in the drawer; a dormant filter
  on the list (01); the username beside the real name (05); Remove
  picture on a student's row (01, 05; Sam, 2026-10-20).
- **Schools not on the list** — Approve, Merge, Remove (01).
- **Check**: Assign refuses a deactivated account.

### Subscriptions
- Each receipt's rows — Live, Queued, Ended, Revoked; who granted it;
  the Grant preview (02).

### Payments
- In progress, abandoned and paid counts; abandoned left out of the
  default list; "resend the link" as the rescue; the trimmed raw view
  (02).
- **Check**: after Retry Activation the panel redraws, "Activated ✓"
  goes, and it can close itself (likely gone with D31).

### Courses
- The Open to the public tick beside each programme, and an Open / Not
  open badge (02 C5).

### Practice papers and Mock exams
- A paper: "First sitting in" (a dropdown, Free Navigation already
  picked) and the other ways allowed after it (04.5). A mock: mode ticks
  under Study and Exam (refused with none), and "First sitting in" as a
  paper (04.11). Both: Sittings allowed, Results (Immediately / On a
  date and time), Review (Always / Until a date and time / Not allowed)
  (04.10, 04.12, 04.13). The mock
  form refuses a live mock holding a draft question, saying how many
  (04.16), and warns when its questions are edited after students have
  sat it (04.17). The modes as
  chips; an "Allows …" filter; the "Open in trial" tick (03); a Preview
  button (04 Q20); the mock list "Showing 50 of N"; the paper picker
  hides held-back questions and marks one already in the paper "In a
  mock"; a Draft badge on unpublished questions; Archive and Restore
  confirm.

### Question bank
- As in 06.
- **Check**: the whole course loads in batches (06 B3 replaces it); an
  imported id from another course moves the question into this one.

### Announcements
- Engagement — read, clicked, dismissed (08 A2).
- **Check**: each edit adds a line break between paragraphs (08 A3).

### Messages
- **Redesigned (Sam, 2026-10-17; 08.2 step 4)**: the students who have
  written, waiting for a reply first; a tap opens the student's Messages
  as they see them, with one line about them and Next waiting. The rules
  are in 08.

### Attempts
- **Check**: the note that numbers cover at most 5,000 sittings (05).

### Config
- Typed fields (10). **Check**: a failed read shows "No config keys
  found." instead of an error.

### New: Security, Emails, Question reports
- Security — Sessions, Login events, Reset requests (01). Emails — every
  email, with Retry (10). Question reports — grouped by question, Mark
  fixed (06).
