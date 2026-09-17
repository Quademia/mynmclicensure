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

> | S7 | Attempts shape | one row; `item_ids` comma-joined TEXT, `answers_json` a JSON string; the runner reads the live bank and receives every column | Split into a header row plus one row per question, each snapshotting the question as served; the runner's projection sealed while live, unsealed in review, with a per-item unseal for instant feedback; student INSERT/UPDATE on attempts dropped in favour of server-side writes. Supersedes S3. Adopted from MyNclex (Pillar 2 + snapshot tables), keeping `user_has_course()` and this product's three question types. Cheapest before cutover, while the table is empty | ☐ |

**Status.** Draft. Not in `rebuild.md`, not approved, not queued. Nothing
is built from this until Sam ticks it there with a date.
