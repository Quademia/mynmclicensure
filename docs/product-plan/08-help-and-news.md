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

- A notice an admin writes — exam dates, new questions, offers, alerts,
  news — **for signed-in students only** (Sam, 2026-10-18); visitors get
  the site strip of the public pages instead (02.11).
- **Targeting**: eight optional scopes — audience, programme, course,
  level, subscription kind (paid / trial / free), package, cohort, named
  students. A student must match every scope that is set.
- **A course's announcements reach every student who has held the
  course** — live or ended, revoked grants apart; "subscribers only" is
  the course plus Paid (Sam, 2026-10-04; no storage change). *(built
  2026-10-18: 08.1)*
- **The scoping runs in the database** (Sam, 2026-09-18): one function
  returns only what the signed-in student should see, with the student's
  own marks, one read per page; the table itself is closed to the
  browser, and the named-students list never leaves the server. Draft,
  active, archived (no "scheduled"); start and end dates bound when it
  shows; pinned first, then priority, then newest; archive is the way
  out, nothing deletes. *(built 2026-10-18: A1)*
- **Each notice remembers its own marks** for each student — seen,
  tapped, dismissed, each set once, never cleared; writes through the
  server only; ✕ dismisses. *(built 2026-10-18: A2)* **Seen sets
  itself** when a notice shows in full — opened on the page, the newest on
  a computer, a course page's news, and the must-see pop-up when it is
  built — with no Mark as read button; one small message after the page
  has shown, only when something is new. A tap on a notice's button
  counts wherever it shows (the page, the dashboard, a course page). Each
  mark brings back the new number for the bell and the menu row. *(built
  2026-10-18: 08.7)*
- **No Bulk Send**: announcements are the broadcast, with the same
  targeting; New Thread reaches one student (Sam, 2026-09-18).

**Redesigned (Sam, 2026-10-18; drawn in the chat).** *(08.7–08.13 built
2026-10-18; to build: 08.14, 08.15, A4)*

- **The page, like Messages**: the list, and a tap opens the notice —
  beside the list on a computer, the newest opening by itself; in its
  place on a phone, "‹ Announcements" going back. Every notice has its
  own address, so a link or a device notice opens it. **One list, no
  tabs**: something new in Messages' blue (the dot, bold, a New badge);
  Mark all as read; the dismissed ones at the foot. *(built: 08.7)*
- **The list is the hybrid**: the pinned notice a big card with its
  picture; the rest rows — the dot, a square (the picture's middle, or
  the kind's icon), the title, the first line, the time. **Opened**: the
  picture across the top, kind · date, the title, the words, the button,
  **Ask about this** (the Message us box on Something else, the notice
  named in the draft), Dismiss when allowed. *(built: 08.7; the pictures
  with 08.10, the kinds' own icons with 08.13)*
- **Kinds are the admin's own list** (Sam: "the examples given may not
  be enough"): a name and an icon picked from a grid of the app's icons;
  added, renamed, re-iconed, ordered, retired (never deleted while in
  use). It starts with Exam date · New questions · Offer · Alert · News;
  News when none is picked. *(built 2026-10-18: 08.13 — the Kinds panel
  beside "+ New Announcement" and the editor's Kind; the grid is 25
  icons, the app's 12 and 13 added from Lucide on Sam's yes; a retired
  kind is kept by its notices and offered to no new one; at least one
  kind stays offered.)*
- **One picture per notice, uploaded** — never a pasted link (Sam: the
  app would copy it in anyway, doing the job twice); wide (2:1, about
  1200 × 600), the upload box saying so; made at upload into two small
  sizes (about 10 KB for the list, 100 KB for the opened notice, loaded
  only when opened); the words first, the picture after. A video is a
  button to YouTube. *(built 2026-10-18: 08.10 — in today's admin form,
  moving with 08.14: the admin's browser cuts the 2:1 middle at up to
  1200 × 600 and the list's middle square, WebP, else JPEG; each picture
  its own folder, kept a year in a phone's cache; Replace and Remove
  delete the old files.)*
- **The ways in**: on a computer the bell with the number of new
  notices; on a phone the menu's Announcements row with its number and
  the menu button's dot (the phone's top bar keeps no bell, 2026-09-26);
  the dashboard; a course page's news. The number is the database's, read
  with the Messages count when a page is first drawn, set again by each
  mark, and asked again when the app comes back to the screen. *(built:
  08.9)*
- **The dashboard (C)**: a "New from Quademia" card near the top, only
  while something is new — up to two, a tap opens, ✕ dismisses —
  replacing the box at the foot. A notice ticked **Must-see** also pops
  up once, at the student's next dashboard, one at a time, on the
  shared dialog with its picture. *(built 2026-10-18: 08.8 — the card
  links into the page on each notice and does not mark Seen; the pop-up
  marks Seen as it shows; the Must-see switch in the admin form's
  Settings; the shared dialog gained a picture slot and opens itself when
  it starts open.)*
- **The admin's editor**: no codes — what is typed is what students see
  (the tool chosen with Sam at its build; the body stored once, which
  ends the extra line break per save); the picture, the kind, Must-see,
  **Also send to devices** (08.5b's notices, once, when it goes live); a
  button pointing inside the app picked from a list; **"This will reach
  N students today"** as the scopes are set. *(08.14, 08.15, A4, 08.12)*
- **The follow-up**: Reaches today · Seen · Tapped · Dismissed, each
  out of who it reaches, and the names behind each number, Not seen yet
  among them (with the last sign-in once 01.6 is built, until then the
  last sitting). *(built 2026-10-18: 08.11 — a row's Follow-up opens it;
  the row shows Seen out of the reach; 08.12's reach line in the
  editor's Targeting. The reach, the line and the student's reader share
  one rule in the database.)*
- **Parked**: a reminder to those who have not seen it; which button
  was tapped when a notice has two; a bell panel on a computer; a
  public NMC news page (with 08.3).
- **Order**: A1, A2 and 08.1 with the storage below in one migration →
  the student side (08.7, 08.9, 08.10, 08.13) → the dashboard (08.8) →
  the admin side (08.11, 08.12, 08.14, A4) → devices (08.15).

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
- **A new reply is marked so it cannot be missed** (Sam, 2026-10-18,
  drawn: A; the dot alone was easy to miss): told in one colour, blue —
  the dot, the preview bold and blue, saying who wrote ("Quademia: …";
  "You: …" for the student's own), and a blue **New reply** badge under
  the time, which stays grey; the list keeps its order. Teal on the page
  means only the open conversation and "Start a message". The admin's view of a student says **New message**. A "New
  replies" card above the list was built and taken out the same night
  (Sam: it did not make sense).
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
  - **The app closed: phone notifications, both sides** *(built
    2026-10-17: 08.5b)* — the student when Quademia replies, Quademia's devices when
    a student writes; a tap opens the conversation. **What it says**
    (Sam, 2026-10-17, drawn: wording a): the title and line are ours,
    the label only — never the message's text, since phones are shared:
    "Quademia replied" / "Payment or package" for a student, "Ama Owusu
    wrote" / "Payment or package" for an admin. The phone's own line
    above names the app — "MyNMCLicensure" with the painted Q once it is
    on the Home Screen, the browser and address before. One buzz per
    conversation: a new reply replaces the earlier one. Free per message (Google, Apple and
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
  - **The ask** (Sam, 2026-10-17, drawn): a card under the student's
    message right after they send — "Get a notification when we reply ·
    On this device, even when the app is closed", **Not now** and **Turn
    on**; Turn on, then the browser's own Allow (two taps, once); the card
    then one grey line, "Notifications on for this device", and not shown
    on that device again. The words say **device**, never phone — a
    student may be on a phone, a tablet or a computer (Sam, 2026-10-18).
    **Not now** hides it on that device for 7 days, then it comes back
    after a send — there is no other switch for a student (the browser's
    or device's settings turn it off). A Block: once, "Notifications are
    blocked on this device. You can allow them in your browser or device
    settings." An iPhone not on the Home Screen: "Want a notification
    when we reply? On iPhone, add the app to your Home Screen first",
    **Show me how** opening the install steps (07.3). **The admin's
    switch**: "Notify this device when a student writes", at the top of
    the admin's Messages, per device (it is the device's row). A browser
    asks only after a tap, and a Block cannot be asked again. Reach:
    Android's Chrome after Allow, even closed or not installed; an iPhone
    only once the app is on the Home Screen (iOS 16.4 or later); a
    computer while the browser is open. Tested on Sam's computer against
    a production build first, then his phone against licensure-dev — the
    helper runs on a production build only, and the pane shows no
    notifications.
  - **Email only as a fallback, later**: for a student with no device
    allowed, so a reply reaches them once and never by both (Sam: an
    email saying "you have a message, sign in" repeats the badge); a
    switch in the admin's settings. Parked: SMS (once Arkesel is in,
    03; it needs no data, a charge per message),
    WhatsApp (Meta's approval, a charge per message). Weighed and set
    aside 2026-10-17: a hosted service (OneSignal — a heavy script on
    every page, its own service worker, a plan not ours), a Telegram bot
    (reaches only students who use Telegram and link it).

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
- `user_notice_state` — seen, tapped, dismissed (A2; named after the
  follow-up's words 2026-10-18).

Ticked by Sam 2026-10-18 for the redesign: `announcements` gains the
kind, the picture, Must-see and the devices send; the new table
`announcement_kinds`; the bucket `licensure-gh-announcement-images`.
Still to tick at their builds: the body stored once (08.14) and the
`announcement` kind on `notification_devices` (08.15).

## Open

- The Sheets era's bot script (`Telegram_By_Worker-DEV`, not in this
  repo) — Sam to find it; read before 17 is planned.
- The Telegram group's keys list (free text holding junk) is under 10.
- The portal guide's Learning History card promises "identify topics you
  repeatedly miss" and "monitor improvement over time": since 05.5
  (2026-10-17) that is each sitting's report and, later, the course
  page's topics (05.6) — Sam's words, with the help page's redesign.
- **Where else to offer notifications (08.5b)** — today a student is asked
  only right after sending a message, so one who never writes is never
  asked. Whether to offer it elsewhere too (the Messages page, Profile,
  the dashboard), and how, is Sam's to decide later (2026-10-18). Mind the
  rules already ruled: the browser asks only after a tap, a Block cannot
  be asked again, and Not now holds for 7 days.
- **Announcements on devices (08.15)** — whether a student's yes to
  replies also brings announcements, or announcements ask their own yes
  (with the item above); and whether a device notice shows the notice's
  title (a notice is not private, unlike a message) or only "News from
  Quademia".
