# Post-Rebuild Diagnosis & Proposed Fixes

Opened 2026-09-17 by Claude, in session with Sam. Status: **a findings
register — a finding here is seen and written down, not decided; a
decision is a `rebuild.md` §8 tick or a `BUILD_LIST.md` line.**

Structural problems found by reading the ported app, with a proposed
fix for each. Most are inherited from the stack the product was first
built on (a vanilla-JS site over Google Sheets, then Supabase), where a
convention in a string did the work a column should do.

## What this is, and what it is not

- **Not `BUILD_LIST.md`.** That file is the inventory of slices — built,
  queued, parked. A line there means the work is real and ordered. A
  finding here is a *diagnosis*: it has been seen and written down, and
  Sam has decided nothing about it.
- **Not `rebuild.md` §9.** §9 is the port's carried legacy defects,
  each fixed inside the slice that rebuilt its surface. The port is
  finished, so nothing here has a slice to sit in.
- **A shape change still needs its §8 tick.** Anything below that
  changes storage is a §8 candidate and is not built until it has a row
  in `rebuild.md` §8 with Sam's tick and a date.
- **Not authorised by being here.** The port's like-for-like rule ended
  with the port (Sam, 2026-09-18), so a finding may propose a new
  feature as well as an internal fix. Either is built only on Sam's
  go-ahead in the session.

## Rules for this file

- **One finding per entry**, numbered `D<n>`, newest appended.
- Each carries: **what**, **where** (file and line, or table and column),
  **who it reaches** — a real user or only dev — and a **proposed fix**
  in one line. Sam prices the fix on the reach.
- **The proposed fix is a recommendation, never a decision.** A decision
  goes in `rebuild.md` §8 or `BUILD_LIST.md`, not here.
- When a finding is approved, it leaves here for `BUILD_LIST.md` and is
  marked `→ queued <date>` below. When it is rejected, it is marked
  `✖ <reason> (Sam, <date>)` and kept, so it is not re-found.
- No session history. That belongs in `sessions/`.
- **A *Proposed direction* section** may follow the findings where
  several point at one shape. It carries the comparison, the staging
  and a draft row for `rebuild.md` §8 — as text to be judged, never
  as an edit to that file. The row moves to §8 only when Sam ticks it.

---

## D1 — Premium Prep products are identified by the ending of their ID

**What.** The Premium Prep page finds its products by reading the
spelling of the product's primary key. Two separate business facts are
parsed out of one string: *"this is a premium product"* (the ID ends in
`_2026_PREP`) and *"it belongs to programme RN"* (whatever is left when
that ending is chopped off). Neither fact is stored in a column. There
is no column saying a product is premium, and no column linking a
product to a programme.

The same database already answers the same question properly one table
over: `programs.trial_product_id` is a declared column with a foreign
key, so a programme's *trial* product is a real link the database
enforces. A programme's *premium* product is a guess from spelling.

**Where.** `app/premium-prep/premium-prep-client.tsx:26` (`PREP_SUFFIX`),
`:43` (the suffix test), `:44` (the programme derived by slicing the ID).
Compare `db/migrations/20260911010000_auth_tables.sql:33`.

**Who it reaches.** Nobody today: the five live IDs are spelled
correctly, 2026 is the current year, and the paid products are archived
on prod behind the launch pause. It springs later, in three ways:

1. The exam year is inside the ending. A 2027 cohort needs
   `RN_2027_PREP` products, and the page then shows *"No active Premium
   Prep products were found yet."* until a developer edits code and
   redeploys. A price is an admin edit; a year is a deploy.
2. An admin creating a product may type any ID (`app/(app)/admin/products/products-client.tsx:174`
   checks only that it is not blank). `RN_PREP_2026`, or a trailing
   space, produces a product that is active, priced and correct in every
   visible way, and invisible on the sales page — with no error anywhere.
3. The page sorts every match by price and takes the cheapest
   (`premium-prep-client.tsx:59-64`). A second, discounted RN prep
   product silently becomes the one the RN button sells. Nothing marks
   which product is the one being sold.

**Proposed fix (option D, Sam, 2026-09-18 — replaces C).** A flag on the
product, `products.is_premium`; the year leaves the id, so a premium
product stays premium in 2027 with a price edit and no deploy. The
Premium Prep page lists every active, paid, premium product and groups
them by programme using the **derived match** of D23 (a product matches
the programmes that sit its courses, GP not counting) — no programme
column on the product, no `prep_product_id` on the programme. Two
premium RN products show as two cards under RN instead of "cheapest
wins". `programs.trial_product_id` **stays** as it is: registration must
pick exactly one product automatically, and "exactly one" is a pointer,
not a flag or a match.

*Replaced: (C) `programs.prep_product_id`, mirroring `trial_product_id`
— chosen 2026-09-17, replaced 2026-09-18 because premium is a fact about
the product while the trial is a decision about the programme, and
because the programme a product is for is derivable from its courses
(D23). Rejected earlier: (A) move the `_2026_PREP` string from code into
a `config` row — still string-matching, a mistyped ID still silently
invisible. (B) `products.program_id` + `products.tier` — `program_id`
rejected on 2026-09-18 by Sam: a product is a bag of courses and a bag
can cross programmes (an RM + RN product has no single programme);
`tier` survives as the boolean above.*

**Status.** Open. Not approved, not queued. Worth settling before D3's
slice (the Telegram gate) is built on the same pattern.

---

## D2 — `products.kind` exists and nothing filters on it

**What.** The products table carries `kind` (`PAID | TRIAL | FREE`) —
the column that says what a product *is*. No page uses it to decide
anything; it is read once, only to display in the admin user drawer
(`lib/users/queries.ts:58`). Instead, three surfaces each invent their
own rule for "a paid product":

- Premium Prep — *the ID ends in `_2026_PREP`* (`app/premium-prep/premium-prep-client.tsx:43`)
- Subscribe — *not a programme's trial ID, and price > 0* (`app/subscribe/subscribe-client.tsx:34`)
- Upgrade — the same as Subscribe (`app/(app)/student/upgrade/upgrade-client.tsx:50`)

Three definitions of one idea, none of them the column that means it. A
product mis-set as `kind = 'TRIAL'` but priced above zero still sells on
Subscribe and Upgrade; the column that should have stopped it is never
consulted.

**Where.** The three lines above; the column at
`db/migrations/20260911150000_catalogue_tables.sql:43`.

**Who it reaches.** Nobody today — the seeded data has `kind` set
correctly throughout, so the three rules happen to agree. It reaches a
student the first time an admin creates a product whose `kind` and price
disagree.

**Proposed fix.** One shared helper reading `kind` and `status`, used by
all three surfaces, so the column becomes the answer instead of three
guesses. Naturally paired with D1.

**Status.** Open. Not approved, not queued.

---

## D3 — `telegram_group_keys` is free text, and already holds junk

**What.** A product's Telegram groups are an untyped list of strings an
admin types by hand into a tag box — no list to pick from, no
validation, no table of real groups behind it
(`app/(app)/admin/products/products-client.tsx:520-537`, hint:
*"Type a key and press Enter…"*). Two products already carry
keyboard mash: `NAC_BASIC_CLIN_ONLY` has `{JKHOILHHPI}` and
`NAC_BASIC_PREV_ONLY` has `{JUKJGHOIU8ILUL}`
(`legacy/db/seed_data.sql:84-85`), copied into `licensure_gh` verbatim
by the content copy at `db/migrations/20260911150000_catalogue_tables.sql:145`.

**Who it reaches.** Nobody yet — nothing reads the column. It reaches a
paying student the day the Telegram gate ships, because the gate decides
who is admitted to which group from exactly this column. A mash value
admits nobody, silently.

**Proposed fix.** A `telegram_groups` table with the real groups, and
the product's list chosen from it rather than typed — settled *before*
slice 17 is built, not after. The prod rows want checking for further
junk at the same time.

**Status.** Open. Not approved, not queued. Blocks nothing today; would
change slice 17's shape if settled first.

---

## D4 — There is no Paystack webhook; activation depends on the browser coming back

**What.** A payment becomes a subscription only when the payer's browser
returns to `/payment-confirmation` and the verify poll succeeds. Nothing
listens to Paystack directly. A payer who approves a mobile-money prompt
and then closes the tab — or loses signal, which is the case this
product is built for — has paid and received nothing until an admin
notices the stuck row and presses the rescue button on the admin
Payments page.

This is carried, not a rebuild regression: the old payments Worker had
four routes and no webhook either
(`legacy/mynmclicensure/workers/payment-worker/src/index.js:18-46`),
despite `legacy/CLONING.md:999` ticking "Set up Paystack webhook".

**Where.** `lib/payments/verify.ts` and `lib/payments/activate.ts` are
reached only from the confirmation page; there is no route handler under
`app/` for an inbound Paystack call.

**Who it reaches.** A real payer, for real money, as soon as the product
sells. Frequency unknown and worth measuring before pricing the fix —
the live site's stuck-payment rate is the number that decides how urgent
this is.

**Proposed fix.** A Paystack webhook route that verifies the signature
and runs the same activation path the confirmation page runs, so a
completed payment activates whether or not the browser ever comes back.

**Status.** Open. Not approved, not queued. The only finding here that
costs money rather than tidiness. Two facts added 2026-09-18: alpha's
Payments web app *was* webhook-driven (Sam); and D34's ruling — a
nightly sweep that verifies every stale INIT row with Paystack — covers
most of this finding within a day, leaving the webhook as the
seconds-not-hours version of the same catch.

---

## D5 — The runner hands every answer to the browser

**What.** The runner loads its questions with `select('*')`, so every
column comes back — `correct`, `rationale`, `rationale_img` and the
per-option feedback `fb_a`–`fb_f`. The page then passes those rows to
`<QuizRunner>`, which is a `'use client'` component. Next.js serialises
a client component's props into the HTML so the browser can rebuild it,
so the answer key for every question in the attempt is in the page
source before the student answers anything.

In timed mode the answer is withheld from the *screen*, not from the
browser: `canReveal` is `locked || reviewMode` — a render rule over data
that is fully present.

**Where.** `lib/bank/queries.ts:36` (`select('*')`),
`lib/attempts/runner-load.ts` (returns `items: Item[]`),
`app/(app)/runner/timed/page.tsx` and `.../instant/page.tsx`
(`items={load.items}`), `components/runner/quiz-runner.tsx:30`
(`'use client'`), `:532-535` (the reveal rule). The type:
`lib/bank/types.ts:30-50`.

**Who it reaches.** A paying student — who already holds these questions
legitimately in practice mode, so this is not a privacy breach and no
personal data is exposed. What it costs is **exam integrity**: a timed
mock exam, the product's central claim, can be read off the page source.
Not confirmed by running the app (no keys in that session); confirm in
half a minute by opening a timed attempt and searching the page source
for a rationale sentence.

**Proposed fix.** Send the runner display columns only, and return the
answer for one question at a time as it is answered (instant) or at
submit (timed) — MyNclex's sealed/unsealed split, see *Proposed
direction* below.

**Status.** Open. Not approved, not queued.

---

## D6 — `answers_json` stores the correct answer a second time

**What.** `buildAnswersJson` writes `correct` into every record it saves
to `attempts.answers_json`. The whole attempt row, that blob included,
is handed to the browser runner — so a half-finished timed attempt leaks
the answers to everything already answered, independently of D5.

The stored copy is never trusted: the server recomputes `correct` and
`is_correct` from the live questions at submit (`recomputeAnswers`). So
it is a duplicate of the truth whose only effects are the leak and a
second, drifting version of the answer if the question is ever edited.

**Where.** `lib/attempts/scoring.ts:108-131` (`buildAnswersJson`),
`lib/attempts/types.ts` (`AnswerRecord.correct`), the column at
`db/migrations/20260913230000_attempts.sql`.

**Who it reaches.** The same paying student as D5, on a resumed attempt.

**Proposed fix.** Stop writing `correct` into the record — the server
recomputes it anyway. Old rows keep their copy harmlessly.

**Status.** Open. Not approved, not queued. The cheapest item in this
file; one function.

---

## D7 — A student can write their own attempt row, including the score

**What.** The attempts policies are row-scoped but not column-scoped:

```
create policy attempts_update on attempts for update
using (attempts.user_id = auth_user_id());
```

That restricts *which rows* a student may change, not *which columns*.
The browser holds a live authenticated database client
(`lib/supabase/client.ts`, used by the messages pages for live replies),
so the database's own rules are the only control on a direct write. A
student can edit their own attempt row and set `score_pct` to 100. The
insert policy is the same shape.

The server-side recompute at submit is a good guard on the path that
goes *through* the Server Action. The direct path has no guard.

**Where.** `db/migrations/20260913230000_attempts.sql` (the three
policies), `lib/supabase/client.ts`.

**Who it reaches.** A paying student, on their own rows only. Nothing
rides on the score — no certificate, no leaderboard — but it silently
corrupts the admin Attempts analytics, which is the number that decides
which topics need more content. Same shape as §9 #15 (`users_update`),
closed for this reason.

**Proposed fix.** Drop the student insert/update policies; the runner's
writes go through `SECURITY DEFINER` functions or service-role Server
Actions, as MyNclex does (`nclex_attempts` grants students SELECT only).

**Status.** Open. Not approved, not queued.

---

## D8 — The question bank is readable directly from the browser

**What.** The root of D5, and the one that survives fixing it. The item
policies read:

```
create policy items_gp_select on items_gp for select
using (user_has_course('GP'));
```

Every row and every column, `correct` and `rationale` included, to any
student holding that course. With the browser's authenticated client
(D7), one console request pulls a whole course. The Quiz Builder already
does a mild version of this legitimately: picking a course ships every
stem and rationale in it to the browser, because the concept search
filters client-side.

**Where.** `db/rls.sql:378-391` (the eleven policies),
`lib/attempts/queries.ts:60-71` (`getBuilderCourseItems` selects
`stem, rationale` for the whole course),
`app/(app)/student/quiz-builder/quiz-builder-client.tsx:193-199`
(the client-side concept search that is the reason).

**Who it reaches.** A paying student, and it is the paid content itself
— the bank, with answers and rationales, as a single request. Carried,
not introduced: legacy queried Supabase from the browser too, and §9 #3
already tightened this from *any signed-in user* to *a subscriber*.

⚠ **Do not copy MyNclex here.** Its equivalent policy
(`nclex_bank_items_read_published`) grants every **signed-in** user the
whole published bank and defers entitlement to the app layer; a
migration of 2026-09-03 restates that as a live constraint. MyNMCLicensure's
`user_has_course()` gate is the stricter of the two and stays.

**Proposed fix.** Move the builder's search server-side, then revoke the
answer columns from `authenticated` and have the server read the bank
with the service role after its existing access check. Only possible
once the runner no longer reads the live bank — see *Proposed direction*.

**Status.** Open. Not approved, not queued.

---

## D9 — Both builders ship a whole course's stems and rationales

**What.** Picking a course in the Quiz Builder sends every question stem
and every rationale in that course to the browser, so the "search by
concept" box can filter as the student types. The Offline Pack Builder
calls the same function and does the same thing.

The filters are all criteria — main topic, subtopic, difficulty,
question type, a search word. None of them needs the question text in
the browser to be answered. The payload is the whole leak: the criteria
are not.

Scale: `items_rm_mid` holds 540 questions against a 900 target, so
picking midwifery ships 540 stems and rationales in one response —
more than the runner (D5) ever leaked, before the student has built
anything. It carries stem and rationale but **not** the options and
**not** `correct`, so it is not the complete question; a rationale
usually names the answer in prose, so treat it as leaked.

Inherited, like the rest: the legacy site had no server, so the browser
needed the rows in order to filter them. The rebuild moved the rendering
to the server and kept the data shape.

**Where.** `lib/attempts/actions.ts:60-72` (`loadBuilderCourse`),
`lib/attempts/queries.ts:60-71` (`getBuilderCourseItems` — selects
`stem, rationale` for the whole course),
`app/(app)/student/quiz-builder/quiz-builder-client.tsx:159, 193-199`,
`app/(app)/student/offline-packs/build/offline-builder-client.tsx:112`.

**Who it reaches.** A paying student, one click after opening the
builder. Both builders share the call, so one fix covers both.

**Proposed fix — counts only.** MyNclex's shape, and it is already
running: `nclex_count_eligible_items(p_filters JSONB) RETURNS JSONB`
takes the filters and returns
`{ "total": 47, "by_question_type": { "MCQ": 31, "SATA": 16 } }` — a
number and a breakdown, no stems, no rationales, not even ids
(`db/migrations/20260506150000_slice_2_2a_count_and_create_attempt.sql:257-295`
in `Quademia/mynclex`). Called on every filter change, debounced ~150 ms
(`lib/practice/builder/actions.ts`). Start then calls a separate
function that picks and snapshots inside the database.

⚠ The concept search matches against `rationale`. Server-side it still
works — the database searches the text and returns a count, faster than
the browser can — but the count lands a moment after typing stops rather
than on every keystroke. That is what the debounce is for.

**Status.** Open. Not approved, not queued. Much smaller than S7, and
required before D8 can be closed.

---

## D10 — The browser's database credential is the stack, not the messaging feature

**What.** Recorded because the opposite is the natural assumption, and
acting on it would cost a feature and fix nothing.

Audited every use of the browser Supabase client. It appears in four
files and does exactly two things: realtime channels for live message
replies (`app/(app)/student/messages/messages-client.tsx:184-202`,
`app/(app)/admin/messages/messages-client.tsx:277-279`) and auth
(`app/login/login-card.tsx`, `app/reset-password/page.tsx`).
**No browser code queries a table** — not one `.from()` or `.rpc()`.

The credential is there regardless:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is compiled into the JavaScript bundle
  at build time and is public by design.
- The access token sits in a cookie the browser can read — it must, or
  `createBrowserClient` could not hold a session, and realtime could not
  authenticate. Nothing in `lib/supabase/server.ts` or `middleware.ts`
  sets `httpOnly`, and setting it would break the browser client.

So a student needs none of this product's code to query the database
directly. Removing realtime messaging would remove a feature students
use and close nothing.

**Who it reaches.** Nobody by itself — it is a property of cookie-based
Supabase auth, shared with MyNclex and with every app on this stack.
It is what makes D8 exploitable, and the reason D8's fix has to be the
permission rather than a code path.

**Proposed fix.** None here. Keep live messaging. Fix D8 in the database
(D8's own entry), which is the only thing that constrains a credential
already in the browser.

**Status.** Open as a recorded fact, not as work. ⚠ Do not "close the
messaging connection" — it is not the door.

---

## D11 — The admin bank reads are a speed problem, not a leak

**What.** The admin Question Bank page and the admin quiz picker each
load an entire course, every column, into the admin's browser. Both are
properly gated: `loadCourseItems` and `loadPickerItems` call
`requireAdmin()` before reading anything.

An admin authoring or picking questions needs to see the answers, so
this is not a leak — MyNclex sends full rows with answers to its
curator's browser too. The difference is only how much at once: MyNclex
pages at 50 with Load more, capped at 500, filters applied server-side
(`lib/bank/bank-list-query.ts:175-176` in `Quademia/mynclex`); this
product loads the whole course.

⚠ The pattern is only half-built over there. Their own note:
*"the bank WILL grow past 500, so this is a real to-do, not
hypothetical"* — past the cap, a sort silently shows the first 500 only,
the same class of bug as this product's admin Attempts page.

**Where.** `lib/bank/actions.ts:32-42` (`loadCourseItems`),
`lib/quizzes/actions.ts:49-53` (`loadPickerItems`),
`app/(app)/admin/question-bank/question-bank-client.tsx:136`,
`components/quizzes/quiz-manager.tsx:296`.

**Who it reaches.** An admin, who is entitled to the content. The cost
is load time on a growing bank, on a phone especially.

**Proposed fix.** Page the two admin reads server-side when the bank
gets big enough to hurt. Borrow MyNclex's shape with its limitation
known — server-side ORDER BY from the start, rather than load-all-to-sort.

**Status.** Open, low priority. Not a leak; do not bundle it with D5–D10.

---

## D12 — A saved offline pack is a pointer list, not a snapshot

**What.** The table's own header calls a pack *"an immutable snapshot of
the chosen item ids"* — and that sentence is the defect. It stores
**which** questions, not the questions. `offline_packs.item_ids` is an
array of ids and the renderer follows them back to the live bank every
time the pack is opened
(`lib/offline-packs/queries.ts:226` → `getItemsByIds`).

So a saved pack is not immutable:

- a question edited → the pack quietly shows the new wording;
- a question deleted → it disappears from the pack. The renderer already
  apologises for this: *"Some saved questions could not be loaded from
  the source items table. Missing count: N."*
  (`app/(app)/offline-pack/page.tsx:109-110`);
- the pack then disagrees with itself — stored `question_count` says 50,
  `items.length` is 47, and the header prefers the smaller number
  (`:120`).

That warning is the tell: legacy knew a saved pack could lose questions
and chose to apologise rather than prevent it.

**Where.** `db/migrations/20260914200000_offline_packs.sql` (the
`item_ids text[]` / `question_count` columns and the header's wording),
`lib/offline-packs/queries.ts:208-231`,
`app/(app)/offline-pack/page.tsx:109-120`.

**Who it reaches.** A student who re-opens a pack weeks after saving it.
Lower stakes than D6: a pack is *printed*, so the paper copy is frozen
whatever the database does, and there is **no leak** — the renderer is a
Server Component and a pack carries its answer key by design.

**Proposed fix.** The same fix as S7, pointed at a second table:
`offline_pack_items`, one row per question, the question copied in at
build time. Structurally identical to `attempts` → `attempt_items`, so
the machinery is written once and reused. Folded into S7's draft row
below rather than listed as work of its own.

ℹ️ Storage is not a concern: fifty questions of full text is ~100 KB per
pack, and `offline_packs_per_course` caps how many a student may hold.
The same holds for attempts.

**Status.** Open. Not approved, not queued. Lower urgency than D6 — it
should not be the reason S7 grows and slips.

---

## D13 — Course access has two definitions that agree by coincidence

**What.** "Which courses does this student hold" is answered twice, in
two languages, from the same text list. TypeScript
(`getStudentCourseAccess`) loads every ACTIVE subscription with its
product and, for each course in `products.courses_included`, adds up the
remaining days. SQL (`user_has_course()`) checks for one ACTIVE,
unexpired row whose product's list contains the course. Both unpack the
same array by hand; nothing ties them together. Two more readers do the
same unpacking their own way (D17). They agree today. Editing any one of
them, or the meaning of `courses_included`, breaks the agreement with no
error anywhere.

**Where.** `lib/subscriptions/queries.ts:24-66`;
`db/migrations/20260913220000_subscriptions.sql:66-84` (the function,
`p_course_id = any (p.courses_included)` at :82; `db/rls.sql:373`).

**Who it reaches.** Everyone, silently — the pages (TypeScript) and the
bank policies (SQL) can disagree about the same student.

**Proposed fix.** One definition in the database, read by both: the
course-level access table in *Proposed direction — course-level access*
below. Until then, at minimum both readers call one SQL function.

---

## D14 — The days-left number is wrong whenever two products overlap

**What.** The TypeScript reader **adds** the remaining days of every
subscription that covers a course. Two *different* products covering the
same course (the trial and the paid product always do; RN Full and RM
Full share GP) are summed on screen, but nothing grants the sum: the SQL
gate checks each row's own expiry, and the TypeScript yes/no also ends
when the last row ends. Sam's example: RN Full on day 0, RM Full on day
65 → GP shows 300 + 365 = **665** days; access actually ends on day 430,
**365** days away. Worse, the sum is recomputed from *remaining* days on
every read, so the shown end date moves **earlier every day** until the
shorter row dies (10 + 20 shows 30 today and 28 tomorrow, not 29).

Doc 02's stacking example is the *same* product, where the grant and
Paystack activation extend the existing row — that stacking is real and
written into the row. The cross-product sum is a legacy arithmetic error
carried over. Same-product stacking cannot be generalised to different
products under this shape: rows carry dates per product, and two
products overlapping on one course out of three have nothing to extend.

**Where.** `lib/subscriptions/queries.ts:44-57` (the sum at :55); shown
by the course page's days box and the dashboard's subscription bar.

**Who it reaches.** Every student who buys during their trial — the
common buying path — and anyone holding two products.

**Proposed fix.** Course-level access rows (below): the number becomes a
stored date. Interim, code only: latest expiry per course, not a sum.

---

## D15 — The access read runs four or five times per request

**What.** `getStudentCourseAccess` is not wrapped in React's `cache()`
(the gate is). The course page reads subscriptions in the layout, in the
tab-title function, in the page, and twice more inside the announcements
scope (its own "active subscription" read plus the access map). The
dashboard: four times.

**Where.** `app/(app)/student/layout.tsx:26`,
`app/(app)/student/course/[id]/page.tsx:51` and `:92`,
`lib/announcements/queries.ts:89-113` (`:99`),
`app/(app)/student/dashboard/page.tsx:115`.

**Who it reaches.** Everyone, as slowness — part of the ~13 round trips
per page measured on 2026-09-16.

**Proposed fix.** Wrap the read in `cache()` so one request reads once.
Code only, no shape change.

---

## D16 — Product-to-course is text, not a relationship

**What.** `products.courses_included` is a `text[]`. No foreign key, so a
product can name a course that does not exist, is misspelt, or is
archived; the database cannot check it and cannot join on it, so every
reader unpacks it in code (D13, D17), and the bank policy scans product
rows per question row (the "per row" cost in the perf notes). The legacy
check's gap 11 (a draft or archived course kept inside a product on save)
is a symptom.

**Where.** `db/migrations/20260911150000_catalogue_tables.sql:45` (the
header at :14 says why: "cannot carry a foreign key").

**Who it reaches.** An admin editing products; students only when a
typo lands.

**Proposed fix.** A `product_courses` link table (below). The least
important change in this group on its own; it is what makes the access
rows writable from a checked list.

---

## D17 — Announcements and offline packs each pick "the" subscription by their own rule

**What.** The announcement scope takes the most recently expiring ACTIVE
subscription as *the* student's product and kind; with a trial and a paid
product it picks whichever expires later, which is arbitrary. The offline
allowance re-reads every subscription and re-filters by `courses_included`
in code, then applies its own TRIAL rule. Third and fourth readers of the
same list.

**Where.** `lib/announcements/queries.ts:89-113` (`:111-112`),
`lib/announcements/scoping.ts:37-44`;
`lib/offline-packs/queries.ts:115-140`.

**Who it reaches.** A student holding two products — an announcement
scoped to a product may miss them, or reach them, by expiry order.

**Proposed fix.** Read the course-level rows; scope announcements by
course (already possible, §9 #19) rather than by "the" product.

---

## D18 — Quizzes and mock exams are not course-gated in SQL

**What.** The `quizzes` and `mock_quizzes` SELECT policies are
`auth.uid() is not null`: any signed-in student reads every quiz of every
course, `item_ids` included, from the browser. The course gate on quizzes
is TypeScript only. Proven on dev with a student's own credential: 5 of 5
quizzes and 2 of 2 mocks visible to a student holding one course.

**Where.** `db/rls.sql:396-407`.

**Who it reaches.** Low harm — ids and titles, no content — but it is the
same pattern as D8: the floor does not know about courses.

**Proposed fix.** The same access function the bank uses, on both quiz
tables. A policy change, no data change.

---

## D19 — Telegram group keys are on public pages

**What.** `getProducts()` selects `*`, and Premium Prep and Subscribe
hand every active product row — `telegram_group_keys` included — to
signed-out visitors; the Upgrade page hands the same to every student.
Harmless today (nothing reads the keys — D3). The Telegram gate (slice 17)
would make those keys the thing the gate protects, sitting on a public
page.

**Where.** `lib/catalogue/queries.ts:32`, `app/premium-prep/page.tsx:25`,
`app/subscribe/page.tsx:32`, `app/(app)/student/upgrade/page.tsx:46`.

**Who it reaches.** Nobody until slice 17.

**Proposed fix.** The sales pages select the columns they show. Code only.
Settle before slice 17, with D3.

---

## D20 — EXPIRED is a manual button

**What.** A subscription becomes EXPIRED only when an admin presses Sync
Status. Access does not depend on it (both readers check the date), but
the admin list and the profile's Subscription panel filter on
`status = 'ACTIVE'` with no date check, so an expired row shows as
active until the button is pressed. A no-scheduler-era workaround (doc
02: "the platform does not have automatic background jobs on the free
tier"); Supabase has `pg_cron`, and a date needs no status at all.

**Where.** `lib/subscriptions/actions.ts:238-249`,
`lib/profile/queries.ts:26-34` (`:31`), `lib/subscriptions/queries.ts:69-83`.

**Who it reaches.** An admin reading the list; a student reading the
profile panel after expiry and before a sync.

**Proposed fix.** Derive "expired" from the date wherever it is shown, and
retire the button; or a scheduled job. The course-level rows carry a
`revoked_utc` date instead of a status for the same reason.

---

## D21 — What a student's own credential can read (dev, 2026-09-17)

Recorded so the subscription gate's real floor is on file. Run on the
dev project as the two dev students' own JWTs (`set local role
authenticated` + `request.jwt.claims`), the way their browser would:

| read | result |
|---|---|
| own `subscriptions` | own rows only |
| `products`, every column | all 32 (D19) |
| `quizzes` / `mock_quizzes` of every course | all (D18) |
| `items_rn_med` for a student holding RN_MED, `correct` and `rationale` included | 900 of 900 (D8) |
| `items_rn_med` for a student holding GP only | 0 |
| other students' `users`, `sessions`, `attempts`, `offline_packs` | none |

**The gate on the bank holds**; what leaks is the paid content to the
student who paid for it (D8), plus D18 and D19. `information_schema`
shows the browser roles (`anon`, `authenticated`) hold **table-wide**
privileges on every table — RLS is the only barrier — so the
column-level REVOKE D8 proposes is available and has not been used.

**Where.** `db/rls.sql` throughout; the grants are Supabase's defaults.

**Who it reaches.** Nobody by itself. A baseline for D8, D18, D19.

**Proposed fix.** None of its own.

---

## D22 — Eleven item tables make every bank change eleven changes, and every new course a deploy

**What.** The bank is one table per course (`items_gp`, `items_rn_med`,
…), a Sheets-era shape where a course was a tab. `rebuild.md` §8 S2
recommended keeping it (2026-09-10) because the importer, the admin bank
page and the offline picker were written per table. S7 and S8 change the
arithmetic: with eleven tables the bank policies are eleven (D8's column
revoke would be eleven revokes), the S7 snapshot copy must pick a table
by course id (eleven branches or dynamic SQL, for attempts and for
packs), D9's counts-only search cannot run across a course set, and
every column change is eleven ALTERs. Growth costs the same per course:
a new table, four policies, entries in `itemsTableFor`, the CSV importer
and the admin bank page, and a deploy — so adding a programme is a code
change. Sam (2026-09-18): the five programmes are a start; the NMC has
many more.

**Where.** `db/migrations/20260913120000_question_bank_tables.sql` (the
eleven tables and their policies, generated in a loop at `:94`),
`lib/bank/queries.ts` (`itemsTableFor`), `lib/bank/csv.ts`,
`app/(app)/admin/question-bank/`.

**Who it reaches.** Nobody today. It reaches Sam on the day a twelfth
course is added, and it multiplies the S7, D8 and D9 work by eleven.

**Proposed fix.** One `items` table with a `course_id` column and a
foreign key to `courses`; the eleven tables' rows moved in with their
course id. Then: one SELECT policy `user_has_course(course_id)`, one
column revoke (D8), one plain insert-select in the S7 copy function, one
importer path, a course *filter* on the admin page instead of a table
switch; a new course is a row in `courses` and an import, no code. Size
is not a concern: ~6,000 questions today, fifty courses at a thousand
each would be 50,000 rows, small for Postgres with an index on
`course_id`; MyNclex runs its whole bank as one table; partitioning by
course exists underneath if a bank ever reached millions. **One
constraint to check on the live data before deciding:** item ids must be
unique across the whole bank (the live ids are course-prefixed, `GP_001`
style, so they should be — verify). Same window as S7 and S8: cutover
re-copies the whole bank from `public.*`, so done before cutover it is
part of the copy, not a migration of live data.

**Status.** Open. Re-opens S2 with the opposite recommendation; S2's
decision cell in §8 is unchanged (☐) until Sam ticks it.

---

## D23 — The sales pages offer everything and adapt to nothing

**What.** Three doors sell products, each deciding for itself what is
for sale (D2): Premium Prep by the id ending (D1); Subscribe and Upgrade
by "not a trial id and price > 0", as one flat alphabetical list of all
21 paid products. Choosing a programme on Subscribe changes nothing on
the list — the choice is only written onto the payment record. The
Upgrade page ignores the student's own programme. No sales row says
which courses a product unlocks. What holds up: the browser never sends
a price; both payment-start actions look the product up on the server,
require it active, take the price from the row, and verify refuses a
Paystack amount that differs (`lib/payments/init-public.ts`,
`init-upgrade.ts`, `verify.ts:100`).

**Where.** `app/premium-prep/premium-prep-client.tsx:26-64`,
`app/subscribe/subscribe-client.tsx:30-40` (`programId` unused for the
list), `app/(app)/student/upgrade/upgrade-client.tsx:50-60`,
`app/page.tsx` (four links to Subscribe, none to Premium Prep).

**Who it reaches.** Every buyer — a midwife scrolls past the RN and
mental-health products to find hers; nobody is shown what a product
unlocks.

**Proposed fix, with Sam's rulings (2026-09-18).**

1. **Anyone may buy any product** — the page adapts, it does not filter
   (Sam). The list is ordered: the buyer's programme's products first,
   then "Other programmes", nothing hidden.
2. **Which programmes a product is for is derived, not stored:** a
   product matches a programme when any of its courses is sat by that
   programme (`courses.program_scope`), **ignoring courses every
   programme sits** (General Paper); a product made only of such courses
   matches everyone. Checked against the live rows: RN Full → RN; RM
   Full → RM; GP Only → all; an RM_MID + RN_MED product → RM and RN (Sam:
   both should see it). A programme column on products was rejected — a
   product is a bag of courses and a bag can cross programmes.
3. **One helper for "for sale"** — `kind = PAID`, `status = active`,
   `price_minor > 0` — called by all three doors (D2's fix).
4. **`products.is_premium`** for the Premium Prep page (D1 option D).
5. **Select the columns the page shows** (D19). Once `product_courses`
   exists (S8), a sales row lists the courses it unlocks.
6. **`courses.program_scope` becomes a link table (`course_programs`,
   FKs) when this is built** — it goes from admin grouping to the thing
   that orders the shop; a typo then moves a product down the list
   rather than hiding it, so it is worth doing when convenient, not
   urgent.

Items 1, 2 and 5's course list change what a buyer sees, so they sit
after cutover under the ⭐ rule; 3, 4 and the column selection are
shape and code with no visible change.

**Status.** Open. Not approved, not queued.

---

## The auth group — where the five tables came from (traced 2026-09-18)

The table-by-table sweep run over `users`, `sessions`, `auth_events`,
`reset_requests` and `rate_limits`, with every caller read
(`middleware.ts`, `lib/access`, `lib/auth`, the four auth Server
Actions, `/logout`, `/router`, and every `from('users')` in `lib/`).
Sam's brief: find what each table was *for* before deciding how to make
it work better — "this is how hackers could get into the app". The
origin is recorded here so it never has to be dug out of git again.

**Three eras.**

- **Alpha, Nov 2025 – Mar 2026.** Google Sheets as the database,
  Blogger pages as the site, Apps Script as the server (the `auth_*.gs`
  files and the sheet CSVs are in git history under
  `old stack references for claude/`, added 2026-04-02, deleted
  2026-04-12 in `40f2930`). The portal owned everything: salted
  password hashes, its own login tokens (12 h), its own reset tokens,
  three roles (STUDENT, MODERATOR, ADMIN). **Four admin pages existed:**
  *Admin-Create User*, *Admin Token Audit*, *Admin Auth & Reset Audit
  UI*, *Admin Expiry Reminders* — Blogger pages calling
  `auth_actions_admin.gs` (`create_user`, `list_tokens`,
  `admin_revoke_token`, `admin_list_auth_events`,
  `admin_list_reset_requests`, `send_expiry_reminders`).
- **Gamma, from 2026-03-13.** Supabase Auth took over passwords, login
  tokens and reset links. The three tables were recreated in Postgres
  "for audit trail and rate limiting" (`legacy/db/schema.sql` §1.11–1.12,
  the two migrations `auth_events_and_rate_limit.sql` and
  `reset_rate_limit.sql`). The admin pages were **not** recreated: the
  gamma build list (git `70f686e`) says "Admin UI deferred" under Sprint
  3, and under Admin Tools lists "Admin create user", "Admin token audit
  / sessions audit / auth events audit" and "Admin reset request audit
  (data already in reset_requests table)", all unticked. Two lines under
  Code Cleanup: "users.last_login_utc — wire up or drop",
  "users.username — wire up or drop".
- **The port, Sept 2026.** Transcribed gamma exactly (rebuild.md §10);
  wrote `ip_hash` for the first time (§8 S6); nothing else changed.

So the columns that look dead are the residue of four admin surfaces
that gamma deferred and the port carried without them.

**Table by table.**

| Table | Alpha intention | What gamma kept | What the port has today |
|---|---|---|---|
| `users.username` | The login name, auto-made from the forename, editable on Create User; `login` by username was the first door | Column only; login moved to email under Supabase Auth | Column, never written (0 of 4 dev rows), never read |
| `users.must_change_password` | An admin-created account got a temporary password shown once and had to change it at first login; alpha's Dashboard read the flag into its page object | Gamma's first `login.html` (git `fe15939`) redirected a flagged user to `/change-password.html` — a page never written; the 2026-04-07 fix `0c6acc4` removed the redirect instead of building the page | Column; the reset action clears it (§9 #8); no gate |
| `users.last_login_utc` | Written on every alpha login (three call sites in `auth_actions_auth.gs`) | Never written | Never written; `createLoginSession` is the one place it belongs |
| `users.signup_source` | ADMIN / MODERATOR / SELF / PAID — how an account came to exist, shown to the admin | SUPABASE_AUTH / PAYSTACK_SETUP, written by both registration paths | Written, read by nobody (the admin drawer shows `created_utc` only) |
| MODERATOR role | A class rep or teacher who could create students but not admins | Dropped; TEACHER became MyTeacher's | STUDENT and ADMIN only (§9 #12) |
| `sessions` (alpha `tokens`) | The token *was* the login (12 h), and reset tokens shared the sheet — hence `kind` LOGIN / RESET. **Token Audit page:** every session per student with device, login via, issued, last seen, expires, status, and a **Revoke** button per row (the support action for "someone is using my account") | Supabase owns the login token; the table became the device record for the 2-device cap, 7 days, `kind` always LOGIN; no page | Same; the gate reads the current row, `last_seen_utc` is touched; nothing lists or revokes |
| `auth_events` | Five kinds (LOGIN_EMAIL / USERNAME / GOOGLE, VERIFY_TOKEN, RESET_FLOW) with `ok`, `error_code`, `note`; the limiter keyed on user + identifier + **IP**. **Auth Audit page:** filters by email, user, kind, since / until, "only failed", 24h / 7d / 30d presets | Two types with `fail_reason`; keyed on email + browser fingerprint (a browser cannot see its own IP); no page | Same; the server now knows the IP (`sessions.ip_hash`) but the limiter still ignores it |
| `reset_requests` | The portal owned the reset token and its life: REQUESTED → TOKEN_CREATED → EMAIL_SENT → USED / EXPIRED / FAILED, "Has token?", "Last check". **Reset Requests tab** on the audit page | Supabase owns the token; a log with `user_exists`, `status`, `used`; no page | Same |
| `rate_limits` | — (no alpha history) | The payments counter from Sprint 1, April 2026 | Same; EXECUTE revoked from the browser roles — the one auth function that is |
| Create User | The alpha page: name, email, phone, username, programme, cohort, role, must-change flag; temp password shown once; welcome email | "Admin create user", deferred | Not built (BUILD_LIST ⏸ under Carried from gamma) |

**What this changes.** The question for the dead columns is not "drop
or keep". It is whether the four alpha admin surfaces come back on the
new stack — a sessions view with Revoke, a login-events view, a
reset-requests view, Create User — as admin-only server-rendered pages.
If they do, the columns have their jobs back and `last_login_utc` gets
its one missing write. If they do not, the columns go. Sam's call,
alongside D24–D30 below.

**Sam's rulings (2026-09-18) — the nine intentions read back one at a
time, each with what it is, where it came from, done or not, and the
options:**

1. **Two devices, oldest kicked** — working; keep. The legacy check's
   gap 6 (a kicked device signed out mid-quiz) is fixed with it: a
   running attempt finishes, the next page refuses.
2. **Login lockout** — revoke the public grant on the five functions
   (D24) **and** count by IP again, alongside email and fingerprint,
   now the server knows it. → §8 S9.
3. **Password reset** — the same revoke; fail closed on the *check*,
   logging stays fail-open (D30). Gap 8 goes legacy's way: signed in
   straight after the reset.
4. **Admin sessions view** — build fully: a panel in the Users drawer
   *and* a platform-wide Sessions page with the alpha's filters, Revoke
   on every live row. Sam: "we do it fully if we are doing it".
5. **Admin login-events view** — build, a tab of the same page.
6. **Admin reset-requests view** — build **with actions**: "Send reset
   link" on every row, "Lift the block" on a limited one (on the login
   tab too), the admin's own sends logged so the tab is complete. The
   alpha page was read-only and the fix lived elsewhere; joined here.
7. **Create User** — **not rebuilt.** Replaced by *Invite by email*:
   role student or admin, optional product, a set-password link, the
   profile finished by the invitee (the `?complete=1` path); admin
   invites type-to-confirm. `must_change_password` and `username` are
   dropped. Sam's reasoning: a user created without a subscription is
   just a trial student, which registration already makes; the real gap
   is acting on someone who has no account, and the pay-first setup
   flow already solves that shape. → §8 S9.
8. **Last login** — written on every successful login, shown in the
   drawer, a dormant filter on the Users list as the first use; Sam:
   "there are many ways we can use it".
9. **Expiry reminders** — a daily pg_cron job knocking on an app route
   (MyNclex's doorbell pattern: `db/migrations/20260909120000_email_drain_cron.sql`,
   `app/cron/email-drain/route.ts`, a `CRON_SECRET`), the email through
   Resend, a status line on the admin dashboard. **No run-now button** —
   alpha's existed because a Sheets trigger gave no other proof it had
   run. Written against S8's course-level expiry, or adjusted when S8
   lands. The same clock carries D29's retention job later.
10. **Take over the Supabase-sent emails** (added by Sam after the
    email review, 2026-09-18). The gamma project is shared with MyTeacher
    and the legacy site, and Supabase's templates and sender are per
    *project*, so no app on it can brand them and every app shares the
    built-in sender's hourly limit. Each app therefore mints its own
    links through the service role (`auth.admin.generateLink`: magic
    link, recovery, signup confirmation once D27 turns it on, and item
    7's invite), wraps them in its own template, and sends through its
    own Resend key. **Through an outbox, not directly**, copied from
    MyNclex (`lib/email/outbox.ts`, `drain.ts`, `nclex_email_outbox`,
    `docs/product-plan/transactional-email.md`): one row per email with
    a fingerprint the database refuses to duplicate, the send attempted
    on the request's tail, a failure marked with a next-try time, a
    pg_cron doorbell retrying due rows in bounded batches, an admin
    emails page showing what is stuck with Retry. At Resend's cap the
    rows wait rather than vanish; paying for Resend at the peaks becomes
    a choice. The outbox and the doorbell are a shared mechanism built
    **before item 9** (the reminders need them) and before the link
    takeover. The dashboard still gets one visit: SMTP set to Resend as
    the fallback for anything Supabase still sends, neutral Quademia
    wording on its templates. Resend's cap is per account, shared with
    MyNclex — its notes already argue for one sending subdomain for
    every product, split by risk.

D25, D26 and D27 were not among the nine (holes, not intentions);
items 2, 3 and 7 lean on them and they are recommended first → §8 S10,
**ticked by Sam the same day** with the lowercased unique email copy.

---

## D24 — The login and reset functions answer to anyone holding the public key

**What.** `log_auth_event`, `check_login_rate_limit`,
`log_reset_request`, `check_reset_rate_limit` and `mark_reset_used` are
SECURITY DEFINER functions with the default `EXECUTE` grant to
`public`, so `anon` and `authenticated` can call them through PostgREST
(`POST /rest/v1/rpc/<name>`). Legacy needed that — the browser was the
caller (`legacy/mynmclicensure/login.html:283-436`,
`forgot-password.html:82-136`). The port moved every caller to the
server (`lib/auth/events.ts`) and left the grant. Proven on dev
2026-09-18: a plain HTTP call with only the anon key to
`check_login_rate_limit` and `check_reset_rate_limit` returned
`{"allowed": true}` (HTTP 200); the same call to
`check_payment_rate_limit`, which slice 9 revoked, returned 401.
`has_function_privilege('anon', …, 'execute')` is true for all five and
false for the payments one.

**Where.** `db/migrations/20260911010000_auth_tables.sql` (no
`revoke execute` line; contrast `20260915120000_payments.sql:107`).

**Who it reaches.** Every student, after launch. Ten fake `LOGIN_FAIL`
rows for any email through `log_auth_event` lock that student out of
password login for 24 hours (the limiter's own rule); three fake
`EMAIL_SENT` rows through `log_reset_request` block their password
reset for an hour; `mark_reset_used` marks any email's reset used; the
two `check_*` calls tell a caller whether an email is currently locked.
Legacy had the same hole and could not close it (the browser had to
call them); the new stack has no browser caller, so closing it is free.

**Proposed fix.** One migration: `revoke execute on function <each of
the five> from public, anon, authenticated;` — the payments migration's
line, five times. `auth_user_role()`, `auth_user_id()` and
`user_has_course()` stay executable: the policies call them as the
querying role. No code change.

**Status.** → queued 2026-09-18 (Sam, auth read-back item 2): the
revoke, plus the limiter counting by IP again. `rebuild.md` §8 S9.

---

## D25 — A student can rewrite their own email, programme and setup columns from the browser

**What.** The `users_update` policy's `WITH CHECK` locks `role`,
`active`, `user_id` and `auth_id` (§9 #15 closed the role hole and
stopped there). Every other column is writable by the row's owner with
their own JWT and the anon key, bypassing every Server Action. Proven
on dev 2026-09-18 as a student's own claims (rolled back): one
`UPDATE` set `email`, `program_id`, `signup_source`,
`must_change_password`, `last_login_utc` and `cohort` and succeeded;
`role = 'ADMIN'` was refused. The `users_insert` policy has the same
shape (`auth.uid() = auth_id and role = 'STUDENT'`, any other value),
so a Google sign-in with no profile can insert a row with any values,
skipping registration's validation.

**The chain that matters.** The pay-first checkout finds the payer by
email when nobody is signed in: `payments.user_id` is null
(`lib/payments/init-public.ts:62`) and `findPaymentUser` falls through
to `getUserByEmail` (`lib/payments/queries.ts:57-64`), then
`activateOrRequireSetup` activates the paid subscription on the row it
finds (`lib/payments/verify.ts:125-137`). A student who sets their
`users.email` to a victim's address receives the victim's paid
subscription the moment the victim pays.

**Where.** `db/migrations/20260911010000_auth_tables.sql` (the
`users_update` / `users_insert` policies); the table-wide `UPDATE` and
`INSERT` grants to `anon` and `authenticated` on `users` (D21's
observation, now with a consequence).

**Who it reaches.** A real payer, after launch; and any student's own
record (the email their receipts go to, the programme that orders their
shop under D23).

**Proposed fix.** Column-level: `revoke update (email, program_id,
signup_source, must_change_password, created_utc, last_login_utc,
username, role, active, user_id, auth_id) on users from authenticated;`
and the same on insert for the columns registration sets on the
server. The profile page's fields (`forename`, `surname`, `name`,
`phone_number`, `avatar_url`, `level`, `cohort`, `school_id`,
`school_other`) stay writable by the owner. The admin's Deactivate
(`lib/users/actions.ts:42`, which updates `active` as the signed-in
admin) moves to the service role behind `requireAdmin()` — the
database-as-gate direction of D10. Check before building: no other
admin path updates a frozen column as the user client (grep
`from('users').update`).

**Status.** → queued 2026-09-18 (Sam): §8 S10 ticked — the column-level
revoke and the service-role paths as proposed.

---

## D26 — `users.email` is a loose copy of the login email, with a case problem

**What.** `users.email` is stored as typed at registration
(`app/register/actions.ts:33` trims, does not lowercase); Supabase Auth
lowercases its own copy. Nothing ties the two (no unique index, no
lowercase rule, no FK-like check — only `auth_id` is constrained), and
D25 lets the owner change it. The payment lookup lowercases the paid
email and matches exactly (`lib/payments/queries.ts:45,62`).

**Where.** `db/migrations/20260911010000_auth_tables.sql` (`users`:
`email text not null`, no index); `app/register/actions.ts:33,84`;
`lib/payments/queries.ts:44-47`.

**Who it reaches.** A real payer whose address has capitals: registered
as `Ama@Gmail.com`, paying later with the same address, is not found,
is sent to create a second account, and that fails on Supabase's
"already registered". Dev's four rows happen to match (0 mismatches,
checked case-sensitively and not).

**Proposed fix.** Lowercase on every write (registration, the payment
setup) and a unique index on `lower(email)`; or stop keeping the copy
and read the email from Auth (`auth.users` via `auth_id`) — one source.
Either way the lookup in payments stops depending on how a student
typed their address months earlier.

**Status.** → queued 2026-09-18 (Sam): the lowercased unique copy.
Reading from Auth rejected — about fifteen readers would each gain a
join for no gain once the copy is trustworthy. §8 S10.

---

## D27 — Registration depends on a Supabase dashboard setting nobody has recorded

**What.** Registration inserts the profile row *as the new user* under
the `users_insert` policy (`app/register/actions.ts:79-96`). That needs
`signUp` to hand back a session, which happens only when the project's
"Confirm email" setting is off. Dev has it off (0 of 4 auth users
unconfirmed; every registration in the walks worked). If prod's setting
differs, every registration fails at step 2 and rolls back with
"Account created but profile setup failed. Please contact support."

**Where.** `app/register/actions.ts:70-106`; the Supabase Auth
settings, which the legacy-check BUILD_LIST line already says are
recorded nowhere.

**Who it reaches.** Every new student, if the setting is wrong on the
day; nobody while it is right.

**Proposed fix.** Insert the profile with the service role after the
validated sign-up (the action has already checked every field; the
policy adds nothing here), so the setting cannot break registration;
and record the setting with the other Auth dashboard values already
queued. Pairs with D25's insert revoke: once the browser role cannot
insert a profile, the server has to.

**Status.** → queued 2026-09-18 (Sam): §8 S10 ticked, with D25.

---

## D28 — Six trips before a protected page renders

**What.** For one request to `/student/...`: the middleware calls
`getUser()` (a round trip to the auth server, `middleware.ts:58`); the
`(app)` layout calls it again (`app/(app)/layout.tsx:19`); the gate
calls it a third time (`lib/access/internal.ts:36`); then the profile
read (`:39`), then the session read (`:43`), then the fire-and-forget
`last_seen_utc` touch. Three of the six are the same question. The
middleware also asks the auth server for every anonymous visit to the
landing page and the sales pages (the matcher excludes only static
files). `loadGate` is cached per request, so the count does not grow
with callers — but it starts at six. This is the BUILD_LIST line "§8
has no auth-path entry", now counted.

**Where.** `middleware.ts:26-84`, `app/(app)/layout.tsx:15-21`,
`lib/access/internal.ts:31-47`.

**Who it reaches.** Every user, as latency on every page (the perf
investigation measured the gate at 3× the page's own queries).

**Proposed fix.** `getClaims()` (a local JWT check, no network) in the
middleware and the layout — or drop the layout's own check, since every
page under it calls a gate — and one `getUser()` in the gate. Code
only; no shape change. A §8 row if Sam wants the auth path treated as a
shape.

**Status.** Open. Not approved, not queued. Code only; not among the
nine intentions — Sam's call when the auth path is next touched.

---

## D29 — The audit tables are write-only, and the one column that should be written is not

**What.** Nothing reads `sessions`, `auth_events` or `reset_requests`
except the limiter (the last 24 h of `auth_events`) and the gate (the
current `sessions` row). No admin page, no retention rule; the legacy
schema's own comment says "TODO: add pg_cron cleanup job when user base
grows". Dev after one week: 44 session rows for 4 users (4 live), 52
auth events, 3 reset requests. `users.last_login_utc` — the column
alpha wrote on every login — is written by nothing; `createLoginSession`
(`lib/auth/sessions.ts:33`) is the one place it belongs. The full
column list is in the trace above.

**Where.** `lib/auth/sessions.ts`, `lib/auth/events.ts`; the trace.

**Who it reaches.** Nobody as a defect; every support conversation as
an absence — "someone is using my account" has no page to look at and
no Revoke.

**Proposed fix.** Two decisions, both Sam's: (1) whether the four alpha
admin surfaces come back (the trace's closing paragraph); (2) a
retention rule for `sessions` and `auth_events` (a scheduled delete of
inactive rows older than N days) once the tables have a reader. Either
way, one line writes `last_login_utc` at login.

**Status.** → queued 2026-09-18 (Sam, items 4, 5, 6 and 8): the admin
security page — sessions with Revoke, login events, reset requests with
actions — and `last_login_utc` written and shown. Retention still open;
MyNclex's nightly pg_cron purge (`nclex_purge_auth_events`, window
from a config value) is the shape, on item 9's clock.

---

## D30 — The rate limits fail open

**What.** `checkLoginRateLimit` and `checkResetRateLimit` return
"allowed" on any error (`lib/auth/events.ts:83-85,100-102`), so a
database hiccup during login switches the limiter off. Carried
deliberately in the port as legacy's policy (§9 #7: "availability over
lockout"); the port's like-for-like rule is over, so it is a finding
now.

**Where.** `lib/auth/events.ts:68-103`; `app/login/actions.ts:48`;
`app/forgot-password/actions.ts:33`.

**Who it reaches.** Nobody while the database answers; during an
outage, the login form is briefly unlimited.

**Proposed fix.** Fail closed on the *check* (refuse the login with the
generic "try again" message when the check itself errors), keep the
*logging* fail-open so a logging failure never blocks a login. Two
`catch` blocks.

**Status.** → queued 2026-09-18 (Sam, item 3): fail closed on the
check, logging stays fail-open.

---

## What came out clean in the auth sweep

Recorded so the next reader does not re-check it. The student pages
pass a picked list of profile columns to the browser, never the row
(`app/(app)/student/profile/page.tsx:42-54`, `upgrade/page.tsx:37-43`).
`auth_events`, `reset_requests` and `rate_limits` have RLS on and zero
policies: the browser roles see zero rows despite the table-wide
grants. `sessions_select` is own-rows-or-admin. The admin Users drawer
sends the whole row including `auth_id` (`lib/users/queries.ts:44-48`),
which is admin-only and fine. `sessions` has the indexes the gate and
the cap need. The kicked-device sign-out mid-quiz is the legacy check's
gap 6 and is not repeated here.

---

## The payments group — where the table and the flow came from (traced 2026-09-18)

The table-by-table sweep run over `payments` and `rate_limits` with
every caller read (`lib/payments/*`, the five payment pages, the
subscriptions policies), plus the page-by-page cut of what the
checkout, confirmation, upgrade and admin pages hand the browser. Sam's
rulings on D31–D36 were taken one at a time on 2026-09-18 and sit in
each finding's Status line; the BUILD_LIST lines followed the same day.

**Three eras.**

- **Alpha.** No payments sheet is in this repo's history, but the
  activation route is (`auth_actions_admin.gs` `apiPaymentsActivate`,
  git `40f2930^`). The order was **account first, then pay**:
  `apiSelfRegisterPaid` created the student with their chosen password
  and no trial and handed the ids to a separate Payments web app; after
  Paystack, that app called `payments_activate` server-to-server with a
  shared secret (`PORTAL_PAYMENTS_SECRET`). The route was idempotent on
  the Paystack reference (a pipe-delimited list of references on the
  subscription row so a retry could never double-grant), took a
  `LockService` lock against two calls landing together, and extended
  or created the subscription with the "Access active" / "Access
  updated" email. **Open question for Sam:** whether the Payments web
  app was driven by Paystack's webhook or by the payer's browser
  returning — the app itself is not in this repo.
- **Gamma, from 2026-03-17.** The payment Worker (`payments-worker/`,
  later `mynmclicensure/workers/payment-worker/`), with `init-public`
  and `verify` from the first commit (`2963741`), then `init-upgrade`,
  `setup-complete` and the four admin subscription routes. The order
  was **inverted: pay first, then set up the account.** That inversion
  created the nineteen-column `payments` table, the setup token and its
  48-hour clock, "Retry Activation then Copy Setup Link" (doc 01), the
  token re-minted on every verify, the confirmation page polling
  verify, and the lookup of the payer by email. **No Worker version
  ever had a webhook** (`git log -S'webhook'` over every Worker path is
  empty); the "webhook" in the 2026-04-17 smoke-test log was the
  browser return. Doc 01's security section lists CORS and the
  Cloudflare rate-limit binding, both Worker artefacts.
- **The port (slice 9, 2026-09-15).** Transcribed exactly (rebuild.md
  §7.1): the routes became four Server Actions, the binding became the
  `rate_limits` counter behind a revoked function, the columns gained
  the S4 keys. Every write is the service role's; only an ADMIN reads
  rows; no INSERT or UPDATE policy exists on purpose. Dev holds no
  payment rows today (cleared 2026-09-15); prod holds the September
  test rows and its 21 paid products archived.

**What is sound.** The Paystack key never leaves the server
(`lib/payments/paystack.ts:29-33`). The price comes from the product
row (`init-public.ts:45,65`), never the browser. Verify compares the
paid amount to the expected one and marks a mismatch FAILED for good
(`verify.ts:100-108`). A reference can only ever produce one
subscription (`activate.ts:29-39`). Students cannot read or write
payment rows (`payments_select` ADMIN only, no write policy). The setup
form posts as FormData so the payer's password never reaches the dev
log (`setup-complete.ts:31-35`). A half-made login is rolled back
(`:187-194`). `check_payment_rate_limit` is the one function correctly
revoked from the browser roles. The sales pages receive only the
products list and the programmes; the upgrade page only the student's
own subscriptions; the admin page is gated and paginated.

---

## D31 — Pay-first is the root of every carried payments question, and alpha had it the other way

**What.** The account is created *after* the money
(`lib/payments/setup-complete.ts`). Everything awkward on this table
follows from that one order: the setup token and its 48-hour clock;
the token re-minted on every verify (§9 #20); a reference that must
serve as the only secret (§9 #21); the confirmation page polling verify
against the limiter (§9 #22); the payer found by email, which is D25's
capture chain (`queries.ts:57-64`, `verify.ts:126`); no school,
referral or trial captured on a paid account; the admin rescue
sequence; and the payer who pays and never returns, whose money sits at
PAID with no account until someone acts. The alpha created the account
first and activated server-to-server against a known user id.

**Where.** `lib/payments/verify.ts:124-160`, `setup-complete.ts`,
`app/payment-confirmation/confirmation-client.tsx`; doc 01 "Flow A".

**Who it reaches.** Every new payer: a second form after paying, a
link that can expire, a support conversation when it does.

**Proposed fix.** Account first — or at least email and password
before the redirect to Paystack. The subscribe and Premium Prep pages
create the login and the profile (the server-side insert of D27), then
start the payment with `user_id` set, exactly as the upgrade page does
today. The setup token, `setup_created_utc`, `setup_completed_utc` and
the rescue sequence disappear; the confirmation page only shows status;
activation lands on a known user id; the auth work's *Invite by email*
becomes the same flow with a product attached. Question for Sam first:
was pay-first a deliberate product choice in gamma (less friction
before the money), or a side effect of the Worker design?

**Status.** Ruled (Sam, 2026-09-18). **Pay-first stays; it was a
product decision, not a Worker side effect.** Sam's reason: a buyer
loses interest in the first minutes, so an account form before the
money loses customers, while a buyer who has paid finishes whatever
comes after because the money is already committed. Account-first
(the proposed fix above) is rejected. What changes under pay-first:
the moment verify sees PAID, the **server creates the account** from
the email, phone and programme already on the row (the D27
service-role insert), activates the subscription on that user id, and
queues a set-password email through the outbox (the same one-time
link as *Invite by email*). The confirmation page keeps its shape; its
form shrinks from the whole profile to a password; name and surname
move to the profile page, which already asks for them. The setup
token, `setup_created_utc`, `setup_completed_utc` and the admin rescue
sequence go; the rescue becomes "resend the link". An email that
already has a login gets the subscription added to it, as today, made
safe by S10. Money never sits at PAID with no account. Alpha's
Payments web app **was webhook-driven** (Sam) — recorded for D4, which
now matters more: without a webhook the server learns of a payment
only when a browser or an admin asks. Queued in BUILD_LIST.

---

## D32 — The payment row stores Paystack's whole reply, forever, and shows it to admins

**What.** `verify` writes the entire verify reply into `payments.raw`
(`lib/payments/verify.ts:105,115`), and `init` the entire initialize
reply (`init-public.ts:99`). Checked against Paystack's published
OpenAPI spec (`PaystackHQ/openapi`, `dist/paystack.yaml`) and the
transaction docs on 2026-09-18: the verify reply's `authorization`
object carries `last4`, `bin`, `card_type`, `bank`, `brand`,
`exp_month` / `exp_year`, `channel`, `reusable` and
`authorization_code`; `customer` carries `customer_code`, `email`,
`phone`; the transaction carries `ip_address`. **A reusable
authorization code plus the secret key can charge that card again**
(Paystack's charge-authorization endpoint). Nothing in the app reads
any of these fields. The admin Payments panel has a "Show raw payload"
toggle that prints the lot (`payments-client.tsx:435-441`). Rows are
never deleted.

**Where.** `lib/payments/verify.ts`, `init-public.ts`,
`init-upgrade.ts:98`, `app/(app)/admin/payments/payments-client.tsx`.

**Who it reaches.** Every payer after launch — card details and a
re-charge token retained indefinitely, readable by any admin, and part
of whatever a database leak would carry.

**Proposed fix.** Keep what the app reads: the gateway's transaction
id and reference, status, amount, currency, channel, paid time,
customer email. Strip `authorization` (or keep only `channel`,
`card_type`, `last4` if the admin needs to recognise a card — never
`authorization_code`, `bin`, `signature`) and `ip_address` before
writing. Drop the raw toggle or point it at the stripped copy. A
one-time scrub of existing rows on both projects at build time.

**Status.** Ruled (Sam, 2026-09-18): **strip before saving, keeping
three card fields.** Kept: the gateway transaction id and the
reference, status, amount, currency, channel, paid time, the
customer's email, and for an admin to recognise a payment in a
support conversation `channel`, `card_type` and `last4` only. Dropped
before the write: the rest of `authorization` (`authorization_code`,
`bin`, `exp_month`, `exp_year`, `bank`, `brand`, `signature`,
`reusable`), `ip_address`, and the same trim on the init reply. The
raw toggle stays and shows the stripped copy (legacy had the toggle).
A one-time scrub of the rows already on dev and prod when it is
built. Early in the build order — it reaches every payer from day one
and is one trim function plus the scrub. Queued in BUILD_LIST.
**Built 2026-09-19** (Claude): `lib/payments/trim.ts` allow-lists both
replies; verify's two raw writes and both init steps use it; the scrub
is `20260919150000_payments_raw_scrub.sql`, applied on dev (zero rows
there), prod at the next release. Proven with a full Paystack-shaped
reply: none of nineteen sensitive tokens survive the trim.

---

## D33 — The reference alone unlocks the payer's personal data and the setup token

**What.** `verify` has no session by design (§9 #21). To any caller
holding a reference it answers, with no other check: the payer's
email, phone and programme and the current setup token on a
SETUP_REQUIRED row (`verify.ts:146-159`), or the subscription id on an
ACTIVATED one. The reference is `QAC_` + 12 hex, and it travels in
Paystack's return address, the payer's Paystack receipt, the admin's
copied link, and the browser's localStorage
(`confirmation-client.tsx:106-125`). The page also accepts `trxref`,
`ref` and a remembered reference.

**Where.** `lib/payments/verify.ts:124-160`;
`app/payment-confirmation/confirmation-client.tsx:105-125`.

**Who it reaches.** A payer whose reference leaks before setup — the
holder can read their details and create the account on their paid
email (§9 #21's case), and can read email and phone off any reference
at any time.

**Proposed fix.** Folds into D31: with account-first there is no token
to hand out, and verify to an unauthenticated caller returns status
only. If pay-first stays: verify returns status and nothing else
unless the caller proves the token (or is signed in as the row's
user), and the setup form is pre-filled from the browser's own storage
rather than the reply.

**Status.** Ruled (Sam, 2026-09-18): **same browser, with the emailed
link as the fallback.** Under D31 there is no setup token; the account
exists at PAID and only the password is missing. Init sets a private
HttpOnly cookie in the buyer's browser, a random secret tied to the
reference, that never appears in an address, a receipt or a link.
When Paystack returns the browser to the confirmation page the cookie
comes with it; verify matching it to the row shows the password form
and sets the password on the just-created account. A browser without
the cookie (a leaked reference, a second device) gets the status and
"we have emailed you a link to set your password" — the outbox link
from D31 covers the phone-to-laptop case. Verify returns status and
the product name to any caller and nothing personal to anyone; the
page still accepts the reference from the address and its stored copy,
because the reference alone now yields status only. Emailed-link-only
rejected: it sends every buyer to their inbox at the moment they are
readiest to finish. Queued with D31 in BUILD_LIST.

---

## D34 — Abandoned INIT rows pile up forever, and anyone can make them

**What.** `init-public` inserts a payments row and creates a Paystack
transaction on every call (`init-public.ts:58-97`), five a minute per
address, for any email, with no session. Nothing expires or clears an
INIT row: an abandoned checkout, a probe, or a bot each leave one, and
the admin page's INIT counter and the Load More list grow with them
(`admin-queries.ts:79-96`). Legacy behaved the same; the gamma prod
rows show it.

**Where.** `lib/payments/init-public.ts`; no cleanup anywhere;
`admin-queries.ts`.

**Who it reaches.** The admin, as noise that hides real stuck rows;
Paystack's transaction count.

**Proposed fix.** A nightly job on the pg_cron clock (auth item 9's)
marks INIT rows older than N days ABANDONED (a new terminal status the
counters exclude) — never deletes, so a late Paystack success can still
be matched by reference. With D31, init happens only for a known user,
which removes the anonymous-probe half.

**Status.** Ruled (Sam, 2026-09-18): **a nightly sweep that asks
Paystack, never guesses by age, never deletes.** Sam's question first:
the statuses were meant as a checklist of how far a payment got so an
admin can rescue a stuck one (doc 01); as a "started but did not
finish" signal the INIT counter is not done right — it sums a buyer on
the Paystack screen now, a tab closed in March and a script's two
hundred clicks, and it hides the one row that matters, a payment whose
browser never returned. The ruling: a job on the pg_cron clock (auth
item 9's, D29's) takes every INIT row older than a staleness age read
from `config` (about an hour) and verifies it with Paystack. Paid →
the normal activation path (account created, link queued, as D31);
abandoned or failed → **ABANDONED**, a new terminal status the
counters and the default list leave out; still pending → left alone.
What remains at INIT is genuinely in progress, so the admin gets three
honest numbers: in progress, abandoned, paid. The sweep also covers
most of D4 — a payment the browser never reported is caught within a
day. Under D31 `SETUP_REQUIRED` goes, so the statuses become INIT,
PAID, ACTIVATED, FAILED, ABANDONED. Pay-first keeps init sessionless
(D31), so the anonymous half stays and is answered by the sweep, not
by a gate. Queued in BUILD_LIST.

---

## D35 — One rate-limit bucket per address for all four payment routes

**What.** `checkPaymentRateLimit` keys on `payments:<ip>` for init,
upgrade, verify and setup alike (`lib/payments/rate-limit.ts:28`), five
per sixty seconds. The confirmation page's own poll spends it: four
verify calls, then "Too many requests" on a pending mobile-money
payment (§9 #22, seen in the 9a walk). A school computer lab or a
campus behind one address gets five payment actions a minute for the
whole room. The check also fails open (D30's twin).

**Where.** `lib/payments/rate-limit.ts`; `verify.ts:39`;
`init-public.ts:29`; `setup-complete.ts:57`; `VERIFY_POLL_MS` /
`VERIFY_MAX_POLLS` in `types.ts:20-21`.

**Who it reaches.** Any payer whose mobile-money prompt takes more than
twelve seconds; any shared address.

**Proposed fix.** Key verify on the reference (a poll is one payer,
one reference), init and setup per route per address, and let the
confirmation page poll without counting. Fail closed on error as D30.

**Status.** Ruled (Sam, 2026-09-18): **as proposed.** One tally per
action — init and the password step each per address on their own
key; verify counted per reference, not per address, so one buyer's
watching never locks out another on the same connection, and the
confirmation page's own poll is not counted (a poll is one payer
watching one payment); the check fails closed with a clear message
when the counter cannot be read, as D30. Removes §9 #22 outright.
Sam's follow-up question on the same day — when the `rate_limits`
table was introduced and whether he was asked: built in slice 9a
(2026-09-15) from rebuild.md §7.1, written in the 2026-09-10 planning
session, as the plain replacement for gamma's Cloudflare rate-limit
binding, which does not exist under OpenNext; not a §8 row because it
changed no legacy data shape; not asked again at build. Queued in
BUILD_LIST.

---

## D36 — Currency is never checked at verify

**What.** Verify compares `amount` to `amount_minor_expected` and
nothing else (`lib/payments/verify.ts:100`). The reply's `currency` is
not compared to the row's. Every product is GHS today (checked on dev:
one currency), so it cannot bite yet; the day a second currency exists,
an equal minor amount in the wrong currency passes.

**Where.** `lib/payments/verify.ts:83-108`.

**Who it reaches.** Nobody today.

**Proposed fix.** One comparison beside the amount check, FAILED with
a note on mismatch, when the row is next touched (D32 or D31).

**Status.** Ruled (Sam, 2026-09-18): **add the check now, as a rider
on D32.** One comparison beside the amount check; a mismatch is
FAILED with a note, as an amount mismatch is. Queued with D32 in
BUILD_LIST. **Built 2026-09-19** with D32: `currency_mismatch` beside
`amount_mismatch` in `lib/payments/verify.ts`, named on the
confirmation page.

---

## The messaging group — where the two tables came from (traced 2026-09-18)

The table-by-table sweep run over `messages_threads` and `messages`
with every caller read (`lib/messaging/*`, both messages pages, both
layouts' badges, the runner's Send feedback), the live shape and
policies read off dev, three policy tests run as a dev student with
their own credential (all rolled back), and the page-by-page cut of
what the two pages hand the browser. Sam's rulings are pending;
nothing here is decided.

**Three eras.**

- **Alpha.** Messaging is alpha-native. The two tables are the two
  sheet tabs `threads` and `messages` of the portal workbook (git
  `40f2930^`, `old stack references for claude/licensure/messages/`),
  column for column: `thread_id, user_id, status, context_type,
  bulk_batch_id, course_id, quiz_id, attempt_id, question_id, ref_text,
  created_at, last_message_at, last_sender` and `message_id, thread_id,
  sender_type, sender_id, body_text, created_at, read_by_user,
  read_by_admin`. The `THR_` / `MSG_` / `BULK_` text ids, the two read
  booleans and `ref_text` as a pre-rendered blob are a spreadsheet's
  shape. The service was a token-verified Apps Script API
  (`PortalMessaging`, build `msg-v1-2025-12-18`): every student call
  re-verified the token and the account's `active` flag; admin calls
  checked `is_admin`. It carried **five protections**: a 2000-character
  message cap, a send limit of 20 a minute per student and 60 per admin,
  a bulk-send limit of 5 per ten minutes, a **200-recipient cap** on a
  bulk send, and paged lists (50 threads, 300 messages per open). The
  entry points were the same three as today — the Messages page, the
  course page, both runners' Send feedback — and `admin1` appears as a
  literal on alpha's thread rows, which is where the column default
  comes from. A fourth context, `admin_bulk`, was removed before gamma.
- **Gamma, 2026-03-20.** Built in one day (`b346237`, "feat: add
  MyLicensure messaging system"; the README had it as "Telegram
  (planned)" until then). Two renames (`sender_type` → `sender_role`,
  `last_sender` → `last_sender_role`), two additions (`admin_id`
  defaulting to `'admin1'`, `subject`), no indexes, no foreign keys —
  `legacy/db/schema.sql` was reverse-engineered from the live database
  on 2026-04-01 (`522b974`), so it records what the sheet-shaped tables
  had. **The trust boundary moved to the browser:** every read and
  write became the anon key against Postgres under RLS, and every one
  of alpha's five protections was dropped; the only cap left was an
  800-character constant in the student page's script. The tables ran
  **twelve days with `dev_allow_all`** before RLS landed (`d0e30b2`,
  2026-04-01), and the thread INSERT policy then lacked the admin
  bypass, so admin-started threads and Bulk Send **never once
  succeeded on the live site** until the June 2026 migration
  (`legacy/db/migrations/fix_messages_threads_insert_admin_bypass.sql`).
  Sprint 2 (April) moved the inbox filters and recipient resolution to
  the database but missed the student search, which still fetched
  every active user. Messaging never had a line in the gamma
  BUILD_LIST except "Search — courses, questions, messages" under
  ideas; doc 07 claims search by question text, which no era built.
- **The port (slice 12, 2026-09-15).** Legacy's columns and six
  policies transcribed; S4 keys added to `users`, `courses` and
  threads (`quiz_id`, `question_id`, `attempt_id` left bare — two quiz
  tables, eleven item tables); six indexes added; `messages` put in the
  realtime publication (Claude's recommendation, accepted); Bulk Send
  rewritten to write in 500-row batches instead of one student at a
  time (accepted); the student search paged to twenty on the server.
  Writes moved behind `requireStudent()` / `requireAdmin()` — but
  **every messaging statement still runs as the user's own client
  under RLS**; no messaging code uses the service role. Alpha's caps
  were not reinstated: the 800-character check exists on the student
  action only, the admin reply is unbounded, nothing limits sends or
  recipients. Three legacy behaviours were carried knowingly and are
  recorded in the 12a/12b entry: the two disagreeing unread rules, a
  reply reopening a closed thread, and `bulk_batch_id` missing from a
  reused thread. Dev holds 8 threads and 12 messages from the walks.

**Proven on dev, 2026-09-18** (SQL as a dev student's own claims, each
in a transaction rolled back): a student can **insert a message into
their own thread with `sender_role = 'admin'`, any `sender_id`, and
`read_by_admin = true`** — a forged support reply; can **edit the
admin's replies** (`body_text`) and flip `read_by_admin`; can
**rewrite their own thread's `status`, `admin_id`, `context_type`,
`bulk_batch_id`, `last_sender_role`**. They **cannot** hand the thread
to another student (`user_id` rewrite refused — with no WITH CHECK,
Postgres applies USING to the new row too, so the code inventory's
claim that a thread can be re-owned is **false**), cannot open a
thread for another student (refused), cannot see any other student's
thread or message (0 rows), and the public key sees nothing (0 rows).
DELETE has no policy and is refused (read from the policies; the
delete test itself was blocked by the tooling).

**What is sound.** Isolation between students holds at the floor.
Every admin read and write sits behind `requireAdmin()`; every student
action re-reads the thread's ownership before writing
(`lib/messaging/actions.ts:111,146,166`). The admin's own inserts and
the student's own inserts hardcode the right `sender_role`, `sender_id`
and read flags. The ref text the runner builds carries the stem, the
options as shown and the student's answer, **never the correct
answer** (`components/runner/quiz-runner.tsx:640-674`). Bulk Send
writes in batches of 500 with the existing open threads read first.
Realtime subscribes under the SELECT policy, one channel per open
thread, and an admin reply reached an open student pane in ~6 s (12a
walk). The two pages pass the browser only the signed-in student's
own threads (student side) or, on the admin side, data an admin may
see. The schema and policy snapshots match the migration.

**Sam's rulings (2026-09-18), taken on the feature rather than finding
by finding.** Messaging is three jobs in one table, and only one fits:

1. **Keep the support desk.** Student-started threads in the general
   and course contexts, the admin replies and closes. Its value over
   the WhatsApp and Telegram links on the dashboard: the app knows who
   is writing, the conversation is on the record against the account,
   and the admin sees the student's courses and subscription beside
   the message. Rebuilt the server-writes way (D37's fix), small.
2. **Park Bulk Send.** Announcements already broadcast with the same
   targeting and more (`scope_programs, scope_courses, scope_level,
   scope_subscription_kind, scope_product_ids, scope_audience,
   scope_cohort, scope_user_ids`); New Thread covers the individual
   case; the group-with-private-replies case has no named example.
   A rarely used door is the one nobody watches — Bulk Send did nothing
   on the live site for three months and nobody noticed. "Keep it but
   rarely use it" was weighed and rejected: keeping it means paying
   for its cap, limiter door, chunking and batch id through the
   rebuild for a door expected to stay shut. The button and its code
   come out; both tables are empty on launch day; a ⏸ line in
   BUILD_LIST. If a reply-able broadcast is ever wanted, "allow
   replies" on an announcement is the smaller change.
3. **Split question feedback into its own feature.** A report about
   a question is not a conversation: it wants the question, the
   attempt, a reason from a short list (wrong answer, unclear wording,
   rationale wrong, typo), an optional note, the student's answer as
   the server saw it, and a status (new, reviewed, fixed, dismissed).
   In a thread it is a blob the admin cannot list by question, count,
   or mark fixed. The runner's Send feedback opens a small form; an
   admin Reports page groups by question with counts and a Mark fixed
   that reaches the bank page; the student sees the outcome in their
   history; an admin may open a support thread from a report if a
   conversation is needed. A new feature, Sam's go-ahead given for the
   queue; its design is written when it is picked.

Effect on the findings: D37, D39, D41, D42, D43 stand for the support
desk; D38 loses its recipient cap (Bulk Send parked) and keeps the
length cap and the send limit; D40's question context moves to the
reports feature, and what remains of it is the course check and the
link-opens-a-draft question. **The six decisions for the support desk
rebuild, ruled together (Sam, 2026-09-18, the recommendations as
given):** the server alone writes and a message is fixed once sent;
one length cap of **2000** characters on both sides, server and
database; a reply to a closed thread **reopens it with a visible line**
in the conversation; **two read timestamps on the thread** replace the
per-message flags, one rule for badge and dot, one query — the storage
change drafted as `rebuild.md` §8 **S11**; the course page link opens
a **New Thread draft** the student sends with a click; the
assigned-admin column is **dropped**. Question context columns leave
the thread with the reports feature; a `report_id` link is added when
that feature lands.

---

## D37 — The messaging policies say who may touch a row, not what they may write

**What.** All six policies test one thing: is the caller an ADMIN, or
does the thread belong to them. `messages_insert` never checks that
`sender_role` is `'student'` or that `sender_id` is the caller;
`messages_update` and `messages_threads_update` carry no WITH CHECK, so
any column of a row the student may see is theirs to set. Proven above:
a forged admin reply with a link in it, sitting in the student's own
thread marked read-by-admin (so it never lights the admin badge); the
admin's real replies rewritten; the thread's status flipped, its admin
reassigned, a `bulk_batch_id` invented. The app's own code never does
any of this — `actions.ts` writes the right values — but the app is
not the only caller of a table the browser roles hold `grant all` on.
Legacy had the same six policies (`legacy/db/rls.sql:430-507`); alpha
had none of this exposure because the browser never touched the sheet.

**Where.** `db/migrations/20260915150000_messaging.sql:73-105`;
`lib/messaging/actions.ts:116-135`.

**Who it reaches.** A student who wants a "support said so" screenshot
(a forged renewal notice, a forged answer confirmation); an admin
reading a thread whose replies were edited after the fact; the audit
value of the table, which is nil while any participant can rewrite it.
Nobody else's data is at risk — isolation holds.

**Proposed fix.** The S7 / S10 pattern: the Server Actions behind
`requireStudent()` and `requireAdmin()` write with the service role,
and INSERT and UPDATE on both tables are **revoked from `anon` and
`authenticated`**. Reads stay under the SELECT policies (realtime
needs them). The alternative — WITH CHECK clauses pinning
`sender_role`, `sender_id`, the read flags and the thread's frozen
columns — keeps browser writes and is a policy per column; the revoke
is one line per table and matches where the users row (S10) and the
attempts (S7) are going.

**Status.** Open. Not approved, not queued.

---

## D38 — Alpha's five protections were dropped by gamma and not restored by the port

**What.** Alpha capped a message at 2000 characters on the server,
limited sends to 20 a minute per student and 60 per admin, limited
bulk sends to 5 per ten minutes, refused a bulk send over **200
recipients**, and paged every list. Today: the student action refuses
over 800 characters (`MESSAGE_MAX_LEN`, `types.ts:18`); the admin
reply has **no cap at all** (`admin-actions.ts:119-126`); `body_text`
has no database constraint; nothing limits how many messages a student
sends or how many recipients a bulk send reaches — an empty scope is
every active student, and the only brake is the preview count the
admin must click through (`messages-client.tsx:509-516`).

**Where.** `lib/messaging/actions.ts:107`, `admin-actions.ts:119-126,
263-266, 280-380`; alpha `messaging script:27-35, 936, 976`.

**Who it reaches.** The admin inbox (a student can flood it at the
speed of the network); every student (a mistaken no-scope bulk send
reaches the whole roster, and a second click sends it again); the
table's size.

**Proposed fix.** The general limiter Sam queued on 2026-09-18 takes
the student send and the admin bulk send as two of its first doors,
numbers in `config`; one length check shared by both send actions
(alpha's 2000 or legacy's 800 — Sam's call), mirrored by a CHECK
constraint on `body_text`; a recipient cap on bulk send with the
number in `config`, refusing above it rather than warning.

**Status.** Open. Not approved, not queued.

---

## D39 — The admin inbox reads the whole table, and the failures are silent

**What.** `getAdminThreads` reads **every thread** with no limit, then
fetches the latest message for all of them in one `.in()` list
(`admin-queries.ts:63-84`); the unread badge reads every
`read_by_admin = false` row in the system on **every admin page**
(`:98`, `admin/layout.tsx:16`, and again on every `router.refresh()`
the messages client fires); the search pre-pass matches the whole
`users` table with no limit and no role filter (`:51-54`); the bulk
pickers read `level, cohort` off every active user (`:137-147`);
`resolveRecipients` passes the full recipient list to `.in()`
unchunked (`:167,178`) — where `bulkSendAction` itself chunks at 500 —
and **does not check the error** on either query, so a failed query
filters everyone out and the preview says 0. PostgREST's row cap and
the URL length turn each of these into a wrong number or an empty
list, never an error. Legacy's `getUnreadCountForAdmin` was the same
full scan on every admin page (`api.js:2575-2583`); alpha paged.

**Where.** `lib/messaging/admin-queries.ts`; `app/(app)/admin/layout.tsx`.
Overlaps the two Scale lines already in BUILD_LIST (Bulk Send / inbox
`.in()` lists; the Attempts page's 5,000-row slice).

**Who it reaches.** The admin, at a few thousand threads: a badge that
is too low, an inbox that comes back empty, a preview count of 0 for a
real population. Nobody today (8 threads on dev).

**Proposed fix.** Page the inbox on the server (a `range` with the
filters database-side, "Unread only" included); one count query for
the admin badge scoped to open threads; the search pre-pass limited
and role-filtered; recipient resolution chunked like the send and its
errors surfaced; the pickers from a distinct query, not every row.

**Status.** Open. Not approved, not queued.

---

## D40 — A student's thread is built from whatever the browser says, and a link builds one on arrival

**What.** `ensureThreadAction` takes `context_type`, `course_id`,
`quiz_id`, `question_id`, `attempt_id`, `subject` and up to **6000
characters** of `ref_text` from the client and checks only lengths
(`actions.ts:44-47, 52-53, 76-92`). A student can open a course
thread for a course they hold no access to (the key proves the course
exists, not the entitlement), attach **another student's**
`attempt_id` (no key, no check), and store any text as the "quoted
question". The Messages page's deep-link effect calls the action
**from the address bar with no click** (`messages-client.tsx:243-268`),
so any link of the form `/student/messages?item_id=…&ref=…` creates a
thread in the visiting student's account on page load. The runner
puts the whole ref text — the stem and every option — into that
address (`quiz-runner.tsx:676-687`), so the question text sits in
browser history and travels as a referrer. Legacy did all of this
(`api.js:2408-2450`; `student/messages.html:263-292`).

**Where.** `lib/messaging/actions.ts:49-98`;
`app/(app)/student/messages/messages-client.tsx:243-268`;
`components/runner/quiz-runner.tsx:676-687`.

**Who it reaches.** The admin, reading a thread whose context is
invented; the question bank, whose stems leave the app by address;
a student sent a crafted link, who finds a thread they never opened.

**Proposed fix.** The server builds the context: given an `item_id`
and `attempt_id`, it checks the attempt is the caller's, reads the
question and the student's answer itself and writes `ref_text` from
the same builder the runner uses; `course_id` checked against
`user_has_course()`. The runner passes ids only, never the text. The
deep link pre-fills a New Thread that the student sends with a click,
instead of creating on arrival — one change to the reuse rule's UX,
Sam's call.

**Status.** Open. Not approved, not queued.

---

## D41 — Two unread rules on the student side, and the admin badge counts closed threads

**What.** The sidebar badge counts distinct **open** threads holding
any message with `read_by_user = false`, sender not checked
(`queries.ts:62-77`); the dot on the thread list checks that the
**latest** message is an unread **admin** reply
(`messages-client.tsx:433`). So an admin reply on a closed thread
shows a dot but no badge; an older unread reply under a newer read
one counts in the badge with no dot. The admin badge counts every
`read_by_admin = false` message including closed threads (`:98`),
while the inbox's unread flag is computed over the filtered list only
(`:91`). Both carried from legacy on purpose (12a entry); alpha had
one rule — `message.unread.count` over open threads. The student badge
is also the slowest query on every student page (perf investigation,
35–200 ms, two serial reads).

**Where.** `lib/messaging/queries.ts:58-77`; `admin-queries.ts:91,98`;
`messages-client.tsx:433`.

**Who it reaches.** Every student and every admin, as a badge that
does not match the list under it.

**Proposed fix.** One rule, stated once: a thread is unread for a
party when it holds a message from the other party that party has not
read; open threads only for the badge, the same test for the dot. One
query for each badge (already a Speed line in BUILD_LIST).

**Status.** Open. Not approved, not queued.

---

## D42 — Residue and drift in the two tables

**What.** In one place, the small things the trace explains:
`admin_id` is the literal `'admin1'` on every student-opened thread
(`actions.ts:79`) — an alpha sheet value, now a column nothing reads;
`quiz_id` and `attempt_id` are write-only; the New Thread dialog's
"Ref text" field is collected and never sent
(`messages-client.tsx:371,769`; `admin-actions.ts:200`); no CHECK
constraint pins `status`, `context_type`, `sender_role` or
`last_sender_role` to their three-or-two values; a reply — student or
admin — sets `status = 'open'` and so **reopens a closed thread**
(`actions.ts:133`, `admin-actions.ts:113`; legacy `api.js:2477`);
`newThreadAction` reports "N threads created" when it reused N
(`admin-actions.ts:247`); a reused thread never records the
`bulk_batch_id`, so a batch cannot be reconstructed (12b walk);
`messages_threads` is not in the realtime publication, so a close or
reopen never reaches an open student page (`migration:109-118`); the
student search and New Thread accept an admin as the recipient (no
role filter, `admin-queries.ts:109`; `admin-actions.ts:232`); the
student page receives `admin_id`, `bulk_batch_id` and `read_by_admin`
in its props (`select('*')`), harmless but unread by the UI;
`db/rls.sql` carries no `enable row level security` line for any
table after the catalogue slice, so the snapshot understates what the
migrations did.

**Who it reaches.** Mostly nobody today; the reopen-on-reply and the
wrong "created" count reach the admin.

**Proposed fix.** Sam's storage-hygiene rule — one at a time: drop or
write `admin_id`; CHECK constraints in the D37 migration; a reply to a
closed thread refused or reopened explicitly (product call); the
threads table into the publication; role filter on the recipient
search; a narrower select for the student page; the snapshot fixed.

**Status.** Open. Not approved, not queued.

---

## D43 — Every table in the schema grants the browser roles everything; RLS is the only gate (schema-wide)

**What.** Found here, true everywhere: the schema migration grants
`all on all tables` to `anon` and `authenticated` and sets the same
as the default privilege for tables created later
(`db/migrations/20260910120000_licensure_gh_schema.sql:29-39`).
Checked on dev: all 32 tables carry INSERT, UPDATE, DELETE,
TRUNCATE, REFERENCES and TRIGGER for both roles. A table with no
DELETE policy refuses deletes only because RLS defaults to deny;
TRUNCATE is not row-level and is not policed by RLS at all (not
reachable through PostgREST today, which exposes no TRUNCATE, but
reachable from any function or any future surface). Every finding of
the form "the policy lets a student write X" (D7, D25, D37) exists
because the grant is wide and the policy is the only narrowing. This
is Supabase's `public`-schema default copied into our schema.

**Where.** `db/migrations/20260910120000_licensure_gh_schema.sql:29-39`;
all later migrations rely on it.

**Who it reaches.** Nobody by itself; it is the floor under D7, D25
and D37 and every table the sweeps have not reached.

**Proposed fix.** Grant by need, not by default: SELECT to
`authenticated` where a policy exists; INSERT / UPDATE only on the
tables the browser must write (shrinking as S7, S10 and D37 land);
nothing to `anon` beyond the public catalogue reads; never DELETE,
TRUNCATE, REFERENCES or TRIGGER to either. One migration, table by
table, after the storage sweep finishes so the list is known once.

**Status.** Open. Not approved, not queued.

---

## The quiz and announcement group — where the four tables came from (traced 2026-09-18)

The table-by-table sweep run over `quizzes`, `mock_quizzes`,
`announcements` and `user_notice_state`, with every caller read
(`lib/quizzes/*`, `lib/announcements/*`, the attempt spawn path, both
student list pages, both admin pages, the announcements page, the
dashboard strip, the course page), the live shape and policies read
off dev, four policy tests run as a dev student with their own
credential (rolled back), and the page-by-page cut of what each page
hands the browser. Sam's rulings are pending; nothing here is decided.

**Three eras.**

- **Alpha.** *Fixed quizzes* are alpha's: the sheet tab `quizzes`
  (299 rows at `40f2930^`) carried `quiz_id, course_id, type, title,
  n, time_limit_sec, version, published, visibility, publish_at,
  unpublish_at, notes` — one row per mode (`GP-F-T0` timed, `GP-F-I0`
  instant), no item list (a quiz was "the first n of the course
  sheet"), `visibility` holding the literal `student`. *Mock exams did
  not exist.* *Announcements* existed as a separate Apps Script app:
  `announcements.list` returned the items **and the caller's states in
  one call**, `announcements.markseen` wrote `seen`; states were
  `seen` / `dismissed`; `priority >= 3` showed an Urgent pill; and the
  **course page asked the server for that course's announcements**
  (`sample course page:1696-1700`). No alpha admin page for any of
  this — the sheet was edited by hand.
- **Gamma.** Announcements and `user_notice_state` were born on the
  student dashboard on 2026-03-13 (`6eda562`, "Create dashboard.html")
  before any table or admin page; the table was written down in
  CLONING.md after the code that used it. Fixed quizzes reached
  `api.js` on 2026-03-16 (`e4a4d2e`); the item picker and `item_ids`
  are gamma's, `type` became `allowed_modes`, `version` went,
  `status`, `shuffle`, `created_at`, `updated_at` came. **Mock exams
  arrived whole on 2026-03-21** (`4e76ec5`) as a second table with the
  same shape plus `visibility` redefined to `ALL | PAID | TRIAL` — and
  never once set or read; `mock-exams-reference.md` (same day) says so
  twice. `seen` became `read`, `clicked` was added for the body
  button. **The course scope regressed:** gamma's browser filter
  never read `scope_courses`, and the course page filtered on a column
  that does not exist — doc 05 describes alpha. The admin form offered
  a `scheduled` status that never reached a student. No indexes, no
  keys on any of the four; every read and write was the browser's
  anon key under RLS; Sprint 2 narrowed the admin fixed-quiz list to
  eight columns, which is why Edit from that list came up empty. In
  the gamma BUILD_LIST: "DB transactions for quiz publish" and
  "Notifications — quiz published" deferred; the rename list omits
  `mock_quizzes`.
- **The port (5a/5b 2026-09-13/14, 11a/11b 2026-09-14).** Legacy's
  columns and policies transcribed; S4 keys to `courses` (both quiz
  tables) and `users` (notice state); indexes on `course_id`, `status`
  and the notice `(item_type, item_id)`; `quizzes` and `mock_quizzes`
  added to the §6.6 content copy, announcements not copied (D5). Four
  deliberate changes: §9 #18 (Scheduled leaves the dropdown), §9 #19
  (the course scope honoured — alpha's behaviour restored), scoping
  moved to the server, and **Start runs on the server and refuses** a
  non-ACTIVE quiz, an unoffered mode or a course without access where
  legacy greyed a button. The admin fixed-quiz Edit was made to load
  the whole row (a fix outside §9, **Sam's word still open**, 5a entry).
  Carried knowingly: `visibility`; archive ↔ active toggling a draft to
  active; the unenforced `min=60`; five announcement quirks (the strip's
  count not falling, the `<br>` per edit, …). Every statement still
  runs as the user's own client under RLS. Dev holds 5 quizzes, 2 mock
  exams, 3 announcements, 2 notice rows.

**Proven on dev, 2026-09-18** (SQL as an RN dev student holding GP,
RN_MED and RN_SURG, rolled back): the student **reads every quiz row of
every course** — GP, RN_MED, RN_SURG, RM_MID and RM_PED_OBS_HRN — and
**all 45 question ids of both mock exams**; reads the archived
announcement and the one scoped to programme RN whatever their scope;
can write **any words** into their own notice rows' `state` and
`item_type` and any `item_id`; **cannot** write a notice row for
another student (refused) or read another's (0 rows). Drafts are
admitted by the policies by construction; dev holds none to prove it
on.

**What is sound.** Start is the server's and refuses what the UI only
hid (5b's change). The question bodies are not in any of these
payloads — the runner fetches them at attempt time under
`user_has_course()`. Every admin write is gated and the two admin
pages validate course, title and question count. The course page's
announcements section renders on the server and hands the browser only
a sanitised body. Scoping runs on the server with the course scope
restored and the `scheduled` trap removed. Retake copies the attempt's
own item order, so a mock cannot be re-rolled for a better set. The
`(user, type, item)` unique row makes the notice upsert idempotent.

**Sam's ruling on the mock exams (2026-09-18) — intention first.**
Fixed quizzes and mock exams look the same because the mock's
intended experience was never built. Sam: mock exams were an idea
**specifically for premium members** — every year people sit the
licensure, and the mock was a way to engage and give more to the
premium group, ideally as a different experience. The gamma record
agrees three times: the reference doc ("time-limited quiz sets
published during exam periods", "a separate table with a separate
lifecycle"), `visibility = PAID` documented as "only paid subscribers
can see it — a future enhancement", and the gamma BUILD_LIST's
deferred "result release" and "notifications — results released".
So: **the two tables are not merged** (the merge into one table with a
`kind` was proposed and withdrawn — it would bake the accident in);
**`visibility` is kept, no longer as residue but as the flag for the
premium gate** (D48 amended); and **"Mock exams as a premium exam
experience" is a design item on BUILD_LIST**, to be designed when Sam
picks it — ingredients noted, none decided: premium-only through S8's
subscription kind; an exam window with one timed sitting, no retake,
no instant mode; results and review released together on a date
(S7's sealed attempt fits); standing against the cohort; notices
when it opens and when results land (outbox, announcements); a closed
window submits whatever is in progress (answers D45 (g) by design).
Until then both tables get the same floor fixes as they stand.

**Sam's four rulings on the rest of the group (2026-09-18), as
recommended:** the quiz floor (course-scoped reads of active, published
rows; `item_ids` and `notes` server-only) — D44; the lifecycle rules
(one availability check on the server's clock, archive one-way with
restore to draft, status words pinned, stats keyed by table, the mock
list paged) — D45, code beside the migration; the announcements
function `announcements_for_me()` with the table admin-only to read —
D46; three notice timestamps replacing the state word, with a key to
the announcement — D47. Drafted as `rebuild.md` §8 **S12**; one
BUILD_LIST line.

---

## D44 — Every signed-in user can read every quiz and mock exam, question ids included

**What.** `quizzes_select` and `mock_quizzes_select` are
`using (auth.uid() is not null)` (`20260913180000_quiz_tables.sql:76,
88`): any signed-in account reads every row of both tables — every
course, held or not, every status including draft and archived — with
`item_ids` (the exact question set) and `notes` ("Internal notes.
Students never see this."). The TypeScript layer filters by course
access, `published` and `status` (`lib/quizzes/queries.ts:26`;
`fixed-quizzes/page.tsx:32-43`), then hands the surviving rows whole
(`select('*')`) to a client component that renders neither `item_ids`
nor `notes` (`components/quizzes/student-quiz-list.tsx:39`). So a
student's own page also ships them every mock exam's question list
before the exam. Legacy was the same policy and the same `'*'`
(`legacy/db/rls.sql:801-840`; `api.js:815-829`); alpha's sheet had no
item list to leak. Contrast the eleven `items_*` tables, which **are**
gated per course by `user_has_course()`.

**Where.** `db/migrations/20260913180000_quiz_tables.sql:76-98`;
`lib/quizzes/queries.ts:19-34`; `app/(app)/student/fixed-quizzes/page.tsx:57`,
`mock-exams/page.tsx:57`.

**Who it reaches.** Every student, as the mock exam's question set
known in advance for any course they hold (the bodies then readable
through D8 until S7 lands, and through the runner regardless); a trial
student, as the full catalogue of every course's quiz definitions; the
admin, as notes meant for them alone.

**Proposed fix.** Two layers, like the bank. The floor: the SELECT
policies become `admin or (status = 'active' and published and
user_has_course(course_id))`; `item_ids` and `notes` leave the browser
roles' reach (a column-level revoke, or the student read through a
view that omits them — the D43 shape). The page: the student list
selects the columns it renders; the attempt spawn, already a Server
Action, reads `item_ids` with the service role. Drafts and archived
rows stop being readable by anyone but an admin.

**Status.** Open. Not approved, not queued.

---

## D45 — The quiz lifecycle has rules that disagree with each other

**What.** Small rules, each carried from legacy, that contradict one
another or the intent. (a) **Retake skips availability**:
`retakeAttempt` re-checks course access but not
`getQuizAvailability`, so a closed, archived or draft quiz can be
retaken by calling the action (`lib/attempts/actions.ts:320-350`
against `:269`). (b) **Two clocks**: the list pages compute
UPCOMING / CLOSED against the browser's clock
(`student-quiz-list.tsx:347,356`), the spawn against the server's;
a skewed phone shows a card Start refuses. (c) **Restore promotes a
draft**: archive ↔ active is a two-way toggle, so a draft that is
archived and restored becomes active without ever being published
by intent (`lib/quizzes/actions.ts:67-75`; legacy
`admin/fixed-quizzes.html:1050-1058`). (d) **`saveQuiz` never checks
`status` or `allowed_modes`** against their lists before writing, and
no CHECK constraint pins them (`actions.ts:80-126`), where
`saveAnnouncement` does check. (e) **The attempt stats box merges
tables**: `getQuizAttemptStats` filters `quiz_id` only, and a fixed
quiz and a mock exam are separate tables with independent text keys;
it also counts retake and abandoned rows in the total
(`lib/attempts/queries.ts:19-30`). (f) **The mock admin page loads the
whole table with `'*'`** and reports `mocks.length` as the total, so
past the API row cap the count silently caps (`admin/mock-exams/page.tsx:35`);
the fixed page pages fifty with an exact count. (g) An in-progress
attempt on a mock that closes is **orphaned**: Resume is disabled and
nothing finishes or abandons it (`mock-exams-reference.md:186-196`).
(h) The 5a fix that made admin Edit load the whole row is built and
**unruled** (5a entry).

**Where.** `lib/attempts/actions.ts`, `lib/attempts/queries.ts`,
`lib/quizzes/actions.ts`, `components/quizzes/student-quiz-list.tsx`,
`app/(app)/admin/mock-exams/page.tsx`.

**Who it reaches.** Students on a mock that closes mid-attempt (g),
students with a wrong phone clock (b); the admin, as stats that mix
two tables (e) and a total that caps (f); the rest reaches nobody
until someone calls an action by hand.

**Proposed fix.** One availability check shared by Start and Retake,
on the server's clock, with the list page taking `now` from the
server render; archive as one-way from any status, restore to
`draft`; CHECK constraints and the same validation in `saveQuiz` that
`saveAnnouncement` has; stats keyed by `(source, quiz_id)` with
retakes and abandons shown apart; the mock admin list paged like the
fixed one; a closed mock finishes its in-progress attempts by the
D34 clock (auto-submit as the timed runner does) or lets Resume
through for the attempt already begun — Sam's call; Sam's word on (h).

**Status.** Open. Not approved, not queued.

---

## D46 — Every signed-in user can read every announcement, scope fields included

**What.** `announcements_select` is `using (auth.uid() is not null)`
(`20260914220000_announcements.sql:67`): every signed-in account reads
every announcement — drafts, archived, and ones scoped to other
programmes, cohorts or **named students**. The scoping that decides
what a student should see is entirely TypeScript
(`lib/announcements/scoping.ts:18-55`); the query only narrows to
`status = 'active'` and the date window (`queries.ts:69-84`). The
rows that pass are handed to two client components whole, all eight
scope fields included — `scope_user_ids` carries other students'
user ids into every browser that qualifies for that announcement
(`student/announcements/page.tsx:33`; `dashboard/page.tsx:207`;
`components/announcements/announcements-strip.tsx:21`). The course
page is the exception: it renders on the server and hands the browser
only the sanitised body. Legacy's policy and `'*'` were the same;
alpha's server answered per course.

**Where.** `db/migrations/20260914220000_announcements.sql:67-81`;
`lib/announcements/queries.ts:69-84`; `scoping.ts`; the two client
components.

**Who it reaches.** Students, as other students' ids and the targeting
of every notice they see; the admin, whose drafts are readable before
they are published.

**Proposed fix.** Move the scoping to where the floor is: one
SECURITY DEFINER function, `announcements_for_me()`, that applies the
eight checks in SQL from the caller's profile and access and returns
only the columns the pages render (id, title, bodies, pinned,
dismissible, created_at, start/end). The three student pages call it
— one query instead of three reads plus a filter — and the SELECT
policy on the table itself becomes admin-only. `scope_user_ids` never
leaves the server. Alternative, smaller: keep the TS scoping and
project the columns at the boundary; the drafts stay readable at the
floor.

**Status.** Open. Not approved, not queued.

---

## D47 — The notice state is one overwritten row, so the counts it feeds are wrong

**What.** `user_notice_state` holds one row per `(user, type, item)`
whose `state` is overwritten on every write (`recordNoticeState`,
`lib/announcements/actions.ts:109-132`). A student who marks read and
then dismisses leaves one `dismissed` row, so the admin's engagement
counts report read 0 / dismissed 1 — the read is erased
(`getEngagementCounts`, `queries.ts:34-46`). `seen_at` is overwritten
too, so it records the last touch, not the first sighting, against its
name and its `default now()`; nothing reads it or `updated_at`. The
dashboard strip's ✕ writes `read`, not `dismissed`, while gated on
`dismissible` and titled Dismiss (`announcements-strip.tsx:34,62`), so
dismissals from the strip count as reads. `item_id` is checked only
for non-emptiness and has no key to `announcements`; `state` has no
CHECK — proven: any words into `state` and `item_type`, any `item_id`.
The strip's "N unread" does not fall when ✕ is pressed (legacy set it
once). All of it legacy's (`student/announcements.html:470-490`;
`dashboard.html:731-745`); alpha's `markseen` set `seen` once.

**Where.** `lib/announcements/actions.ts:109-132`, `queries.ts:34-46`;
`components/announcements/announcements-strip.tsx`;
`db/migrations/20260914220000_announcements.sql:51-62, 85-95`.

**Who it reaches.** The admin, as read / clicked / dismissed counts
that cannot be trusted; students, only as a strip count that lags.

**Proposed fix.** Columns, not a single state word: `read_at`,
`clicked_at`, `dismissed_at` on the row, each set once and never
cleared, so every count is a count of non-nulls and "dismissed after
reading" is both; a key from `item_id` to `announcements`; the strip's
✕ writes `dismissed_at`; the write through the server as it already
is, with `item_type` and the row's identity the server's alone (the
D43 shape). A §8 row if Sam agrees, since the columns change.

**Status.** Open. Not approved, not queued.

---

## D48 — Residue and drift across the four tables

**What.** `mock_quizzes.visibility` is alpha residue (`student`)
redefined by gamma (`ALL | PAID | TRIAL`) and never set or read in
three eras — ~~drop it~~ **kept as the flag for the premium gate the
mock exam was meant to have (Sam, 2026-09-18; the ruling above)**. `n` on `mock_quizzes` has no
default where `quizzes` has `0`. No CHECK constraint on any status
word across the four tables. `announcements` has no key to anything:
`scope_programs`, `scope_courses`, `scope_product_ids`, `scope_user_ids`
are loose arrays and `scope_level` is a comma-joined string
(`'L100,L300'`); `scope_audience` is nullable with a default; its
hottest read (active + window, ordered pinned, priority) has only a
`status` index. `body_html` and `body_text` are two copies of one
body; each edit reloads the stored HTML into the textarea and re-runs
the paragraph converter, adding a `<br>` per save
(`sanitise.ts:15-26`; `announcements-client.tsx:154`). The sanitiser
runs only in the browser (`document`-dependent), so the server never
validates a body. `getAnnouncementById` has no caller. Both admin
DELETE policies exist for a Delete no page offers. Doc 03 has no mock
exams; doc 05 describes alpha's course scope; `mock-exams-reference.md`
names files renamed in `57eeadc`. `db/schema.sql` and `db/rls.sql`
omit `announcements` and `user_notice_state` (BUILD_LIST already has
the line).

**Who it reaches.** The admin editing an announcement twice (the
`<br>`); otherwise nobody today.

**Proposed fix.** Sam's storage-hygiene rule, one at a time, in the
migration that D44 / D46 / D47 need anyway: drop `visibility`; CHECKs;
`scope_level` as `text[]` like its siblings; keys where the target is
one table (`scope_programs` → `programs`, `scope_courses` → `courses`,
`scope_product_ids` → `products`, `scope_user_ids` → `users`) or a
scope table instead of arrays; the body stored once as text and
rendered on the server; the editor reloading the text, not the HTML;
the two snapshots regenerated.

**Status.** Open. Not approved, not queued.

---

## The config group — where `config`, `schools` and `levels` came from (traced 2026-09-18)

The last table-by-table sweep: the three reference tables, every
reader of every config key, the admin Config page, the register and
profile readers of `schools`, the live rows on dev, and three tests as
a dev student and as the public key (rolled back). Sam's rulings are
pending; nothing here is decided.

**Three eras.**

- **Alpha.** None of the three existed. Settings were constants in the
  Apps Script (`auth_config.gs`: "No logic — constants only"), changed
  by redeploy. School was free text or absent. `cohort` was a
  registration field from the start; `level` came later as a free-text
  user column ("✅ NEW"). Bulk messaging already scoped by `cohort_ids`
  and `level_ids` as raw strings.
- **Gamma.** `config` was born on 2026-03-16 with three keys, all read
  (`81695a6` README, `e4a4d2e` api.js); four more keys followed, one of
  them (`builder_default_questions`) never read by anyone. `levels` was
  born on 2026-03-13 as CLONING.md boilerplate (`b0f7b22`) with four
  rows; **no commit in the repository's history ever wrote a query
  against it** — its own policy comment says "unused but keep open for
  future". `schools` arrived last, on 2026-06-01, in one signup-capture
  commit (`df925c0`): 141 NMC-accredited schools from the regulator's
  list, `users.school_id` keyed to it with a free-text `school_other`
  escape, readable by the public key because the register page is
  pre-auth. **Gamma inverted alpha's registration:** school (an id) at
  register, cohort and level moved to the profile page as free text.
  Two seed files disagreed on two values (§9 #11). The admin Config
  page accepted any string for any key and offered "Add Key" for
  "settings for code you are about to write".
- **The port (slices 2a, 3, 7e).** All three carried with their rows
  (141 schools with ids preserved, 4 levels, 7 config keys) and their
  policies; `users → schools` made an explicit key (S4); the code
  fallbacks set equal to the seed (§9 #11, fixed). §8 S5 said "read
  through one `lib/config/` accessor with the legacy fallbacks" — the
  accessor was not built: config is read through `lib/catalogue/` and
  the fallback is written inline at **six call sites in two idioms**.
  `levels` carried, still unread; the four levels are a TypeScript
  constant in two files. §9 had no row for `levels` or `schools`; the
  2026-09-17 dead-column sweep caught the table, two `schools` columns
  and the one config row.

**Proven on dev, 2026-09-18** (rolled back): a student reads all seven
config rows and the four levels and **cannot** change a config value
(0 rows updated); the public key reads the 141 schools and nothing
else (0 config, 0 levels). No writes to `schools` are possible for any
browser role (a single SELECT policy). Every `users.level` value in use
exists in `levels`; every `users.school_id` in use exists in `schools`.

**What is sound.** The floor for these three is right for what they
hold today: reference data readable by those who need it, writable by
the admin alone or by nobody. The keys are numbers used as numbers and
never rendered into a page. The server-side caps (offline pack size
and allowance, builder size) read the table, so an admin's change
takes effect without a deploy, which is S5's point. The register
page's school picker is strict with an honest escape hatch.

---

## D49 — The config table accepts anything, and the readers trust it in two different ways

**What.** The admin page and its actions check one thing on a save:
the value is not empty (`lib/catalogue/actions.ts:179`). No type, no
range, no list of known keys; Delete is unconditional and unaudited
(`:191-197`); "Add Key" accepts any lowercase name. The reader then
coerces: `Number(value)` turns `''` into `0`, `'1e9'` into a billion,
`'Infinity'` into `Infinity` (`lib/catalogue/queries.ts:101-104`). The
six read sites guard differently — the builders and offline packs use
`> 0 ? … : default`, the two runner keys use `|| default`, so
`runner_questions_per_page = -5` and a negative autosave interval reach
the runner as props (`lib/attempts/runner-load.ts:116-117`). `getConfig`
fails open: a database error hands back `{}` and every tunable silently
reverts to its default with no signal to anyone. The table is read on
every runner load, every builder load, every spawn and every allowance
check, uncached. Every signed-in student reads every key and
description (`config_select: auth.uid() is not null`) — harmless for
today's seven numbers, but the queued limiter rules (D35, the general
limiter), the retention window (D29) and the INIT staleness age (D34)
are all planned to live here, and the page's own copy invites
"settings for code you are about to write". The card's "⚠️ Key is
read-only — referenced by platform code" prints on every row,
including the one nothing reads. Legacy identical throughout; alpha had
constants and a redeploy.

**Where.** `lib/catalogue/queries.ts:80-110`, `actions.ts:140-197`;
`app/(app)/admin/config/config-client.tsx`; the six read sites listed
in the 2026-09-18 entry.

**Who it reaches.** The admin, who can break every runner with one
typo and learn of it from a student; every student, on the day a
server-only setting is added to a table they can read.

**Proposed fix.** The accessor S5 asked for, as a **registry**: one
module listing every known key with its type, bounds, default and
whether the browser roles may read it. The admin page edits known keys
with that validation (a number field for a number, refusing out of
range) and shows unknown keys as such; Delete refuses a known key. One
read per request (cached). Server-only keys either in a second table
with an admin-only SELECT, or a `scope` column with the SELECT policy
honouring it — the second is one column. Drop `builder_default_questions`
(§9 #9, still not done).

**Status.** Ruled (Sam, 2026-09-18): **config is admin-only to read,
with the registry.** Sam's question — "why were students reading
config; I thought it is an internal thing" — answered by the trace:
legacy's runner and builders ran in the browser and read the table
themselves, so the policy had to admit every signed-in student; the
port moved the readers to the server but kept reading as the student,
so the policy stayed as the door the server walked through. The
ruling: the accessor reads with the service role, `config_select`
becomes ADMIN-only, no scope column needed; the registry as proposed
(every known key with type, bounds, default; the admin page validating
against it, unknown keys shown as such, Delete refusing a known key);
one read per request; `builder_default_questions` dropped. Drafted
as `rebuild.md` §8 **S13** with D51's shape.

---

## D50 — `schools` is a regulator's list with no way to change it, in a vocabulary the product does not speak

**What.** 141 rows from the NMC accreditation list, seeded once in
June 2026. No admin page and no write policy: a school that opens,
closes or is misspelt cannot be changed except by SQL, and the students
who chose "My school isn't listed" and typed a name have no path back
into the list (`users.school_other` is never reviewed anywhere). Two
columns, `ownership` and `programmes`, are never read; `programmes`
holds the regulator's codes (`RGN, RCN, RMN, RM, PN`) which are **not
the product's programme ids** (`RN, RM, RPHN, RMHN, NACNAP`), so
"schools offering this programme" cannot be asked without a mapping.
The full active list is re-read on every hit to the public `/register`
route and every profile render, uncached. Announcements and messaging
do not scope by school.

**Where.** `db/migrations/20260911010000_auth_tables.sql:36-44, 391-392,
434-444`; `app/register/page.tsx:25-31`; `lib/profile/queries.ts:13-24`;
`lib/users/queries.ts:45-50`.

**Who it reaches.** The admin, the day a school must be added or
renamed; the analytics nobody has yet, when "which schools do our
students come from" meets 40 free-text spellings.

**Proposed fix.** A small admin Schools page (list, add, rename,
deactivate, and a view of the free-text "other" names with a "promote
to the list" action); `programmes` either dropped or mapped to
`programs` through a join table when a use appears; the list cached
for the register page. None of it urgent.

**Status.** Open. Not approved, not queued.

---

## D51 — `levels` has never been read, and level and cohort are free text in three places

**What.** The `levels` table (four rows) has had no reader in any
commit of any era. The four level names are typed constants in
`lib/profile/types.ts:14` and `lib/announcements/types.ts:25`;
`users.level` is free text validated against the constant on the
profile page only; `users.cohort` is free text validated by nothing
(`lib/profile/actions.ts:62-64`); announcements store `scope_level` as
a comma-joined string; the admin pickers for bulk messaging and the
announcement scope are built by `select distinct` over whatever
students typed (`lib/messaging/admin-queries.ts:137-146`;
`lib/announcements/queries.ts:50-55`), so one student typing `2024 `
with a space makes a second cohort. Alpha had both as free text;
gamma made a table for one of them and never wired it.

**Where.** `db/migrations/20260911150000_catalogue_tables.sql:32-37,
89-99`; the two constants; `lib/profile/actions.ts:62-64`.

**Who it reaches.** The admin, as a cohort picker that fills with
typos; nobody else.

**Proposed fix.** Sam's call between two honest shapes. **Drop** the
table and keep the constant, since four fixed levels have not changed
in three eras. Or **make it real**: `users.level` keyed to `levels`,
the pickers reading the table, and `cohort` as a year (`integer`) or
its own small table so that the announcement and messaging scopes
match exact values. Either way `scope_level` becomes `text[]` (D48).

**Status.** Ruled in part (Sam, 2026-09-18): **`levels` is kept — "it
will be needed in the future."** Dropping it is off the table; the
shape that follows is the real one: `users.level` keyed to
`levels(level_id)` (every value in use already matches), the profile
picker and the two admin pickers reading the table instead of the two
typed constants, and an admin edit path when a fifth level appears.
**Cohort becomes a year** — `users.cohort integer` (Sam, 2026-09-18),
so the announcement and messaging scopes match exact values; the
profile field a year input. Drafted with D49 as §8 **S13**. D50
(schools) stays open — no ruling asked for yet on the admin page.

---

## The inventory — everything that reads the bank

Traced 2026-09-17. Every caller of `lib/bank/queries.ts` and every use of
`itemsTableFor`, checked for whether the result crosses into a browser.

| Surface | Reaches a browser | After S7 (C) |
|---|---|---|
| The runner | yes — whole quiz, every column | **closed** |
| Quiz Builder | yes — whole course's stems + rationales | open → D9 |
| Offline Pack Builder | yes — same call, same payload | open → D9 |
| Admin Question Bank | yes — whole course, admin-gated | fine → D11 |
| Admin quiz picker | yes — whole course, admin-gated | fine → D11 |
| Offline Pack renderer | no — Server Component, HTML only | fine |
| `spawnBuilderAttempt` validation | no — server only | fine |
| `finishAttempt` recompute | no — server only | fine |
| **The database permission** | **the door behind all of them** | open → D8 |

Nothing else reads the bank. The only student-facing readers are the
runner and the two builders.

ℹ️ A saved offline pack stores `item_ids` only and the renderer re-reads
the live bank (`lib/offline-packs/queries.ts:226`), so editing a
question changes an old pack. Same no-snapshot shape as attempts, far
smaller consequence. Noted, not queued.

## The order the three steps have to run in

1. **S7 (C)** — the runner stops reading the live bank; each sitting
   carries its own questions.
2. **D9** — the builders stop reading it; counts and a breakdown replace
   the payload.
3. **D8** — only now can the answer columns be revoked from
   `authenticated`, because nothing in a browser needs them any more.

Steps 1 and 2 are not protection on their own; they are what make step 3
possible. Step 3 is the one that protects the content. Doing 3 before 1
and 2 breaks the app.

---

## The line: records, not definitions

Three tables hold an `item_ids` list. Only two of them should be
snapshotted, and the rule that separates them is:

> **Snapshot the records of what happened. Never snapshot the
> definitions of what is on offer.**

| Table | What it is | Snapshot? |
|---|---|---|
| `attempts` | a record of a sitting that happened | **yes** — D6 |
| `offline_packs` | a record of something a student saved | **yes** — D12 |
| `quizzes`, `mock_quizzes` | a product being offered, edited by an admin | **no — deliberately** |

A fixed quiz or mock exam *should* follow the live bank: correcting a
typo must correct it everywhere the quiz is served
(`db/migrations/20260913180000_quiz_tables.sql:33` — `item_ids text[]`,
and the same on `mock_quizzes`). Snapshotting those would mean every
content fix required rebuilding the quizzes that use it.

⚠ Written down because the opposite is the obvious mistake: anyone
reading S7, then grepping for `item_ids`, finds three tables and
"finishes the job". Two of them, and stop.

## How this file gets extended — the two sweeps

D1–D12 came from following one thread (the payment ids, then the
attempts table, then everything that reads the bank). That thread is
finished. Sam's method for continuing, his words, 2026-09-17:

1. **Table by table** — take each table, then what code uses it, then
   whether the table is good. D1–D3 and D6–D8, D12 were found this way
   by accident; done deliberately it would cover the tables nothing has
   looked at yet.
2. **Page by page** — take each page and see what it leaks into the
   browser. *The inventory* above is this sweep run over the question
   bank only. Run over every page it would also cover users, payments,
   subscriptions, messages and announcements, which nobody has checked.

Either sweep appends findings as `D<n>`. The table-by-table sweep was
run over **subscriptions** (with `products`, `programs`, `courses` as
its neighbours) on 2026-09-17 → D13–D21 and *Proposed direction —
course-level access*; and over **the auth group** (`users`,
`sessions`, `auth_events`, `reset_requests`, `rate_limits`) on
2026-09-18 → the trace *The auth group — where the five tables came
from* and D24–D30, with the page-by-page cut for that group in *What
came out clean*. Sam's addition for the auth sweep, worth repeating for
the rest: **trace the table's origin (alpha → gamma → port) before
judging it** — several "dead" columns were the residue of admin pages
gamma deferred. Then over **payments** (with `rate_limits` and the
subscriptions policies) the same day → *The payments group* and
D31–D36, with the page-by-page cut of the five payment pages folded
into *What is sound*; Sam ruled on those on 2026-09-18. Then over
**messaging** (`messages_threads`, `messages`) the same day → *The
messaging group* and D37–D43, D43 being the schema-wide grant found
along the way; the sweep proved on dev that the code inventory's
"a thread can be re-owned" was false — **test a policy claim before
recording it**. Then over **quizzes / mock_quizzes / announcements /
user_notice_state** the same day → *The quiz and announcement group*
and D44–D48 (mock exams are gamma-born; the course scope was alpha's
and regressed in gamma; the two quiz SELECT policies and the
announcements one admit every signed-in user to every row). Then over
**config / schools / levels** the same day → *The config group* and
D49–D51 (none of the three existed in alpha; `levels` never read in
any era; the config accessor S5 asked for was not built). **The
table-by-table sweep is complete: every table in `licensure_gh` has
been traced once**, which is what D43's one grant migration was
waiting for. The page-by-page sweep over every other page remains
unrun.


# Proposed direction — the attempts restructure

Not a finding and not a decision: the shape D5–D8 point at, written out
so it can be judged. Read with `rebuild.md` §8 — a draft row for that
table sits at the end, to be moved there only if Sam ticks it.

## What MyNclex does, and how it compares

Read from `Quademia/mynclex` on 2026-09-17 (reference only; AGENTS.md
rule #2 forbids importing from a sibling, copy-paste is allowed).

MyNclex hit this problem and named the answer **Pillar 2 — no answer-key
leakage**, enforced at the one place data crosses to the browser
(`app/(app)/(focused)/session/[attempt_id]/page.tsx:40-66`): a
`SEALED_ITEM_COLUMNS` list while a sitting is live, `UNSEALED_ITEM_COLUMNS`
(the same plus `correct_answer_snapshot_json`, `rationale_snapshot`,
`rationale_img_snapshot`) in review. A type split makes it a compile
error to get wrong (`lib/practice/runner/types.ts:7-12`): live mode
accepts `SealedItem` only. Instant feedback is a **per-item unseal
envelope** returned by the submit action for the one question just
answered, never a wholesale unseal.

| | MyNMCLicensure | MyNclex |
|---|---|---|
| What the runner receives | every column of every question | sealed while live, unsealed in review |
| Answer key in the browser | always, from page load | never while live; one item at a time |
| Enforced by | nothing | a type split — wrong code will not compile |
| Attempt storage | one row, two TEXT blobs | a header row + one row per question |
| A question edited later | the past attempt changes | snapshots — the attempt keeps what was shown |
| Student writing their attempt | INSERT + UPDATE, any column | SELECT only; writes via SECURITY DEFINER RPCs |
| Scoring | browser computes live, server recomputes | server reads the key, scores in tested TS, RPC persists |
| **Direct read of the bank** | **subscriber only (`user_has_course`)** | any signed-in user (deferred, see D8) |

Six rows to MyNclex, one to here — and the one is the access gate, which
is why this is a transplant, not a merger: **adopt MyNclex's attempt
architecture; keep MyNMCLicensure's access gate and its smaller scope.**

MyNclex's own decision record (`sessions/2026-05.md`, slice 2.3) chose
server-side projection over column-level RLS deliberately: review
legitimately needs the keys, so tightening the database would have meant
column policies plus a permissive view — "more moving parts".

## What is adopted, and what is kept

**Adopted from MyNclex:** one row per question instead of a text blob;
each row snapshotting the question as served; the sealed/unsealed
projection; the type split; the per-item unseal for instant feedback;
writes through locked server functions.

**Kept from MyNMCLicensure:** `user_has_course()` (stricter than
MyNclex's — D8); the server-side recompute at finish, which already
refuses to trust the browser's score; three question types (MCQ / TF /
SATA) — MyNclex's nine types, NGN case studies, CAT, trends and
clinical-judgement steps are machinery this product does not have; the
eleven per-course item tables (§8 S2); the `U_` / `ATT_` id conventions
that support conversations depend on; the ten preflight checks, already
server-side.

## Staged, so it can stop between stages

- **A — seal the runner.** The type split and the per-item unseal.
  Attempts table untouched. Closes D5. Moderate: the runner is 885 lines
  and computes feedback in the browser today, so that path moves. Alone,
  this is what makes a timed mock exam an exam.
- **B — A, plus close the write door.** Closes D7. A plus rewiring four
  or five save paths.
- **C — A + B, plus the snapshot structure.** Header row + one row per
  question, each carrying its own copy of the question. Closes D6, ends
  §8 S3's blobs, makes "which questions does everyone fail" a SQL
  question instead of parsing every row in app code (today the admin
  Attempts page gives up at 5,000 rows and reports from an arbitrary
  slice), and makes a finished attempt immune to later question edits.
  Large: new tables, migration, and the runner's save/load, the review
  page and the admin analytics rewritten. Weeks.
  ℹ️ In MyNclex the copy is an `INSERT … SELECT … FROM nclex_bank_items`
  inside the create-attempt function, so the question rows never leave
  the database at creation either — table to table, not via a server.

⚠ **C does not close D8 by itself** — it is what makes closing it
possible. Once a sitting carries its own questions, the runner stops
reading the live bank, and the browser's access to it can be revoked.
That still needs the builder's search moved server-side. **C + the
builder move → then D8 can be closed.** Anyone reading C as full
protection is reading it wrong.

## The timing argument

`rebuild.md` D5 says attempts do not move at cutover: **the table is
empty on launch day.** Today C costs code and nothing else. After
cutover the same change also means migrating real students' history
without losing or corrupting it — slower, riskier, and not fully
reversible. That window is open once.

Against it: C is weeks on a product that is not yet earning, and stage A
alone already fixes the thing that actually hurts.

## The tables (agreed with Sam, 2026-09-18)

MyNclex's three attempt tables read from GitHub on 2026-09-18
(`db/migrations/20260505120000_slice_2_1_attempt_tables.sql`; the sealed
list in `app/(app)/(focused)/session/[attempt_id]/page.tsx:40-66`). Its
structure is taken — a header, one snapshot row per question, one
answer row per question, a fixed column list at the boundary, reads only
for students — and its machinery for cases, trends, tutor items, nine
question types, CAT and study/exam intent is not.

**`attempts` — the header.** Today's row minus the two blobs. Keeps
`attempt_id`, `user_id`, `quiz_id`, `course_id`, `mode`, `source`, `n`,
`seed`, `duration_min`, `status`, `score_raw`, `score_total`, `score_pct`,
`time_taken_s`, `origin_attempt_id`, `display_label`, `ts_iso`. Drops
`item_ids` (the questions are rows now) and `answers_json` (the answers
are rows now). Every page that lists attempts keeps working.

**`attempt_items` — the snapshot.** One row per question, written once
at creation, never updated.

| column | why |
|---|---|
| attempt_item_id | bigint identity |
| attempt_id | → attempts, cascade |
| position | 1, 2, 3… the order served; unique per attempt |
| item_id | the bank question it came from. **No FK, on purpose** — the snapshot is the truth; editing or deleting the bank row must never touch history (MyNclex does the same) |
| question_type, stem, option_a…option_f, marks, shuffle_options | the public half — the **sealed** list |
| correct, rationale, rationale_img, fb_a…fb_f | the secret half — added to make the **unsealed** list |
| maintopic, subtopic, difficulty | copied so the admin analytics group by topic without re-reading the bank |

The copy is one statement inside a SECURITY DEFINER function: insert
into `attempt_items` select from the course's item table where the id is
in the picked list — the questions never leave the database on the way
in. Eleven course tables, so the function picks the table by course id
as `itemsTableFor` does in code. A type split makes handing the unsealed
list to a live runner a compile error (D5).

**`attempt_answers` — what the student wrote.** One row per question,
created empty with the attempt, updated as the student works.

| column | why |
|---|---|
| answer_id, attempt_item_id (unique), attempt_id, user_id | the links |
| chosen | a letter, a list of letters (SATA), or null — today's `chosen` |
| is_correct, score_awarded | set by the server at submit, or per item in instant mode; never by the browser |
| flagged, sata_checked | today's per-question state |
| time_spent_s, submitted_at, updated_at | today's timing, plus when |

Separate from the snapshot because a snapshot is written once and an
answer changes on every click; the sealing rule then lives on one table,
and autosave writes small rows instead of re-serialising the whole
attempt. D6's second copy of `correct` has nowhere to live.

**`offline_packs` and `offline_pack_items`.** The pack header keeps every
column but `item_ids`. `offline_pack_items` is `attempt_items` again:
`pack_id`, `position`, `item_id`, the same snapshot columns. No answers
table and no sealing — a pack carries its key by design and the renderer
is a Server Component. Build Similar reads the pack's ids from these rows
(D12).

**Who may do what.**

| table | student | writes |
|---|---|---|
| attempts | SELECT own (ADMIN all) | none from the browser role; create / save / submit / finish / abandon are SECURITY DEFINER functions that check ownership and `user_has_course()` then write (D7) |
| attempt_items | SELECT own attempt's rows, **sealed columns only** | the create function, once |
| attempt_answers | SELECT own | the save and submit functions |
| offline_packs, offline_pack_items | SELECT own | the create function |

**Stricter than MyNclex in one place.** Its students can SELECT the whole
`attempt_items` row, secret half included; the sealing is the page's
column list only, so a student with the console open during a timed
sitting can still read the key. Here the secret-half columns are
**revoked from the browser role** on `attempt_items` (the grants are
table-wide today — D21), and the review page reads them with the service
role after its ownership check. The same move D8 makes on the bank, made
here first: a timed mock exam is an exam even against the console.

**The four creators** — builder, fixed quiz, mock exam, retake — call one
create function with an ordered id list, the course and the mode. Retake
takes the order from the original attempt's rows and copies fresh from
the live bank (a new sitting records what it was shown today; the old
one keeps what it saw). Instant mode's Check Answer calls the submit
function for one item, which grades it and returns that item's secret
half — the per-item unseal. Timed mode's submit grades every row and
unseals the attempt for review.

## Draft row for `rebuild.md` §8 — not yet added there

Widened to both snapshot tables on 2026-09-17 (Sam) — see *The line:
records, not definitions*. `quizzes` / `mock_quizzes` stay pointer lists.

> | S7 | Attempt and offline-pack shape | Both keep an id list and re-read the live bank: `attempts.item_ids` comma-joined TEXT + `answers_json` a JSON string carrying a second copy of `correct`; `offline_packs.item_ids` a TEXT[] the renderer follows back on every open. The runner receives every column of every question | Split each into a header row plus one row per question, the question snapshotted as served (`attempt_items`, `offline_pack_items` — one set of snapshot machinery, two tables). The runner's projection sealed while live, unsealed in review, with a per-item unseal for instant feedback; student INSERT/UPDATE on attempts dropped for server-side writes. Supersedes S3. `quizzes` / `mock_quizzes` deliberately unchanged — a product on offer must follow the live bank. Adopted from MyNclex (Pillar 2 + snapshot tables), keeping `user_has_course()` and this product's three question types. Cheapest before cutover: rebuild.md D5 leaves **both** tables empty on launch day, so both windows close on the same date | ☐ |

Covers D5, D6, D7 and D12. Does **not** cover D9 (the builders) or D8
(the permission) — those are the second and third steps of the order
above, and D8 cannot run until both are done.

**Status.** ✅ Ticked into `rebuild.md` §8 as S7 (Sam, 2026-09-18). The
row above is the copy; §8 is the truth. Not yet in `BUILD_LIST.md`; the
stage (A, B or C) and its place in the order are not yet set.


# Proposed direction — course-level access

The shape D13–D17 and D20 point at, worked through with Sam on
2026-09-17. Not a decision until it has its §8 row and tick; the rulings
below are how Sam wants it shaped *when* it is built.

## The idea, in one line

The expiry moves from the product to the course. A purchase writes one
access row per course it unlocks; the subscription row stays as the
receipt. The gate becomes one lookup; the days-left number becomes a
stored date; both readers (D13), the sum (D14) and the extra readers
(D17) go away together. Sam's framing: *"we should not say they have
access to RN_FULL for 365 days; we should say they have access to GP for
365 days, RN_MED 365 days…"*

## Two new tables

**`product_courses` — the definition side.** What a product unlocks,
one row per course, replacing `products.courses_included` (D16).

| column | type | why |
|---|---|---|
| product_id | text → products | the product |
| course_id | text → courses | the course it unlocks |

Primary key on both: no duplicates. Foreign keys on both: no unknown or
deleted course. No dates, no status — a definition carries no time.
`courses_included` is dropped once the admin Products page writes here.

**`course_access` — the entitlement side.** One row per course per
purchase. What the gate reads.

| column | type | why |
|---|---|---|
| access_id | bigint identity | never quoted in support, so no text-id convention |
| user_id | text → users | who holds it |
| course_id | text → courses | what they hold |
| subscription_id | text → subscriptions | the receipt that granted it; Revoke follows this link |
| start_utc | timestamptz | when access begins — today, or queued behind the course's current end (below) |
| expires_utc | timestamptz | when it ends; the days-left number is this date |
| revoked_utc | timestamptz null | empty = live. A date, not a status: a date is a fact, a status goes stale (D20) |
| created_utc | timestamptz | when written |

Check: expiry after start. Index on (user_id, course_id) over live rows.
Several rows per course per student are intended (trial, paid, queued
renewal), so no uniqueness. Students SELECT their own rows; no browser
write path — every write is a Server Action with the service role, as
the trial grant already is.

**`subscriptions` stays as the receipt**, unchanged in shape; it stops
being what the gate reads. `product_id` becomes nullable for a hand-
picked grant (below). `status` then serves only the admin list and
Revoke — where D20 lands.

**Functions.** `user_has_course(course)` keeps its name and its eleven
callers; its body becomes one lookup in `course_access`. A second
function returns the student's courses with their latest expiry, for the
pages. One definition. D18 puts the same function on the quiz tables.

## The write rule

Five paths write access today, all already on the server. Each gains one
step: after the receipt, write its course rows from `product_courses`.

| path | rows written |
|---|---|
| registration trial | the trial product's courses |
| Paystack activation | the paid product's courses |
| admin Grant | the product's courses (later: as ticked in the form) |
| admin Update | the receipt's rows rewritten to its edited dates / product |
| admin Revoke | `revoked_utc` stamped on the receipt's rows |

**Start date, two settings.** *Off* (before cutover): every row starts
today. *On* (after cutover, a product change): for each course, if the
student already holds it, the new row **queues** — starts at the
course's current latest end. Same-product renewal, cross-product overlap
and a new course are then one rule; the "extend the existing row"
branch in grant and activation goes.

## Worked example (stacking on)

Ama, RN. 1 Sep 2026 registers → SUB_1 (RN_TRIAL): GP, RN_MED, RN_SURG,
1 Sep–31 Oct 2026. 17 Sep buys RN Full → SUB_2: the same three courses,
17 Sep 2026–17 Sep 2027 (a trial never extends anything — ruling 2; the
trial rows run out on their own date). 21 Nov buys RM Full → SUB_3:

| course | receipt | starts | ends |
|---|---|---|---|
| GP | SUB_3 | 17 Sep 2027 | 17 Sep 2028 |
| RM_MID | SUB_3 | 21 Nov 2026 | 21 Nov 2027 |
| RM_PED_OBS_HRN | SUB_3 | 21 Nov 2026 | 21 Nov 2027 |

GP queued behind its current end; the two new courses start today. On
21 Nov the page shows GP 665 (a stored date — D14's number, true this
time), RN_MED 300, RM_MID 365; tomorrow 664, not 663. Revoke SUB_3 on
1 Mar 2027: its three rows get `revoked_utc`, GP falls back to 17 Sep
2027 by itself. Renew RN Full early on 1 Sep 2027: three rows queued
from 17 Sep 2027 — the remaining two weeks are not lost, with no
special case. Admin extends SUB_2 to 1 Oct 2027: SUB_2's three rows take
the new end; SUB_5's queued rows keep 17 Sep 2027 and overlap for two
weeks, which the gate does not mind (ruling 4).

The two questions the gate asks, both on this table: *can Ama open
RN_MED now* — a live row whose window contains now; *how many days on
GP* — the latest end among her live GP rows.

## Sam's rulings (2026-09-17)

1. **Bought means kept.** Rows are written at purchase; a later edit to
   a product's course list affects new buyers only. A product is a
   definition, a subscription is a record pointing at it — the same
   line as *records, not definitions* above.
2. **A trial does not stack.** A paid purchase starts today; the trial's
   rows run out on their own date. Carrying a trial remainder into a paid
   plan is a promise to make deliberately after cutover, if ever.
3. **Timing.** The tables and the four automatic paths before cutover
   with stacking *off* (`subscriptions` is empty on launch day —
   rebuild.md D5 — so the window is open once). Queued-row stacking on
   after cutover, as a product change under the ⭐ rule.
4. **Revoke and edits do not ripple.** Revoking a receipt switches off
   its rows; rows queued behind keep their dates. An admin extension
   overlaps rather than shifts the queue. Every row's dates are written
   once and read as facts.
5. **Every row traces to a receipt.** A hand-picked grant (courses and
   days chosen without a product) writes a receipt with no product,
   source ADMIN and the admin's note, so "why does Ama have this" is
   always answerable.
6. **The admin forms follow the rows.** Grant lists the product's courses
   ticked (untick one); Update lists the receipt's course rows, each
   editable; Revoke takes a receipt or one row. This closes "give Ama 14
   more days on GP", which no tool does today. It is admin capability
   beyond like-for-like: read-only rows in the dialogs before cutover,
   editing after — unless Sam exempts the admin surface.

## Draft row for `rebuild.md` §8 — not yet added there

> | S8 | Course-level access | Access is derived from `products.courses_included` (a `text[]`, no FK) by two readers that agree by coincidence — TypeScript sums remaining days per course, SQL checks each row's own expiry — plus two more in announcements and offline packs; the days shown are a sum nothing grants and drift earlier daily; EXPIRED is a manual button | `product_courses` (product_id, course_id; FKs) replaces the array; `course_access` (user, course, subscription, start, expires, revoked_utc) written by the five server-side paths from `product_courses`, one row per course per receipt; `user_has_course()` becomes one lookup in it, a second function returns courses with latest expiry for the pages; `subscriptions` stays as the receipt (`product_id` nullable for a hand-picked grant). Start rule: "today" before cutover; queued behind the course's current end after (product change). Covers D13, D14, D16, D17, D20; enables D18. Cheapest before cutover: `subscriptions` is empty on launch day | ☐ |

**Status.** ✅ Ticked into `rebuild.md` §8 as S8 (Sam, 2026-09-18). The
row above is the copy; §8 is the truth. Not yet in `BUILD_LIST.md`. D15
(the per-request cache) and D19 (column selection on the sales pages) are
code-only and independent of this row.
