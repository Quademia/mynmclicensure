# Sessions Log

Running log of work sessions. Each entry: what was done + what's queued for next session.
Newest session on top.

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

### Next session
- **Prod mirror of the two fixes** — apply `fix_teacher_rls_helper_functions.sql` and `fix_teacher_fk_to_teacher_users.sql` to prod Supabase (`qizhyhjeqhaybyddsuni`). Before applying FK migration to prod: verify all affected tables have zero orphan rows (same check I ran on dev) — prod has real legacy data, so orphans are possible and would block the FK creation.
- **Resume MyTeacher feature audit** (paused earlier at user's request — one-thing-at-a-time).
- **Stale `db/prod-setup/01_tables.sql`** — rebuild from schema.sql when there's a window.
