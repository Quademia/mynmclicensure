# MyTeacher Clean Split — Sprint Plan

**Status: COMPLETE (April 2026)**

## Goal

Separate MyTeacher and MyNMCLicensure at the auth layer so each product has its own:
- User table
- Session table
- Auth audit table
- Password reset table
- Guard / auth JS files
- Login, forgot-password, reset-password, and router pages

Supabase Auth (`auth.users`) remains shared — it is the login identity for both products.

---

## Guiding Principles

- **Additive first** — create new tables/files before touching existing ones
- **Licensure untouched** — `public.users` keeps its name this sprint; rename deferred to a future sprint
- **Fail-open RPCs** — MyTeacher-specific RPCs (log_mt_auth_event etc.) do not yet exist; all calls are fire-and-forget and fail gracefully
- **No PRs** — all changes pushed directly to main

---

## Batch 1 — Supabase DB (dev → prod)

| Step | Description | Status |
|------|-------------|--------|
| 1 | Create `myteacher_users` table | ✅ |
| 2 | Create `teacher_sessions` table | ✅ |
| 3 | Create `teacher_auth_events` table | ✅ |
| 4 | Create `teacher_reset_requests` table | ✅ |
| 5 | Create `myteacher_user_id()` helper function | ✅ |
| 6 | Create `myteacher_user_role()` helper function | ✅ |
| 7 | RLS policies for all 4 new tables | ✅ |
| 8 | Update `teacher_class_members` RLS to use `myteacher_user_id()` | ✅ |
| 9 | Update `teacher_quiz_attempts` RLS to use `myteacher_user_id()` | ✅ |

## Batch 2 — New JS Files

| Step | Description | Status |
|------|-------------|--------|
| 10 | Create `myteacher/js/myteacher-guard.js` | ✅ |
| 11 | Create `myteacher/js/myteacher-auth.js` | ✅ |

Key differences from root `js/guard.js` and `js/auth.js`:
- Reads from `myteacher_users` (not `users`)
- Session table: `teacher_sessions` (not `sessions`)
- localStorage key: `mt_session_id` (not `qa_session_id`)
- Redirects: `/myteacher/login.html` and `/myteacher/router.html`

## Batch 3 — MyTeacher Auth Pages

| Step | Description | Status |
|------|-------------|--------|
| 12 | Create `myteacher/login.html` | ✅ |
| 13 | Create `myteacher/forgot-password.html` | ✅ |
| 14 | Create `myteacher/reset-password.html` | ✅ |
| 14b | Create `myteacher/router.html` | ✅ |

## Batch 4 — Wire Existing MyTeacher Pages

| Step | Description | Status |
|------|-------------|--------|
| 15 | Swap `/js/guard.js` → `/myteacher/js/myteacher-guard.js` in all teacher pages (10 files) | ✅ |
| 16 | Swap guard in all student pages (5 files) | ✅ |
| 16b | Swap guard in all admin pages (2 files) | ✅ |
| 17 | Update `myteacher/register.html` — login.html → myteacher/login.html, insert into myteacher_users | ✅ |
| 18 | Update `js/myteacher-api.js` — 3 queries from `users` → `myteacher_users` | ✅ |
| 19 | Update `teacher_class_members` RLS | ✅ (done in Batch 1) |
| 20 | Update `teacher_quiz_attempts` RLS | ✅ (done in Batch 1) |

## Batch 5 — Auth Split + Product Selector

| Step | Description | Status |
|------|-------------|--------|
| 21 | Fix stragglers: access-request.html (moved to myteacher/), admin/teachers.html, nav JS files | ✅ |
| 22 | Create `mynmclicensure/login.html`, `forgot-password.html`, `reset-password.html`, `router.html` | ✅ |
| 23 | Update `js/guard.js` + all Licensure pages to use `/mynmclicensure/*` paths | ✅ |
| 24 | Convert root `login.html` to product selector | ✅ |
| 25 | Delete root `forgot-password.html`, `reset-password.html`, `router.html` | ✅ |
| 26 | Update CLONING.md, BUILD_LIST.md, this doc | ✅ |

---

## What Was NOT Changed This Sprint

- `public.users` table name — still named `users`. Rename to `licensure_users` deferred to a future sprint.
- MyTeacher RPCs (`log_mt_auth_event`, `check_mt_login_rate_limit`, `log_mt_reset_request`, `check_mt_reset_rate_limit`, `mark_mt_reset_used`) — all 5 now live on both dev and prod Supabase.
- Supabase Auth redirect URL allowlist — must manually add `mynmclicensure/*` and `myteacher/*` in Supabase dashboard.

---

## Supabase Redirect URLs to Add Manually

In the Supabase dashboard → Auth → URL Configuration → Redirect URLs, add:
- `https://yourdomain.com/mynmclicensure/login.html`
- `https://yourdomain.com/myteacher/login.html`
- `https://yourdomain.com/mynmclicensure/reset-password.html`
- `https://yourdomain.com/myteacher/reset-password.html`

---

## Post-Sprint Fixes (April 2026)

Issues caught during end-to-end testing after the initial push, all resolved before launch.

| Fix | Detail |
|-----|--------|
| **`myteacher_users` renamed to `teacher_users`** | Table renamed in Supabase via `ALTER TABLE`. Helper functions `myteacher_user_id()` and `myteacher_user_role()` updated to query `teacher_users`. All 11 file references updated (rls.sql, schema.sql, guard files, auth pages, api). |
| **`teachers.html` role update bug** | `setTeacherStatus()` was writing `role: 'TEACHER'` to `public.users` (Licensure table) instead of `teacher_users`. Fixed. |
| **`teacher_profiles` FK + RLS bug** | FK constraint pointed to `public.users.user_id` instead of `teacher_users.user_id` — blocked all teacher profile inserts silently. RLS INSERT policy also pointed at `public.users`. Both fixed in dev Supabase. |
| **Router — pending teacher intercept** | Added STUDENT intercept in `myteacher/router.html`: if a STUDENT role user has a `teacher_profiles` row, redirect to `access-request.html` before hitting the student dashboard. |
| **Router — OAuth/magic link session creation** | `myteacher/router.html` now creates an `mt_session_id` on load if none exists, covering OAuth and magic link login flows that bypass `login.html`. |
| **Student redirect changed** | Router changed STUDENT destination from `my-classes.html` to `dashboard.html`. |
| **Student dashboard overlay UX** | Join overlay now shows a helper text ("Ask your teacher for a class code…") and a Sign out link for students with no code. |
| **All 5 MyTeacher RPCs created** | `log_mt_auth_event`, `check_mt_login_rate_limit`, `log_mt_reset_request`, `check_mt_reset_rate_limit`, `mark_mt_reset_used` — all applied to dev Supabase and documented in `db/rls.sql`. Previously fail-open stubs, now fully wired. |
| **`access-request.html` moved and rebuilt** | Moved from `myteacher/teacher/access-request.html` to `myteacher/access-request.html`. All 4 redirect references updated. `boot()` rewritten to read `teacher_profiles` on load and show correct state: no row → blank form; PENDING → status card + resubmit button; REJECTED → status card + pre-filled form; DISABLED → disabled message + sign out only; APPROVED/unknown → redirect to router. |
| **Prod migration** | 3 users inserted into `teacher_users` (2 approved teachers + 1 admin). All 4 Supabase batches (tables + RLS, RPCs, RLS policy updates, user migration) applied to prod. |
