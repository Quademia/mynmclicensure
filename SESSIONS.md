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
