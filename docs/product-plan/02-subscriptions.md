# Subscriptions — products, receipts and course access

The living plan for this feature (Sam, 2026-09-19: the feature docs
`00–07` hold what a feature does today, what the diagnosis found,
Sam's rulings, and the sliced plan). Written for the port as a
description of the legacy product on 2026-09-12 (the trial paragraph
corrected 2026-09-13, the CANCELLED status removed); rewritten into
this shape on 2026-09-19 by Claude. Git holds the earlier text.

Sources it leans on: `post-rebuild-diagnosis.md` (D13–D21 the access
group, D2 / D19 / D23 the sales doors, *Proposed direction —
course-level access* with the worked example and the six rulings),
`rebuild.md` §8 row S8 (ticked 2026-09-18) and §7.1 (the payments
Worker retired into Server Actions), the 2026-09-17/18 session entry.
The slice ids here (`C1`, `C2`, …) are the ids `BUILD_LIST.md` uses
under this doc's section.

---

## 1. What it does today

### A product is a bag of courses

The unit of sale. A `products` row carries an id (`RN_FULL`,
`GP_ONLY`, `RN_TRIAL`, …), a name, a `kind` (PAID | TRIAL | FREE), a
status (active | archived), a price in minor units, a duration in
days, and **`courses_included` — a plain list of course-id words**
with no key to `courses`. A bag may cross programmes (an RM_MID +
RN_MED product is legitimate — Sam, 2026-09-18), so a product has no
programme of its own. The admin Products page ticks courses from the
course list, grouped by programme, and saves the words; a draft or
archived course stays in the bag on save (legacy-check gap 11).

**Kinds.** PAID is bought through Paystack or granted by an admin.
TRIAL is granted at registration: each programme's
`programs.trial_product_id` names its trial product, whose course
list equals the paid product's — a trial is limited by its length
(seven days), not its courses. FREE is granted directly. The column
is displayed in the admin user drawer and read nowhere else; the
three sales doors each decide "for sale" by their own rule (D2).

### A subscription is the receipt

One `subscriptions` row per purchase or grant: `SUB_…` id, the
student, the product, `start_utc`, `expires_utc`, a status (ACTIVE |
EXPIRED | REVOKED — never "TRIAL"; the kind is the product's), a
source (PAYSTACK | ADMIN | SELF_TRIAL_SIGNUP | PAYMENT), a source
reference (the Paystack reference, `admin_grant`, the user id), and
`expiry_reminded`, which no code reads (the reminder scan was never
rebuilt; BUILD_LIST carries it).

### Five writers, all on the server since the port

| path | what it writes |
|---|---|
| registration | the programme's trial product, from now for its duration, with the service role; a failure is logged and never stops the registration (`lib/subscriptions/trial.ts`) |
| Paystack activation | at verify, with the service role: a row already tied to this reference is reused (the replay guard); else the same product ACTIVE and unexpired is **extended** from its expiry; else a fresh row from now (`lib/payments/activate.ts`) |
| admin Grant | the same extend-or-create rule, a chosen start date allowed on a fresh row, the "access assigned" email after (`lib/subscriptions/actions.ts`) |
| admin Update | dates, status, source and product rewritten on the receipt, refusing a second ACTIVE unexpired row for the same product |
| admin Revoke | `status = 'REVOKED'`, the "access removed" email after |

Plus **Sync Status**, a button on the admin list that flips ACTIVE rows
past their expiry to EXPIRED — the no-scheduler-era way of keeping the
status column honest (D20).

### Stacking

**Same product:** real. A purchase or grant while the same product is
still active extends that receipt from its current expiry; no days are
lost. **Across products:** the page *adds up* the remaining days of
every receipt that names the course and shows the sum as the expiry.
Nothing grants the sum (D14, below).

### How access is checked — two definitions of one fact

- **In TypeScript**, `getStudentCourseAccess` loads the student's
  ACTIVE receipts with their products and, for every course in every
  `courses_included`, sums remaining days into a map of course →
  `{ totalDays, expires }`. The student layout, the dashboard, the
  course page, the two quiz list pages, the Quiz Builder and the
  offline-pack builder read that map; the course page's "days left"
  box and the dashboard's subscription bar are its numbers.
- **In SQL**, `user_has_course(course_id)` is `SECURITY DEFINER` and
  answers true for an ADMIN or for a student with one ACTIVE, unexpired
  receipt whose product's list contains the course. It gates the
  eleven question-bank tables, since Q1 the quiz and mock-exam reads,
  the attempt spawn and the bank reads.

Both unpack the same word list by hand; nothing ties them together.
Three more readers unpack it their own way: the announcement scope
(the most recently expiring ACTIVE receipt is "the" product and kind;
the course list from the map), the offline-pack allowance (every
receipt of any status, filtered by the list in code, then its own
TRIAL rule), and the messaging admin's two (`getStudentCourseIds` for
New Thread's course list, `resolveRecipients` for the parked Bulk
Send). The profile's Subscription panel and the Upgrade page list the
receipts themselves — one on the profile (the latest expiring), all of
them on Upgrade.

### What the student sees

The dashboard's subscription bar shows the longest access and warns
under seven days; each course card shows its expiry or the warning;
the course page shows a days-left box; the profile shows one
subscription with its product name and expiry; the Upgrade page lists
the active ones above the products for sale. A course the student does
not hold shows the upgrade prompt; the Quiz Builder and the pack
builder offer only held courses.

---

## 2. What the diagnosis found

One line each; the full text with proof is in
`post-rebuild-diagnosis.md`.

- **D13 — two definitions that agree by coincidence.** The TypeScript
  map and the SQL gate both unpack `courses_included`; editing either,
  or the meaning of the list, breaks the agreement with no error.
  Reaches everyone, silently.
- **D14 — the days-left number is wrong whenever two products
  overlap.** The map sums remaining days across receipts; the gate
  checks each receipt's own date. Sam's example: RN Full on day 0, RM
  Full on day 65 → GP shows 665 days, access ends in 365. Recomputed
  from *remaining* days, the shown end moves earlier every morning.
  Reaches every student who buys during a trial — the common path.
- **D15 — the access read runs four or five times a request.** Not
  cached per request; the course page reads it in the layout, the
  title, the page and twice inside the announcement scope. Code only.
- **D16 — product-to-course is text, not a relationship.** No foreign
  key, so a product can name a course that does not exist or is
  archived; every reader unpacks in code; the bank policy scans product
  rows per question row. Gap 11 is a symptom.
- **D17 — announcements and offline packs each pick "the"
  subscription by their own rule.** A student holding two products
  gets an arbitrary product and kind for scoping.
- **D18 — quizzes not course-gated in SQL.** Closed by 03 Q1
  (2026-09-19), on today's `user_has_course()`.
- **D19 — Telegram group keys on public pages.** `select('*')` on the
  sales doors. Code only; before the Telegram gate.
- **D20 — EXPIRED is a manual button.** Access never depended on the
  status (both readers check the date), but the admin list and the
  profile panel filter on `status = 'ACTIVE'` with no date check, so an
  expired row shows as active until Sync is pressed.
- **D21 — the floor, measured.** A student's own credential reads only
  their own receipts and only the bank tables of courses they hold
  (900 of 900 with answers for a held course, 0 for one not held); the
  browser roles hold table-wide privileges, so column-level revokes
  are available. The gate holds; the shape is the problem.
- **D2, D23 — the shop.** Three doors each define "for sale"; nothing
  adapts to the buyer's programme; no sales row says which courses a
  product unlocks. The shop's plan sits under *Later* below until Sam
  places it here or in `01-payments.md`.

---

## 3. Rulings (Sam, 2026-09-17/18, and after)

- **Expiry belongs on the course, not the product.** Sam's framing
  after the RN Full + RM Full walk-through: *"we should not say they
  have access to RN_FULL for 365 days; we should say they have access
  to GP for 365 days, RN_MED 365 days…"* A purchase writes one access
  row per course; the receipt stays. Ticked into `rebuild.md` §8 as
  **S8** on 2026-09-18.
- **The six rulings on its shape** (recorded in the diagnosis under
  *Proposed direction — course-level access*):
  1. **Bought means kept.** Rows are written at purchase; a later edit
     to a product's course list affects new buyers only.
  2. **A trial does not stack.** A paid purchase starts today; the
     trial's rows run out on their own date.
  3. **Timing.** The tables and the automatic paths before cutover
     with stacking *off* (every row starts today; `subscriptions` is
     empty on launch day — D5 — so the window is open once).
     Queued-row stacking on after cutover, as a product change under
     the ⭐ rule.
  4. **Revoke and edits do not ripple.** Revoking a receipt switches
     off its rows; rows queued behind keep their dates. An admin
     extension overlaps rather than shifts the queue. Every row's
     dates are written once and read as facts.
  5. **Every row traces to a receipt.** A hand-picked grant writes a
     receipt with no product, source ADMIN and the admin's note.
  6. **The admin forms follow the rows.** Grant lists the product's
     courses ticked; Update lists the receipt's rows, each editable;
     Revoke takes a receipt or one row. Read-only rows in the dialogs
     before cutover, editing after.
- **The product stays the single unit of sale.** Course-level pricing
  (a price per course, products as bundles, a basket) weighed and
  parked; S8's shapes already fit it if it returns (2026-09-18).
- **A product has no programme column.** Which programmes a product is
  for is derived from its courses' `program_scope`, General Paper not
  counting; anyone may buy any product, the shop orders and hides
  nothing (D23, 2026-09-18).
- **S2 before S8** (2026-09-19): the eleven per-course item tables
  become one before the access rows land, so the new gate is written
  onto one bank policy, not eleven. The link table (C1) touches no item
  table and is not held by this. **Reversed later the same day for C2
  (Sam, 2026-09-19):** the gate is one function the eleven policies
  call by name, so its body changes once whether the tables are eleven
  or one; C2 touches no item table and was built before S2. S2 stays
  its own decision.

---

## 4. The plan

Each slice ends with Sam testing it at `localhost:3000`. A slice that
changes a table names its §8 row. Ids are this doc's own. C1 and C2
are the two halves of S8; C3 is S8's after-cutover half.

### C1 — The link table (S8's definition side; D16)

**Storage, one migration.**

- `product_courses (product_id → products, course_id → courses)`,
  primary key on both. No dates, no status — a definition carries no
  time. Filled in the migration from every product's
  `courses_included`; a word with no `courses` row fails the
  migration, so both projects' lists are checked first (dev's rows;
  prod's 32 products by a read Sam runs).
- Policies mirror `products`: read by anyone (the sales doors will
  list what a product unlocks — D23 item 5), written by an ADMIN.
- `courses_included` dropped in the same migration, after every reader
  below has moved. Both snapshots updated.

**Code.** The Products page saves the ticked courses as link rows
(delete the product's rows, insert the ticks, inside the save action)
and reads them back through the join for the table's tags and the
panel; the `Product` type carries `courses: string[]` from the join.
`user_has_course()` joins `product_courses` instead of `= any(...)`.
`getStudentCourseAccess`, the offline-pack allowance and the messaging
admin's two readers select the courses through the join. **Nothing a
student sees changes**; the days-sum stays until C2.

**Gap 11 lands here**, Sam's ruling needed at build: the key refuses a
course that does not exist; whether an archived course may stay in a
bag is a product question (legacy dropped it on save).

**Done when** (SQL on dev, then the browser): the link rows count
equals the sum of the old lists and every product's set matches; a
save naming a course id with no row is refused; the Products page
shows the same tags and the panel the same titles; the RN student's
dashboard, course page and Quiz Builder show the same courses and the
same days as before; the bank proof of D21 unchanged (900 for a held
course, 0 for one not held); the pack allowance for a held course
unchanged; New Thread's course list unchanged.

### C2 — The access rows (S8's entitlement side; D13, D14, D15, D17, D20)

Built before S2 (Sam, 2026-09-19; the order reversed — §3).

**Storage, one migration.**

- `course_access`: `access_id bigint identity`, `user_id → users`,
  `course_id → courses`, `subscription_id → subscriptions`,
  `start_utc`, `expires_utc` (CHECK expiry after start), `revoked_utc`
  null (empty = live), `created_utc`. Index on `(user_id, course_id)`
  over live rows. No uniqueness — several rows per course per student
  are intended (trial, paid, a queued renewal).
- Students SELECT their own rows; **no browser write path** — the
  browser roles' INSERT / UPDATE / DELETE never granted; every write
  is a Server Action with the service role. (`subscriptions` keeps its
  ADMIN policies for the admin actions, as today.)
- `subscriptions.product_id` nullable, for the hand-picked grant
  (ruling 5) — **moved to C3** with the form that writes it, so the
  type change lands beside its writer (Claude, at build, 2026-09-19).
- `user_has_course(course_id)` keeps its name and every caller; its
  body becomes one lookup: an ADMIN, or a live row for the caller and
  course whose window contains now. A second function,
  `my_course_access()`, returns the caller's courses with the latest
  live end per course — the pages' one read.
- Backfill: one row per course per existing receipt from
  `product_courses`, the receipt's dates, `revoked_utc = now()` for a
  REVOKED receipt. Dev's rows only matter; prod's receipts are test
  rows and launch day starts empty (D5).
- Both snapshots updated.

**Code.** The five writers gain one step after the receipt: write its
course rows from `product_courses`, every row starting today (ruling
3, stacking off). Where a writer *extends* the same product's receipt
(activation, Grant), the receipt's rows take the new end with it, as
Update rewrites a receipt's rows to its edited dates — my
recommendation, so a same-product renewal before cutover loses
nothing; the extend branches go when stacking turns on (C3). Revoke
stamps `revoked_utc` on the receipt's rows. `getStudentCourseAccess`
becomes one `rpc('my_course_access')`, wrapped in React's `cache()`
so a request reads once (D15); `totalDays` is the stored date's
distance, so tomorrow shows one less. The announcement scope takes its
course list from the same read; the offline-pack allowance and the
messaging admin's two readers read `course_access` (the allowance's
TRIAL rule reads the receipt's product kind through the link). The
admin list and the profile panel derive "expired" from the date (D20);
the Sync Status button **stays** for now — it only tidies the status
column, which nothing reads for access any more (no ruling asked for
its removal, 2026-09-19). One parity note: today's gate ignored a
receipt's start date, so a future-dated admin grant gave access at
once; a row is live only inside its window, so such a grant now waits
for its day.

**Done when** (SQL as the dev students, rolled back, then the
browser): `user_has_course` answers as before for both dev students
(true on a held course, false on one not held) and the bank proof of
D21 is unchanged; `my_course_access()` returns the same courses with a
stored end; a trial and a paid product on the same course show the
later end, not the sum, and the dashboard's number is one less the
next day; Grant writes one row per course of the product; Revoke
closes the course the moment the page reloads; Update's new dates
reach the receipt's rows; a student's direct insert into
`course_access` is refused; an expired receipt shows Expired on the
admin list without the button.

### C3 — Stacking on, the admin forms follow the rows (rulings 3, 5, 6)

Ruling 3 put this after cutover under the like-for-like rule; with the
port finished that rule no longer holds, and C3 is code on C1 and C2's
tables. **Buildable whenever Sam picks it (Sam, 2026-09-19)** — one
rule from day one is simpler to explain than a change after launch.
Split into two (Sam, 2026-09-19): C3a the queued start, C3b the admin
dialogs.

#### C3a — The queued start (ruling 3 on, code only)

- For each course of a paid or free receipt, the new row starts at the
  student's latest live end on that course from a **non-trial**
  receipt when that end is later than the receipt's start; otherwise
  on the receipt's start. The row keeps the receipt's length. A trial
  carries nothing forward and a trial's own rows never queue (ruling
  2). **The receipt keeps the purchase dates; the rows are the
  access** (Sam, 2026-09-19). **No on-off switch** — simply on (Sam,
  2026-09-19).
- The two "extend the same product's receipt" branches go (Paystack
  activation, admin Grant): a renewal is a receipt of its own. Update
  stops refusing a second ACTIVE receipt for the same product. The
  `extended` activation mode and the confirmation page's line for it
  go; Grant's result loses its mode.
- An admin Update still puts a receipt's rows on the receipt's dates
  (the admin asked for those dates); editing one row is C3b.

**Done when** (SQL on dev, rolled back where it writes): a second
RN_FULL grant to a student whose GP row ends on day 24 writes GP
starting on day 24 and ending on day 389, the two RN courses likewise;
a course the student does not hold starts today; a grant beside a
trial-only row starts today (the trial pushes nothing); the worked
example's GP 665 falls out of the rows; Paystack activation of a
second purchase creates a second receipt, no extension; the dashboard
shows each course's latest end.

#### C3b — The admin dialogs follow the rows (rulings 5, 6)

- **Grant** lists the product's courses ticked, an untick allowed; a
  hand-picked grant (courses and days, no product) writes a receipt
  with no product, source ADMIN and the admin's note —
  `subscriptions.product_id` nullable lands here.
- **Update** lists the receipt's rows, each editable — "give Ama 14
  more days on GP", which no tool does today.
- **Revoke** takes a receipt or one row.
- The Users page's Assign shares Grant's form.

### Later, under this doc

- **The shop (D2, D19, D23):** one "for sale" helper on `kind` and
  `status`; `products.is_premium` for Premium Prep (D1 option D); the
  list ordered by the buyer's programme through `course_programs`
  (`program_scope` made a link table), nothing hidden; each sales row
  listing the courses it unlocks from `product_courses`; the columns
  the page shows. The visible parts after cutover. Sam places it here
  or under `01-payments.md`.
- **Expiry reminders** (BUILD_LIST, auth item 9): written against
  `course_access`'s end dates, through the outbox; `expiry_reminded`
  goes or moves with it.
- **One Quademia account** (BUILD_LIST): register offering "sign in to
  add this product" — touches the trial grant.
- **Retention of receipts and rows:** never deleted; a purge is not
  planned.

---

## 5. Ladder

| Slice | Date |
|---|---|
| C1 The link table | ✅ 2026-09-19 (`20260919200000_product_courses.sql`; proven on dev by SQL — 32 of 32 products with rows, a bad course id refused, the gate unchanged for both dev students; Sam moved on without a defect) |
| C2 The access rows | ✅ 2026-09-19 (`20260919230000_course_access.sql` + `…233000_course_access_grants.sql`; before S2 — Sam; proven on dev by SQL, walked by Sam on an RM Trial grant: the rows and the per-course ends, GP the later end not the sum) |
| C3a The queued start | ⬜ |
| C3b The admin dialogs follow the rows | ⬜ when Sam picks it (2026-09-19) |
