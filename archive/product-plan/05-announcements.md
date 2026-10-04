# Announcements

The living plan for this feature (Sam, 2026-09-19: the feature docs
`00–07` hold what a feature does today, what the diagnosis found,
Sam's rulings, and the sliced plan). Written for the port as a
description of the legacy product on 2026-09-12 — and it described
alpha's course scope, which gamma had lost and slice 11 restored;
rewritten into this shape on 2026-09-19 by Claude. Git holds the
earlier text.

Sources: `post-rebuild-diagnosis.md` (D46, D47, D48 and the trace of
the four tables), `rebuild.md` §8 S12 (the floor and the notice
state) and S13 (`scope_level` as an array). Slice ids here (`A1`,
`A2`, …) are the ids `BUILD_LIST.md` uses under this doc's section.

---

## 1. What it does today

### What an announcement is

A notice an admin writes for students: exam-date reminders, platform
news, course news, alerts, offers. It shows on the student dashboard
(a strip of the newest unread, two at most, pinned first, with "View
all" and the unread count), on the Announcements page (tabs, cards,
Mark as Read, Dismiss), and on a course page when scoped to that
course.

### Targeting

Eight scope fields, every one optional, **AND** between them — a
student must match all that are set: audience (ALL | STUDENTS),
programme, course, level, subscription kind (PAID | TRIAL | FREE),
product, cohort, named users. Course scope matches a student whose
course access covers any listed course (restored by the port, §9
#19). The rules run on the server, in `lib/announcements/scoping.ts`,
over rows the page has already read.

### Lifecycle and schedule

`status` is draft | active | archived (the port dropped gamma's
`scheduled`, which never reached a student — §9 #18). `start_at` and
`end_at` bound when an active one shows. Pinned ones sort first, then
`priority`. Archive is the way out; no page deletes.

### The student's state

One `user_notice_state` row per (student, announcement) holding a
single word — read | clicked | dismissed — overwritten on every
write. The admin page counts these words per announcement as its
engagement figures.

### The body

Typed in a small toolbar editor; stored twice, as HTML and as text;
sanitised in the browser and rendered from the HTML.

---

## 2. What the diagnosis found

- **D46 — every signed-in account reads every announcement, scope
  fields included.** The SELECT policy is "any signed-in user"; the
  scoping is TypeScript over an unscoped read. Proven on dev: a
  student reads the archived one and the one scoped to another
  programme. The dashboard and the Announcements page hand the browser
  the rows whole, so `scope_user_ids` carries other students' ids into
  every qualifying browser. The course page is the exception: it
  renders on the server. Reaches students (other students' ids, the
  targeting of every notice) and the admin (drafts readable before
  publishing).
- **D47 — the notice state is one overwritten word, so the counts are
  wrong.** Read then dismiss leaves one `dismissed` row: the read is
  erased. `seen_at` records the last touch, not the first. The strip's
  ✕ writes `read`, not `dismissed`. `item_id` has no key to
  `announcements`; `state` has no CHECK (proven: any words accepted).
  The strip's count does not fall on ✕. Reaches the admin (untrusted
  engagement figures) and students (a lagging count).
- **D48 — residue.** No keys on the scope arrays; `scope_level` is a
  comma-joined string where its siblings are arrays; the hottest read
  has only a `status` index; the body stored twice and the editor
  adding a `<br>` per save (a BUILD_LIST line already); the sanitiser
  browser-only; `getAnnouncementById` unused; a DELETE policy for a
  Delete no page offers.

---

## 3. Rulings (Sam, 2026-09-18)

- **S12, the floor:** one SECURITY DEFINER function,
  `announcements_for_me()`, applies the eight checks in SQL from the
  caller's profile and access and returns only the rendered columns;
  the three student pages call it, one query each;
  `announcements_select` becomes ADMIN-only; `scope_user_ids` never
  leaves the server; CHECKs on the status words.
- **S12, the notice state:** `read_at`, `clicked_at`, `dismissed_at`
  replace `state`, `seen_at`, `updated_at` — each set once, never
  cleared; every count a count of non-nulls; `item_id` keyed to
  `announcements`; the strip's ✕ dismisses; the write through the
  server with the row's identity the server's.
- **S13 (a rider):** `scope_level` becomes `text[]` like its siblings.
- Bulk Send in messaging is parked because **announcements are the
  broadcast** with the same targeting (Sam, 2026-09-18).

---

## 4. The plan

### A1 — The floor (S12, S13's rider, D46, D48)

**Storage, one migration.**

- `announcements_for_me(p_course_id text default null)` — SECURITY
  DEFINER, `search_path` pinned. From `auth.uid()` it reads the
  caller's profile (`program_id`, `level`, `cohort`, `role`), their
  subscription kind and active product (the most recently expiring
  ACTIVE subscription, FREE and none when there is none), and their
  course access (`user_has_course`). It returns the active, in-window
  rows that pass all eight checks, pinned first then priority, as
  `announcement_id, title, body_html, body_text, pinned, dismissible,
  priority, created_at, start_at, end_at` — no scope field. With
  `p_course_id` it returns only those scoped to that course (the
  course page's section). EXECUTE revoked from `anon`; `authenticated`
  keeps it, since the student calls it as themselves.
- `announcements_select` becomes `auth_user_role() = 'ADMIN'`. The
  DELETE policy goes (no page deletes).
- `scope_level` → `text[]` (S13's rider), the existing comma-joined
  values split in the migration.
- CHECKs: `status in ('draft','active','archived')`,
  `scope_audience in ('ALL','STUDENTS')`,
  `scope_subscription_kind in ('PAID','TRIAL','FREE')` or null.
- An index for the hot read: `(status, start_at, end_at)`.

**Code.** `getAnnouncementsForStudent` becomes one `rpc('announcements_for_me')`
call; `getActiveAnnouncements`, `getStudentScope` and the TypeScript
scoping go (the rules live in SQL now; `computeDisplayStatus` stays for
the admin page). The `Announcement` type splits: the admin row with
scopes, the student row without. The admin form saves `scope_level` as
an array. The two client components receive the student row only.

**Done when** (SQL as a dev student, rolled back, then the browser): a
direct read of `announcements` as a student returns zero rows;
`announcements_for_me()` returns exactly what the page showed before
for that student, with no scope column; the dashboard strip, the
Announcements page and a course page's section show the same notices
as before; an admin still sees drafts and archived rows on the admin
page; a level-scoped announcement still reaches the right level.

### A2 — The notice state (S12, D47)

**Storage, one migration.**

- `user_notice_state` gains `read_at`, `clicked_at`, `dismissed_at`
  (timestamptz, nullable); the existing rows carried over
  (`state = 'read'` → `read_at = seen_at`, and so on); then `state`,
  `seen_at`, `updated_at` dropped. `item_id` → `announcements
  (announcement_id)`; `item_type` keeps its default with a CHECK on
  the one word.
- The browser roles' INSERT and UPDATE on the table are revoked and
  the two policies dropped; SELECT stays own-row-or-admin. The write
  is the server's, with the service role behind `requireStudent()`.

**Code.** `recordNoticeState(id, 'read' | 'clicked' | 'dismissed')`
sets the matching column only if it is null (`coalesce`), through the
service role, the user id the server's. The strip's ✕ records
`dismissed`. The student map: read when `read_at` or `clicked_at` is
set, dismissed when `dismissed_at` is set — a notice can be both. The
engagement counts are three `count(column)`s. The strip's unread
count falls on ✕.

**Done when:** Mark as Read then Dismiss on one announcement shows
read 1 / dismissed 1 on the admin page; the strip's count drops when
✕ is pressed and the notice does not return on reload; a direct
insert into `user_notice_state` as a student is refused.

### A3 — Residue (D48), later

- The body stored once as text, rendered on the server; the editor
  reloads the text, which ends the `<br>` per edit (the BUILD_LIST
  line from slice 11a).
- Keys for the scope arrays — a scope table, or keys where the target
  is one table — one at a time under Sam's storage-hygiene rule.
- `getAnnouncementById` removed.

---

## 5. Ladder

| Slice | Date |
|---|---|
| A1 The floor | ⬜ |
| A2 The notice state | ⬜ |
| A3 Residue | ⬜ later |
