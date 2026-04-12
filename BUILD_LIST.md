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
- [ ] Consolidate escapeHtml() and safeText() in utils.js
- [ ] Revisit session expiry length (currently 7 days)
- [ ] users.last_login_utc — wire up or drop
- [ ] users.username — wire up or drop
- [ ] README and CLONING files need updating to reflect current folder structure and My Teacher naming

### Product Separation
- [x] Auth split complete — each product has own user table, session table, guard/auth JS, and auth pages (see docs/sprints/myteacher-clean-split.md)
- [ ] Rename `public.users` → `licensure_users` (deferred — requires DB migration + full Licensure codebase sweep)
- [ ] Create MyTeacher auth RPCs: log_mt_auth_event, check_mt_login_rate_limit, log_mt_reset_request, check_mt_reset_rate_limit, mark_mt_reset_used
- [ ] Add Supabase redirect URL allowlist entries for mynmclicensure/* and myteacher/* (manual — Supabase dashboard)

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
Full auth separation between MyTeacher and MyNMCLicensure. New tables: myteacher_users, teacher_sessions, teacher_auth_events, teacher_reset_requests. New JS: myteacher-guard.js, myteacher-auth.js. New pages: myteacher/login, forgot-password, reset-password, router + mynmclicensure equivalents. Root login.html converted to product selector. All 18 MyTeacher pages swapped to myteacher-guard.js. myteacher-api.js, nav files, and register pages updated. Root forgot-password, reset-password, router deleted.

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
