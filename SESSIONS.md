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
