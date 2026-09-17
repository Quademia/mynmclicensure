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
