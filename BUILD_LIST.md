# MyNMCLicensure Build List

The inventory of slices: everything built, everything queued, everything
parked, one line each. The first section is the port (`rebuild.md`),
finished 2026-09-16 and kept as history; *Improvements* is the live
list. Rebuilt to this shape on 2026-09-10 when the port was planned;
the gamma-era list it replaces is in git history and in `qacademy-gamma`.

## Rules for this file

- **One line per slice:** `- <mark> <id> <name> — <date if built>`.
  Under 120 characters. No explanation, no commit hashes, no merge or
  release status (git holds that).
- **Marks:** ✅ built (with the date) · ⬜ queued · ⏸ parked, with a
  one-line reason · ✖ cancelled.
- **A section per plan doc.** Slice ids are the doc's own ids.
- **Built means ticked in two places in one commit:** here and in the
  plan doc's ladder.
- **There is no "next" marker.** Sam decides each session.
- **Unplanned work still gets a line** when done, marked `(unplanned)`.
- **Found mid-build and out of scope:** a ⬜ line in the right section,
  or a ⏸ line with its reason. Never a paragraph.

---

## The port — finished 2026-09-16

### [rebuild.md](docs/product-plan/rebuild.md) (the plan called it "the rebuild")

- ✅ 0 Repo reshape — old tree to `legacy/`, MyTeacher and residue deleted — 2026-09-10
- ✅ 1 Scaffold — Next app, Workers, deploy + migrate workflows, schema `licensure_gh`, runner — 2026-09-10
- ✅ 1b First dev deploy — deploy-dev + migrate-dev green, licensure-dev live — 2026-09-11
- ✅ 1c One Cloudflare account — both Workers on the workspace account, one plan fee — 2026-09-10
- ✅ (unplanned) Release branch named `production` — two prod workflows and the docs retargeted — 2026-09-10
- ✅ 2a Auth — tables incl. `programs`, login (three doors), register, forgot, reset, router, logout, gates — 2026-09-11
- ✅ 2b Shell — page header, both sidebars, phone drawer, placeholder dashboards; no footer (legacy has none) — 2026-09-11
- ✅ 3 Catalogue and config — courses, levels, products, config + copy; admin Products / Courses / Config; landing, Premium Prep — 2026-09-11
- ⬜ (unplanned) Paid-plan pause switch lifted for testing 2026-09-11; decide before cutover whether prod launches paused — on prod the 21 paid products are archived (the live pause), so nothing sells until those rows are set active (seen 2026-09-15)
- ✅ 4a Question bank — eleven tables, bucket, entitlement gate, reads, admin page, dev content from prod CSVs — 2026-09-13
- ✅ 4b Question bank — CSV importer: template, upload, row report, upsert on item_id — 2026-09-13
- ✅ 5a Fixed quizzes and mock exams — tables, content copy, availability function, admin pages — 2026-09-13
- ✅ 5b Fixed quizzes and mock exams — student list pages, start / retake / abandon, admin attempt stats — 2026-09-14
- ✅ 6a Runner — attempts table, Quiz Builder, instant mode, resume, review — 2026-09-14
- ✅ 6b Runner — the timed mode: server-stamped start, countdown, auto-submit — 2026-09-14
- ✅ 7a Student home — learning history: stats bar, filters, Load more, Resume / Review / Retake — 2026-09-14
- ✅ (unplanned) §9 #17 — the instant save no longer flips a completed attempt back to in progress — 2026-09-14
- ✅ 7b Student home — portal guide: the static help page, side list, FAQ accordion — 2026-09-14
- ✅ 7c Student home — NMC Procedures: programme card, viewer, the manual list — 2026-09-14
- ✅ 7d Student home — course page: header, days left, quiz previews, builder shortcut, announcements after 11 — 2026-09-14
- ✅ 7e Student home — profile: two editable panels, photo upload to a product bucket, subscription panel, ?complete=1 — 2026-09-14
- ✅ (unplanned) Server Action body cap raised to 3 MB — a 2 MB photo or rationale image no longer refused; rule in AGENTS.md — 2026-09-14
- ✅ 7f Student home — dashboard: nudge, subscription bar, channels, course cards, recent attempts — 2026-09-16
- ✅ 8 Subscriptions — trial at registration, course access, admin grant/update/revoke/sync, the real question gate — 2026-09-13
- ✅ 9a Payments — table, rate limit, the four actions, subscribe, Premium Prep live, confirmation page — 2026-09-15
- ✅ 9b Payments — the upgrade page live, the admin Payments page (rescue buttons, revenue summary) — 2026-09-15
- ✅ (unplanned) First production release — main → production (slices 0–9), the eleven migrations on the prod project, licensure-prod created; no DNS — 2026-09-15
- ✅ 10 Email — four templates, Quademia sender, `appOrigin()` — 2026-09-16
- ✅ 11a Announcements — two tables, server-side scoping (course scope fixed, §9 #19), admin page (no Scheduled status, §9 #18) — 2026-09-14
- ✅ 11b Announcements — student page, dashboard strip on the placeholder, the course page section — 2026-09-14
- ✅ 12a Messaging — tables, the student page, the three contexts, both runners' Send feedback, live replies, the student badge — 2026-09-15
- ✅ 12b Messaging — the admin inbox, New Thread, Bulk Send (batched writes), the admin badge — 2026-09-15
- ✅ 13a Offline packs — table, allowance, non-repeat picker, watermark, the builder, the renderer — 2026-09-14
- ✅ 13b Offline packs — My Packs: list, filters, summary counts, Open / Build Similar — 2026-09-14
- ✅ 14a Admin home — the Users page (drawer, assign, reset, deactivate; ?user_id= opens it) and the dashboard counts — 2026-09-15
- ✅ 14b Admin home — the Attempts analytics page — 2026-09-15
- ✖ 15 Phone pass — not a session of its own: phones kept working with every change (Sam, 2026-09-16)
- ✅ (unplanned) The rebuild's slices declared complete — 16 and 17 moved to *After the rebuild* (Sam) — 2026-09-16

### Decisions still open in rebuild.md

- ✅ §8 S1 user primary key — keep `U_` ids, add the FK — 2026-09-11
- ⬜ §8 S3 attempts blobs → JSONB / arrays
- ✅ §8 S4 foreign keys on licensure tables — 2026-09-11, as each table lands
- ✅ §8 S6 populate `sessions.ip_hash` — 2026-09-11
- ✅ §9 #8 `must_change_password` — left as it is, no gate, column carried — 2026-09-11
- ⬜ §8 has no auth-path entry — the gate's three sequential round trips and the middleware's per-request auth call cannot change until Sam adds one and ticks it (2026-09-16); counted as six trips in D28 (2026-09-18)
- ✅ §8 S9 auth functions and the two alpha columns — the five functions revoked from the browser roles, IP in the limiter, `username` and `must_change_password` dropped — 2026-09-18
- ✅ §8 S10 the users row's browser writes — column-level revoke, server-side profile insert, email lowercased with a unique index (D25–D27) — 2026-09-18
- ✅ §8 S11 messaging storage — browser writes revoked, service-role writes, read stamps on the thread, CHECKs, six columns dropped (D37–D42) — 2026-09-18
- ✅ §8 S12 quiz, mock and announcement storage — course-scoped quiz reads without item_ids, announcements_for_me(), three notice timestamps (D44, D46–D48) — 2026-09-18
- ✅ §8 S13 config, levels and cohort — config admin-only with a registry read by the service role, users.level keyed to levels, cohort a year (D49, D51) — 2026-09-18

## Improvements

The one list, now that the port is finished (2026-09-16): the gaps the
legacy check found, items carried from the gamma era, product changes
and internal findings spotted during the port, the diagnosis findings
Sam has queued, and cutover and the Telegram gate. One line each, with
the work that surfaced it; Sam orders them. A finding in
`post-rebuild-diagnosis.md` gets a line here only when Sam queues it.

### Plans by feature doc

The feature docs `00–07` are the living plan per feature (Sam,
2026-09-19); a doc rewritten into that shape gets a section here with
its own slice ids. The flat lists below keep the items no doc has
taken yet.

#### [02-subscriptions.md](docs/product-plan/02-subscriptions.md)

- ✅ C1 The link table — product_courses with keys, the Products page and five readers on it (S8; D16) — 2026-09-19
- ✅ C2 The access rows — course_access from five writers, one-lookup gate, stored dates (S8; D13–D17, D20) — 2026-09-19
- ⬜ C3 Stacking on, admin forms per row — queued start, hand-picked grant, row edits (rulings 3, 5, 6); Sam's pick

#### [03-quiz-system.md](docs/product-plan/03-quiz-system.md)

- ✅ Q1 The floor — course-scoped reads of active published rows, item_ids and notes server-only, CHECKs (S12; D44, D48) — 2026-09-19
- ✅ Q2 The lifecycle rules — one availability check on the server clock, archive one-way, saveQuiz validation, stats by table, the mock list paged (D45) — 2026-09-19
- ⏸ Q3 Mock exams as a premium exam experience — a design item, ingredients noted, none decided (Sam, 2026-09-18)

#### [05-announcements.md](docs/product-plan/05-announcements.md)

- ⬜ A1 The floor — announcements_for_me(), the table admin-only to read, scope_level text[], CHECKs, the hot-read index (S12, S13; D46, D48)
- ⬜ A2 The notice state — read_at / clicked_at / dismissed_at, a key to the announcement, server-side writes, the strip's ✕ dismisses (S12; D47)
- ⬜ A3 Residue — the body stored once and the <br> per edit ended, keys for the scope arrays, the unused read removed (D48) — later

### The legacy check — gaps found 2026-09-16

Every legacy page compared with its ported route; nothing missing outright. Detail and the minor list: `sessions/2026-09.md`, the legacy check entry. Numbered as reported to Sam; 1–4 first.

- ⬜ 1 Runner autosave restarts its 60 s timer on every answer or flag — steady answering never autosaves; a timed exam loses answers on a closed tab
- ⬜ 2 Runner: a dropped connection at Submit, Save & Resume Later or the timed auto-submit leaves the spinner forever — legacy showed the score
- ⬜ 3 Question Bank: an MCQ with answer C–F switched to TF shows "A (True)" but saves the old letter — every student marked wrong on it
- ⬜ 4 Register: the "N-day free trial — no card required" hint never shows — `trialDays` still null, waiting on slice 8
- ⬜ 5 Sidebar badge, My Courses and name / photo load once in the layout — stale across sidebar clicks; dropdown open state carries across pages
- ⬜ 6 The device check on every save signs a kicked or expired device out mid-quiz, losing unsaved answers — legacy let it finish (§10, unrecorded); fixed with auth item 1: the attempt finishes, the next page refuses (Sam, 2026-09-18)
- ⬜ 7 Quiz Builder and Offline Pack builder: the status line sticks after a failure; "Select a course…" leaves the previous course's topics and counts
- ⬜ 8 Password reset: legacy signed the student straight in, the rebuild asks for a new sign-in — Sam: legacy's way, signed in straight after (2026-09-18)
- ⬜ 9 Admin Messages: the open conversation vanishes when a filter hides its thread, realtime still marks new messages read, no way back on a phone
- ⬜ 10 Admin Payments: after Retry Activation the panel redraws — "Activated ✓" gone, and the panel can close itself
- ⬜ 11 Admin Products: a draft or archived course inside a product is kept on save, where legacy dropped it — Sam to rule
- ⬜ 12 Admin Users: Assign refuses a deactivated account; legacy's Users page allowed it (a second change beyond §9 #24)
- ⬜ 13 A failed database read shows "No config keys found." (Config) and "No active subscriptions found yet." (Upgrade) instead of an error
- ⬜ 14 Offline pack renderer: the course code instead of its title once the course is not active
- ⬜ About 40 minor or cosmetic differences (titles, wording, focus, scroll, spinners) — listed in the session entry; Sam's call whether to tidy
- ⬜ Five legacy bugs the rebuild fixed without a record (history Retake, "%" in Send feedback, inbox unread, picker Subtopic filter, timed pre-Start save) — keep, Sam to confirm
- ⬜ `db/schema.sql` and `db/rls.sql` snapshots omit offline_packs, announcements and user_notice_state — the migrations are complete

### Carried from gamma

Items from the gamma-era list that still apply. Listed so they are not
lost; the ⏸ reasons were written under the port's like-for-like rule.

- ⬜ Content: `items_rphn_disease_ctrl` is empty while its course is active
- ⬜ Content: `items_rm_mid` short of its target set count (540 of 900)
- ⬜ Content: set-size targets for RMHN / NACNAP / RPHN
- ⬜ Remove MANUAL_TEST rows before cutover (moot if cutover deletes old data)
- ⏸ Email confirmation on signup — a product change; not in the like-for-like rebuild
- ⬜ Expiry reminders — a daily pg_cron doorbell to an app route, the email through Resend, a dashboard status line; no run-now button; written against S8's course expiry (Sam, 2026-09-18; auth item 9)
- ⬜ Admin security page: Sessions — a panel in the Users drawer and a platform-wide list with the alpha filters, Revoke on every live row (Sam, 2026-09-18; auth item 4)
- ⬜ Admin security page: Login events tab — filters by email, user, outcome and date, Lift the block (Sam, 2026-09-18; auth item 5)
- ⬜ Admin security page: Reset requests tab — Send reset link, Lift the block, the admin's own sends logged (Sam, 2026-09-18; auth item 6)
- ⬜ Invite by email — student or admin, optional product, a set-password link, the profile finished on arrival; replaces Create User; drops `username` + `must_change_password` (Sam, 2026-09-18; auth item 7)
- ⬜ Last login — written on every successful login, shown in the drawer, a dormant filter on the Users list (Sam, 2026-09-18; auth item 8)
- ⬜ Email outbox + drain — a queue table with a fingerprint, send on the request's tail, pg_cron doorbell retries, an admin emails page with Retry; MyNclex's shape; before item 9 (Sam, 2026-09-18; auth item 10)
- ⬜ Take over the Supabase-sent emails — magic link, reset, confirm (once on), invite minted with generateLink, our templates, through the outbox; the project's templates are shared with MyTeacher (Sam, 2026-09-18; auth item 10)
- ⬜ Supabase dashboard: Auth SMTP set to Resend as the fallback sender, neutral Quademia wording on the project's templates (auth item 10)
- ⏸ Student analytics, notifications, search, sequential runner mode — new features, after
- ⏸ Paystack LIVE key on prod — waits on the company / Paystack-account decision

### Found during the port and since

Product changes spotted while transcribing `legacy/`, internal findings
that were nobody's slice, the two slices moved out of the port when
its slices were declared complete (Cutover, the Telegram gate), and
what the diagnosis and the perf investigation surfaced.

- ⬜ 16 Cutover — DNS, live keys, content re-copy, old logins deleted, `legacy/` removed (moved from the rebuild, Sam, 2026-09-16)
- ⬜ Storage hygiene: ~14 columns, the `levels` table and one config row with no reader or writer (list in the 2026-09-18 session entry) — Sam: some have an unbuilt purpose; review one at a time (2026-09-18); the auth group's five settled by the trace and the read-back (S9, items 7 and 8)
- ✅ Auth holes: EXECUTE revoked on the five auth functions, the limiter counting by IP (D24, S9); the limit checks fail closed (D30) (auth items 2, 3) — 2026-09-19
- ✅ Auth holes under S10: the users row's browser INSERT gone and UPDATE cut to the profile fields (D25), email lowercased and unique (D26), the profile insert server-side (D27) — 2026-09-19
- ⬜ Retention: a nightly pg_cron purge of inactive `sessions` and old `auth_events` rows, window from a config value, as MyNclex does (D29; on auth item 9's clock)
- ⬜ Design system: one shared palette already (MyNclex's tokens file was copied from this app); the foundation is that file extended with status tokens, copied here as styles/tokens.css; the shell per product; the sales pages' second teal Sam's call; the doc after Claude Design's mockups (inventory 2026-09-19)
- ⬜ Courses: the form suggests a code from programme + title, overwritable, the code stays the key; drop the dead page_slug column when the table is next touched; S2 (one items table) before S8 (Sam, 2026-09-19)
- ⬜ A deactivated account signs in, is logged LOGIN_SUCCESS, and is thrown out by the gate too fast to read anything — refuse at login with "This account has been deactivated", log it as a refusal, so the login-events page can show it (seen in Sam's S10 test, 2026-09-19)
- ⏸ Course-level pricing (a standalone price per course, products as bundles, a basket later) — the product stays the single unit of sale; revisit when the course count makes a product per course a chore (Sam, 2026-09-18)
- ⬜ Before cutover: Resend's free plan caps the account shared with MyNclex at 100 emails a day (MyNclex's notes); re-registration day would pass it and lose the rest — the Pro upgrade first (slice 10, 2026-09-16)
- ⬜ Before cutover: the Supabase Auth dashboard settings (redirect allow-list, sender, QAcademy-branded reset and magic-link templates) are recorded nowhere here — check them and add the live address (legacy check, 2026-09-16)
- ⬜ 17 Telegram gate — Connect page, link codes, bot Worker on the DB, allowlist from subscriptions (moved from the rebuild, Sam, 2026-09-16)
- ⬜ A link to Premium Prep from the landing page — legacy never linked it; the page was shared by address only (slice 3, 2026-09-12)
- ⬜ Learning history: the stats bar counts the loaded pages, not the whole history — legacy called true totals deferred (slice 7a, 2026-09-14)
- ⬜ Learning history: Source and Sort work over the loaded pages only; Course / Mode / Status / Search are database-side (slice 7a, 2026-09-14)
- ⬜ Learning history: no Mock option in the Source filter; a mock attempt’s chip shows the raw word "mock" (slice 7a, 2026-09-14)
- ⬜ Procedures: the thirteen NMC manual links are fixed in the page; move them to a table with an admin management page (slice 7c, 2026-09-14)
- ⬜ Offline packs: the renderer’s cover prints "Prepared for: …" twice, the owner line and the stored label beneath it — legacy did (slice 13a, 2026-09-14)
- ⬜ Announcements: each edit re-saves the body through the paragraph converter and adds a line break between paragraphs — legacy did (slice 11a, 2026-09-14)
- ⬜ Profile: the Subscription panel shows one active subscription, the first returned, even when the student holds two — legacy did (slice 7e, 2026-09-14)
- ✅ Profile: the photo is one file per student overwritten in place and the cached old one kept showing — a version stamp on the saved address (Sam, 2026-09-14)
- ⬜ Payments: the server creates the account at PAID and queues a set-password link; the setup token, its two columns and the rescue go; the form shrinks to a password (D31, Sam 2026-09-18)
- ⬜ Payments: verify answers status and product to anyone; a same-browser cookie set at init shows the password form, otherwise the emailed link (D33, Sam 2026-09-18)
- ✅ Payments: Paystack's replies trimmed before saving — channel, card_type, last4 kept; the scrub migration on dev, prod at the next release; currency checked at verify (D32 + D36) — 2026-09-19
- ⬜ Payments: a nightly sweep verifies stale INIT rows with Paystack — paid ones activated, the rest ABANDONED, never deleted; SETUP_REQUIRED goes (D34, Sam 2026-09-18)
- ⬜ Payments: one limit per action, verify counted per reference, the confirmation poll uncounted, fail closed (D35, Sam 2026-09-18) — closes §9 #22
- ⬜ One limiter for the app: the counter table as the general tally, a rule per door in config; first doors e.g. register, messages, both builders, photo upload; shaped at build (Sam, 2026-09-18)
- ⬜ Messaging as a support desk: general + course threads, server writes only, messages fixed once sent, 2000-char cap, read stamps on the thread (§8 S11), visible reopen, draft from the course link, paged admin inbox (D37–D42; Sam, 2026-09-18)
- ⏸ Bulk Send parked — announcements broadcast with the same targeting; New Thread covers one student; a rarely used door is the one nobody watches; button and code out at the rebuild (Sam, 2026-09-18)
- ⬜ Question reports — a new feature replacing "Send feedback" threads: reason list, the student's answer, status new/reviewed/fixed/dismissed, admin page grouped by question with Mark fixed (Sam, 2026-09-18)
- → Mock exams as a premium exam experience — moved to the 03-quiz-system.md section above as Q3 (2026-09-19)
- → Quizzes and announcements floor (S12; D44–D48) — sliced into 03-quiz-system.md Q1–Q2 and 05-announcements.md A1–A2 above (2026-09-19)
- ⬜ Config registry: admin-only reads through a service-role accessor, typed and bounded keys, a stricter Config page, the dead row dropped; levels wired to the pickers; cohort a year (S13; D49, D51; Sam, 2026-09-18)
- ✖ Payments: §9 #20 (token re-minted on verify) and §9 #21 (the reference as the only secret) — no token exists under D31 + D33 (Sam, 2026-09-18)
- ✖ Payments: the setup step's login rollback (§9 #4) — the login is created by the server at PAID under D31, so the step and its rollback go (Sam, 2026-09-18)
- ⬜ Subscribe: a signed-in student only sees a note pointing to the upgrade page and can still pay here as a new buyer — consider redirecting them to /student/upgrade instead (Sam, slice 9a, 2026-09-15)
- ⬜ One Quademia account across the products: the project has one login table, so an email registered in one app cannot register in another — register should offer "sign in to add this product", and a sign-in with no profile here should offer a "complete your profile" step; a cross-product rule, before MyTeacher's rebuild copies this register page (Sam, 2026-09-15)
- ⬜ Speed: the avatar is served at full size (1.38 MB for a 24px circle) and re-fetched every page — resize and cache it (perf investigation, 2026-09-16)
- ⬜ Speed: no loading state on any student surface, so a click is a silent stall for the whole server time — a route-level skeleton (perf investigation, 2026-09-16)
- ⬜ Speed: ~34 in-page links are plain anchors, so a click discards the page and re-runs every query; MyNclex uses next/link in 48 files, this app in 3 (perf investigation, 2026-09-16)
- ⬜ Speed: the unread badge is two serial queries and finishes last on every student page — one query, still counting distinct threads (perf investigation, 2026-09-16)
- ⬜ Speed: the student layout's three queries block every student page, including pages needing none of them (perf investigation, 2026-09-16)
- ⬜ Speed: the item-bank policy re-runs user_has_course() per row — ~230 ms per Quiz Builder course pick now, ~2.2 s per read at a 10,000-row course; eleven ALTER POLICY lines, no data change (perf investigation, 2026-09-16)
- ⬜ Scale: admin Bulk Send and the admin inbox collect every matching student id into one .in() list — exceeds the API limit around 2,000–5,000 students and returns nothing rather than erroring (perf investigation, 2026-09-16)
- ⬜ Scale: the admin Attempts page computes its analytics from at most 5,000 loaded rows — past that it silently reports numbers from an arbitrary slice; wrong, not late (perf investigation, 2026-09-16)
- ⬜ Speed: fixed-quizzes and mock-exams select every attempt column, answer blob included, only to count answers — 400 KB–1 MB per load on a phone (perf investigation, 2026-09-16)
- ⬜ Scale: no index on attempts(ts_iso); attempts(user_id, ts_iso desc) too — seconds on the admin window at 500k rows (perf investigation, 2026-09-16)
- ⬜ Check before launch: whether sharing the gamma project with the legacy product and MyTeacher slows prod — false on dev (99.95% idle), untested on prod (perf investigation, 2026-09-16)
