# 08 — Help and news

How Quademia speaks to students and students speak back: announcements
(the broadcast), messages (the support desk), the portal guide, the NMC
procedures, the WhatsApp and Telegram channels, and the members-only
Telegram group.

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

### Messages — the support desk *(to build: 08.2)*

Ruled by Sam, 2026-09-18.

- **A support tool, not a chat**: threads between one student and
  Quademia, either **general** or about a **course**. The course page's
  "Message us" opens a draft tagged with the course. A general or
  course thread reuses the open one.
- **Writes through the server only; a message is fixed once sent**;
  2,000 characters at most.
- A thread is open or closed; a reply to a closed thread reopens it
  with a visible line, "reopened by a reply".
- Read stamps on the thread drive one unread rule; **the unread badge
  counts open threads in one query**. Replies and closes reach an open
  page live.
- **The admin inbox**: one feed (name, context, last message), filters
  by unread and context, search by name or email, reply, close and
  reopen, New Thread to one student; **paged**.
- A student's send is a door of the app's limiter (10).
- The unread count shows on the top bar's envelope on a computer; on a
  phone on the drawer's Messages row, with a teal dot on the hamburger.
  Quademia's side of a thread shows the logo.
- Feedback on a question leaves messaging for **question reports** (06).

### Help pages and groups

- **Portal guide** — how to use the app: a side list and a FAQ.
- **NMC procedures** — a programme card, a viewer and the NMC's manual
  list. The manual links move from the page into a table the admin
  manages. *(to build)*
- **WhatsApp and Telegram channels** — links out.
- **The Telegram group — Premium Prep's private study group** (Sam,
  2026-10-04: "yes we need the groups"). The platform carries the
  questions, tests, explanations and news; the group is the human layer
  it does not replace — a tutor's revision, quick answers, the batch
  sitting the same exam. Worth it only while someone runs it. Members
  only: a Connect page, link codes, a bot on the database, the allowlist
  drawn from the premium packages. *(to build: 17)*

## Storage

Written on the tables in `12-tables.md`, all ticked 2026-09-18:

- `messages_threads` and `messages` — the support desk (08.2).
- `announcements` — read through one function, admin-only, the level
  scope a list (A1).
- `user_notice_state` — read, clicked, dismissed (A2).

## Open

- Who runs the premium groups — a tutor posting and answering most days
  (needed before 17 is worth building).
- The Telegram group's keys list (free text holding junk) is under 10.
