# CLAUDE.md — QAcademy Nurses Hub

> ⚠ **This repo was split three ways on 2026-08-23.** Read
> [`SPLIT.md`](SPLIT.md) before doing anything structural — it records
> what is now separate, and (more importantly) the five things that are
> still shared between the products despite the split.

## Claude-Specific
- This file is auto-loaded by Claude Code at session start.
- AGENTS.md is the shared instruction file for all AI assistants — always follow it.
- Check recent commits at session start — ChatGPT may have pushed changes.
# AGENTS.md — QAcademy Nurses Hub

Shared instructions for any AI assistant working on this repo (Claude, ChatGPT, Codex, etc).

## Project Overview
QAcademy Nurses Hub is a web-based LMS for nursing students in Ghana preparing for NMC licensure exams. Two products under one repo:
- **MyNMCLicensure** (`mynmclicensure/`) — exam prep with admin + student sides
- **MyTeacher** (`myteacher/`) — class-based assessment with teacher + student + admin sides

**Stack:** Vanilla HTML/CSS/JS (no build step), Supabase (DB + auth), Cloudflare Pages (hosting), Paystack via Cloudflare Worker (payments).

## Session Routines

### Start
1. Pull latest from git
2. Read Sessions.md to remeber prevoius work
3. Read `BUILD_LIST.md` for current priorities
4. Scan recent commits (`git log --oneline -10`) — another assistant may have pushed changes
5. Read `README.md` for project context if needed
6. Read `db/README.md` (entry point), then `db/schema.sql` + `db/rls.sql` if working on anything database-related

### End
1. Commit all work with clear commit messages
2. Push to main
3. Update `BUILD_LIST.md` if items were completed or new ones discovered
4. Update `README.md` if new pages, features, or conventions were added
5. Update Product.md where appropraite.
6. update sessions.md

## Working With Me
- I have no coding experience. Before writing or pushing any code, explain the rationale — what the code does, why it's structured that way, and what it changes. Do not assume I can read code.
- Always push directly to main. No PRs or feature branches.



## Coding Conventions
- Supabase JS CDN uses `supabase` as global. Project uses `const db = supabase.createClient(...)` in `js/config.js`. All files reference `db`, never `supabase`.
- Use `.maybeSingle()` instead of `.single()` on queries where result might be empty.
- Never hardcode `/mynmclicensure/...` or `/myteacher/...` paths in JavaScript. Always use `LICENSURE.x` or `MYTEACHER.x` from `js/paths.js`.
- Item IDs are globally unique and course-prefixed: `GP_001`, `RN_MED_001`, etc.
- User IDs are TEXT format: `U_` + random string (not UUID).
- When adding to an API file, provide only the new function block — never a full rewrite.

## Security Rules
- Never trust frontend guards alone — they are UX convenience, not protection. Security lives in RLS and server-side code.
- Do not widen CORS on the payments worker.
- Never use innerHTML with user-controlled values. Use safeText() and safeAvatar() from js/utils.js instead. These helpers are the established pattern — use them for any new UI that displays names, emails, URLs, or any user-supplied text.
- Do not expose Supabase service role key in browser code — anon key only.
- All sensitive writes should go through trusted boundaries (workers/RPCs), not direct browser mutations.

## Change Rules
- Prefer minimal patches over large rewrites.
- Do not rewrite large working files unless explicitly asked.
- Preserve existing UX unless the task says otherwise.
- Do not add features, refactor, or "improve" beyond what was asked.
- When editing, only touch what needs to change. Don't clean up surrounding code.


