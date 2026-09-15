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
- ⬜ 7f Student home — dashboard; after 12 folds in (upgrade moved to 9b, 2026-09-15)
- ✅ 8 Subscriptions — trial at registration, course access, admin grant/update/revoke/sync, the real question gate — 2026-09-13
- ✅ 9a Payments — table, rate limit, the four actions, subscribe, Premium Prep live, confirmation page — 2026-09-15
- ✅ 9b Payments — the upgrade page live, the admin Payments page (rescue buttons, revenue summary) — 2026-09-15
- ✅ (unplanned) First production release — main → production (slices 0–9), the eleven migrations on the prod project, licensure-prod created; no DNS — 2026-09-15
- ⬜ 10 Email — four templates, Quademia sender, `appOrigin()`
- ✅ 11a Announcements — two tables, server-side scoping (course scope fixed, §9 #19), admin page (no Scheduled status, §9 #18) — 2026-09-14
- ✅ 11b Announcements — student page, dashboard strip on the placeholder, the course page section — 2026-09-14
- ⬜ 12 Messaging — three contexts, admin inbox, bulk send, badges, the runner's Send feedback button (left out of 6)
- ✅ 13a Offline packs — table, allowance, non-repeat picker, watermark, the builder, the renderer — 2026-09-14
- ✅ 13b Offline packs — My Packs: list, filters, summary counts, Open / Build Similar — 2026-09-14
- ⬜ 14a Admin home — the Users page (drawer, assign, reset, deactivate; ?user_id= opens it) and the dashboard counts
- ⬜ 14b Admin home — the Attempts analytics page
- ⬜ 15 Phone pass — student at 375px, admin navigable at 768px
- ⬜ 16 Cutover — DNS, live keys, content re-copy, old logins deleted, `legacy/` removed
- ⬜ 17 Telegram gate — Connect page, link codes, bot Worker on the DB, allowlist from subscriptions; after 8

### Decisions still open in rebuild.md

- ✅ §8 S1 user primary key — keep `U_` ids, add the FK — 2026-09-11
- ⬜ §8 S3 attempts blobs → JSONB / arrays
- ✅ §8 S4 foreign keys on licensure tables — 2026-09-11, as each table lands
- ✅ §8 S6 populate `sessions.ip_hash` — 2026-09-11
- ✅ §9 #8 `must_change_password` — left as it is, no gate, column carried — 2026-09-11

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

Product changes spotted while transcribing `legacy/`. None is built
during the rebuild (AGENTS.md ⭐: no new user-visible feature). One
line each, with the slice that surfaced it; Sam orders them once
cutover is done.

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
