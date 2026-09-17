# Post-Rebuild Diagnosis & Proposed Fixes

Opened 2026-09-17 by Claude, in session with Sam. Status: **a findings
register — nothing here is approved, queued, or being built.**

Structural problems found by reading the rebuilt app, with a proposed
fix for each. Most are inherited from the stack the product was first
built on (a vanilla-JS site over Google Sheets, then Supabase), where a
convention in a string did the work a column should do.

## What this is, and what it is not

- **Not `BUILD_LIST.md`.** That file is the inventory of slices — built,
  queued, parked. A line there means the work is real and ordered. A
  finding here is a *diagnosis*: it has been seen and written down, and
  Sam has decided nothing about it.
- **Not `rebuild.md` §9.** §9 is carried legacy defects, each fixed
  inside the slice that rebuilds its surface. The rebuild's slices are
  complete, so nothing here has a slice to sit in.
- **A shape change still needs its §8 tick.** Anything below that
  changes storage is a §8 candidate and is not built until it has a row
  in `rebuild.md` §8 with Sam's tick and a date.
- **The ⭐ rule still holds.** Nothing here is a user-visible feature;
  none of it changes what a student sees. That does not make any of it
  authorised.

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

**Proposed fix (option C of three discussed, 2026-09-17).** Add
`programs.prep_product_id`, mirroring the existing `programs.trial_product_id`
— the premium product declared by a column and a foreign key, as the
trial product already is; product IDs unchanged, nothing a student sees
changes.

*Rejected alternatives: (A) move the `_2026_PREP` string from code into
a `config` row — stops the yearly deploy, but still string-matching, so
a mistyped ID is still silently invisible. (B) add `products.program_id`
+ `products.tier` — fixes all three and generalises to several tiers or
campaign years at once, at the cost of an extra column and more admin
UI; the better choice only if more than one premium product per
programme is ever expected.*

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
costs money rather than tidiness.

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
course-level access*. Every other table, and the page-by-page sweep,
remain unrun.


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

## Draft row for `rebuild.md` §8 — not yet added there

Widened to both snapshot tables on 2026-09-17 (Sam) — see *The line:
records, not definitions*. `quizzes` / `mock_quizzes` stay pointer lists.

> | S7 | Attempt and offline-pack shape | Both keep an id list and re-read the live bank: `attempts.item_ids` comma-joined TEXT + `answers_json` a JSON string carrying a second copy of `correct`; `offline_packs.item_ids` a TEXT[] the renderer follows back on every open. The runner receives every column of every question | Split each into a header row plus one row per question, the question snapshotted as served (`attempt_items`, `offline_pack_items` — one set of snapshot machinery, two tables). The runner's projection sealed while live, unsealed in review, with a per-item unseal for instant feedback; student INSERT/UPDATE on attempts dropped for server-side writes. Supersedes S3. `quizzes` / `mock_quizzes` deliberately unchanged — a product on offer must follow the live bank. Adopted from MyNclex (Pillar 2 + snapshot tables), keeping `user_has_course()` and this product's three question types. Cheapest before cutover: rebuild.md D5 leaves **both** tables empty on launch day, so both windows close on the same date | ☐ |

Covers D5, D6, D7 and D12. Does **not** cover D9 (the builders) or D8
(the permission) — those are the second and third steps of the order
above, and D8 cannot run until both are done.

**Status.** Draft. Not in `rebuild.md`, not approved, not queued. Nothing
is built from this until Sam ticks it there with a date.


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

**Status.** Draft. Not in `rebuild.md`, not approved, not queued. D15
(the per-request cache) and D19 (column selection on the sales pages) are
code-only and independent of this row.
