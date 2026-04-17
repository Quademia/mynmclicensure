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
- **Smoke tests — MyTeacher (dev, partial):**
  - Login: teacher, admin, student (email/Google/magic link) ✓
  - Session cap (2) enforced ✓
  - WELCOME_TEACHER email on admin approval ✓
- **RLS bug diagnosed** — 21 policies across 7 MyTeacher tables reference `auth_user_id()` / `auth_user_role()` (Licensure helpers that read `public.users`). Freshly-registered teachers have no row in `public.users`, so helpers return NULL and INSERT/SELECT fails (code 42501). Affected tables: `teacher_programmes`, `teacher_cohorts`, `teacher_courses`, `teacher_bank_items`, `teacher_classes`, `teacher_quizzes`, `teacher_quiz_classes`. Fix plan drafted.

### Next session
- **Execute RLS fix** (approved, not yet applied):
  - Create `db/migrations/fix_teacher_rls_helper_functions.sql` — DROP + CREATE 21 policies, swapping to `myteacher_user_id()` / `myteacher_user_role()`. Preserve `OR auth.uid() IS NOT NULL` fragment in `teacher_classes_select` (join_code lookup — LESSON 2).
  - Update `db/rls.sql` with new policy blocks + add sections for `teacher_programmes/cohorts/courses` (not currently in rls.sql). Update LESSON 3 to explain split helpers.
  - Apply migration to dev Supabase via MCP.
  - User retries programme creation from live session to verify.
  - Add BUILD_LIST item: tighten `teacher_classes_select` by moving `getClassByJoinCode()` to SECURITY DEFINER RPC.
  - Commit + push.
- **Finish MyTeacher smoke test** — last untested dev email event: `CLASS_JOIN_APPROVED`.
- **Then continue** the general MyTeacher feature audit (paused earlier at user's request — one-thing-at-a-time).
