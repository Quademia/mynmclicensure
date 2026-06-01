# Sessions Log

Running log of work sessions. Each entry: what was done + what's queued for next session.
Newest session on top.

---

## Session — 2026-06-01 (Licensure messaging — bulk send fix + clickable links — Claude Code)

### Done
- **Bug: admin Bulk Send reported "sent to 0".** Root cause was the
  `messages_threads` INSERT RLS policy — `WITH CHECK (user_id =
  auth_user_id())` with no ADMIN exception. Admin-initiated threads
  (New Thread + every Bulk Send recipient) are owned by the *student*,
  so RLS rejected every insert (42501). Recipient resolution (a SELECT)
  worked, but no threads were created → count 0. messages_threads /
  messages were empty in prod (admin messaging had never succeeded).
- **Fix:** added `auth_user_role() = 'ADMIN'` bypass, matching the
  sibling select/update + messages_insert policies. Applied to
  gamma-dev and gamma-prod databases directly (MCP); recorded in
  `db/rls.sql` + `db/migrations/fix_messages_threads_insert_admin_bypass.sql`.
  Verified both ways (admin can create a thread for a student; a student
  is still blocked from creating threads for others) via rolled-back
  transactions on both DBs.
- **Welcome blast.** Sam bulk-sent a welcome message to all 628
  students, then refined the copy (asks: how they heard about QAcademy,
  their school, any help needed; + WhatsApp channel invite). Rewrote the
  body in place on prod — one `UPDATE messages SET body_text=… WHERE
  sender_role='admin'` (629 rows; guarded so it can never overwrite a
  student reply; 0 replies existed).
- **Clickable links.** Message bodies were rendered with `esc()`, so the
  WhatsApp URL showed as plain text. Added an XSS-safe `linkify()`
  (escape first, then anchor only http(s) URLs) to both
  `student/messages.html` and `admin/messages.html`, with link styling.
- **Released** to production via PR #18 (main → production merge commit
  `bf9f9fb`), following the established release pattern.

### Context discovered
- Free-access signups are stored as **TRIAL** subscriptions (627 of 628;
  1 PAID, 0 FREE) with **no level/cohort** set. So three of the five
  Bulk Send filters (Level, Cohort, and the "Free" kind) are effectively
  dead for the current audience, and the "Free" option is a trap that
  resolves to 0. `program_id` IS populated (RN 331, RM 280, RPHN 14,
  NACNAP 2, RMHN 1).

### Next session
- Optional: make Bulk Send filters honest for the current audience —
  relabel/align the Subscription Kind options (Free→Trial reality) and/or
  warn when a filter would zero-out the recipient list.
- Optional: clean up the untracked `payments-worker/` folder (only a
  stray `package-lock.json`).
- The odd count (629 threads vs 628 students) — one extra thread, not
  yet investigated.

---

## Session — 2026-04-19 (MyNclex planning — Claude Web)

Product-planning session for MyNclex. Roles, Journey Tracker,
Programme Structure, Tutor Onboarding, and Pricing all settled in
`mynclex/docs/product-plan.md`. MyNclex now has its own product-
local session log at `mynclex/SESSIONS.md` — detailed MyNclex
entries live there going forward.

---

## Session — 2026-04-19 (MyNclex scope + skeleton — Claude Web)

### Done
- Scope settled: MyNclex = QAcademy-owned NCLEX-RN bank + vetted-tutor
  programmes layer. v1 deferrals documented (CAT, NGN, public tutor
  signup, payment splits, sibling migrations).
- Stack locked: Next.js 16 + OpenNext + Cloudflare Workers + Supabase
  (shared) + @supabase/ssr.
- Repo placement: `mynclex/` folder inside qacademy-gamma, deployed as
  own Worker watching only that path. Monorepo today, mentally three
  repos. Table prefix `nclex_`.
- Skeleton created: `mynclex/CLAUDE.md` + folder structure (app, lib,
  public, db/migrations, workers) with .gitkeep placeholders.
- No code, no build config yet. Design phase begins next.

### Next session
- Return with visual designs / artefacts from design phase
- First build session: initialise Next.js + hello-world deploy to prove
  Cloudflare Workers + OpenNext pipeline

### Update — same day, build session (Claude Code)
Design phase produced a full launching-2026 landing page, so we
ran the full first-build sequence in one sitting:

- **Scaffold** — `create-next-app` (App Router, TS, Tailwind, ESLint,
  flat layout). Cloudflare bits added manually to mirror `qacademy-beta-b`:
  `wrangler.jsonc`, `open-next.config.ts`, `@opennextjs/cloudflare` +
  `wrangler` deps, `cf:build`/`cf:dev`/`cf:deploy` scripts.
  - `c3` and `create-cloudflare` failed due to TTY requirements in the
    bash tool — fell back to `create-next-app` direct + manual Cloudflare
    wiring.
- **Turbopack workaround** — Next.js 16 defaults to Turbopack for
  production; `@opennextjs/cloudflare` 1.19.x doesn't yet handle Turbopack
  chunk layout (`ChunkLoadError` at first SSR request). Fixed by passing
  `--webpack` to both `build` and `cf:build`. Documented in
  `mynclex/CLAUDE.md` (Known Workarounds) and `docs/product-plan.md` (TBD).
- **First deploy** — `qacademy-dev-mynclex` Worker, named per sibling
  convention (`qacademy-dev-{product}[-{purpose}]`). Live at
  https://qacademy-dev-mynclex.mybackpacc.workers.dev (HTTP 200).
- **Landing page translated** — HTML design → JSX in `app/page.tsx`
  (client component for `onSubmit`), full CSS in `app/landing.css`
  verbatim, Inter (weights 300–800) via `next/font/google` in `layout.tsx`,
  metadata updated. Footer `<a>` dropped to plain text per scope.
- **H1 wrap fix** — Added `white-space: nowrap` to the `h1` rule after
  observing browsers break at the hyphen in `MyNclex-RN` on wider
  viewports where the clamped font-size approached the 620px hero
  container.
- **Site integration** — Added MyNclex-RN card to `index.html` (third
  product card, pulse-line SVG icon, "Launching 2026" status pill, links
  to dev Worker) and to `product-select.html` (third sign-in button with
  the same pill). Introduced `.card-tag-status` (index) and
  `.product-status-pill` (product-select) CSS classes.
- **Responsive grid** — `.products` grid bumped to `repeat(3, 1fr)` with
  `max-width: 1080px` on desktop so all three cards sit on one row above
  920px. 920px breakpoint drops back to 2-column; 580px to 1-column.
- **Logo assets** — Copied `images/QAcademy_Logo.png` (989 KB) to
  `mynclex/public/qacademy-logo.png` to preserve the extraction
  discipline (`mynclex/` must stay portable to its own repo + own
  Supabase project later).
- **Favicon** — Replaced the scaffolded Next.js "N" `favicon.ico` with a
  256×256 PNG derived from the QAcademy logo (one-off resize via `sharp`
  as a temporary devDep; `sharp` uninstalled after). `<link rel="icon">`
  auto-injected by Next.js App Router icon convention.

Commits (newest last): `faeff31`, `0102e71`, `516e792`, `5850b7b`,
`c497f92`, `7f3ff2c`, `a5233cf`.

### Next session
- Design-phase artefacts for post-launch MyNclex screens (auth, bank,
  tutored programmes) — feed into `mynclex/docs/product-plan/main.md` TBDs
- First real feature slice: wire `@supabase/ssr` + `nclex_*` table plan
- Watch for `@opennextjs/cloudflare` release that supports Turbopack; drop
  `--webpack` once available

---

## Session — 2026-04-18 (Licensure question-bank inventory — Claude Code)

### Focus
Shifted attention to MyNMCLicensure launch readiness. Inventoried prod `items_*` tables to understand question-bank state before any content work.

### Prod `items_*` inventory
11 tables, **5,280 questions total**. Schema uniform (25 cols). Per-table set-coverage against user's target set sizes (GP=100/set, all others=180/set):

| Course | Rows | Sets available | Gap |
|---|---:|---|---:|
| GP | 600 | 6 sets of 100 | ✓ |
| RN_MED | 900 | 5 sets of 180 | ✓ |
| RN_SURG | 900 | 5 sets of 180 | ✓ |
| RM_PED_OBS_HRN | 1,080 | 6 sets of 180 | ✓ |
| **RM_MID** | **540** | **3 sets of 180** | **+360 to reach 5 sets** |
| RMHN_PSYCH_NURS | 360 | 2 sets of 180 | (target tbd) |
| RMHN_PSYCH_PPHARM | 360 | 2 sets of 180 | (target tbd) |
| NAC_BASIC_CLIN | 180 | 1 set | (target tbd) |
| NAC_BASIC_PREV | 180 | 1 set | (target tbd) |
| RPHN_PPHN | 180 | 1 set | (target tbd) |
| **RPHN_DISEASE_CTRL** | **0** | **empty** | **course is `status='active'` — broken for RPHN students** |

### Observations
- 99.94% MCQ / 0.06% SATA (only 3 SATA rows in the entire bank of 5,280).
- Data hygiene good: **zero null rationales**, **zero null batch_id** — every question traceable to an import batch and has an explanation.
- Difficulty spread: 46% Easy / 40% Moderate / 14% Hard.
- `items_gp` has **149 distinct `subject` values** (others have 1–2) — cross-cutting course, but worth a normalisation pass for typos/inconsistencies at some point.

### Blocker surfaced — source material gap
User does not currently have NMC Ghana midwifery syllabus, WHO maternal/newborn PDFs, Ghana Standard Treatment Guidelines, or a reference midwifery textbook (Myles etc). **Any questions generated without authoritative sources would be plausible-but-unverified — not shippable** for a licensure prep platform. Session ended here so user can try to collect materials between sessions.

No code changes, no commits beyond this docs update.

### Next session — priority 1
Confirm what source material is now in hand. **Minimum viable bundle:** NMC Ghana midwifery syllabus + 2–3 WHO maternal/newborn guideline PDFs (antenatal, intrapartum, postnatal, MCPC) + Ghana STG obstetric sections. Free sources listed in-chat this session. Once those land, build a topic-weighted plan for the +360 Midwifery gap.

### Next session — other
- **`items_rphn_disease_ctrl` empty-but-active** — holding fix: flip course `status` to `'inactive'` so RPHN cohort doesn't see a broken course at launch. Proper fix: seed questions.
- **Set-size targets** for RMHN / NACNAP / RPHN — decide whether those courses also need the "5 sets" standard or can launch with current volume.
- **Remaining Launch Blockers** — email confirmation flow (5 items), MANUAL_TEST account cleanup, custom domain, Paystack TEST→LIVE key swap.

---

## Session — 2026-04-17 (db/ consolidation — Claude Web + Claude Desktop)

### Audit findings (Phase 1)
- **01_tables.sql** was fully redundant with schema.sql — zero objects in 01 that schema.sql didn't already have. 01 was missing: all MyTeacher auth-split tables, the section 5.12 FK block, teacher_config, all 10 `teacher_library_*` item tables, and carried a pre-reshape `teacher_library_courses` stub that would have collided with seed data.
- **02_functions_triggers.sql** was missing all 7 MyTeacher auth functions added post-split (myteacher_user_id/role, log_mt_*, check_mt_*, mark_mt_*). It uniquely held 2 live objects: the `offline_packs` auto-timestamp function + trigger (active, must move) and 2 test helpers `tq_item_option_letters` / `tq_student_item_result` (confirmed unreferenced anywhere in the repo — safe to drop).
- **03_rls.sql** carried the "wrong RLS helper" landmine: 26 policies on 9 MyTeacher content tables using `auth_user_*` instead of `myteacher_user_*`. Yesterday's `fix_teacher_rls_helper_functions.sql` migration fixed this in live DBs and in rls.sql, but 03 was never back-ported. Fresh bootstrap from 03 would have broken every new teacher signup.

### Done (Phase 2, all 9 steps)
- **Backfilled rls.sql with 40 ALTER TABLE ENABLE ROW LEVEL SECURITY statements** — one for every table with a policy block (4 more than the initial audit estimate of 36; the gap was sections 6a + 23 being multi-table blocks). Interleaved above each section's first DROP POLICY.
- **Moved non-RLS `offline_packs` trigger + function into rls.sql** under a new "NON-RLS FUNCTIONS & TRIGGERS" section at the bottom, with a docblock explaining why it lives there (single SQL file per bootstrap step).
- **Dropped 2 dead test helpers** (`tq_item_option_letters`, `tq_student_item_result`).
- **Fixed teacher_library_courses seed drift** — added MICROBIOLOGY, PHARMACOLOGY, SOCIOLOGY, MANAGEMENT, SURVEYING to seed_data.sql (values pulled from live prod so they match exactly).
- **Deleted** `db/prod-setup/01_tables.sql`, `02_functions_triggers.sql`, `03_rls.sql`.
- **Moved** `db/prod-setup/04_seed_data.sql` → `db/seed_data.sql` (promoted to root for bootstrap order clarity).
- **Renamed** `db/prod-setup/` → `db/setup/`, dropped number prefixes on the two markdown runbooks (now `workers_deploy.md` + `supabase_auth_storage.md`).
- **Added** `db/README.md` — short entry-point doc covering file roles, bootstrap sequence, and the "every migration gets back-ported to schema.sql/rls.sql" convention.
- **Updated cross-references** in CLAUDE.md, README.md, CLONING.md, BUILD_LIST.md, docs/question-schema-plan.md. Left SESSIONS.md historical entries untouched (they accurately describe what existed at the time).
- **Removed** 2 obsolete BUILD_LIST items (`01_tables.sql` stale rebuild, teacher_library_courses seed drift).

### Mental-model shift
Fresh Supabase bootstrap is now **3 SQL pastes + 2 markdown checklists**:
1. `db/schema.sql`
2. `db/rls.sql`
3. `db/seed_data.sql`
4. `db/setup/workers_deploy.md` + `db/setup/supabase_auth_storage.md`

Source-of-truth layer: `db/schema.sql` + `db/rls.sql` + `db/seed_data.sql`. Audit-history layer: `db/migrations/`. One home per concern, zero silent drift surface.

### Next session — priority 1
- **Resume MyTeacher feature audit** — re-test feature by feature systematically. Yesterday's smoke pass surfaced 5 latent bugs; less-travelled flows (quiz publish, quiz attempt, results, bank import) almost certainly have more.
- **Launch blockers from BUILD_LIST** — remove test accounts (MANUAL_TEST rows), email confirmation flow (5 items), custom domain on Cloudflare, question bank content review, Paystack TEST→LIVE keys.

---

## Session — 2026-04-17 (Claude Web + Claude Desktop)

### Done
- **Library tables rename** — 10 tables renamed `library_X` → `teacher_library_X`
  (accounting, anatomy, english, government, management, microbiology,
  pharmacology, physiology, sociology, surveying). Migration:
  `db/migrations/rename_library_tables_to_teacher_library.sql`. Applied to
  dev + prod. Both smoke-tested (teacher library page loads, course detail
  queries hit renamed tables and return 200).
- **RLS policies renamed** alongside the tables (`Anyone can read library_X`
  → `Anyone can read teacher_library_X`) — metadata-only, no behaviour change.
- **Prod library seed** — copied 100 sample questions (10 per table) from
  dev → prod so prod smoke tests have realistic content.
- **Repo updates**: `db/schema.sql` section 5.9b, `db/rls.sql` new 16b
  documentation comment, `db/prod-setup/04_seed_data.sql` items_table
  values, `docs/question-schema-plan.md` examples. Skipped stale
  `db/prod-setup/01_tables.sql` + `03_rls.sql` (separate rebuild task).
- **Zero code changes needed** because `resolveLibraryRefs()` in
  `myteacher-api.js` reads `items_table` dynamically from the catalogue.

### Surfaced during this session
- `04_seed_data.sql` has only 5 `teacher_library_courses` rows; dev + prod
  have 10. Seed file drifted from reality — logged on BUILD_LIST.
- 10 library item tables allow unauthenticated SELECT; `teacher_library_courses`
  does not. Inconsistency logged on BUILD_LIST.

### Next session — priority 1
- **Resume MyTeacher feature audit** — re-test feature by feature systematically.
  Yesterday's smoke pass surfaced 5 latent bugs; less-travelled flows (quiz
  publish, quiz attempt, results, bank import) almost certainly have more.
- **Launch blockers from BUILD_LIST** — remove test accounts (MANUAL_TEST rows),
  email confirmation flow (5 items), custom domain on Cloudflare, question bank
  content review, Paystack TEST→LIVE keys.
- **Stale `db/prod-setup/01_tables.sql` + `03_rls.sql`** — rebuild from
  `schema.sql` + `rls.sql` when there's a window.

---

## Session — 2026-04-17 (Claude Code)

### Done
- **Email worker split** — decomposed shared worker into `mynmclicensure/workers/email-worker/` (WELCOME_STUDENT, SUBSCRIPTION_ASSIGNED, SUBSCRIPTION_REVOKED, PAYMENT_SETUP_REQUIRED) and `myteacher/workers/email-worker/` (WELCOME_TEACHER, CLASS_JOIN_APPROVED). Old shared worker archived.
- **Payment worker moved** into `mynmclicensure/workers/payment-worker/`. Renamed on Cloudflare: `qacademy-licensure-payment-worker` (prod) / `qacademy-dev-licensure-payment-worker` (dev). Old `payments-worker/` archived.
- **Config split fixes** — each product's `js/config.js` now points to its own email + payment workers. Fixed dev anon key typo (extra "i" → 401 errors across all Supabase calls).
- **`.wrangler/` + `node_modules/`** added to `.gitignore`.
- **BUILD_LIST.md** — added "Licensure Table Renaming" as its own sprint-sized initiative (decisions + scope + table list).
- **README.md / CLONING.md / db/prod-setup/05_workers_deploy.md** updated to reflect per-product workers.
- **Smoke tests — Licensure (dev, full pass):**
  - Login: email, Google, magic link ✓
  - Emails: WELCOME_STUDENT, SUBSCRIPTION_ASSIGNED, SUBSCRIPTION_REVOKED, PAYMENT_SETUP_REQUIRED ✓
  - Payment worker: all 8 routes incl. backdate ✓
- **Smoke tests — MyTeacher (dev, full pass):**
  - Login: teacher, admin, student (email/Google/magic link) ✓
  - Session cap (2) enforced ✓
  - WELCOME_TEACHER email on admin approval ✓
  - Programme creation ✓ (unblocked by RLS fix below)
  - Class creation ✓ (unblocked by FK fix below)
  - Student join-by-code → teacher approve ✓
  - CLASS_JOIN_APPROVED email ✓
- **RLS bug fixed** — `db/migrations/fix_teacher_rls_helper_functions.sql`. 26 policies across 9 MyTeacher content tables (teacher_profiles, programmes, cohorts, courses, bank_items, classes, quizzes, quiz_classes, quiz_items) were using `auth_user_id()` / `auth_user_role()` (read `public.users`). Swapped to `myteacher_user_id()` / `myteacher_user_role()` (read `teacher_users`). Applied to dev, policies updated in `db/rls.sql`, LESSON 3 rewritten to document the two helper pairs.
- **FK bug fixed** — `db/migrations/fix_teacher_fk_to_teacher_users.sql`. 8 FKs across 6 MyTeacher tables (teacher_bank_items, teacher_classes, teacher_class_members x2, teacher_quizzes, teacher_quiz_classes, teacher_quiz_attempts x2) still referenced `users(user_id)` after the auth split. Dropped + recreated against `teacher_users(user_id)`. FK declarations added to `db/schema.sql` section 5.12 (they had never been in any repo file — only in the live DB).
- **BUILD_LIST additions**:
  - Harden `teacher_classes_select` — move `getClassByJoinCode()` to SECURITY DEFINER RPC, then tighten the policy.
  - Rebuild `db/prod-setup/01_tables.sql` from `db/schema.sql` — currently stale, missing the MyTeacher auth-split tables and FK block. Do before next prod bootstrap.
- **SESSIONS.md** — created this file (and renamed to uppercase for consistency).

- **Prod mirror applied** ✓ — both migrations (`fix_teacher_rls_helper_functions`, `fix_teacher_fk_to_teacher_users`) applied to prod Supabase (`qizhyhjeqhaybyddsuni`). Prod was actually missing the teacher_id/user_id FKs entirely (never had referential integrity on those columns), so the FK migration acted as a pure add. Verified: 0 bad policies, 0 bad FKs, 8 good FKs.
- **Prod Cloudflare workers deployed** ✓ — all three prod workers now live: `qacademy-licensure-email-worker`, `qacademy-myteacher-email-worker`, `qacademy-licensure-payment-worker`. User set secrets via Cloudflare dashboard.
- **`main` merged to `production` branch** ✓ — fast-forward only, 39 commits + subsequent fixes. Cloudflare Pages now serves the post-split code.
- **Prod smoke test — all 7 steps pass** ✓:
  1. Licensure login all three methods ✓
  2. MyTeacher login all three roles ✓
  3. Licensure registration → WELCOME_STUDENT email ✓
  4. MyTeacher teacher registration → admin approval → WELCOME_TEACHER email ✓
  5. Programme/cohort/course/class creation (validates today's RLS + FK fixes) ✓
  6. Student join by code → teacher approval → CLASS_JOIN_APPROVED email → student sees class ✓
  7. Licensure payment flow: Paystack init → checkout → webhook → activation → SUBSCRIPTION_ASSIGNED email ✓. Also tested admin grant/revoke emails ✓ and retry activation ✓ (after bug fix below).
- **Prod-specific fixes surfaced during smoke test:**
  - **createClass cohort_id drop** — `myteacher-api.js` `createClass()` had an allowlist of opts fields to copy into the insert row; `cohort_id` was missing. Classes saved with null cohort_id regardless of user selection. One-line fix.
  - **Missing PostgREST FKs (7 of them)** — `add_missing_teacher_fks_part2.sql`. Prod was missing every parent-child FK on teacher_ tables (class_id, teacher_quiz_id refs) that dev had. This blocked PostgREST nested-select embeds (`.select('teacher_classes(...)')`) used across the app, including the student "my classes" page. Zero orphans, added directly. Required `NOTIFY pgrst, 'reload schema'` post-apply.
  - **retryActivation worker URL** — admin payments page read the worker URL from the DB `config` table (`payments_worker_url`), not from `config.js`. DB row was stale pointing to a worker that no longer exists. Refactored `retryActivation()` to use `PAYMENTS_API_BASE` directly (single source of truth), removed the DB config row from dev + prod, and dropped it from `prod-setup/04_seed_data.sql`. Dev had the same stale URL — never noticed because retry wasn't exercised during dev smoke.
- **Paystack launch blocker flagged on BUILD_LIST** — prod payment worker is currently using Paystack TEST keys (revealed during step 7). Must swap to LIVE keys via Cloudflare dashboard before real customers arrive.
- **`teacher_config` table added** (`db/migrations/add_teacher_config_table.sql`) — empty MyTeacher mirror of the Licensure `config` table. Any logged-in user can SELECT, only MyTeacher admins can write. Future feature migrations will add their own keys. Applied to dev + prod.

### Next session — priority 1
- **Library tables rename** — `library_X` → `teacher_library_X` for all 10 library_* tables (accounting, anatomy, english, government, management, microbiology, pharmacology, physiology, sociology, surveying). All tables empty on dev + prod (verified), so pure DDL rename + update `teacher_library_courses.items_table` seed values. **Zero code changes needed** because `resolveLibraryRefs()` in myteacher-api.js reads table names dynamically from the DB column, not from a JS constant. Steps:
  1. Create migration `db/migrations/rename_library_tables_to_teacher_library.sql`
  2. `ALTER TABLE library_X RENAME TO teacher_library_X` × 10
  3. `UPDATE teacher_library_courses SET items_table = REPLACE(items_table, 'library_', 'teacher_library_')`
  4. `NOTIFY pgrst, 'reload schema'`
  5. Apply to dev, then prod
  6. Update `db/schema.sql` (section 5.9b — CREATE TABLE library_anatomy + 9 sibling comments)
  7. Update `db/rls.sql` (RLS policies on the library_* tables)
  8. Update `db/prod-setup/04_seed_data.sql` (seed row `items_table` values)
  9. Update `docs/question-schema-plan.md` examples
  10. SKIP `db/prod-setup/01_tables.sql` + `03_rls.sql` — already stale, need full rebuild as a separate task

### Next session — other
- **Resume MyTeacher feature audit** — re-test feature by feature systematically. Today's smoke pass surfaced 5 latent bugs; less-travelled flows (quiz publish, quiz attempt, results, bank import) almost certainly have more.
- **Launch blockers from BUILD_LIST** — remove test accounts (MANUAL_TEST rows), email confirmation flow (5 items), custom domain on Cloudflare, question bank content review, Paystack TEST→LIVE keys.
- **Stale `db/prod-setup/01_tables.sql` + `03_rls.sql`** — rebuild from `schema.sql` + `rls.sql` when there's a window. Today's discoveries prove these files are a real liability — every missing declaration is a time bomb for fresh prod bootstraps.
