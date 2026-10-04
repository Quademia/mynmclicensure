# 00 — The map

The whole app on one page: who uses it, how they get in, every page in
one line, the menu, the order things are built in, and how it is built
underneath. It holds no rules — each feature's rules live in its own
file (01–10), and what a page shows in each state lives in `11-pages.md`.

Written fresh on 2026-10-04 (Sam), when the old plan docs, the old build
list and the old app moved to `archive/`. Those are kept to look things
up; nothing here is described against them.

## The files

| File | Holds |
|---|---|
| 00 The map | This page |
| [01 Accounts and sign-in](01-accounts-and-sign-in.md) | Registering, signing in, devices, passwords, the admin's security pages |
| [02 Packages and payments](02-packages-and-payments.md) | Programmes, packages, checkout, Paystack, course access, expiry |
| [03 Free account and trial](03-free-account-and-trial.md) | The free question set, the 14-day trial, what happens after it |
| [04 Practice](04-practice.md) | Practice papers, mock exams, the quiz builder, the sitting, the report, the daily challenge |
| [05 Progress](05-progress.md) | Learning history, the streak, questions mastered, the leaderboard, badges |
| [06 Question bank](06-question-bank.md) | The questions, the importer, the admin's bank page, question reports |
| [07 Offline packs](07-offline-packs.md) | Packs to study without data |
| [08 Help and news](08-help-and-news.md) | Announcements, messages, the portal guide, NMC procedures, channels |
| [09 Design system](09-design-system.md) | The look and the shared pieces every page uses |
| [10 Launch and platform](10-launch-and-platform.md) | Going live, security, emails, speed, settings |
| [11 Pages](11-pages.md) | Per page: what it shows to a free, trial, paid and ended student |
| [12 Tables](12-tables.md) | Every table: each column, who can read or change it, and every decided change with Sam's tick |

Each feature file has three parts: **how it works** (the feature as it
will be — built and decided together, the unbuilt parts marked *to
build* with their id), **storage** (a short pointer to the tables its
decisions change) and **open** (what is still Sam's to rule, one line
each). A change to the database is written on its table and column in
`12-tables.md`, with Sam's tick and its date — none is built without
one. The status of every piece — queued or built — is one line in
[`BUILD_LIST.md`](../../BUILD_LIST.md), one section per file. A decision
is written once, in its file; its status once, in the build list.

## Who uses it

- **Students** — nursing students in Ghana preparing for the NMC
  licensure exam, most on phones and weak mobile data. Seven
  programmes: RN, RM, RMHN, RPHN, RCN, NAC, NAP — each opened to the
  public when its question bank is ready (02).
- **Admins** — the Quademia team: content, packages, students, support.
- **Visitors** — not signed in: the home page, the packages, checkout.

## The ways in

```
                 Home page — "start your 14-day trial,
                 then free practice, forever"
                 ┌────────────────┴──────────────────┐
           Register = 14-day trial              Buy a package
           one per phone                        account made on paying
                 └────────────────┬──────────────────┘
                      Student app — trial or paid
                                  │
       ↓ when a trial or package ends: the free account, the floor —
         the account kept, free practice forever, the rest locked, not gone
```

Two ways in, one floor (Sam, 2026-10-04): registering starts the trial,
buying a package makes the account; the free account is not a door but
where every student lands when a trial or package ends (01, 03). Free
Full Access stays the admin's grant (02).

## The pages

### Student — grouped as the menu

| Group | Page | What it is for |
|---|---|---|
| Dashboard | Dashboard | Where sign-in lands, for every status; its top card is this student's next step — today's challenge, days left, carry on, the recap (11) |
| Practise | My courses | One course: its papers, days left, its news |
| | Practice papers | The set papers of each course (today "Fixed quizzes") |
| | Mock exams | Timed papers in exam conditions |
| | Quiz builder | A quiz built from chosen topics |
| | Daily challenge — *new* | Five questions a day, one course in turn; opened from the dashboard's top card, no menu item (04 G2) |
| | The sitting | Answering questions, in four modes |
| | Report | One sitting's debrief: what to fix next |
| Progress | Learning history | Every past sitting: resume, review, retake |
| | Streak and questions mastered — *new* | A card on the dashboard, not a page (05 G1a) |
| | Leaderboard — *new* | My school, my programme, schools; a "your rank" line on the challenge card opens it (05 G1b) |
| | Badges — *later* | Milestones, once there are real numbers (05 G3) |
| | Progress across sittings — *later* | Topic accuracy over time — not ruled (05 Q12) |
| Study offline | My packs | The packs the student has made |
| | Build a pack | Questions picked to study without data |
| | The pack | The pack itself, to save or print |
| Help and news | Announcements | Notices from Quademia |
| | Messages | Chat with the support team |
| | Portal guide | How to use the app |
| | NMC procedures | The NMC's procedure manuals |
| | WhatsApp and Telegram channels | Links out |
| | Premium channel — *later* | Premium Prep's Telegram channel, one per programme, joined through the bot (08) |
| Account | Profile | Details and photo; the username and animal for the boards (*new*, 05) |
| | Packages | Buy or extend a package (today "Upgrade") |

In the sitting: **Report this question** — *new*, in place of Send
feedback (06).

### Visitor

| Page | What it is for |
|---|---|
| Home page | Free practice questions, forever; the trial and the packages as the way to the full bank (03 F3) |
| Premium Prep | The premium packages |
| Packages | Every package for sale, chosen by programme |
| Checkout | One package: four fields, then Paystack |
| Payment confirmation | The receipt, and the way into the new account |
| Sign in · Register · Forgot / reset password | The account doors (01) |

### Admin

| Page | What it is for |
|---|---|
| Dashboard | The numbers at a glance |
| Users | Every account; a drawer per person: details, grant, reset, deactivate |
| Subscriptions | Who holds what: grant, update, revoke |
| Payments | Every Paystack payment; rescue a stuck one; revenue |
| Packages | What is for sale: courses, price, days, the trial's limits |
| Courses | The courses of each programme; Open to the public, one tick per programme (*new*, 02 C5a, the tick 02.9) |
| Announcements | Notices, targeted |
| Practice papers | The set papers; the one open in the trial (03 F4) |
| Mock exams | The timed papers |
| Attempts | How students are doing, across sittings |
| Question bank | Every question: editor, importer, subjects and topics |
| Question reports — *new* | Students' reports, grouped by question (06) |
| Messages | The support inbox |
| Security — *new* | Sessions, login events, reset requests (01) |
| Emails — *new* | Every email sent, with Retry (10) |
| Config | Settings |

## The menu

**Confirmed by Sam, 2026-10-04.** The student menu in the groups above:
Dashboard, Practise, Progress, Study offline, Help and news; Account
under the avatar in the top bar. In the sidebar (and the phone's
drawer, the same menu) each group is a small heading with every row
visible beneath — not groups that open and close — named as the phone's
tabs: Practice papers, Mock exams, Quiz builder; My packs, Build a pack
(Sam: A; built 2026-10-04, 09.7).

- **One menu for every status** (Sam: A) — free, trial, paid and ended
  see the same items. A locked item carries a small lock and, tapped,
  says what opens it; upgrading removes the locks and moves nothing.
- **Sign-in lands on the dashboard for everyone**; its top card changes
  with the student's status (11).
- The daily challenge has no menu item — its card is on the dashboard.
  The leaderboard is one item under Progress and a line on that card.
- Why: one place to learn, as Duolingo, Spotify and Quizlet do; a menu
  or a landing that changes with status moves things when the student
  upgrades and hides what they could unlock ("locked, not gone", 03).
- **On a phone, a bar at the bottom** (Sam, 2026-10-04): four tabs that
  never change — Dashboard, Practise, Progress, Offline. A group's other
  pages sit in a row of tabs at the top of its pages (Practise: Papers ·
  Mocks · Builder; Progress: History · Leaderboard; Offline: My packs ·
  Build); each tab opens on the first, not remembered. The ☰ menu stays
  the full list; a computer keeps the sidebar. A bar that swaps to the
  group's items was drawn and declined: two taps between groups (09).

## The build order

**Proposed, 2026-10-04 — Sam to confirm.** Each session takes the next
item; a new idea is parked in one line in its file, not worked through.

1. **Behind the scenes — no page design needed.**
   - ~~The trial's limits in the database (03 F4a)~~ — done 2026-10-04.
   - ~~The free set's two doors (03 F1)~~ — done 2026-10-04.
   - ~~An ended subscription stops counting as live everywhere (02.1)~~ — done 2026-10-04.
   - ~~Programmes open to the public, NAC, NAP and RCN added closed (02 C5a)~~ — done 2026-10-04; NACNAP's switch-over (C5b) on the day NAC and NAP open.
2. **The student pages, redesigned — the inside first, the shop window
   last** (Sam, 2026-10-04: the home page is built on what exists). The
   dashboard, with its four top cards and the streak card (05 G1a) — it
   sets the look; the free account's floor comes with it (03 F2) →
   practice (course, papers, mocks, builder, the sitting, the report) →
   history → offline packs → help and news → profile and packages →
   last, the visitor pages together: the home page (03 F3), the shop,
   Premium Prep, checkout and confirmation. Each page built with its
   four states (11).
3. **The new features on the new pages.** The daily challenge (04 G2)
   → the leaderboard (05 G1b) → badges (05 G3).
4. **The admin pages, redesigned**, with the new ones (security,
   emails, question reports).
5. **Going live** (10) — the last step, not a wall: security headers,
   live keys, the email plan, the content copy, the domain.

## How it's built

The technical side, settled and working; the rules for working on it
are in `AGENTS.md`.

- **The app** — one Next.js app (TypeScript, React) that builds every
  page on the server; the phone receives finished pages and never talks
  to the database itself.
- **Where it runs** — Cloudflare Workers, on Quademia's one Cloudflare
  account: `licensure-dev` for testing, `licensure-prod` for students
  (on its workers.dev address until going live, then
  `licensure.quademia.com`).
- **The database** — Supabase (Postgres, sign-in, file storage), on the
  dev / prod project pair shared with the old site and MyTeacher.
  Everything this product owns lives in one schema, `licensure_gh`;
  file buckets carry a `licensure-gh-` prefix. A project per product is
  paid compute not yet earned; a schema is the cheapest real separation,
  and copying that one schema out is the move the day it gets its own.
  The sign-in table belongs to the project and is shared. Every table
  is described in [`12-tables.md`](12-tables.md).
- **The database is the gate** — the browser never writes to a product
  table. Every write goes through the server, behind a check that the
  caller is a signed-in student or admin, with a key only the server
  holds. Row rules let a student read only their own rows and the
  courses they hold; each table grants the browser only what it needs.
- **The seal on answers** — a question's answer never reaches the
  browser before the student answers: a sitting copies its questions
  when it starts, grading runs inside the database, Check Answer
  unseals one question at a time, and an exam's clock and Sequential's
  order are held by the database.
- **Payments** — Paystack, called from the server; the price from the
  package, the amount and currency checked on the reply; the buyer's
  browser and Paystack's signed webhook both report a payment, and the
  database allows one receipt per payment.
- **Emails** — sent by the app itself through Resend, from the action
  that causes them, every link from the sending site's address. The
  sign-in emails are still Supabase's own (10).
- **Two branches** — `main` is the tested app: a push deploys
  `licensure-dev` and migrates the dev database. `production` is the
  released app, merged from `main` on Sam's yes: a push migrates prod
  and deploys `licensure-prod` (two separate jobs today — 10).
- **Migrations** — numbered files in `db/migrations/`, applied by the
  repo's own runner and recorded in `licensure_gh.migrations`, proven
  in a rolled-back run first.
- **Going live** changes the address, the keys and the content, not the
  code or the database's shape; no student data from the old site moves.
