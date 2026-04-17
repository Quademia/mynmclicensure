# Sessions Log

Running log of work sessions. Each entry: what was done + what's queued for next session.
Newest session on top.

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
