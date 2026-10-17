# 08 — Help and news

How Quademia speaks to students and students speak back: announcements
(the broadcast), messages (the support desk), the portal guide, the NMC
procedures, the WhatsApp and Telegram channels, and Premium Prep's
members-only channel.

Detail and history: `archive/product-plan/05-announcements.md` (A1–A4),
`archive/product-plan/07-messaging.md`, and `archive/product-plan/rebuild.md`
§8.

## How it works

### Announcements

- A notice an admin writes — exam dates, platform news, course news,
  alerts, offers. It shows in three places: the **dashboard strip** (the
  newest unread, two at most, pinned first, View all and the unread
  count); the **Announcements page** (tabs, cards, Mark as read,
  Dismiss); and a **course page's own section** when it is scoped to
  that course.
- **Targeting**: eight optional scopes — audience, programme, course,
  level, subscription kind (paid / trial / free), package, cohort, named
  students. A student must match every scope that is set.
- **A course's announcements reach every student who has held the
  course** — live or ended, revoked grants apart; "subscribers only" is
  the course plus Paid (Sam, 2026-10-04; no storage change). *(to build)*
- **The scoping runs in the database** (Sam, 2026-09-18): one function
  returns only what the signed-in student should see, one read per
  page; the table itself is admin-only, and the named-students list
  never leaves the server. Draft, active, archived (no "scheduled");
  start and end dates bound when it shows; pinned first, then priority;
  archive is the way out, nothing deletes. *(to build: A1)*
- **Each notice remembers its own state** for each student — read,
  clicked, dismissed, each set once, never cleared; writes through the
  server only. The strip's ✕ dismisses and the count falls. Engagement
  figures for the admin are counts of these. *(to build: A2)*
- The body is written in a toolbar editor, links through the shared
  link dialog. Stored once, as text, and drawn on the server (ending
  the extra line break per edit). *(to build: A3, later)* A real picker
  for linking a quiz. *(to build: A4)*
- **No Bulk Send**: announcements are the broadcast, with the same
  targeting; New Thread reaches one student (Sam, 2026-09-18).

### Messages — the support desk *(built 2026-10-17: 08.2)*

Ruled by Sam, 2026-09-18; the labels, the pop-up and the rest of step 2
2026-10-17.

- **A support tool, not a chat**: threads between one student and
  Quademia, each with **one of five labels** in place of "general or a
  course" (Sam, 2026-10-17: B) — *Payment or package · My account ·
  Something isn't working · A course* (and which) *· Something else*. A
  thread reuses the open one of its label (a course's, that course's).
  **No subject line**: a thread reads as its label or its course; lists
  show the start of its last message.
- **"Message us" can sit on any page and opens a pop-up box there**,
  the label already picked by the place — a course page: that course;
  Packages and the end of a package: Payment or package; Profile and the
  too-many-devices notice: My account; an error screen: Something isn't
  working; the sitting's "I don't understand the answer": the course,
  the question quoted. A text box, Send, then a toast — "Sent. We'll
  reply in Messages" — and the student stays where they were (one
  request, on weak data). From Messages itself, or the help page, the
  student picks the label first. **Replies are read in Messages**, with
  the thread's whole history. *(the links on other pages: 08.4, as each
  page is touched)*
- **The student's Messages page** (Sam, 2026-10-17: drawn as B): the
  labels are the list — Payment or package, My account, Something isn't
  working, Something else — then "Your courses", each course of the My
  courses list its own row, then "Earlier conversations". A row shows its
  newest conversation (Closed when closed, a dot when a reply is unread)
  or "Start a message ›"; a tap opens it, or an empty one, and nothing is
  made until Send. One request to open, one to send. On a phone the list
  and the conversation take turns and the back button returns to the
  list; on a computer they sit side by side.
- Messages needs a signed-in student, so one who cannot sign in cannot
  reach it — the sign-in page gets its own way out (01.10).
- **Writes through the server only; a message is fixed once sent**;
  2,000 characters at most.
- A thread is open or closed; a reply to a closed thread reopens it
  with a visible line, "reopened by a reply".
- Read stamps on the thread drive one unread rule; **the unread badge
  counts open threads in one query**. Replies and closes reach an open
  page live.
- **The admin's Messages, by student** (Sam, 2026-10-17, in place of the
  inbox of every conversation): a list of the students who have written —
  those **waiting for a reply** (an open conversation whose last message
  is theirs) first, the longest waiting at the top, timed from their
  first unanswered message (writing again does not move them down) —
  each with what waits and the start of it; twenty a page. Filters: a
  search that reaches **every** student (to write to one who never wrote), "Waiting for a
  reply / All", and the label. A tap opens **that student's Messages as
  they see them** — the same view — with one line about them (programme
  and school, the live package and its days, the last paid payment, how
  many are unfinished), the waiting conversation open at once, Close and
  Reopen, and **Next waiting ›** to the next student. "Start a message"
  under any label writes to the student; New Thread and the old filters
  went. Parked: a programme filter, a course filter, an "Answered" view,
  "Payment not finished", the package state (Sam, 2026-10-17: the list
  is fine as it is).
- A student's send is a door of the app's limiter (10.8); **no limit of
  its own until then** (Sam, 2026-10-17) — only a signed-in student
  sends, through the server, 2,000 characters at most.
- The unread count shows on the top bar's envelope on a computer; on a
  phone on the drawer's Messages row, with a teal dot on the hamburger.
  Quademia's side of a thread shows the logo.
- Feedback on a question leaves messaging for **question reports** (06),
  planned with this and built with it (Sam, 2026-10-17): "Report an
  issue" is built (06.2); **the old question threads are deleted** with
  their messages when the question type goes (Sam, 2026-10-17 — dev's
  three are sample data; any on prod go too).
- **The build, in order** (2026-10-17): question reports end to end
  (done, 06.2); Messages through the server on both sides — the storage,
  the labels, the pop-up box, Bulk Send and the question threads gone
  (done 2026-10-17); the student page redesigned, drawn first (done
  2026-10-17, below); the admin's Messages by student (done 2026-10-17,
  in place of "the inbox paged, on today's look").
- **Telling each side of a new message** *(Sam, 2026-10-17)*. The live
  chat stays as built — an open conversation updates by itself — but
  most replies come later, with nobody in the chat, so each side is told
  when it is not there:
  - **In the app: the badge keeps itself fresh** *(built 2026-10-17:
    08.5a)* — on the live chat's own kind of line (Sam, in place of a
    recount on every page change): while the app is on the screen it
    listens to the student's own conversations (every conversation for
    an admin), and a reply, a read — on any of their devices — or a close
    changes the number at once. The line is cut when the screen locks or
    the student switches app, and what changed meanwhile never arrives,
    so the number is also asked again when the app comes back to the
    screen and when the line reconnects. The count stays the database's
    one. What it costs: one open line per open app — Supabase counts the
    busiest moment of the month across the shared project (Free 200,
    Pro 500 included, then $10 per 1,000); its messages are a handful per
    conversation change. Supabase's lighter **Broadcast** (a mailbox per
    student, the permission checked once) is parked: it needs a rule on
    a table outside our schema and pays only at thousands of students at
    once (08.6).
  - **The app closed: phone notifications, both sides** *(to build:
    08.5b)* — the student
    when Quademia replies ("Quademia · Payment or package" and the
    reply's first line; a tap opens the conversation), Quademia's
    devices when a student writes. Free per message (Google, Apple and
    Mozilla deliver them). The pieces: a key pair per environment, the
    private one a Cloudflare secret Sam adds; a table of the devices
    that allowed it, a dead one removed when its service says so;
    `public/sw.js` gains the notification and the tap, and is
    registered on the admin's pages too; sent after the reply returns,
    so Send does not wait, by a library that runs on Cloudflare (the
    common one is written for Node). **The devices table ticked
    2026-10-17** (`notification_devices`, 12): built general — each
    device carries the kinds it is sent, so announcements and the rest
    can follow, each Sam's call (few and important: the browser's Allow
    covers the whole app, and a Block loses replies too); a sign-out or
    a bump deletes a device, a week running out does not.
  - **The ask**: after a student's send, "Notify me when Quademia
    replies" — a browser asks only after a tap, and a Block cannot be
    asked again. Reach: Android's Chrome after Allow, even closed or
    not installed; an iPhone only once the app is on the Home Screen
    (iOS 16.4 or later); a computer while the browser is open. Tested on
    Sam's phone against licensure-dev — the helper runs on a deployed
    build only, and the pane shows no notifications.
  - **Email only as a fallback, later**: for a student with no device
    allowed, so a reply reaches them once and never by both (Sam: an
    email saying "you have a message, sign in" repeats the badge); a
    switch in the admin's settings. Parked: SMS (once Arkesel is in,
    03), WhatsApp (Meta's approval, a charge per message).
  - To settle before 08.5b is built, drawn first: the rules and where
    the ask appears.

### Help pages and groups

- **Portal guide** — how to use the app: a side list and a FAQ.
- **NMC procedures** — a programme card, a viewer and the NMC's manual
  list. The manual links move from the page into a table the admin
  manages. *(to build)*
- **WhatsApp and Telegram channels** — links out.
- **The premium channel — Premium Prep's private Telegram channel**, one
  per programme, open all year, never a batch (Sam, 2026-10-04: "yes we
  need the groups"; 02). The platform carries the questions, tests,
  explanations and news; the channel is the human layer: Sam posts —
  revision, voice notes, reminders that point into the app — and
  members read. Sam runs it until he finds people. Saving and
  forwarding are restricted (Telegram's setting). *(to build: 17)*
- **Members only, through the bot**: the student links their Telegram
  account to their Quademia account with a one-time code (the Sheets
  era's Connect page); the channel takes join requests only, and the bot
  approves one only from a linked account with live Premium Prep, so a
  forwarded link admits nobody. Each day the bot removes members whose
  Premium Prep has ended, with a message to renew, and lets them back
  in when they do. *(to build: 17)*

## Storage

Written on the tables in `12-tables.md`, all ticked 2026-09-18:

- `messages_threads` and `messages` — the support desk (08.2).
- `announcements` — read through one function, admin-only, the level
  scope a list (A1).
- `user_notice_state` — read, clicked, dismissed (A2).

## Open

- The Sheets era's bot script (`Telegram_By_Worker-DEV`, not in this
  repo) — Sam to find it; read before 17 is planned.
- The Telegram group's keys list (free text holding junk) is under 10.
- The portal guide's Learning History card promises "identify topics you
  repeatedly miss" and "monitor improvement over time": since 05.5
  (2026-10-17) that is each sitting's report and, later, the course
  page's topics (05.6) — Sam's words, with the help page's redesign.
