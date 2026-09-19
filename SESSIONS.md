# MyNMCLicensure Sessions Log

Index of work sessions, newest first. **This file is the index only.**
Detail lives in the period files under `sessions/`, and that is where it
should stay rich.

## Rules for this file

- **One line per session:** `- YYYY-MM-DD — short title`. Under 160
  characters. Plain text — no bold, no emoji markers, no commit hashes.
- **Then ONE keyword line** beneath it, as a nested bullet `  - ↳ `: the
  things the title does NOT say — decisions made, defects found, rules
  reversed, tables built, questions left open. Separated by ` · `.
  **Under 250 characters. Keywords, not sentences.**
- **One blank line between sessions.**
- **Merge and release status do NOT go here.** `git log origin/main` and
  `origin/production` are the truth.
- **Everything else goes in the period file.**
- **Name the assistant** in the period-file entry, not here.

---

## 2026-09 — [sessions/2026-09.md](sessions/2026-09.md)

- 2026-09-19 — S9+S10 auth floor, D32+D36 Paystack trim, 03 Q1+Q2 quiz floor and lifecycle built, walked, merged; docs 00–07 become the living plans
  - ↳ five functions revoked · IP in the limiter · fail closed · users row frozen · email unique · card data trimmed · quiz reads course-scoped · restore→draft · mock list paged · one palette already · course codes stay · S2 before S8

- 2026-09-18 — D31–D36 ruled; messaging, quiz/announcement and config groups traced (D37–D51); S11, S12, S13 ticked; table sweep complete; no code
  - ↳ pay-first kept, account at PAID · raw stripped · Paystack sweep of INIT · one limiter · Bulk Send parked · question reports · mock = premium design item · levels kept · config admin-only · grant all schema-wide · design system opened

- 2026-09-18 — the port declared finished; auth traced alpha→gamma→port, D24–D30, ten rulings, S9/S10 ticked; payments traced, D31–D36; no code
  - ↳ rebuild = a port · one Improvements list · auth fns public · users row owner-writable · alpha admin audit pages · Invite not Create User · pg_cron doorbell · email outbox · pay-first the root · raw keeps card data

- 2026-09-18 — subscriptions diagnosed (D13–D21); course-level access and the attempt snapshot tables designed; S7 and S8 ticked into §8; no code changed
  - ↳ cloud branch merged · access has two readers · days summed, never granted · course_access + product_courses · six rulings · attempt_items sealed / unsealed · stricter than MyNclex on the console · S3 superseded · remote delete refused

- 2026-09-17 — post-rebuild diagnosis: a findings register opened, twelve structural findings, the attempts restructure drafted as §8 S7; no code changed
  - ↳ new doc not BUILD_LIST · rebuild.md untouched · prep-suffix ids → option C · runner leaks answers · score writable · bank readable · builders ship courses · keep live messaging · offline packs · MyNclex Pillar 2 · order S7→D9→D8 · unmerged

- 2026-09-16 — the legacy check: every legacy page compared with the rebuild; nothing missing outright; 14 gaps queued, 4 to fix first
  - ↳ nine parallel readers · autosave restarts on every answer · dropped connection freezes the runner · MCQ→TF saves the old letter · trial hint off · stale sidebar · 5 legacy bugs fixed silently · ~40 minor · nothing changed

- 2026-09-16 — 10 built: the four legacy emails sent from the server through Resend; walked, all six arrived; the rebuild's slices declared complete
  - ↳ sender as MyNclex, own Resend keys · Users page Assign emails too · §9 #25 values escaped · footer Quademia, live Telegram · expiry read from row · 15 dropped · 16, 17 to After · like for like until cutover · legacy check next

- 2026-09-16 — 7f built: the student dashboard; slice 7 closed; then a measured investigation into why the app is slow, and into the schema
  - ↳ Sam: keep 15, it is a sweep · ruling: runner link follows attempt mode · ~13 round trips a page, gate waits 3x, Postgres only 13ms · MyNclex: gate waits 2x, next/link 48 files vs 3 · item-bank policy per row · 2 scale cliffs · nothing changed

- 2026-09-15 — 9, 14 and 12 built: payments, admin Payments / Users / dashboard / Attempts, messaging both sides with live replies; first prod release
  - ↳ three slices split on one branch, all closed · 7f narrowed · §9 #20–#24 (two fixed) · password in the dev log → FormData · one Quademia account → after · prod: 11 migrations, licensure-prod up, paid products archived · branch rule per MyNclex

- 2026-09-14 — fix: profile photo over 1 MB refused by Next’s Server Action body cap; raised to 3 MB, refusal caught into a toast, rule in AGENTS.md
  - ↳ Sam’s own upload failed after the 7e merge · same cap covered the question bank image upload · proven with a 1.61 MB PNG · then the cached old photo fixed with a version stamp on the address (Sam) · dev server restarted

- 2026-09-14 — 7e built: the profile page (two editable panels, photo upload to a product bucket, subscription panel, ?complete=1); walked; 7 split (7e, 7f)
  - ↳ two quirks listed for after the rebuild first (Sam) · bucket licensure-gh-profile-images, upload on the server · toast title folded in · empty first name refused on the server · student1 dev row holds test data · next is Sam’s call

- 2026-09-14 — 11 built: announcements (tables, server-side scoping, admin page, student page, dashboard block, course section); walked on both sign-ins
  - ↳ §9 #18 Scheduled status dropped, #19 course scope applied (Sam: §9 and fix) · RM half proven by script · edit adds a <br> per save (legacy) → after the rebuild · one save hung on dev · next is Sam’s call

- 2026-09-14 — 7d built: the course page (header, days left, quiz previews, builder shortcut; announcements wait for 11); walked; 7 split (7d, 7e)
  - ↳ announcements section waits for 11 (Sam: build now) · Message button → 12’s page · expired days state unreachable (legacy) · unknown id shows No Access as legacy · merge ≠ wrap-up (Sam’s correction) · next is Sam’s call

- 2026-09-14 — 13b built: My Packs (list, filters, summary counts, Open / Download, Build Similar); walked in the pane; slice 13 closed
  - ↳ same branch as 13a, not merged between · filters and counts over the loaded rows as legacy · Archived / Deleted options set by nothing · Load More and an inactive pack not walked · renderer 11 s on dev · next is Sam’s call

- 2026-09-14 — 13a built: offline packs (table, allowance, non-repeat picker, builder wizard, renderer); walked in the pane; 13 split (13a, 13b My Packs)
  - ↳ "PDF" = the browser print dialog, no file · allowance / pick / id check on the server · two packs shared 0 items · trial refusal not walked · QA strings → Quademia · cover repeats Prepared for (legacy) · next is Sam’s call

- 2026-09-14 — 7c built: NMC Procedures (programme card, the NMC site in a viewer, the manual list); walked in the pane; 7 split again (7c, 7d rest)
  - ↳ manuals hard-coded as legacy → table + admin page after the rebuild (Sam) · NMC site does load in the iframe · Inside QAcademy → Quademia · no src until a manual is chosen · NACNAP card not walked · next is Sam’s call

- 2026-09-14 — 7b built: the portal guide (static help page, side list, FAQ accordion, footer); walked in the pane; 7 split again (7b guide, 7c rest)
  - ↳ QAcademy → Quademia in two strings · footer links wait for 7c and 12 · legacy had no .btn-secondary rule, carried · side-list highlight is legacy’s lagging algorithm · no data read · next is Sam’s call

- 2026-09-14 — 7a built: learning history (stats bar, six filters, cards twenty at a time, Resume / Review / Retake); walked in the pane; ticked
  - ↳ three legacy quirks carried (stats and Source / Sort over loaded pages only, no Mock source) → after the rebuild · late autosave flips completed back to in_progress (6a, as legacy) · next is Sam’s call

- 2026-09-14 — 5b built: student Fixed Quizzes and Mock Exams pages, start / retake / abandon, admin attempt stats; Sam’s test passed; 5 and 6 closed
  - ↳ start refuses closed / wrong-mode / no-access on the server · Abandon keeps browser confirm · runner exits land on Fixed Quizzes as legacy · dev quizzes carried legacy item ids, re-pointed by hand · 7 next

- 2026-09-14 — 6a passed; 6b built by Codex (timed mode on the shared core), reviewed and tested, ticked and merged; Codex's two helper scripts removed
  - ↳ Codex left no log or index lines and an unpushed branch · server-stamped start, elapsed on server, capped · concurrent start shares one stamp · scripts/ is baseline + runner only · 5b next

- 2026-09-13 — slice 6 split (6a/6b after 8); 6a built: attempts table, Quiz Builder, the runner core with instant mode and review; Sam's test pending
  - ↳ one core two pages (Sam: proceed as planned) · Preview button dead, not built (§9 #16) · score recomputed on server at finish · Send feedback waits for 12 · exits land on 5b's page · SATA gate not walked in pane

- 2026-09-13 — slice 8 built: subscriptions, trial at registration, course access, the real question gate, admin Subscriptions page; Sam's test pending
  - ↳ 8 before 6 (three stand-ins avoided) · slice 6 read, 6a/6b/5b proposed, two rulings open · student self-insert policy dropped, no column dropped · expiry reminder = Sheets-era scan never rebuilt, parked · doc 02 corrected · gate proven by SQL

- 2026-09-13 — slice 5 split; 5a built: quiz tables with content copy, the availability function, admin Fixed Quizzes and Mock Exams pages; Sam's test pending
  - ↳ 5a/5b split, 5b after 6 · quizzes join §6.6 copy · FK to courses · mock visibility carried uncontrolled · dates saved as UTC · edit-loses-fields defect fixed and flagged · Preview + stats wait for 6 · form_input misses React checkboxes

- 2026-09-13 — slice 4 built and closed: question bank (4a) and CSV importer (4b); dev bank loaded from Sam's prod CSV exports
  - ↳ 4a/4b split · user_has_course() signed-in until slice 8 · CSV reader fixed, rules kept · TF shuffle left as legacy · dev items from CSVs not public copy · 5,361 rows, no images · Table Editor exports one page · slice 5 next

- 2026-09-12 — slice 3 tested by Sam and passed; dev catalogue cleaned; prod parent-site address set; "After the rebuild" list started
  - ↳ PARENT_SITE_ORIGIN prod = quademia.com · NEWPROGRAM + two test products deleted on dev · 32 products active · Premium Prep never linked in legacy · sub-slices go in rebuild.md not feature docs · slice 4 next

- 2026-09-11 — slice 3 built: catalogue and config tables with content copy, admin Products / Courses / Config, the landing page and Premium Prep
  - ↳ umbrella pages not rebuilt · paused switch lifted · _2026_PREP rule carried · S4 trial_product_id FK · PARENT_SITE_ORIGIN dev set, prod open · untested by Sam, next session · RN_2026_PREP left active on dev

- 2026-09-11 — slice 2 built: auth (2a) and shell (2b); 1b proven green; Telegram gate queued as slice 17
  - ↳ programs into 2 · S1/S4/S6 ticked · §9 #8 left · #15 users_update WITH CHECK · implicit-flow links for magic/reset · cap 2 kicks oldest live · no footer in legacy · Telegram not dead · email doors untested by Sam

- 2026-09-10 — 1c done: both Workers on the workspace Cloudflare account; the four GitHub secrets set; §6.1 names licensure_gh
  - ↳ dev account_id + workers.dev origin follow prod · one token, two CF secrets · 1b ticks on the first green push to main · prod Exposed schemas done · Workers are created by the first deploy · no server

- 2026-09-10 — release branch is `production` not `prod`; one Cloudflare account queued as 1c; dev+prod in one Supabase project rejected
  - ↳ two prod workflows retargeted · production keeps gamma release history · workspace CF account owns the zone, prod must sit there · auth.users is project-wide · §6.1 `licensure.*` stale · no code, no server

- 2026-09-10 — the rebuild planned (like for like, MyNclex stack only, `licensure_gh` schema), slice 0 done, docs flattened, the stack installed on a branch
  - ↳ D1–D10 · schema `licensure_gh`, country not profession · own migration runner · workers → Server Actions · §8 + §9 lists · legacy/ 85 renames · product-plan flat · no MyNclex UI · db:migrate waits on DB_URL · Next 16.2.4 CVE

## 2026-04 to 2026-06 — [sessions/2026-04-to-06.md](sessions/2026-04-to-06.md) — the gamma era

- 2026-06-04 — admin Attempts analytics page, read-only, no DB change
  - ↳ getAttemptsWindow · countAttempts · getAttemptById · 5,000-row cap · PASS_PCT 70 · delete/void deferred

- 2026-06-01 — Licensure messaging: admin bulk send fixed (RLS admin bypass on thread insert), clickable links, welcome blast to 628 students
  - ↳ messages_threads_insert admin bypass · fix_messages_threads_insert_admin_bypass.sql · applied dev+prod by MCP · body rewrite guarded against replies

- 2026-04-19 — MyNclex planning (Claude Web)
  - ↳ the third product scoped; later decoupled into its own repo

- 2026-04-19 — MyNclex scope + skeleton (Claude Web)
  - ↳ first Next.js skeleton inside gamma; moved out 2026-04-26

- 2026-04-18 — Licensure question-bank inventory
  - ↳ items_gp 149 distinct subjects vs 1–2 elsewhere · RM_MID 540 of 900 · rphn_disease_ctrl empty

- 2026-04-17 — db/ consolidation (Claude Web + Desktop)
  - ↳ schema.sql + rls.sql + seed_data.sql as the readable truth · migrations named not numbered

- 2026-04-17 — library tables renamed `library_X` → `teacher_library_X`, ten tables, dev + prod
  - ↳ rename_library_tables_to_teacher_library.sql · RLS policies renamed · 100 sample questions seeded to prod

- 2026-04-17 — the email worker split per product and the payment worker moved under mynmclicensure; full smoke pass on both products
  - ↳ qacademy-licensure-payment-worker · dev anon key typo fixed · Licensure Table Renaming initiative added · 8 payment routes tested · session cap 2 verified
