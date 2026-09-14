# MyNMCLicensure — the rebuild plan

Written 2026-09-10 by Claude, from a planning session with Sam. Status:
**in build — slices 0 and 1 done 2026-09-10; slice 2 (2a + 2b) done 2026-09-11.** This is the one document that says what the
rebuild is, what it is not, and in what order it is built. The slice
ladder at the end is mirrored line-for-line in `BUILD_LIST.md`; a slice
is ticked in both places in the same commit.

Claude and Codex both build from this plan, one agent per session.
Anything this document does not say, the agent in session asks Sam
rather than guesses.

---

## 1. What is being done, in one paragraph

MyNMCLicensure — the NMC Ghana licensure exam-prep product for nursing
students — is rebuilt from a vanilla HTML/JS site with browser-side
logic into a server-rendered Next.js app on the MyNclex stack. The
**behaviour** stays exactly what it is today. The **stack** changes.
The old code stays in this repo under `legacy/` as the reference until
cutover, then is deleted. Nothing is migrated except the question bank
and the catalogue seeds. On cutover day the old logins are deleted and
the new product opens to new signups.

## 2. Decisions (Sam, 2026-09-10)

Each of these was a real choice with an alternative. They are settled;
reopen one only with Sam, and record the reopening here.

| # | Decision | Alternative rejected | Why |
|---|---|---|---|
| D1 | **Rebuild inside this repo** (`Quademia/mynmclicensure`). Old tree moves to `legacy/`. | A fresh repo | The history is here and costs nothing to keep |
| D2 | **Stay on gamma's Supabase project pair.** The rebuilt product gets its own Postgres **schema** named `licensure_gh`; the old product keeps `public`. | Own Supabase project per product | Right in principle, but each extra project is paid compute; not until the products earn it. A schema is the cheapest real separation and dumps out cleanly later |
| D3 | **Everything is rebuilt.** No feature is dropped. Priority order is decided after this plan, per slice. | A trimmed first release | No rush; the product is already complete and the audience knows it |
| D4 | **Like-for-like.** No new user-visible feature, no new mechanism the user can see. Internal shape may change only where §8 lists it and Sam has ticked it. | Adopt MyNclex's runner, bank shape, catalogue | MyNMCLicensure and MyNclex are different products for different people. Only the stack is shared |
| D5 | **No data migration.** Users, subscriptions, payments, attempts, messages, packs: none of it moves. Every gamma user is a free user. | Move users with password hashes | Nothing to preserve; a clean start is simpler and safer |
| D6 | **The question bank and catalogue seeds ARE copied.** Eleven item tables, programmes, courses, products, config, schools. | — | The product opens empty otherwise |
| D7 | **Cutover deletes the old logins**, restricted to accounts that belong only to MyNMCLicensure. MyTeacher shares the login table and must not lose a user. | Let old users sign in and get a fresh profile | Simpler; nobody is owed continuity |
| D8 | **Claude and Codex both build, one agent per session.** Both work in the same clone and read and write the same record files (`AGENTS.md`, `BUILD_LIST.md`, `SESSIONS.md`, `sessions/`); the plan is edited by whichever agent is in session, on Sam's go-ahead. | Claude plans, Codex executes (the first framing) | Both are agents; the only real constraint is that a shared working tree admits one at a time |
| D9 | **Record files take the MyNclex shape**: rules in `AGENTS.md`, one-line index in `SESSIONS.md`, monthly logs in `sessions/`, one-line inventory in `BUILD_LIST.md`, specs in `docs/`. | The old gamma shape (a status paragraph per item) | It went stale; the MyNclex shape has held |
| D10 | **The schema is named for the country, not the profession: `licensure_gh`.** (Sam, 2026-09-10, before any migration ran.) | `licensure` (no country); `nmc_gh` (the regulator) | "NMC" does not identify Ghana — the UK's regulator is also the NMC. A second profession (teacher licensure) is another *programme* inside the product, so the schema must not say nursing; a second country is the axis that does not fit inside the data, so the schema does say Ghana. The brand "MyNMCLicensure" is the thing that would change, and a brand is cheap to change; a schema name is not |

## 3. The boundary: stack versus product

The executor draws the line exactly here. When in doubt, it is product,
and product comes from `legacy/`.

### 3.1 Stack — taken from MyNclex as plumbing

These are copied from the MyNclex repo (`qacademy-mynclex`) because they
are how the stack works, not how a product works. Copy, do not import
(`AGENTS.md` non-negotiable #2).

- Next.js 16 + TypeScript + React 19, App Router, flat layout (no `src/`).
- Cloudflare Workers via `@opennextjs/cloudflare`. Production builds use
  `--webpack`; `middleware.ts` keeps its name. `wrangler.jsonc` with
  account pinning, a top-level dev block and an `env.prod` block.
- Supabase with `@supabase/ssr`: `lib/supabase/server.ts` and
  `client.ts`, per-request clients, `getUser()` never `getSession()`,
  `force-dynamic` on authenticated pages, service role only on the
  server. **One addition for this repo:** every client is created with
  `db: { schema: 'licensure_gh' }`.
- Resend, sent from Server Actions. Paystack, initialised and verified
  from Server Actions. Both of gamma's Workers retire (§7).
- GitHub Actions: `deploy-dev.yml` on push to `main`, `deploy-prod.yml`
  on push to `production`. A migration workflow of this repo's own (§6.5) —
  **not** MyNclex's `migrate-prod.yml`, which drives the Supabase CLI
  tracker and cannot be shared with another repo on the same project.
- `scripts/lint-baseline.mjs`, `.eslint-baseline.json`,
  `.githooks/pre-commit`, `eslint.config.mjs`, `tsconfig.json`,
  `next.config.ts`, `open-next.config.ts`. No Tailwind, no PostCSS: the
  stylesheet is the product's own (§3.2).
- The shell primitives that carry no product meaning: the cookie
  refresh middleware, the `(app)/layout.tsx` auth boundary, the
  `AppShell` frame with a `mobileNav` slot, the toast and confirm-dialog
  primitives (`lib/toast/`, `lib/overlays/shared/`).
- The document set (D9) and the rules in `AGENTS.md`.

Nothing else. Not `lib/practice`, not `lib/bank`, not `lib/products`,
not `lib/nav` contents, not `lib/payments` beyond the Paystack HTTP
calls, not the email templates, not the CSS.

### 3.2 Product — transcribed from `legacy/` only

Every page, every flow, every rule, every string. The sources, in
priority order when they disagree:

1. **The code in `legacy/mynmclicensure/`** — pages, `js/*-api.js`,
   `guard.js`, `auth.js`, the two Workers. Behaviour is what the code
   does.
2. **`docs/product-plan/00-overview.md` … `07-messaging.md`**, plus
   `mock-exams-reference.md` — the feature
   specs. Where a doc contradicts the code, the code wins and the
   disagreement is noted in the session log. Known ones: doc 02 lists a
   `CANCELLED` subscription status that no code knows (statuses are
   ACTIVE, EXPIRED, REVOKED); doc 04 says a trial covers a limited course
   list, but every trial product's `courses_included` equals the paid
   product's — a trial is limited by its 7 days only; doc 04 claims RLS
   enforces course entitlement, and it does not (§9 defect 3).
3. **`legacy/db/schema.sql`, `rls.sql`, `seed_data.sql`,
   `migrations/`** — the data shape.
4. **§9 of this document** — the defects and dead code that are *not*
   carried forward, with their disposition.

## 4. Target repository layout

Audience grouping is kept. Gamma's folders map almost one to one.

```
mynmclicensure/                       (repo root — flat, no src/)
  AGENTS.md  CLAUDE.md  README.md  BUILD_LIST.md  SESSIONS.md  SPLIT.md
  app/
    layout.tsx                        root metadata, fonts
    (public)/                         index, premium-prep, subscribe, payment-confirmation
    login/  register/  forgot-password/  reset-password/  router/  logout/
    (app)/
      layout.tsx                      slim auth boundary only
      student/                        dashboard, course/[id], quiz-builder, fixed-quizzes,
                                      mock-exams, learning-history, offline-packs/…,
                                      announcements, messages, profile, procedures,
                                      portal-guide, upgrade
      student/runner/instant/[attemptId]  and  student/runner/timed/[attemptId]
      admin/                          dashboard, users, subscriptions, payments, products,
                                      courses, question-bank, fixed-quizzes, mock-exams,
                                      attempts, announcements, messages, config
  components/
    shell/                            topbar, footer, app-shell, user-menu, mobile/
    nav/student/  nav/admin/  nav/shared/
  lib/
    access/                           requireStudent(), requireAdmin() — server gates
    auth/                             device sessions, rate limits, reset flow, device label
    supabase/                         server.ts, client.ts (schema: licensure)
    catalogue/                        programmes, courses, products, levels
    config/                           the config table reader (+ admin writer)
    bank/                             items (11 tables), CSV import, rationale images
    quizzes/                          fixed + mock, availability state machine
    attempts/                         spawn, autosave, finish, retake, review
    builder/                          the quiz builder
    subscriptions/                    grant / extend / update / revoke / sync / course access
    payments/                         init-public, init-upgrade, verify, setup-complete
    email/                            send.ts + four templates
    announcements/                    scoping (AND logic), notice state
    messaging/                        threads, messages, bulk send, recipient resolution
    offline-packs/                    allowance, non-repeat picking, watermark, render
    overlays/  toast/  hints/
  styles/                             one file per surface; 768px breakpoint blocks
  db/
    schema.sql  rls.sql  seed/  migrations/  README.md
  scripts/                            lint-baseline.mjs, db-migrate.mjs
  docs/
    product-plan/                     flat (decided 2026-09-10): rebuild.md, the specs
                                      00–07, mock-exams-reference.md, and the gamma-era
                                      renaming-plan.md + myteacher-clean-split.md
  sessions/                           period logs
  legacy/                             the whole old tree, read-only, deleted at cutover
  public/                             images (QAcademy_Logo.png → the Quademia mark, see AGENTS)
```

Route rule carried from MyNclex: a list and its detail are **siblings**
when the detail has different chrome (`/admin/users` + `/admin/user/[id]`).
Nesting renders both layouts.

Gamma's runner is two self-contained pages of ~2,300 lines each with
most of their code duplicated. Transcribe the *behaviour* of both into
one `lib/attempts/` core with two thin route wrappers. That is not a new
mechanism; it is the same mechanism written once. Every visible
difference between the two modes (feedback timing, the countdown, the
auto-submit, the SATA "Check answer" gate that exists in instant only)
is preserved.

## 5. Naming

| Thing | Name |
|---|---|
| Postgres schema | `licensure_gh` |
| Tables | the legacy names, unchanged, inside the schema: `licensure_gh.users`, `licensure_gh.items_gp` … |
| Storage buckets | `licensure-gh-rationale-images` (global namespace, so the prefix stays) |
| RPCs | legacy names inside the schema: `licensure_gh.check_login_rate_limit` … |
| Migration tracker | `licensure_gh.migrations` |
| Cloudflare Workers | `licensure-dev` and `licensure-prod`, both on the workspace account (qacademynurses), which owns the `quademia.com` zone — one account, one plan fee (1c, 2026-09-10) |
| Hostnames | dev: the Worker's `workers.dev` URL; prod: **`licensure.quademia.com`** (settled in MyNclex `domain-and-identity.md`) |
| Brand strings | **Quademia**, never QAcademy, in anything a reader sees (`AGENTS.md`). The sender becomes `Quademia <noreply@…>`; the domain is decided with the DNS slice |
| Money | `GHS 350`, via a `formatMinor()` copy; never `₵` |

## 6. The database

### 6.1 One project, two schemas

Both products run in the same Supabase project during the rebuild:

| | dev | prod |
|---|---|---|
| project ref | `zrakjibtxyzoqcdtvpmq` | `qizhyhjeqhaybyddsuni` |
| old product | `public.*` (bare names) + `public.teacher_*` | same |
| new product | `licensure_gh.*` | same |

`auth.users` is shared by everything in the project. That is what makes
D7 a step with a filter, not a bulk delete.

### 6.2 Exposing the schema (both projects, dashboard, once)

Supabase's API serves only schemas listed under **Settings → API →
Exposed schemas**. Add `licensure_gh` on dev and on prod, and add it to
the "Extra search path" too. Then every server and browser client is
created with `db: { schema: 'licensure_gh' }`. ⚠ Forgetting the dashboard
step fails with "relation does not exist" on every query and nothing
in the repo can fix it — it goes in `db/README.md` as the first line.

### 6.3 Tables — moved name for name

Create in `licensure_gh`, from `legacy/db/schema.sql`, with the same
columns and defaults: `programs`, `courses`, `levels`, `products`,
`users`, `schools`, `subscriptions`, `payments`, `announcements`,
`user_notice_state`, `config`, `quizzes`, `mock_quizzes`, `attempts`,
`offline_packs`, `messages_threads`, `messages`, `sessions`,
`auth_events`, `reset_requests`, and the eleven item tables `items_gp`,
`items_rn_med`, `items_rn_surg`, `items_rm_ped_obs_hrn`, `items_rm_mid`,
`items_rphn_pphn`, `items_rphn_disease_ctrl`, `items_rmhn_psych_nurs`,
`items_rmhn_psych_ppharm`, `items_nac_basic_clin`, `items_nac_basic_prev`.
⚠ Only `items_gp` is written out in the legacy schema; the other ten are
"the same, with the name substituted". `legacy/db/rls.sql` is the one
place all eleven names appear. Generate all eleven from one template.

Not moved: everything `teacher_*`, and the `dev_allow_all` remnants.

Shape changes are **not** made here. Candidates are listed in §8 and
made only if ticked.

### 6.4 Row-level security — the floor, rewritten for a server app

The legacy policies were written for a browser talking straight to the
database. Under the new stack the browser never queries a product table;
Server Actions and Server Components do, as the signed-in user. So:

- Keep every owner-scoped SELECT/INSERT/UPDATE policy as the floor.
- Keep the "no DELETE policy" pattern on `attempts`, `offline_packs`,
  `sessions` — soft-deactivate, never delete.
- Keep `auth_events` and `reset_requests` with **zero** policies, reached
  only through their SECURITY DEFINER RPCs.
- **Drop** the policies that existed only so the browser could do a
  server's job: `subscriptions_insert` for students (the trial grant
  moves into the registration Server Action, service role), and the
  browser write path on `sessions` (the session cap moves into the login
  Server Action). These are §9 defects 2 and 5.
- Content gating (§9 defect 3) is enforced in the app layer by the
  gate that loads a course's items, AND, because the app layer is not
  the floor, by a SELECT policy on each `items_*` table that checks an
  active subscription covering the course. The check is one function,
  `licensure_gh.user_has_course(course_id)`, called by eleven policies.
- Every tutor/admin-side read still names its scope in the query
  (`AGENTS.md` workaround "RLS is the floor, not the filter").

### 6.5 Migrations — this repo's own runner

MyNclex applies migrations with the Supabase CLI, which records them in
the project's single `supabase_migrations.schema_migrations` tracker and
refuses to run if the tracker disagrees with the files on disk. Two
repos cannot share that tracker. gamma never used it, so on this project
pair the tracker is free — but MyTeacher's rebuild will need the same
answer, and the answer must not be "whoever pushes first wins".

So this repo brings a small runner, `scripts/db-migrate.mjs`:

- Reads `db/migrations/*.sql` in filename order
  (`YYYYMMDDHHMMSS_name.sql`, the MyNclex convention).
- Connects with the project's Postgres connection string (a repo secret
  per environment: `DB_URL_DEV`, `DB_URL_PROD`).
- Applies each file not yet recorded in `licensure_gh.migrations(version,
  name, applied_at)`, each in its own transaction, and records it.
- Never touches `supabase_migrations.*`.
- Run by `migrate-dev.yml` on push to `main` and `migrate-prod.yml` on
  push to `production`, before the deploy workflow. Locally: `npm run db:migrate`.

The first migration creates the schema and the tracker. `db/schema.sql`
and `db/rls.sql` stay as the readable statement of the current shape,
regenerated when a migration changes them (same discipline as MyNclex).

### 6.6 Content copy (D6)

Because old and new live in the same database, the copy is SQL inside
it, one statement per table, run once on dev and once on prod at the
slice that needs it:

```sql
insert into licensure_gh.items_gp select * from public.items_gp;
-- × 11 item tables, then programs, courses, levels, products, config, schools,
-- quizzes, mock_quizzes (added 2026-09-13, slice 5a: the live quizzes must
-- reach the new product; D6 names them now)
```

Verify by row count and by `md5(string_agg(item_id || stem, '|' order
by item_id))` on both sides. Rationale images: copy the storage objects
from the old bucket into `licensure-gh-rationale-images` and rewrite the
URLs in `rationale_img` in the same step. Two content facts carried
from gamma's build list, not for the rebuild to fix: `items_rphn_disease_ctrl`
is empty while its course is active; `items_rm_mid` is short of its
target set count.

Config seeds: `legacy/db/seed_data.sql` is the operative seed, not
`schema.sql`. Where they disagree the live prod row wins, and the copy
takes the live rows anyway.

## 7. The two Workers become Server Actions

This is the only part of the product that is re-implemented from a
specification rather than transcribed page by page, because the Worker
pattern itself is what the stack retires. The specification is the
Worker source. What follows is the contract the new code must meet.

### 7.1 Payments (`legacy/mynmclicensure/workers/payment-worker/src/index.js`)

| Legacy route | New home | Caller |
|---|---|---|
| `POST /payments/init-public` | `lib/payments/init-public.ts` | subscribe, premium-prep |
| `POST /payments/init-upgrade` | `lib/payments/init-upgrade.ts` | student upgrade |
| `GET  /payments/verify` | `lib/payments/verify.ts` | payment-confirmation (polls), admin Retry Activation |
| `POST /payments/setup-complete` | `lib/payments/setup-complete.ts` | payment-confirmation |
| `POST /admin/subscriptions/grant` | `lib/subscriptions/grant.ts` | admin subscriptions |
| `POST /admin/subscriptions/update` | `lib/subscriptions/update.ts` | admin subscriptions |
| `POST /admin/subscriptions/revoke` | `lib/subscriptions/revoke.ts` | admin subscriptions |
| `POST /admin/subscriptions/sync-expired` | `lib/subscriptions/sync-expired.ts` | admin subscriptions (manual button, on each visit) |

Behaviour that must survive exactly:

- **Statuses** `INIT → PAID → SETUP_REQUIRED → ACTIVATED`, terminal
  `FAILED`. `verify` on an `INIT` row asks Paystack; not-yet-success
  returns "not ready" and the row stays `INIT` (the confirmation page
  polls on that). An **amount mismatch** marks the row `FAILED` with the
  note "Amount mismatch. Expected X, got Y" and is terminal. Success
  sets `PAID`, adopts the Paystack customer email, sets `paid_utc` only
  if unset, merges the verify response into `raw`.
- **Setup token**: minted when a `PAID` row has no user; **re-minted on
  every verify call** (that is what makes "Retry Activation refreshes
  the link" true); 48-hour life from `setup_created_utc`; exact string
  compare; expired or missing timestamp both refuse.
- **Activation** has three modes, checked in this order: `existing_by_ref`
  (a subscription with `source='PAYSTACK'` and `source_ref = reference`
  already exists — the replay guard; reuse it, keep the original
  `activated_utc`), `extended` (an ACTIVE unexpired subscription for the
  same product — add the product's `duration_days` to its expiry, reset
  `expiry_reminded`), `created`. Product lookup here does **not** require
  the product to be active.
- **Idempotency**: `setup-complete` on an already-activated row returns
  the same answer; on failure it writes `failure_note` and leaves the
  status alone so the row stays retryable.
- **`setup-complete` creates the account**: an auth user with
  `email_confirm: true`, then the profile row with `signup_source =
  'PAYSTACK_SETUP'`, then the payment row is stamped, then activation.
  Password minimum 8. ⚠ In legacy this path captures no school or
  referral and grants no trial — it grants the purchased product. Keep
  that.
- **Admin grant** extends from `max(existing expiry, now)`, `source =
  'ADMIN'`, `source_ref = 'admin_grant'`, and (unlike the Paystack path)
  does **not** reset `expiry_reminded`. Optional `start_date` only for a
  new row. **Admin update** validates status ∈ {ACTIVE, EXPIRED, REVOKED},
  source ∈ {SELF_TRIAL_SIGNUP, PAYSTACK, ADMIN}, expiry after start,
  widens dates to day bounds, and refuses with `duplicate_active_subscription`
  when another ACTIVE unexpired row exists for the user and product.
  **Revoke** is a bare status change. **Sync-expired** flips ACTIVE rows
  past expiry to EXPIRED and returns the count.
- **Rate limit**: 5 requests per 60 seconds per IP on the four public
  payment actions, none on admin ones. gamma used a Cloudflare binding;
  under OpenNext the plain answer is a small `licensure_gh.rate_limits`
  counter behind a SECURITY DEFINER RPC, the same shape as the login
  limiter. **Fail open** if the check itself errors, as legacy does.
- **Auth for admin actions** is `requireAdmin()` from `lib/access` — the
  Bearer-token dance disappears with the Worker.
- Ids: `QAC_` + 12 upper hex for references, `SUB_` + 10 for
  subscriptions, `U_` + 10 for users, a bare 32-hex uuid for setup tokens.
- The two-source stacking rule from doc 02 is **two mechanisms**, both
  kept: the server extends one row per product; the course-access
  reader sums remaining days across every active subscription that
  covers the course (`getStudentCourseAccess` in the legacy API).

Legacy quirks to **drop**, not carry (they are Worker artefacts, not
behaviour): the CORS-by-omission response, the `buildFilterParams`
helper that silently drops falsy filters, leaking `err.message` to the
client on 500.

### 7.2 Email (`legacy/mynmclicensure/workers/email-worker/`)

Four events, sent through Resend from the Server Action that causes them,
awaited inside a try that logs and never blocks the action (legacy
behaviour). Templates move to `lib/email/templates/` with the shared
footer; the three social links in the footer are kept as constants.

| Event | Sent from | To | Variables |
|---|---|---|---|
| `WELCOME_STUDENT` | registration action, after profile + trial | the student | name (forename), email, loginUrl, programName |
| `SUBSCRIPTION_ASSIGNED` | admin grant action | the student | name, loginUrl, productName, expiryDate (read back from the row, not recomputed) |
| `SUBSCRIPTION_REVOKED` | admin revoke action | the student | name, productName, renewUrl, supportEmail |
| `PAYMENT_SETUP_REQUIRED` | admin Retry Activation when verify returns SETUP_REQUIRED | the payer | email, productName, setupUrl, expiryHours = 48 |

Links come from one `appOrigin()` read at call time (`AGENTS.md`
workaround), never a literal. The `EMAIL_SECRET` mechanism disappears
entirely (§9 defect 1). There is no expiry-reminder email in legacy;
`subscriptions.expiry_reminded` exists unused and is kept as-is (D4).

## 8. Internal shape changes — candidates, not decisions

D4 freezes what the user sees. These are places where the storage shape
could change without the user noticing. **None is done unless Sam ticks
it here with a date.** Each has my recommendation; a recommendation is
not a decision.

| # | Candidate | Legacy | Recommendation | Decision |
|---|---|---|---|---|
| S1 | User primary key | `users.user_id TEXT 'U_…'` + nullable `auth_id UUID`, no FK to `auth.users` | Keep `U_` ids (every table and every id in a support conversation uses them) but add the FK and make `auth_id` NOT NULL UNIQUE. A missing link is a bug, not a state | ✅ Sam, 2026-09-11. Slice 2 |
| S2 | Eleven item tables | one table per course, identical shape | Keep eleven. The CSV importer, the bank page and the offline-pack picker are all written per table; one table is a bigger transcription for no visible gain | ☐ |
| S3 | `attempts.answers_json`, `attempts.item_ids` | TEXT blobs | JSONB / TEXT[] — free under Postgres, lets the review page query rather than parse | ☐ |
| S4 | Foreign keys | none on licensure tables | Add them where the legacy data would satisfy them (subscriptions→users, products; attempts→users; payments→products; messages→threads). Refuse orphans at the floor | ✅ Sam, 2026-09-11, for `sessions → users` (slice 2). The rest as each table lands |
| S5 | `config` table | live-editable key/value read on every page | Keep, exactly. An admin can change runner and builder tunables without a deploy, and that is a feature they have today. Read through one `lib/config/` accessor with the legacy fallbacks | keep (D4) |
| S6 | `sessions.ip_hash` | column exists, never written (browser cannot see the IP) | Write it now that the server can. Same column, finally populated | ✅ Sam, 2026-09-11. Slice 2 |

## 9. Carried defects and dead code — dispositions

Found in the planning survey. Each is fixed or removed **inside the slice
that rebuilds its surface**, never as a slice of its own. None is a
feature; a user cannot tell.

**Defects not carried forward**

| # | Defect in legacy | Where | Disposition |
|---|---|---|---|
| 1 | `EMAIL_SECRET` shipped in browser JS; anyone can send email from the domain | `js/config.js`, email worker | Gone with the worker. Emails are sent server-side (§7.2). Slice 10 |
| 2 | A student can INSERT their own subscription row for any product (`subscriptions_insert` policy) | `db/rls.sql` | Policy dropped; trial grant happens in the registration Server Action. Slice 2 + 8 |
| 3 | Every question in every course readable by any logged-in user; entitlement checked only in the browser | `db/rls.sql` `items_*` SELECT | App-layer gate on the course loader AND a subscription-aware SELECT policy (§6.4). Slice 4a creates the function `user_has_course()` and the eleven policies, allowing any signed-in user until then; slice 8 fills in the subscription check and carries the test (Sam, 2026-09-13) |
| 4 | Registration creates the auth user, then the profile insert can fail, leaving an orphan login | `register.html` | One Server Action; on profile failure the auth user is deleted with the service role (the MyNclex `app/register/actions.ts` rollback pattern). Slice 2 |
| 5 | Session cap kicks the oldest session **without** the not-expired filter the count uses; can leave three live | `auth.js` `createLoginSession` | The kick query filters `active AND expires_utc > now`, same as the count. Slice 2 |
| 6 | Two different `buildDeviceLabel()` definitions; last script loaded wins | `auth.js`, `guard.js` | One implementation (`lib/auth/device-label.ts`); the `auth.js` version is the one users actually got, so its labels are kept. Slice 2 |
| 7 | Login rate-limit and reset rate-limit checks fail **open** on error | `login.html`, `forgot-password.html` | **Kept.** Legacy chose availability over lockout; changing it is a policy change, not a defect fix. Noted for Sam |
| 15 | `users_update` policy has no `WITH CHECK`; a signed-in user can set their own row to `role = 'ADMIN'` | `db/rls.sql` | Found in the slice 2 inventory (2026-09-11). Reaches no user on the new stack (the browser never writes tables), but the floor is the floor. Sam: close it. The new policy's `WITH CHECK` refuses a change of `role`, `active`, `user_id`, `auth_id` by a non-admin. Slice 2 |
| 17 | The instant runner’s progress save writes `status = in_progress` on every save and never checks the row, so an autosave landing a moment after Submit flips a completed attempt back to in progress (the score stays); the lists then show Resume and no Review | `runner/instant.html` `saveAttemptProgress`, `js/mynmclicensure-api.js` | Found in the 7a session (2026-09-14): one of Sam’s builder attempts sat at `in_progress` with `score_pct 80`. Reaches a real student, rarely; confusion, not loss (a resubmit recomputes the score). **Fixed 2026-09-14** (Sam): the save is the student’s own row and `status = in_progress` only, as the timed save already was (6b); a late save after a finish is refused and the runner ignores it, as it is locked |

**Dead things — remove or decide**

| # | Item | Disposition |
|---|---|---|
| 8 | `users.must_change_password` — set by nothing, read by nothing, only cleared on reset | **Left as it is** (Sam, 2026-09-11): the column is carried, the reset page clears it as legacy does, no gate is built. A gate would be a new feature; dropping it is tidying that can wait until after the rebuild |
| 9 | `config.builder_default_questions` — seeded, read by no page | Drop from the seed. If an admin row exists it is harmless |
| 10 | Student sidebar → `telegram.html`, a page that does not exist | **Not dead — never rebuilt** (Sam, 2026-09-11). The Sheets-era product had a working TelegramGate: a Connect Telegram page issued a 10-minute link code, the bot's Cloudflare Worker (still on the workspace account) checked it against five sheet tables (groups, allowlist, link_codes, telegram_links, audit) and admitted the student to the groups their subscription allowed. The first rebuild moved none of it; only the sidebar link, `products.telegram_group_keys`, the admin field and the portal-guide text survived. Rebuilt as **slice 17** (§12) after slice 8. Until then the menu item exists in `lib/nav/student.ts` but is not rendered, so the sidebar has no dead link. The two external channel links stay. |
| 11 | `runner_questions_per_page` seeded 2 in `schema.sql`, 1 in `seed_data.sql`; `offline_packs_per_course` seeds 5 while the code falls back to 3 | The live prod row is the truth and is what §6.6 copies. Code fallbacks are set **equal to the seed** so a missing row cannot change behaviour |
| 12 | `guard.js` TEACHER branch and `router.html`'s "everything else goes to student" | The TEACHER role is MyTeacher's and left with the April split. Roles here are STUDENT and ADMIN; any other value is refused at login, not routed |
| 13 | `docs/product-plan/02` `CANCELLED` status | Doc corrected when slice 8 lands |
| 14 | `legacy/archive/` (diverged old copies of the JS) and the empty `workers/`, `payments-worker/` at root | Deleted in slice 0 |
| 16 | The admin Preview button on Fixed Quizzes and Mock Exams — opens the runner with a `quiz_id`; the runner demands an `attempt_id` and shows "Missing Quiz"; nothing turns a quiz into a preview attempt | **Not built** (Sam, 2026-09-13). The runner's own admin preview path (`?preview=1` on an attempt) is transcribed as it is |
| 18 | The admin announcement form offers a status **Scheduled** and saves `status = 'scheduled'`; the student read (`getAnnouncements`) fetches `status = 'active'` only, so anything saved as Scheduled never reaches a student, even after its start date. The table's own "scheduled" pill is computed from Active + a future start | **Fixed in slice 11** (Sam, 2026-09-14): the option leaves the dropdown; scheduling is Active plus a start date, as the table already labels it. No prod row carries the status |
| 19 | Course targeting does nothing: the admin form saves `scope_courses`, but `filterAnnouncementsForStudent` never reads it (a course-scoped announcement reaches everyone) and the course page filters on `a.course_id`, a column that does not exist (its section is always empty). Doc 05 says a course-scoped announcement reaches students holding that course | **Fixed in slice 11** (Sam, 2026-09-14): a course scope matches a student whose course access covers any listed course; the course page shows the ones whose scope lists it. No prod row carries a course scope |

## 10. Authentication and access, as rebuilt

Same three doors as today: email + password, Google, magic link. Same
rules. Moved to the server.

- **Login action**: normalise the email; `check_login_rate_limit(identifier,
  fp_hash)` (fail open); `signInWithPassword`; on failure log
  `LOGIN_FAIL` / `INVALID_CREDENTIALS` and say "Invalid email or
  password" (no enumeration); on success look up the profile (one retry
  after 500 ms — replication lag right after signup); refuse a missing
  profile with "No account found… register first" and sign out; refuse
  `active = false`; create the device session; go to `/router`.
- **Rate limits** (SECURITY DEFINER RPCs moved into the schema
  unchanged): 5 fails in 10 min, 10 fails in 24 h, keyed on both email
  and device fingerprint, `RATE_LIMITED` fails excluded from the count,
  24-h rule checked first. Reset requests: 3 per email per 60 min.
- **Device sessions**: max 2 live; a third login deactivates the oldest
  *live* one (defect 5); 7-day expiry; rows never deleted; the id in a
  cookie now, not localStorage; `guardPage` becomes `requireStudent()` /
  `requireAdmin()` in `lib/access`, which re-verify the session row on
  every request and update `last_seen_utc` without awaiting.
- **Google and magic link**: never create a profile. A return with no
  profile logs `LOGIN_FAIL` / `NO_ACCOUNT`, signs out, and says register
  first. The fingerprint is computed client-side (screen, timezone,
  language, platform) and posted with the form — the server cannot see
  those.
- **Registration action**: the whole legacy sequence in one server call:
  auth signup → profile (`signup_source = 'SUPABASE_AUTH'`, school or
  `school_other`, referral) → trial subscription from
  `programs.trial_product_id` (`source = 'SELF_TRIAL_SIGNUP'`,
  `source_ref = user_id`; added in slice 8) → welcome email (added in
  slice 10) → sign out → "check your email / now log in" screen. The
  confirm-your-email modal gate stays. Rollback per defect 4.
- **Password reset**: request → neutral "if that email is registered"
  message; the reset page waits for the recovery event with the 5-second
  fallback (the MyNclex `reset-password` page is the worked reference
  for the two link shapes); on success clear `must_change_password` (or
  not, per §9 #8) and call `mark_reset_used`.
- **`/router`**: ADMIN → `/admin/dashboard`; STUDENT → `/student/dashboard`;
  anything else refused (§9 #12). ADMIN passes every student gate, as
  today.
- **Turnstile**: gamma has none and the gamma Supabase projects have
  captcha off. Not added (D4).

## 11. Cutover

Not a slice; a checklist for one day, run after every slice is ticked
and Sam has tested prod with a throwaway account.

1. DNS: `licensure.quademia.com` → `licensure-prod`. Verify the
   `APP_ORIGIN` secret and every email link.
2. Paystack: the LIVE secret on `licensure-prod`, test-mode keys on dev.
   (This depends on the company / Paystack-account decision in the
   MyNclex `company-registration.md`; the rebuild is complete without it.)
3. Content copy (§6.6) re-run on prod so the bank is current.
4. **Delete the old logins** — only rows in `auth.users` with no
   `public.teacher_users.auth_id` pointing at them. Count first, delete
   in a transaction, count after. Written as a script in `db/cutover/`,
   run by hand, output pasted into the session log.
5. gamma: take the MyNMCLicensure pages down (a redirect page to the new
   host is enough), leave MyTeacher untouched.
6. Delete `legacy/` from this repo. Drop the bare-name `public.*`
   licensure tables from both projects **after** MyTeacher's rebuild
   confirms it never read them (it should not; its tables are `teacher_*`).
7. Record the day in the session log and in `SPLIT.md` Part 2.

## 12. The slice ladder

Numbered for dependency, not for priority. Sam picks the next slice each
session; the first ⬜ in `BUILD_LIST.md` is the candidate, not the rule.
Each slice ends with Sam testing it on `localhost:3000`, then the dev
Worker after merge. "Done when" is the test.

**0 — Repo reshape.** Move `mynmclicensure/`, `db/`,
`images/`, `index.html`, `product-select.html`, `CLONING.md` into
`legacy/`; delete `myteacher/`, `archive/`, root `workers/`,
`payments-worker/`, `docs/product/08–09`. Correct `SPLIT.md` Part 2 is
already done. *Done when* the root holds only the record files, `docs/`,
`sessions/`, `legacy/`, and git shows every old file as moved, not
deleted.

**1 — Scaffold.** Next.js app from the MyNclex plumbing (§3.1):
`package.json`, configs, `middleware.ts`, `lib/supabase/`, the lint
baseline and hook, `wrangler.jsonc` (`licensure-dev` / `licensure-prod`),
`deploy-dev.yml`, `deploy-prod.yml`, `.env.local` template in
`README.md`. `db/`: first migration creating schema `licensure_gh` and the
tracker; `scripts/db-migrate.mjs`; `migrate-dev.yml`, `migrate-prod.yml`.
Dashboard: expose the schema on both projects. A placeholder home page.
*Done when* `npm run dev` serves it, a push to `main` deploys
`licensure-dev`, and `npm run db:migrate` records the first migration on
dev.

**2 — Auth and shell.** Tables `users`, `schools`, `sessions`,
`auth_events`, `reset_requests` and their RPCs, plus `programs` (moved up
from slice 3 on 2026-09-11: the register page's programme dropdown reads
it; the five rows are copied). Login (three doors), register, forgot,
reset, `/router`, logout. `lib/access` gates. The topbar, footer, both
sidebars with every legacy menu item (minus §9 #10 and the "Teacher
Assess" link, which is MyTeacher's and left with the April split), the
phone drawer. `styles/` started. Built in two sessions (Sam,
2026-09-11): **2a** the tables, the five auth pages, the gates, logout;
**2b** the shell, both sidebars, the drawer, the two placeholder
dashboards. The trial grant waits for slice 8 (`products`,
`subscriptions`) and the welcome email for slice 10; registration
succeeds without them. *Done when* (at the end of 2b) a new account can
register with school + referral, log in on two devices, be kicked on the
third, reset a password, and an admin lands on an empty admin dashboard.

**3 — Catalogue and config.** `programs`, `courses`, `levels`, `products`,
`config`; admin Products, Courses, Config pages; the public index and
premium-prep pages (without the payment buttons working); content copy
of these tables. *Done when* an admin can edit a product and a config
key and the public pages read them.

**4 — Question bank.** Eleven item tables; the bucket; admin Question
Bank page with search, filters, edit, and the CSV importer with its nine
rules (upsert on `item_id`, the shuffle column taken as given — the
"TF never shuffles" rule is the runner's, not the importer's (Sam,
2026-09-13), skipped rows reported);
the subscription-aware item policy (§9 #3); content copy of all eleven.
Built in two parts (Sam, 2026-09-13): **4a** the eleven tables with the
legacy columns and indexes, ADMIN writes, one SELECT policy per table
through a single function `user_has_course(course_id)`, the bucket
`licensure-gh-rationale-images`, the three reads (by ids in the order
given, by filters with the keyword search, the distinct filter values),
the admin Question Bank page — course picker, filters, list, edit / new
panel, image attach, delete — and the dev content load; **4b** the CSV
importer — template, upload, row report, import. Content: dev's eleven
tables are loaded from Sam's CSV exports of prod (2026-09-13), so the 4a
migration creates tables only and does not copy from `public.*`; prod
is copied at cutover by the §6.6 SQL. The gate function allows any
signed-in user until slice 8 fills in the subscription check (the
`subscriptions` table lands there; without this, slices 5–7 could not
be tested), so the "no subscription cannot read" test moves to slice 8.
The CSV reader handles a quoted comma and a line break inside a field,
which legacy's did not; every row rule is unchanged (Sam, 2026-09-13).
*Done when* (4a) an admin can pick a course on `localhost:3000`,
filter and search prod's questions, edit one, add one with an image and
delete it, and dev's row count per table equals the export's; (4b) a
file with good and bad rows imports with the skipped rows named in the
report, and importing it again updates rather than duplicates.

**5 — Fixed quizzes and mock exams.** `quizzes`, `mock_quizzes`; admin
pages for both; the availability state machine (HIDDEN / UPCOMING /
CLOSED / ACTIVE from `published`, `publish_at`, `unpublish_at`,
`status`); `allowed_modes`; mock `visibility` ALL / PAID / TRIAL;
student list pages. Built in two parts (Sam, 2026-09-13): **5a** the two
tables with the legacy columns, policies (any signed-in user reads,
ADMIN inserts and updates, no DELETE — archive is the way out) and the
§8 S4 foreign key to `courses`; the content copy of both (§6.6); one
availability function; the reads; the Server Actions for save, the
Published toggle, archive / restore; the two admin pages — list with
filters (the fixed list fifty at a time with a database search, the
mock list whole, as legacy), details, question picker, review and save.
The attempt-stats box on the details step reads `attempts`, so slice 6
adds it (the admin Preview button never worked and is not built — §9
#16). **5b** the two
student list pages — course accordions, the three filters, the cards
with badge, schedule line and the Practice / Exam sections with their
stats and Start / Resume / Abandon / Retake / Review — built **after
slice 6**, because every button and every stat reads `attempts`.
Enrolled courses come from a course-access helper that returns every
active course until slice 8 fills in the subscription check (the same
stand-in as `user_has_course()`). Mock `visibility` is a column with a
default and no control: the legacy admin form never sets it and the
student page never checks it (`mock-exams-reference.md` says so); it is
carried as is. Scheduling times are saved as legacy saved them, with no
timezone — Ghana time, which is UTC; the server does not convert them.
*Done when* (5a) an admin can create a fixed quiz and a mock exam by
picking questions, edit each, toggle Published from the list, archive
and restore, and the mock list shows its schedule; (5b) a quiz
scheduled for tomorrow shows UPCOMING today and ACTIVE tomorrow, and
Start opens the runner.

**6 — Runner, attempts, builder.** `attempts`; spawn for fixed, builder,
mock; the shared runner core with instant and timed wrappers;
`runner_questions_per_page` and `runner_autosave_interval_sec` from
config; flagging, the question grid, the pre-submit summary, resume of
an in-progress attempt, auto-submit on time-out, SATA exact-set scoring
and the instant-mode "Check answer" gate, TF never shuffled; review;
retake with `origin_attempt_id`; the Quiz Builder with
`builder_max_questions` and `builder_minutes_per_question`. Built in
two parts after slice 8 (Sam, 2026-09-13): **6a** the `attempts` table
with the legacy columns (`item_ids` and `answers_json` stay TEXT — §8
S3 unticked), the §8 S4 foreign key to `users`, own-row policies (no
DELETE); the Quiz Builder — five steps, topics or concept search, the
pool counted live from the course, the config caps, the random pick,
the recent setups in the browser; the runner core at
`/runner/instant` — the ten preflight checks, the per-attempt seeded
option order, pages from config, flags, the question grid (a desktop
column, a phone overlay), the feedback switch, autosave, the exit
dialog, the SATA "Check Answer" gate, submit, the score card, review
mode, and the admin `?preview=1` path; the spawn / save / finish
Server Actions. **6b** the timed mode at `/runner/timed` on the same
core: the server-stamped start, the countdown, auto-submit at zero,
resume with the clock still running, feedback only after submit.
**5b** follows (its own paragraph). Two things run on the server that
legacy ran in the browser (Sam, 2026-09-13): **the score and each
answer's correctness are recomputed from the items when an attempt is
finished**, not taken from the browser (invisible to a student; a
tampered score cannot be saved), and the course-access check reads
slice 8's subscriptions. Not in 6: the "Send feedback" button on each
question (it opens the messages page — slice 12 adds it); the admin
Preview button (§9 #16). The runner has no sidebar, as legacy: its
own header, under the `(app)` auth boundary. *Done when* (6a) Sam
builds a custom quiz in instant mode, answers some, closes the tab,
resumes, finishes, and reviews it; (6b) a timed quiz counts down,
survives a closed tab with the clock still running, and submits itself
at zero with the feedback then shown.

**7 — Student home.** Dashboard, course page, learning history with its
stats bar and pagination, profile, procedures, portal guide, upgrade
page (buttons inert until slice 9). Built in two parts (Sam,
2026-09-14): **7a** the learning history page alone — the stats bar
(total, average, best, instant and timed counts), the `?course=` chip,
the six filters (course, mode, status, source, sort, search), the
attempt cards twenty at a time with Load more, Review and Retake on
each card (the retake through 5b's action); the paginated read with
its filters runs on the server. It reads `attempts` only, so it needs
nothing further. **7b** the portal guide alone (Sam, 2026-09-14): the
static help page — hero, the eleven sections, the "On this page" list
that follows the scroll (a "Tap to open" panel on a phone), the FAQ
accordion, the footer with Upgrade Access and Message Support — no
data; "QAcademy" in its copy becomes Quademia (UI convention #5); its
two footer links land on 7c's upgrade page and slice 12's messages
page and 404 until those exist, as the sidebar's own links do. **7c**
the NMC Procedures page alone (Sam, 2026-09-14): the intro with the
student's programme name, the Your Programme Procedures card (the
NAC/NAP card for NACNAP), the Procedure Viewer — an iframe on the NMC
website, hidden until View, with the fallback link — and the Other
Programme Procedures list with View / Open per manual and the list
toggle; the thirteen manuals and their addresses stay in the page, as
legacy held them (a table with an admin page is an "After the
rebuild" item); "Inside QAcademy" becomes "Inside Quademia". **7d**
the course page alone (Sam, 2026-09-14): `/student/course/[id]` — the
gate (no access → the locked "No Access" card; an unknown course →
"Course Not Found"), the header with the title, one badge per
programme in `program_scope` and the "days left" box (amber at seven
or fewer; legacy's red "expired" state can never show because the
access map skips a subscription with no days left — carried), the
"Message us about this course" button into slice 12's messages page
with the course pre-filled (404 until 12, as the sidebar's own link),
the Fixed Quizzes preview (the course's published active rows that
are ACTIVE or UPCOMING, the first three, question count and time
limit, the badge, "View all fixed quizzes →" into 5b's page with
`?course=`), the Mock Exams preview (the same, every row, with "Opens
d Mon" / "Closes d Mon"), the Quiz Builder shortcut with `?course=`,
the Course Announcements section showing legacy's empty state ("No
announcements for this course yet.") until slice 11 lands and fills
it — the same folding-in as the dashboard strip — and the Practical
Skills block into 7c's page. **7e** the rest — dashboard, profile,
upgrade — later, because the dashboard's course cards, announcements
strip and messages badge fold in slices 8, 11 and 12. *Done when* (7a)
Sam's attempts from slices 6 and 5b appear with the right stats, a
filter narrows them, Load more pages, and Review and Retake open the
runner; (7b) the guide reads as legacy's did, the side list follows
the scroll and jumps on click, a FAQ opens and closes, and the phone
layout stacks with the "On this page" panel; (7c) the page names the
student's programme and its manual, View opens the viewer on it, a
manual from the list opens there too, the list hides and shows, and a
NACNAP student sees the NAC/NAP card; (7d) a My Courses row opens its
course with the right days left, the quiz previews match 5b's lists,
"View all" and the builder shortcut land filtered to the course, and
a course the student does not hold shows the No Access card; (7e) the
student sidebar has no dead link.

**8 — Subscriptions.** `subscriptions`; the trial grant at registration
(moved here from the browser); course access (`getStudentCourseAccess`
summing days across products); admin Subscriptions page with grant,
update, revoke, the manual sync-expired button; doc 02 corrected; the
body of `user_has_course()` (slice 4a) replaced with the subscription
check (§9 #3). *Done when* a fresh registration holds a 7-day trial, an
admin can extend it and revoke it, sync-expired flips a back-dated row,
and a student with no subscription cannot read a course's items by any
route (moved here from slice 4, 2026-09-13).

**9 — Payments.** `payments`; the four public actions and the
confirmation page with its polling; subscribe and premium-prep buttons
live; upgrade live; admin Payments page with Retry Activation and Copy
Setup Link; the rate-limit RPC. Paystack test keys throughout. *Done
when* a pay-first purchase creates an account through the setup link,
a second verify replays safely, an upgrade extends an existing
subscription, and an amount mismatch lands as FAILED.

**10 — Email.** The four templates and their four call sites; the
Quademia sender; `appOrigin()`. *Done when* each of the four arrives in
a real inbox from dev with working links.

**11 — Announcements.** `announcements`, `user_notice_state`; admin
page with the eight scope dimensions; student page; the dashboard strip
(up to 2 unread, pinned first, "view all" count); read / clicked /
dismissed. AND-logic scoping moves from the browser to the server query.
Built in two parts (Sam, 2026-09-14): **11a** the two tables with the
legacy columns (`user_notice_state.user_id` gets the §8 S4 key to
`users`; the legacy policies, including the admin DELETE no page
uses), the scoping in `lib/announcements/` (legacy's seven checks plus
the course scope — §9 #19 — with the student's subscription kind and
product from the most recently expiring active subscription, as
legacy read them), and the admin page — the five counts, the search /
status / audience filters, the table (title with programme chips,
the computed status pill, audience, schedule, the read / clicked /
dismissed counts, flags, Edit), the side panel (title, the body box
with its Bold / Italic / Link / Button helpers and the dead Quiz Link
one, the live preview, status without Scheduled — §9 #18 — priority,
start and end, the pin and dismissible switches, the eight targeting
controls with the cohort list from `users` and the student search,
the live audience sentence), the duplicate-title check, the
newline-to-paragraph and allow-list sanitising at save, Archive with
its confirm dialog. **11b** the student page (the four tabs, the
cards with the pinned and read badges, Mark as Read, Dismiss, the
clicked state on a body button, the subtitle count), the dashboard
strip mounted on the placeholder dashboard until 7e (two unread,
pinned expanded, dismiss, "View all announcements →" with the count,
the two empty states), and the course page's section (7d) filled
with the course-scoped ones. Announcements are not copied at cutover
(D5); dev starts empty. *Done when* (11a) an admin creates an
announcement scoped to RN plus a product, edits it, sees its counts
and archives it; (11b) that announcement reaches an RN student with
the product on the page, the strip and the course page when
course-scoped, and not an RM one, Mark as Read and Dismiss move it
between the tabs, and the counts on the admin table follow.

**12 — Messaging.** `messages_threads`, `messages`; student threads
with the three contexts, the question context capturing stem + options +
current answer and **never** the correct answer; admin inbox with
filters, search, close / reopen; bulk send with recipient preview and
resolution by scope; unread badges in both sidebars. **Also here: the
"Send feedback" button under every question in both runners** (left
out of slice 6, 2026-09-13) — it saves progress, then opens the
messages page with the course, attempt, quiz and item ids and the
quoted question, options as shown and the student's current answer,
never the correct one. *Done when* a bulk send to a scope creates one
thread per recipient and the badge counts match, and a student can
send feedback on a question from inside a running quiz.

**13 — Offline packs.** `offline_packs`; the builder with filters,
`offline_max_questions` (100) and `offline_packs_per_course` (5) from
config, the trial block, the non-repeat picker that recycles only when
the pool is exhausted, the watermark (masked email + owner label); My
Packs; the renderer / print view. Built in two parts (Sam,
2026-09-14): **13a** the `offline_packs` table with the legacy
columns, the own-row policies (no DELETE — a pack is deactivated, never
deleted), the `updated_utc` trigger and the §8 S4 foreign keys to
`users` and `courses`; the shared logic in `lib/offline-packs/` —
the allowance (an active, non-trial subscription covering the course;
packs counted since the earliest such subscription started; legacy's
four refusals: not subscribed, renew required, trial not allowed,
limit reached), the non-repeat picker (unused items first, reused only
when the filtered pool is exhausted), the masked email and the
"Prepared for" owner label, the display label and the default pack
name; the Build New Pack page at `/student/offline-packs/build` — the
Quiz Builder's five-step wizard with Step 4 asking a count and a pack
name (the suggested name, "Next" held until one is set) and Step 5's
"Create pack" opening the confirmation box (the rules, the course /
questions / allowance pills, "Fresh: N • Reused: N", the editable name,
Cancel, Create & Download), the last three setups remembered in the
browser under legacy's own key; and the renderer at
`/offline-pack?pack_id=…`, outside the student chrome because
legacy's page had no sidebar and prints the pack alone — the cover
(owner name, masked email, owner label), the overview, the questions
with their options and topic line and the watermark strip after every
tenth, the answer key, Back / Print / "Download / Save PDF" / Reload;
both print buttons open the browser's print dialog as legacy's did —
no PDF is generated (a real file would be an "After the rebuild"
item). Three things run on the server that legacy ran in the browser
(the same principle as slice 6's score, invisible to a student): the
allowance check, the pick against the student's earlier packs, and
the check that every id is one of the course's items. Config
fallbacks equal the seed (§9 #11): 100 and 5, not legacy's 50 and 3.
"QA", "QAcademy Nurses Hub" and "QAcademy Student" render as "Q",
"Quademia" and "Quademia Student" (UI convention #5); the stored
`watermark.owner_label` uses the new fallback. **13b** My Packs at
`/student/offline-packs` — the list twenty-four at a time with Load
More, the search / course / status / sort filters over the loaded rows
(as legacy), the four summary counts, Open / Download and Build
Similar (into 13a's builder with `?course=`), the empty card; the
Archived / Deleted status options are kept though no legacy code ever
sets a pack to either. *Done when* (13a) Sam builds a pack on dev, the
renderer opens on it with the cover, the questions, the watermark
strip and the answer key, a second pack on the same course shares no
item until the pool runs out, and a trial student is refused with the
legacy reason; (13b) the packs from 13a appear with the right counts,
a filter narrows them, and Open lands on the renderer.

**14 — Admin home.** Dashboard with its four counts; Users page with
the detail drawer and the profile fields; Attempts analytics page as
built 2026-06-04 (windows, breakdowns, per-day strip, top-10s, table,
drawer). *Done when* the admin sidebar has no dead link.

**15 — Phone pass.** Every student surface at 375px, every admin
surface navigable at 768px, using the shared drawer. Not a redesign:
reflow and stacking only. *Done when* Sam walks the student flow on a
phone.

**16 — Cutover** (§11). Not ticked until run.

**17 — Telegram gate** (added 2026-09-11, §9 #10). The Sheets-era feature, rebuilt on this stack: five tables in `licensure_gh` replacing the sheets (groups, allowlist, link_codes, telegram_links, audit); the Connect Telegram page (spec: git history, commit 737237c, "Add Connect Telegram HTML page", 712 lines) issuing a 10-minute `QK-` link code; the bot Worker (spec: the Apps Script in history, "Telegram_By_Worker-DEV", 1,322 lines) pointed at the database; the allowlist kept in step with active subscriptions and `products.telegram_group_keys`; the sidebar item shown. Needs slice 8. *Done when* a paid student links a Telegram account with a code and is admitted to their product's groups, and a lapsed one is refused.

Slices 3–7 need nothing from 8–14 and can run in any order after 2.
Slices 8 → 9 → 10 are a chain. 11, 12, 13 are independent of each
other and of 8–10. 14 needs 6 and 8. 15 last but one.

## 13. What this plan does not do

- It does not change the product's design, copy, or feature set (D4).
- It does not decide priority; Sam does, per session.
- It does not touch MyTeacher, whose rebuild gets its own plan in its
  own repo, but should reuse §6.5 and the record-file shape unchanged.
- It does not solve the Paystack live-key / company question; that is
  MyNclex's `company-registration.md`, and cutover step 2 waits on it.
- It does not carry gamma's post-launch wish list. Items from the old
  `BUILD_LIST.md` that still apply after the rebuild are listed in the
  new `BUILD_LIST.md` under *Carried from gamma*, as ⬜ or ⏸ lines.
- It does not design for a second profession or a second country, but
  it must not design *against* them (D10). A second profession — teacher
  licensure, say — is a **programme**: its own courses, item tables and
  products, everything else shared; nothing in the rebuild may assume
  "nursing" outside programme data and the brand strings. A second
  country — Nigeria, Kenya, the UK — is a **separate decision** (one app
  with a country column, or a clone with its own schema `licensure_ng`
  and its own domain); the rebuild takes no position, and nothing in it
  may assume Ghana outside the schema name, the currency and the
  catalogue seeds.

## 14. Ladder

| Slice | Date |
|---|---|
| 0 Repo reshape | ✅ 2026-09-10 |
| 1 Scaffold | ✅ 2026-09-10 (deploy proven green 2026-09-11) |
| 1c One Cloudflare account | ✅ 2026-09-10 |
| 2a Auth | ✅ 2026-09-11 |
| 2b Shell | ✅ 2026-09-11 |
| 3 Catalogue and config | ✅ 2026-09-11 |
| 4a Question bank — tables, bucket, gate, reads, admin page, dev content | ✅ 2026-09-13 |
| 4b Question bank — CSV importer | ✅ 2026-09-13 |
| 5a Fixed quizzes and mock exams — tables, copy, availability, admin pages | ✅ 2026-09-13 |
| 5b Fixed quizzes and mock exams — student list pages (after 6) | ✅ 2026-09-14 |
| 6a Runner — attempts table, Quiz Builder, the core with the instant mode and review | ✅ 2026-09-14 |
| 6b Runner — the timed mode | ✅ 2026-09-14 |
| 7a Student home — learning history | ✅ 2026-09-14 |
| 7b Student home — portal guide | ✅ 2026-09-14 |
| 7c Student home — NMC Procedures | ✅ 2026-09-14 |
| 7d Student home — course page | ✅ 2026-09-14 |
| 7e Student home — dashboard, profile, upgrade | ⬜ |
| 8 Subscriptions | ✅ 2026-09-13 |
| 9 Payments | ⬜ |
| 10 Email | ⬜ |
| 11a Announcements — tables, scoping, admin page | ⬜ |
| 11b Announcements — student page, dashboard strip, course section | ⬜ |
| 12 Messaging | ⬜ |
| 13a Offline packs — table, allowance, picker, watermark, the builder, the renderer | ✅ 2026-09-14 |
| 13b Offline packs — My Packs | ✅ 2026-09-14 |
| 14 Admin home | ⬜ |
| 15 Phone pass | ⬜ |
| 16 Cutover | ⬜ |
| 17 Telegram gate | ⬜ |
