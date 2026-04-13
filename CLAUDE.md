# CLAUDE.md — QAcademy Nurses Hub

Read and follow `AGENTS.md` for all shared rules, conventions, and session routines.

This file contains only Claude Code specific notes.

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
2. Read `BUILD_LIST.md` for current priorities
3. Scan recent commits (`git log --oneline -10`) — another assistant may have pushed changes
4. Read `README.md` for project context if needed
5. Read `db/schema.sql` if working on anything database-related

### End
1. Commit all work with clear commit messages
2. Push to main
3. Update `BUILD_LIST.md` if items were completed or new ones discovered
4. Update `README.md` if new pages, features, or conventions were added
5. Update Product.md where appropraite.

## Working With Me
- I have no coding experience. Before writing or pushing any code, explain the rationale — what the code does, why it's structured that way, and what it changes. Do not assume I can read code.
- Always push directly to main. No PRs or feature branches.

## Key Files
| File | Purpose |
|---|---|
| `README.md` | Full project docs, stack, conventions, page reference |
| `BUILD_LIST.md` | Current priorities (5-sprint hardening plan) |
| `CLONING.md` | Technical rebuild guide |
| `db/schema.sql` | Single source of truth for all 36 database tables |
| `js/paths.js` | Central path config — never hardcode product paths in JS |
| `js/config.js` | Supabase credentials |
| `js/guard.js` | Auth and role guards |
| `js/mynmclicensure-api.js` | Licensure data layer |
| `myteacher/js/myteacher-api.js` | Teacher Assess data layer |

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

## Multiple AI Assistants
This repo is worked on by both Claude Code and ChatGPT (and potentially others). Each checks the other's recent commits at session start.
- `CLAUDE.md` — Claude Code specific instructions (auto-loaded by Claude)
- `AGENTS.md` — shared instructions for all assistants (this file)
