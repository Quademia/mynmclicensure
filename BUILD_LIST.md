# MyNMCLicensure Build List

The inventory of slices: everything built, everything queued, everything
parked, one line each, grouped by the plan doc that defines it. Rebuilt
to this shape on 2026-09-10 when the rebuild was planned; the gamma-era
list it replaces is in git history and in `qacademy-gamma`.

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

## The rebuild

### [rebuild.md](docs/product-plan/rebuild.md)

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

### The legacy check — gaps found 2026-09-16 (fix before new features)

Every legacy page compared with its rebuilt route; nothing missing outright. Detail and the minor list: `sessions/2026-09.md`, the legacy check entry. Numbered as reported to Sam; 1–4 first.

- ⬜ 1 Runner autosave restarts its 60 s timer on every answer or flag — steady answering never autosaves; a timed exam loses answers on a closed tab
- ⬜ 2 Runner: a dropped connection at Submit, Save & Resume Later or the timed auto-submit leaves the spinner forever — legacy showed the score
- ⬜ 3 Question Bank: an MCQ with answer C–F switched to TF shows "A (True)" but saves the old letter — every student marked wrong on it
- ⬜ 4 Register: the "N-day free trial — no card required" hint never shows — `trialDays` still null, waiting on slice 8
- ⬜ 5 Sidebar badge, My Courses and name / photo load once in the layout — stale across sidebar clicks; dropdown open state carries across pages
- ⬜ 6 The device check on every save signs a kicked or expired device out mid-quiz, losing unsaved answers — legacy let it finish (§10, unrecorded)
- ⬜ 7 Quiz Builder and Offline Pack builder: the status line sticks after a failure; "Select a course…" leaves the previous course's topics and counts
- ⬜ 8 Password reset: legacy signed the student straight in, the rebuild asks for a new sign-in — Sam to decide
- ⬜ 9 Admin Messages: the open conversation vanishes when a filter hides its thread, realtime still marks new messages read, no way back on a phone
- ⬜ 10 Admin Payments: after Retry Activation the panel redraws — "Activated ✓" gone, and the panel can close itself
- ⬜ 11 Admin Products: a draft or archived course inside a product is kept on save, where legacy dropped it — Sam to rule
- ⬜ 12 Admin Users: Assign refuses a deactivated account; legacy's Users page allowed it (a second change beyond §9 #24)
- ⬜ 13 A failed database read shows "No config keys found." (Config) and "No active subscriptions found yet." (Upgrade) instead of an error
- ⬜ 14 Offline pack renderer: the course code instead of its title once the course is not active
- ⬜ About 40 minor or cosmetic differences (titles, wording, focus, scroll, spinners) — listed in the session entry; Sam's call whether to tidy
- ⬜ Five legacy bugs the rebuild fixed without a record (history Retake, "%" in Send feedback, inbox unread, picker Subtopic filter, timed pre-Start save) — keep, Sam to confirm
- ⬜ `db/schema.sql` and `db/rls.sql` snapshots omit offline_packs, announcements and user_notice_state — the migrations are complete

### Decisions still open in rebuild.md

- ✅ §8 S1 user primary key — keep `U_` ids, add the FK — 2026-09-11
- ⬜ §8 S3 attempts blobs → JSONB / arrays
- ✅ §8 S4 foreign keys on licensure tables — 2026-09-11, as each table lands
- ✅ §8 S6 populate `sessions.ip_hash` — 2026-09-11
- ✅ §9 #8 `must_change_password` — left as it is, no gate, column carried — 2026-09-11
- ⬜ §8 has no auth-path entry — the gate's three sequential round trips and the middleware's per-request auth call cannot change until Sam adds one and ticks it (2026-09-16)

## Carried from gamma

Items from the gamma-era list that still apply after the rebuild. Not
rebuild work; listed so they are not lost.

- ⬜ Content: `items_rphn_disease_ctrl` is empty while its course is active
- ⬜ Content: `items_rm_mid` short of its target set count (540 of 900)
- ⬜ Content: set-size targets for RMHN / NACNAP / RPHN
- ⬜ Remove MANUAL_TEST rows before cutover (moot if cutover deletes old data)
- ⏸ Email confirmation on signup — a product change; not in the like-for-like rebuild
- ⏸ Expiry-reminder scan — a Sheets-era admin tool (git 31ccde3) never rebuilt on Supabase; only `expiry_reminded` survived; after the rebuild, needs 10
- ⏸ Admin create user; sessions / auth-events / reset-request audits — new features, after
- ⏸ Student analytics, notifications, search, sequential runner mode — new features, after
- ⏸ Paystack LIVE key on prod — waits on the company / Paystack-account decision

## After the rebuild

Product changes spotted while transcribing `legacy/`, internal findings
that are nobody's slice, and — since Sam declared the rebuild's slices
complete (2026-09-16) — the two slices moved out of it, Cutover and the
Telegram gate. One line each, with the slice or the work that surfaced
it; Sam orders them. No new user-visible feature is built before
cutover (AGENTS.md ⭐); what Sam's check of `legacy/` finds missing is
built as legacy had it, not listed here as new.

- ⬜ 16 Cutover — DNS, live keys, content re-copy, old logins deleted, `legacy/` removed (moved from the rebuild, Sam, 2026-09-16)
- ⬜ Storage hygiene: ~14 columns, the `levels` table and one config row with no reader or writer (list in the 2026-09-18 session entry) — Sam: some have an unbuilt purpose; review one at a time (2026-09-18)
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
- ⬜ Payments: the copied setup link carries a token the confirmation page never reads; verify re-mints one on every call (§9 #20; slice 9, 2026-09-15)
- ⬜ Payments: verify hands a setup token to anyone holding a reference; the reference is the only secret (§9 #21; slice 9, 2026-09-15)
- ⬜ Payments: the confirmation page's 3-second poll trips the 5-per-minute limit on a pending payment — "Too many requests" after four polls, as legacy (§9 #22; slice 9a, 2026-09-15)
- ⬜ Payments: the setup step deletes the new login again when the profile row fails (the §9 #4 rollback, not in legacy) — Sam to confirm or drop (slice 9a, 2026-09-15)
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
