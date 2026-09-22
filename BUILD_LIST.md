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
- **A section per plan doc.** Slice ids are the doc's own ids. **Every
  queued line sits under the surface that will build it** (Sam,
  2026-09-21); a line with no slice id gets one when its doc is
  rewritten. What belongs to no surface goes under `00-overview`; speed
  and scale stay one group.
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
- ✅ §8 S2 one items table, `question_bank` (D22) — ticked 2026-09-19; the build is 08-question-bank.md B1
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
- ✅ §8 S14 the premium marker — `products.is_premium` replaces the `_2026_PREP` id suffix (it carried a year and had no price gate); rule 9 took `products`' grants back to SELECT, the admin writes moved to the service role, two dead policies dropped (D23 item 4) — 2026-09-22
- ⬜ §8 has no row for `courses_select` — the policy is `auth.uid() is not null`, so a signed-out visitor reads nothing from `courses`; `/premium-prep` and `/subscribe` both work around it with a service-role read, and D23 item 5 (a sales row lists its courses) cannot be met on any public page without it (2026-09-22)

## Improvements

The one list, now that the port is finished (2026-09-16): the gaps the
legacy check found, items carried from the gamma era, product changes
and internal findings spotted during the port, the diagnosis findings
Sam has queued, and cutover and the Telegram gate. One line each, with
the work that surfaced it; Sam orders them. A finding in
`post-rebuild-diagnosis.md` gets a line here only when Sam queues it.

### Plans by feature doc

The feature docs `00–10` are the living plan per feature (Sam,
2026-09-19); a doc rewritten into that shape gets a section here with
its own slice ids. **Every queued line sits under the surface that will
build it** (Sam, 2026-09-21) — the three lists that used to hold them
(the legacy check of 2026-09-16, the items carried from the gamma era,
and what the port, the diagnosis and the perf investigation surfaced)
are gone as groupings, and every line keeps its wording and the source
named in it. Detail on the legacy check and its ~40 minor differences:
`sessions/2026-09.md`, the legacy check entry. A line with no slice id
gets one when its doc is rewritten into the living-plan shape.

#### [00-overview.md](docs/product-plan/00-overview.md)

Reference data (config, schools, levels, telegram keys) and everything
that belongs to no single surface — cutover, the Telegram gate (Sam,
2026-09-21). The design system, the shell and the dialogs left for
`10-design-system.md` when it was opened (Sam, 2026-09-22).

- ⬜ 13 A failed database read shows "No config keys found." (Config) and "No active subscriptions found yet." (Upgrade) instead of an error
- ⬜ About 40 minor or cosmetic differences (titles, wording, focus, scroll, spinners) — listed in the session entry; Sam's call whether to tidy
- ⬜ Five legacy bugs the rebuild fixed without a record (history Retake, "%" in Send feedback, inbox unread, picker Subtopic filter, timed pre-Start save) — keep, Sam to confirm
- ⬜ `db/schema.sql` and `db/rls.sql` snapshots omit offline_packs, announcements and user_notice_state — the migrations are complete
- ⏸ Student analytics, notifications, search, sequential runner mode — new features, after
- ⬜ 16 Cutover — DNS, live keys, content re-copy, old logins deleted, `legacy/` removed (moved from the rebuild, Sam, 2026-09-16)
- ⬜ Reference data: schools is a regulator's list with no way to change it (D50, unruled since 2026-09-18)
- ⬜ Reference data: telegram_group_keys is free text and holds junk — no list, no validation (D3)
- ⬜ Storage hygiene: ~14 columns, the `levels` table and one config row with no reader or writer (list in the 2026-09-18 session entry) — Sam: some have an unbuilt purpose; review one at a time (2026-09-18); the auth group's five settled by the trace and the read-back (S9, items 7 and 8)
- ⬜ Before cutover: Resend's free plan caps the account shared with MyNclex at 100 emails a day (MyNclex's notes); re-registration day would pass it and lose the rest — the Pro upgrade first (slice 10, 2026-09-16)
- ⬜ 17 Telegram gate — Connect page, link codes, bot Worker on the DB, allowlist from subscriptions (moved from the rebuild, Sam, 2026-09-16)
- ⬜ Procedures: the thirteen NMC manual links are fixed in the page; move them to a table with an admin management page (slice 7c, 2026-09-14)
- ✅ Profile: the photo is one file per student overwritten in place and the cached old one kept showing — a version stamp on the saved address (Sam, 2026-09-14)
- ⬜ One limiter for the app: the counter table as the general tally, a rule per door in config; first doors e.g. register, messages, both builders, photo upload; shaped at build (Sam, 2026-09-18)
- ⬜ Config registry: admin-only reads through a service-role accessor, typed and bounded keys, a stricter Config page, the dead row dropped; levels wired to the pickers; cohort a year (S13; D49, D51; Sam, 2026-09-18)

#### [01-payments.md](docs/product-plan/01-payments.md)

- ⬜ 10 Admin Payments: after Retry Activation the panel redraws — "Activated ✓" gone, and the panel can close itself
- ⏸ Paystack LIVE key on prod — waits on the company / Paystack-account decision
- ⬜ Payments: no Paystack webhook — a payer who loses signal has paid and got nothing until an admin acts (D4)
- ⬜ Payments: the server creates the account at PAID and queues a set-password link; the setup token, its two columns and the rescue go; the form shrinks to a password (D31, Sam 2026-09-18)
- ⬜ Payments: verify answers status and product to anyone; a same-browser cookie set at init shows the password form, otherwise the emailed link (D33, Sam 2026-09-18)
- ✅ Payments: Paystack's replies trimmed before saving — channel, card_type, last4 kept; the scrub migration on dev, prod at the next release; currency checked at verify (D32 + D36) — 2026-09-19
- ⬜ Payments: a nightly sweep verifies stale INIT rows with Paystack — paid ones activated, the rest ABANDONED, never deleted; SETUP_REQUIRED goes (D34, Sam 2026-09-18)
- ⬜ Payments: one limit per action, verify counted per reference, the confirmation poll uncounted, fail closed (D35, Sam 2026-09-18) — closes §9 #22
- ✖ Payments: §9 #20 (token re-minted on verify) and §9 #21 (the reference as the only secret) — no token exists under D31 + D33 (Sam, 2026-09-18)
- ✖ Payments: the setup step's login rollback (§9 #4) — the login is created by the server at PAID under D31, so the step and its rollback go (Sam, 2026-09-18)

#### [02-subscriptions.md](docs/product-plan/02-subscriptions.md)

- ✅ C1 The link table — product_courses with keys, the Products page and five readers on it (S8; D16) — 2026-09-19
- ✅ C2 The access rows — course_access from five writers, one-lookup gate, stored dates (S8; D13–D17, D20) — 2026-09-19
- ✅ C3a The queued start — a row starts at the course's non-trial end; the extend branches gone (ruling 3) — 2026-09-19
- ✅ C3b The panel shows a receipt's rows; the chain re-packed on every write; window from rows — 2026-09-19
- ✅ (unplanned) One Grant dialog for Subscriptions and the Users drawer, the preview by the chain — 2026-09-19
- ✅ (unplanned) The selling pages become cards — `/premium-prep` five cards, `/subscribe` the shop with a programme chooser that reorders and does not filter; both Server Components with no client half (660 lines deleted); D23 items 1, 2 and 5 built, item 3 built as `lib/catalogue/for-sale.ts` — 2026-09-22
- ⬜ D23 item 3 is not closed — only `/subscribe` calls the one "for sale" helper; `/student/upgrade` keeps its own copy and `/premium-prep` its own inline filter (2026-09-22)
- ⬜ The product card is duplicated between `.prep-*` and `.subp-*` — a shared card belongs in `components.css` beside `.btn` and `.badge`, and a third copy arrives with the checkout (2026-09-22)
- ⬜ The checkout — one route, `/checkout/<product_id>`, for every product; both selling pages already point at it. Email and phone move here; the programme is prefilled from the product but shown and editable, because it becomes the student's ACCOUNT programme and D23 item 1 lets anyone buy any product (Sam, 2026-09-22)
- ⬜ A premium-ticked product whose id matches no programme is dropped in silence on `/premium-prep` — the admin sees "updated successfully" and it never appears (2026-09-22, unruled)
- ⬜ Desktop: a side rail of tickable filters (programme and similar) instead of the chip row (Sam, 2026-09-22)

*Not yet sliced — each gets an id when the doc is rewritten:*

- ⬜ 4 Register: the "N-day free trial — no card required" hint never shows — `trialDays` still null, waiting on slice 8
- ⬜ 11 Admin Products: a draft or archived course inside a product is kept on save, where legacy dropped it — Sam to rule
- ⬜ 12 Admin Users: Assign refuses a deactivated account; legacy's Users page allowed it (a second change beyond §9 #24)
- ⬜ Expiry reminders — a daily pg_cron doorbell to an app route, the email through Resend, a dashboard status line; no run-now button; written against S8's course expiry (Sam, 2026-09-18; auth item 9)
- ⬜ Courses: the form suggests a code from programme + title, overwritable, the code stays the key; drop the dead page_slug column when the table is next touched; S2 (one items table) before S8 (Sam, 2026-09-19)
- ⏸ Course-level pricing (a standalone price per course, products as bundles, a basket later) — the product stays the single unit of sale; revisit when the course count makes a product per course a chore (Sam, 2026-09-18)
- ⬜ A link to Premium Prep from the landing page — legacy never linked it; the page was shared by address only (slice 3, 2026-09-12)
- ⬜ Profile: the Subscription panel shows one active subscription, the first returned, even when the student holds two — legacy did (slice 7e, 2026-09-14)
- ⬜ Subscribe: a signed-in student only sees a note pointing to the upgrade page and can still pay here as a new buyer — consider redirecting them to /student/upgrade instead (Sam, slice 9a, 2026-09-15)

#### [03-quiz-system.md](docs/product-plan/03-quiz-system.md)

- ✅ Q1 The floor — course-scoped reads of active published rows, item_ids and notes server-only, CHECKs (S12; D44, D48) — 2026-09-19
- ✅ Q2 The lifecycle rules — one availability check on the server clock, archive one-way, saveQuiz validation, stats by table, the mock list paged (D45) — 2026-09-19
- ⏸ Q3 Mock exams as a premium exam experience — a design item, ingredients noted, none decided (Sam, 2026-09-18)
- ✅ Q4 The questions as rows — attempt_items and offline_pack_items copied at creation, two clocks (S7) — 2026-09-20
- ✅ Q5 The answers as rows, the write door — grading in SQL, no browser writes, save per tap (S7; D6, D7) — 2026-09-20
- ✅ Q6 The seal — the public half live, one key at Check Answer, review unsealed, console refused (S7; D5) — 2026-09-20
- ⬜ Q7 SATA partial credit — the rule, then the three-state display (Sam, 2026-09-20) — after S7
- ⬜ Q8 The runner as a player — one route, mode and exit from the header (captured 2026-09-20; ruled after 08 B2)
- ⬜ Q9 The Check Answer pending state — the option shows it is being checked until the reply lands (2026-09-20)

*Not yet sliced — each gets an id when the doc is rewritten:*

- ✅ 1 Runner autosave never fired under steady answering — closed by 03 Q5, one save per question per tap — 2026-09-20
- ✅ 2 Runner: a dropped connection at Submit spun forever — closed by 03 Q5, a toast and the button back — 2026-09-20
- ⬜ 7 Quiz Builder and Offline Pack builder: the status line sticks after a failure; "Select a course…" leaves the previous course's topics and counts
- ⬜ Learning history: the stats bar counts the loaded pages, not the whole history — legacy called true totals deferred (slice 7a, 2026-09-14)
- ⬜ Learning history: Source and Sort work over the loaded pages only; Course / Mode / Status / Search are database-side (slice 7a, 2026-09-14)
- ⬜ Learning history: no Mock option in the Source filter; a mock attempt’s chip shows the raw word "mock" (slice 7a, 2026-09-14)
- → Mock exams as a premium exam experience — moved to the 03-quiz-system.md section above as Q3 (2026-09-19)
- → Quizzes and announcements floor (S12; D44–D48) — sliced into 03-quiz-system.md Q1–Q2 and 05-announcements.md A1–A2 above (2026-09-19)

#### [04-access-control.md](docs/product-plan/04-access-control.md)

- ⬜ 6 The device check on every save signs a kicked or expired device out mid-quiz, losing unsaved answers — legacy let it finish (§10, unrecorded); fixed with auth item 1: the attempt finishes, the next page refuses (Sam, 2026-09-18)
- ⬜ 8 Password reset: legacy signed the student straight in, the rebuild asks for a new sign-in — Sam: legacy's way, signed in straight after (2026-09-18)
- ⏸ Email confirmation on signup — a product change; not in the like-for-like rebuild
- ⬜ Admin security page: Sessions — a panel in the Users drawer and a platform-wide list with the alpha filters, Revoke on every live row (Sam, 2026-09-18; auth item 4)
- ⬜ Admin security page: Login events tab — filters by email, user, outcome and date, Lift the block (Sam, 2026-09-18; auth item 5)
- ⬜ Admin security page: Reset requests tab — Send reset link, Lift the block, the admin's own sends logged (Sam, 2026-09-18; auth item 6)
- ⬜ Invite by email — student or admin, optional product, a set-password link, the profile finished on arrival; replaces Create User; drops `username` + `must_change_password` (Sam, 2026-09-18; auth item 7)
- ⬜ Last login — written on every successful login, shown in the drawer, a dormant filter on the Users list (Sam, 2026-09-18; auth item 8)
- ⬜ Email outbox + drain — a queue table with a fingerprint, send on the request's tail, pg_cron doorbell retries, an admin emails page with Retry; MyNclex's shape; before item 9 (Sam, 2026-09-18; auth item 10)
- ⬜ Take over the Supabase-sent emails — magic link, reset, confirm (once on), invite minted with generateLink, our templates, through the outbox; the project's templates are shared with MyTeacher (Sam, 2026-09-18; auth item 10)
- ⬜ Supabase dashboard: Auth SMTP set to Resend as the fallback sender, neutral Quademia wording on the project's templates (auth item 10)
- ✅ Auth holes: EXECUTE revoked on the five auth functions, the limiter counting by IP (D24, S9); the limit checks fail closed (D30) (auth items 2, 3) — 2026-09-19
- ✅ Auth holes under S10: the users row's browser INSERT gone and UPDATE cut to the profile fields (D25), email lowercased and unique (D26), the profile insert server-side (D27) — 2026-09-19
- ⬜ Retention: a nightly pg_cron purge of inactive `sessions` and old `auth_events` rows, window from a config value, as MyNclex does (D29; on auth item 9's clock)
- ⬜ A deactivated account signs in, is logged LOGIN_SUCCESS, and is thrown out by the gate too fast to read anything — refuse at login with "This account has been deactivated", log it as a refusal, so the login-events page can show it (seen in Sam's S10 test, 2026-09-19)
- ⬜ Before cutover: the Supabase Auth dashboard settings (redirect allow-list, sender, QAcademy-branded reset and magic-link templates) are recorded nowhere here — check them and add the live address (legacy check, 2026-09-16)
- ⬜ One Quademia account across the products: the project has one login table, so an email registered in one app cannot register in another — register should offer "sign in to add this product", and a sign-in with no profile here should offer a "complete your profile" step; a cross-product rule, before MyTeacher's rebuild copies this register page (Sam, 2026-09-15)

#### [05-announcements.md](docs/product-plan/05-announcements.md)

- ⬜ A1 The floor — announcements_for_me(), the table admin-only to read, scope_level text[], CHECKs, the hot-read index (S12, S13; D46, D48)
- ⬜ A2 The notice state — read_at / clicked_at / dismissed_at, a key to the announcement, server-side writes, the strip's ✕ dismisses (S12; D47)
- ⬜ A3 Residue — the body stored once and the <br> per edit ended, keys for the scope arrays, the unused read removed (D48) — later
- ⬜ A4 A real quiz-link picker for the editor — the dead Quiz Link tool and its false alert left with DS4 (2026-09-22)

*Not yet sliced — each gets an id when the doc is rewritten:*

- ⬜ Announcements: each edit re-saves the body through the paragraph converter and adds a line break between paragraphs — legacy did (slice 11a, 2026-09-14)

#### [06-offline-packs.md](docs/product-plan/06-offline-packs.md)

- ⬜ 14 Offline pack renderer: the course code instead of its title once the course is not active
- ⬜ Offline packs: the renderer’s cover prints "Prepared for: …" twice, the owner line and the stored label beneath it — legacy did (slice 13a, 2026-09-14)

#### [07-messaging.md](docs/product-plan/07-messaging.md)

- ⬜ 9 Admin Messages: the open conversation vanishes when a filter hides its thread, realtime still marks new messages read, no way back on a phone
- ⬜ Messaging as a support desk: general + course threads, server writes only, messages fixed once sent, 2000-char cap, read stamps on the thread (§8 S11), visible reopen, draft from the course link, paged admin inbox (D37–D42; Sam, 2026-09-18)
- ⏸ Bulk Send parked — announcements broadcast with the same targeting; New Thread covers one student; a rarely used door is the one nobody watches; button and code out at the rebuild (Sam, 2026-09-18)

#### [08-question-bank.md](docs/product-plan/08-question-bank.md)

- ✅ B1 One table — question_bank with a course key, the eleven copied in and dropped, one gate a statement — 2026-09-19
- ✅ B2 Answers server-only — the secret half and write grants off the browser roles, search server-side — 2026-09-21
- ⬜ B3 The admin bank page paged and filtered server-side, fifty at a time (D11) — later

*Not yet sliced — each gets an id when the doc is rewritten:*

- ⬜ 3 Question Bank: an MCQ with answer C–F switched to TF shows "A (True)" but saves the old letter — every student marked wrong on it
- ⬜ Content: `items_rphn_disease_ctrl` is empty while its course is active
- ⬜ Content: `items_rm_mid` short of its target set count (540 of 900)
- ⬜ Content: set-size targets for RMHN / NACNAP / RPHN
- ⬜ Remove MANUAL_TEST rows before cutover (moot if cutover deletes old data)
- ⬜ Question reports — a new feature replacing "Send feedback" threads: reason list, the student's answer, status new/reviewed/fixed/dismissed, admin page grouped by question with Mark fixed (Sam, 2026-09-18)

#### [09-free-account-and-gamification.md](docs/product-plan/09-free-account-and-gamification.md)

Decided in principle in a cloud session on 2026-09-20; candidates, none sliced, the open questions in the doc's §4.

- ⬜ F1 The pool and its door — a free mark on the bank and a second door on the read policy; a §8 row first
- ⬜ F2 The free account — no course_access rows, the builder and runner on the pool, the dashboard's free-vs-trial line
- ⬜ F3 Landing and copy — "free practice questions, forever"; the trial and the products as the route to the full bank
- ⬜ G1 Streak, points, leaderboard — derived from the graded rows, no new tables; after the NMC Prep walk
- ⬜ G2 The daily challenge — five a day per programme from the free pool, a new attempt source; after G1
- ⬜ G3 Tiers — names on point bands; later

#### [10-design-system.md](docs/product-plan/10-design-system.md)

Opened 2026-09-22 with the shell decided as A3 and the sales-page look
retired (B1). Ids are `DS`, two letters, because a bare `D` collides with
`rebuild.md` D1–D10 and the diagnosis's D-numbers. No slice here touches
storage.

- ✅ DS1 The foundation — tokens.css: 23 colours, 10 type styles, 10 spaces, 5 radii, 3 shadows; old names — 2026-09-22
- ✅ DS2 The retired teal out (B1) — 9 stylesheets, 52 uses, 46 written as rgba; .qa-page aliases collapsed — 2026-09-22
- ✅ DS3 One button — the shared family in components.css, 15 surfaces converted; the rest as touched — 2026-09-22
- ✅ DS4 One dialog — on the browser <dialog>; 9 confirms, 4 prompts as 2, alert out; type-to-confirm ×2 — 2026-09-22
- ✅ DS5 The shell becomes A3 — top bar, sidebar on a cookie, PageHeader halved on 23 pages, Upgrade on bar — 2026-09-22
- ✅ DS6 The icon set — 19 Lucide shapes in icons.tsx, the nav's 27 emoji out, NavItem.icon; sidebar only — 2026-09-22
- ✅ DS7 One name circle — photo, else initials on the teal-navy blend; the logo where Quademia speaks — 2026-09-22
- ✅ DS8 One badge — status 6px not a pill (Sam), labels stay 4px; 13 surfaces converted, 173 → 115 — 2026-09-22
- ⏸ DS9 The eight surfaces the shared button cannot reach — as each is touched (ruling 9); .btn-lite + .btn-link added
- ✅ DS10 The button size scale — small / medium / large, large 44px; ten student forward buttons on it — 2026-09-22
- ✅ DS11 A categorical palette — sky / indigo / plum; retake and the modes stay grey; 19 tokens — 2026-09-22
- ✅ DS12 A scale palette — easy / moderate / hard as navy filling by weight, three bars (Sam: navy) — 2026-09-22
- ✅ DS13 One badge class name — 153 renames onto .badge; DS11 then sorted the 20 kind sites — 2026-09-22
- ✅ DS14 The price weight — the token to 700 and the three price rules onto it (they were literals) — 2026-09-22
- ✅ DS15 The page emoji — 52 deleted, 65 to drawn icons, 88 working glyphs and 5 kept; 27 new shapes — 2026-09-22
- ✅ DS16 The synthesised weights — 40 to 700; landing's 12 kept, its 800 is real (not Inter) — 2026-09-22
- ✅ (unplanned) The audience label loses "Panel" — ADMIN / STUDENT on both sidebars (ruling 12) — 2026-09-22
- ✅ (unplanned) The app's favicon and home-screen icon — MyNclex's two Quademia icon files copied in with DS7 — 2026-09-22
- ✅ (unplanned) One public top bar and one footer — `public-top-bar.tsx` / `public-footer.tsx`, the signed-out siblings of DS5, on the landing page and `/premium-prep` in the same commit; `.btn-outline` promoted into the family; the footer's year computed, not typed — 2026-09-22
- ⬜ DS17 The ~15 name chips still on .badge — both builders, premium-prep, upgrade; most sit on DS9 surfaces
- ⬜ DS18 Product kind (PAID / FREE / TRIAL) borrows the state colours — a kind by DS11, unmapped; Sam to rule
- ⬜ Dark mode — not one prefers-color-scheme rule in the app and one theme in the token file; after the above
- ⬜ A content max-width above 1440px, where A3's closed sidebar leaves cards and tables past a comfortable measure

*Not yet sliced:*

- ⬜ 5 Sidebar badge, My Courses and name / photo load once in the layout — stale across sidebar clicks; dropdown open state carries across pages

#### Speed and scale — no doc, kept as one group

The perf investigation of 2026-09-16, kept together rather than split
across the surfaces (Sam, 2026-09-21). Some are one page, some are
every page.

- ⬜ Speed: the avatar is served at full size (1.38 MB for a 24px circle) and re-fetched every page — resize and cache it (perf investigation, 2026-09-16)
- ⬜ Speed: no loading state on any student surface, so a click is a silent stall for the whole server time — a route-level skeleton (perf investigation, 2026-09-16)
- ⬜ Speed: ~34 in-page links are plain anchors, so a click discards the page and re-runs every query; MyNclex uses next/link in 48 files, this app in 3 (perf investigation, 2026-09-16)
- ⬜ Speed: the unread badge is two serial queries and finishes last on every student page — one query, still counting distinct threads (perf investigation, 2026-09-16)
- ⬜ Speed: the student layout's three queries block every student page, including pages needing none of them (perf investigation, 2026-09-16)
- → Speed: the item-bank policy re-runs user_has_course() per row — ~230 ms per Quiz Builder course pick now, ~2.2 s per read at a 10,000-row course; eleven ALTER POLICY lines, no data change (perf investigation, 2026-09-16)
- ⬜ Scale: admin Bulk Send and the admin inbox collect every matching student id into one .in() list — exceeds the API limit around 2,000–5,000 students and returns nothing rather than erroring (perf investigation, 2026-09-16)
- ⬜ Scale: the admin Attempts page computes its analytics from at most 5,000 loaded rows — past that it silently reports numbers from an arbitrary slice; wrong, not late (perf investigation, 2026-09-16)
- ⬜ Speed: fixed-quizzes and mock-exams select every attempt column, answer blob included, only to count answers — 400 KB–1 MB per load on a phone (perf investigation, 2026-09-16)
- ⬜ Scale: no index on attempts(ts_iso); attempts(user_id, ts_iso desc) too — seconds on the admin window at 500k rows (perf investigation, 2026-09-16)
- ⬜ Check before launch: whether sharing the gamma project with the legacy product and MyTeacher slows prod — false on dev (99.95% idle), untested on prod (perf investigation, 2026-09-16)
