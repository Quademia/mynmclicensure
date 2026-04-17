# Build List

**Status: MVP complete — preparing for free trial launch (May 2026)**

Last updated: April 2026

---

## Launch Blockers

These must be done before real users touch the platform.

### Infrastructure
- [x] Set up dev/prod split — separate Supabase project, GitHub repo, Cloudflare Pages, payments + email workers. Mirror pipeline from production branch. Hostname detection in config.js.
- [ ] Set up custom domain on Cloudflare
- [ ] Remove test accounts (MANUAL_TEST rows)
- [ ] Review and clean up question bank content
- [ ] **Swap Paystack secret on prod payment worker from TEST → LIVE key.** Currently prod uses Paystack test keys, so no real customer can complete a payment. Live key must be set via Cloudflare dashboard on `qacademy-licensure-payment-worker` before real users arrive.

### Email Confirmation (on hold — required before real users)
- [ ] Turn on email confirmation in Supabase Auth
- [ ] "Check your inbox" screen after registration
- [ ] Unconfirmed email error state on login.html
- [ ] Resend confirmation button
- [ ] Password reset confirmation email (custom branded via email worker)

---

## Post-Launch Polish

Important but won't block the free trial. Real user feedback will help prioritise.

### Empty States & UI Polish
- [ ] Empty state guidance on every page ("No quizzes yet — create your first one")
- [ ] Skeleton loaders replacing "Loading..." text
- [ ] Stats bar on learning-history reflects loaded page only — needs separate count query for true totals

### Code Cleanup
- [ ] Harden `teacher_classes_select` — currently allows any logged-in user to read active class rows so students can look up classes by join_code. Move `getClassByJoinCode()` to a SECURITY DEFINER RPC and tighten the policy to teacher-or-admin-or-member only.
- [ ] Consolidate escapeHtml() and safeText() in utils.js
- [ ] Revisit session expiry length (currently 7 days)
- [ ] users.last_login_utc — wire up or drop
- [ ] users.username — wire up or drop
- [ ] README and CLONING files need updating to reflect current folder structure and My Teacher naming
- [ ] `db/prod-setup/01_tables.sql` is stale — missing all MyTeacher auth-split tables (teacher_users, teacher_sessions, teacher_auth_events, teacher_reset_requests) and the MyTeacher FK block. Rebuild from `db/schema.sql` before the next prod bootstrap.

### Product Separation
- [x] Auth split complete — each product has own user table, session table, guard/auth JS, and auth pages (see docs/sprints/myteacher-clean-split.md)
- [x] MyTeacher JS files moved into myteacher/js/ — myteacher-api.js, myteacher-teacher-nav.js, myteacher-student-nav.js, myteacher-admin-nav.js
- [x] Create MyTeacher auth RPCs: log_mt_auth_event, check_mt_login_rate_limit, log_mt_reset_request, check_mt_reset_rate_limit, mark_mt_reset_used
- [x] Copy utils.js into myteacher/js/utils.js and update all MyTeacher pages to use it
- [x] Copy css/style.css into myteacher/css/style.css and update all MyTeacher pages to use it
- [x] Split paths.js — create myteacher/js/paths.js with MYTEACHER constant only, update MyTeacher pages to load it instead of root paths.js
- [x] Copy all Licensure JS files into mynmclicensure/js/ (api, sidebars, guard, auth, paths, utils)
- [x] Copy style.css into mynmclicensure/css/ and redirect all Licensure pages
- [x] Make product-select.html self-contained with inline styles
- [x] Archive root css/ folder — no active references remain
- [x] Switch link in MyTeacher topbar updated to point to product-select.html
- [x] Fixed duplicate guard.js and api.js loads in quiz-builder.html
- [x] Split config.js into product-local copies (mynmclicensure/js/ and myteacher/js/)
- [x] Archive root js/ folder — js/ no longer exists at root
- [x] Archive root css/ folder — css/ no longer exists at root
- [x] Move Licensure landing page into mynmclicensure/index.html
- [x] Create clean company root index.html — no product dependency
- [x] Create MyTeacher landing page — myteacher/index.html
- [x] All three landing pages link back to root consistently
- [x] Move email worker references into product-local scope (split into mynmclicensure/workers/email-worker/ and myteacher/workers/email-worker/, archived old shared workers/)
- [x] Move payments worker into mynmclicensure scope (mynmclicensure/workers/payment-worker/, archived old payments-worker/)
- [x] Rename payments worker to qacademy-licensure-payment-worker (dev: qacademy-dev-licensure-payment-worker)

**Code-level product separation is complete.** All remaining "separation" work is database hygiene — see "Licensure Table Renaming" below.

### Licensure Table Renaming (own initiative — sprint-sized)

When MyTeacher was carved out, every new MyTeacher table got a `teacher_` prefix (`teacher_users`, `teacher_classes`, `teacher_quizzes`, etc.). Licensure tables kept their original generic names from the pre-split era (`users`, `sessions`, `subscriptions`, `payments`, `quizzes`, `attempts`, etc.), so the schema is asymmetric — Licensure looks like "the default" and MyTeacher looks like "the addon." This initiative renames every Licensure table to a `licensure_` prefix so both products read symmetrically in the schema.

**Why it's a sprint, not an afternoon:**
- Foreign keys across dozens of tables need updating
- All RLS policies in `db/rls.sql` reference table names in subqueries and need rewriting
- All RPCs (`log_auth_event`, `check_login_rate_limit`, `auth_user_role`, `auth_user_id`, etc.) embed table names in SQL bodies — drop and recreate
- ~80–100 `db.from('users')`-style call sites in `mynmclicensure-api.js`, `guard.js`, `auth.js`, sidebars, and pages — every one must change
- `db/schema.sql` and all four `db/prod-setup/*.sql` bootstrap scripts get rewritten
- Migration runs twice: dev Supabase first, smoke-test, then prod
- Any missed call site silently breaks at runtime ("table does not exist") only when a real user hits it

**Decisions to make before starting:**
- [ ] Naming convention — `licensure_users` (matches `teacher_users`) or `lic_users` (shorter)?
- [ ] Scope — every Licensure table, or only the core identity tables (`users`, `sessions`, `auth_events`, `reset_requests`)?
- [ ] Compatibility window — use a transitional `CREATE VIEW users AS SELECT * FROM licensure_users` so old code keeps working during the sweep, or big-bang cutover?
- [ ] Cutover style — single migration on a quiet day, or rolling table-by-table

**Tables in scope (full list, for sizing):**
`users`, `sessions`, `auth_events`, `reset_requests`, `subscriptions`, `payments`, `programs`, `courses`, `products`, `quizzes`, `attempts`, `items_*` (11 tables), `announcements`, `messages_threads`, `messages`, `config`, `offline_packs`, `user_notice_state`

**Pick this up only when:**
- No active feature work is mid-flight on Licensure
- Dev Supabase is in a known-good state for testing
- You have a clear window to deploy and smoke-test before real users hit prod

### Move Business Logic Server-Side
- [ ] Look into new stack that offers proper backend — almost all business logic lives in the browser
- [ ] DB transactions for multi-step ops (quiz publish, subscription assign)
- [ ] Create Supabase RPCs or worker endpoints for admin bulk ops, subscription assignment, quiz publish, result release
- [ ] Correlation IDs on key flows (payment, join, publish, submission)
- [ ] Explore moving config from the front end

### Admin Tools
- [ ] Admin create user
- [ ] Admin token audit / sessions audit / auth events audit
- [ ] Admin reset request audit (data already in reset_requests table)
- [ ] Admin expiry reminder / auto expiry reminder
- [ ] Admin diagnostics — failed payments view, failed ops log
- [ ] Admin Users page Stage 2 — Quiz History and Payment History panels in user side panel

### Features & Enhancements
- [ ] Telegram for premium members
- [ ] Export/print — CSV for teachers, PDF results for students
- [ ] Search — courses, questions, messages
- [ ] Notifications — quiz published, results released, join approved
- [ ] Student analytics — strength/weakness, progress trends
- [ ] Teacher guidance / how-to pages
- [ ] Accessibility basics — semantic HTML, aria labels, keyboard nav on key flows
- [ ] teacher_ref column on teacher_bank_items
- [ ] Sequential runner mode
- [ ] My Teacher payment model — define tiers when platform has real users
- [ ] Introduce a teacher public question bank for sharing of resources
- [ ] Introduce tagging system into question bank
- [ ] Introduce MyTeacher exams listing timeline

### Testing
- [ ] Playwright smoke tests for 8 critical paths
- [ ] Audit/event logging for important actions (payment, publish, archive, grant subscription)
- [ ] Retry mechanisms on failed data loads

### Future
- [ ] Beta v2 rebuild in React + Next.js — planned, not started
- [ ] Rotate Supabase anon key if ever committed publicly
- [ ] BIMI record — shows QAcademy logo next to sender name in Gmail inbox. Requires DMARC setup + Verified Mark Certificate (~$1,000/year). Revisit post-revenue.

---

## Completed Work

### Sprint 1: Security Hardening (April 2026)
RLS on all 36 tables, XSS fixes (4 locations + safeText/escapeHtml helpers), CORS fix on payments worker, payment timestamp validation, crypto.getRandomValues() for IDs, rate limiting on payment endpoints, sensitive writes moved behind trusted boundaries.

### Sprint 2: Service Boundaries (April 2026)
Pagination on all admin and student list pages (users, payments, fixed-quizzes, bank, learning-history). DB-side search replacing client-side filtering (users, bank, messages, recipient resolution). Narrow select replacing select('*') on all list queries (users, payments, subscriptions, quizzes, bank, attempts, classes, messages). Fixed payments.created_at schema mismatch.

### Sprint 3: Auth Hardening (April 2026)
- Auth events table for login attempt tracking
- Rate limit on login (5 fails / 10 min → lockout, 10 fails / 24 hr → long lockout)
- Rate limit on password reset (3 per email per 60 min) — dedicated reset_requests table with full audit trail (user_exists, status, device info, used tracking). Admin UI deferred.
- Login methods: username + password, Google OAuth, magic link (passwordless email)
- Reset password error handling for invalid/expired/replaced links

### Slices 12–14: Academic Structure (April 2026)
- 3 new tables: teacher_programmes, teacher_cohorts, teacher_courses (all with RLS)
- CRUD APIs for all three + self-contained panel components (programmes-panel.js, cohorts-panel.js, courses-panel.js)
- Academic Structure page (academic-structure.html) with all three panels, added to teacher nav as "Academics"
- Classes wired to cohorts: cohort dropdown replaces programme/course text fields, class list grouped by cohort, auto-suggested titles
- Quizzes wired to courses: course dropdown replaces subject free-text, backward compat for old quizzes with subject hint
- Key decision: courses link through quizzes only (not classes). A class = cohort + semester (student group). A quiz = course (subject identity)
- Schema: cohort_id on teacher_classes, course_id on teacher_quizzes. Both nullable for backward compat. 39 tables total

### Sprint 4: Emails & Error Hardening (April 2026)
- Email worker via Cloudflare Worker + Resend API (welcome student, welcome teacher, class join approved, subscription assigned/revoked, payment setup required)
- Shared injectable email footer across all templates
- Fixed 14 silent catch blocks in myteacher-api.js
- Standardised error response shapes in mynmclicensure-api.js (ok→success, error→code, added missing messages)
- User-facing error states verified on all 4 critical flows (login, quiz submission, join class, payment)
- Moved 4 mynmclicensure-only pages (register, subscribe, payment-confirmation, premium-prep) from root into /mynmclicensure/

### MyTeacher Clean Split (April 2026)
Full auth separation between MyTeacher and MyNMCLicensure. New tables: teacher_users (originally myteacher_users — renamed post-sprint), teacher_sessions, teacher_auth_events, teacher_reset_requests. New JS: myteacher-guard.js, myteacher-auth.js. New pages: myteacher/login, forgot-password, reset-password, router, access-request + mynmclicensure equivalents. Root login.html converted to product-select.html (product selector entry point). All 18 MyTeacher pages swapped to myteacher-guard.js. myteacher-api.js, nav files, and register pages updated. Root forgot-password, reset-password, router deleted. Post-sprint: teacher_profiles FK/RLS bug fixed, all 5 MyTeacher RPCs created and confirmed, router pending-teacher intercept and OAuth session creation added, access-request.html moved to myteacher/ and boot() rebuilt with full status states.

### Question Schema Phase 3: CSV Import Update (April 2026)
- CSV import now supports question_ref, tags, batch_id, year_level, bloom_level columns
- Reordered columns: question_ref first, new metadata at end
- Updated template download, AI prompt, and instructions modal with new columns
- Fixed shuffle_options case-sensitivity bug (TRUE/True/true all work now)
- TF questions always force shuffle_options to false
- Added bloom_level validation (rejects invalid values)
- Full preview table showing all 27 columns with horizontal scroll
- Cancel button on validation step returns to upload screen
- Loading overlay with spinner and progress during import
- Added teacher nav bar to import page
