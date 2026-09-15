# AGENTS.md — MyNMCLicensure

Last updated: 2026-09-15. Rules for **any** assistant working in this
repo — Codex and Claude both. This file holds **rules only**: what to
do and what to avoid. What happened, and why a rule exists, lives in
`SESSIONS.md` (the index) and `sessions/` (the log). What is built and
what is queued lives in `BUILD_LIST.md`. What is being built and in
what order lives in `docs/product-plan/rebuild.md`. Do not write
session history into this file; if a RULE changes, change the rule.

Claude Code reads `CLAUDE.md`, which points here. Codex reads this
file directly. There is one rules file.

## What This Is

MyNMCLicensure is the NMC Ghana licensure exam-prep product under the
**Quademia** brand: five programmes (RN, RM, RPHN, RMHN, NACNAP),
per-course question banks, fixed quizzes and mock exams, a quiz builder,
instant and timed runners, subscriptions and Paystack checkout,
announcements, support messaging, and offline question packs for
students with unreliable connectivity. Audience: nursing students in
Ghana.

## Current Status

**Being rebuilt, like for like, onto the MyNclex stack.** The live
product is still the vanilla-JS site served from the `qacademy-gamma`
repo; its code sits here under `legacy/` as the reference. The plan,
the decisions and the slice ladder are `docs/product-plan/rebuild.md`.
The inventory with dates is `BUILD_LIST.md`. Build what Sam asks for in
the session; nothing more. A slice that needs splitting is split in
`rebuild.md` §12 (a "done when" per part) and §14, then `BUILD_LIST.md`,
in one commit — never in the feature docs `00–07`, which describe the
legacy product and are not build plans (Sam, 2026-09-12).

⭐ **The rebuild adds no user-visible feature and no new mechanism.**
Behaviour is transcribed from `legacy/` and the feature specs
`docs/product-plan/00–07`. Where
the two disagree, the code wins. An internal shape may change only where
`rebuild.md` §8 lists it *and* Sam has ticked it with a date. A defect
listed in `rebuild.md` §9 is fixed inside the slice that rebuilds its
surface, never as work of its own. If something looks wrong and is not
in §9, log it and ask; do not fix it silently.

## Stack

- Next.js 16 + TypeScript + React 19 (App Router)
- Deployed to Cloudflare Workers via `@opennextjs/cloudflare`
- Supabase for Postgres + Auth + Storage — **gamma's project pair,
  shared with the legacy product and with MyTeacher.** This product owns
  the Postgres schema **`licensure_gh`** and nothing outside it.
- `@supabase/ssr` for cookie-based server-side auth
- Resend for email — **sent from the app itself** (Server Actions),
  never from a separate worker. There is no `workers/` folder.
- Paystack for payments (GHS, mobile money + card), from Server Actions.

MyNclex (`qacademy-mynclex`) is the first Quademia product on this
stack and the source of the plumbing. MyTeacher follows later.

## Folder Structure

- `app/` — routes only. Each folder is a URL path.
- `components/` — visual pieces, grouped by domain (`shell/`, `nav/<audience>/`).
- `lib/` — logic, grouped by domain (`access/`, `auth/`, `attempts/`, `payments/`, …).
- `styles/` — all CSS, a top-level sibling of `app/`.
- `db/` — schema, RLS, seeds, migrations for the `licensure_gh` schema.
- `scripts/` — the lint baseline and the migration runner.
- `public/` — static assets.
- `docs/product-plan/` — flat: the rebuild plan, the feature specs
  `00–07`, the mock-exams reference, and the gamma-era plans kept for
  history. One folder until there is a reason to separate.
- `sessions/` — period logs. `legacy/` — the old product, read-only.

Layout is **flat**: no `src/` wrapper. This only means the folders
above sit at the repo root; the audience grouping inside them is kept.

## Folder Conventions

1. **Routes grouped by audience under `app/(app)/`.** `student/` and
   `admin/`. URLs are `/student/...` and `/admin/...`. Public and auth
   pages sit outside `(app)/`.
2. **Components grouped by domain.** `components/shell/` is chrome both
   audiences share; `components/nav/<audience>/` is audience-specific;
   `components/nav/shared/` is genuinely shared.
3. **Single-use components live next to their caller.**
4. **`lib/nav/` is data-driven.** Each audience exports its sidebar as a
   `NavItem[]`; the menu items are the legacy sidebar's, in order.
5. **`styles/` is top-level.** New surface, new file.
6. **Each audience renders its own chrome.** `(app)/layout.tsx` is a
   slim auth boundary. Each audience layout loads its chrome data and
   wraps its tree in `<AppShell>`.
7. **List and detail are siblings when each has its own chrome.**
   `/admin/users/` + `/admin/user/[id]/`. Nesting renders both layouts.
8. **Access gates go through `@/lib/access`.** Pages and Server Actions
   call `requireStudent()` or `requireAdmin()`. TS-layer gates mirror
   the SQL policies in `db/rls.sql` — UX is in TS, security is in SQL.
9. **Cross-cutting UI lives in `lib/overlays/`, `lib/toast/`, `lib/hints/`.**
   Generic primitives in `shared/`; surface-specific instances beside
   their area.
10. **Legacy pages map to routes one to one.** Before writing a page,
    open its legacy `.html` and read the whole thing, including the
    script block. The page's copy, order of fields, validation messages
    and empty states are the spec.

## UI Conventions

1. **Toasts for messages, not inline banners.** Server errors,
   validation, "done" confirmations: fixed top-right toast, auto-dismiss
   ~5 s with a click-× escape.
2. **Confirmation dialogs for destructive or irreversible actions.**
   Centred dialog, dimmed backdrop, backdrop click maps to the safe
   option. Type-to-confirm for the dangerous ones (revoke, delete).
3. **Every surface works on a phone; student surfaces are the
   priority.** Breakpoint **768px**. Navigation comes from the shared
   drawer in `components/shell/mobile/`; do not hand-roll it. Content
   reflows and stacks below 768px in the surface's own stylesheet.
4. **One money voice: `GHS 350`, never `₵350`.** Amounts are stored as
   integer minor units and rendered through `formatMinor()`.
5. **One brand name: `Quademia`. `QAcademy` never reaches a reader.**
   Copy, titles, emails, `aria-label`s say Quademia. Comments, `legacy/`,
   and identifiers may keep the old name; a string that renders may not.
   MyNMCLicensure is a product name under the brand and has no logo of
   its own.

## Non-Negotiable Rules

1. **Everything this product owns lives in the `licensure_gh` schema.**
   Tables, RPCs, policies, the migration tracker. Storage buckets are
   global, so they carry a `licensure-gh-` prefix. Nothing is created in
   `public`. This is the extraction mechanism: the day the product gets
   its own Supabase project, `pg_dump --schema=licensure_gh` is the move.
   Every Supabase client is created with `db: { schema: 'licensure_gh' }`.
   The schema must be listed under Exposed schemas on both projects
   (dashboard) — see `db/README.md`.
2. **No imports from sibling products.** Never import from
   `qacademy-mynclex`, `myteacher`, or `legacy/`. Copy-paste a helper if
   the same one is needed; sharing is not allowed.
3. **The extraction test.** `cp -r` of this repo elsewhere must produce
   a working independent repo.
4. **Server-side auth rules:**
   - `@supabase/ssr`, never the deprecated auth-helpers.
   - On the server, `getUser()` or `getClaims()`, never `getSession()`.
   - Create the Supabase client per request, never at module scope.
   - Authenticated pages set `export const dynamic = 'force-dynamic'`.
5. **Never expose the service role key to the browser.** Anon key only
   in client code. The service role is a Worker secret.
6. **Flat layout, no `src/`.**
7. **Do not touch `public.*` or `teacher_*`.** The legacy product and
   MyTeacher read them live. The one exception is the read-only content
   copy in `rebuild.md` §6.6 and the cutover script in §11.
8. **Do not edit `legacy/`.** It is the reference. Deleted at cutover.

## Known Workarounds (stack-level, carried from MyNclex)

- **Production builds use webpack.** `build` and `cf:build` pass
  `--webpack`; OpenNext cannot load Turbopack's chunk layout. Dev keeps
  Turbopack.
- **Keep `middleware.ts`; do not rename to `proxy.ts`.** OpenNext
  rejects Node middleware.
- **`NEXT_PUBLIC_*` must exist at BUILD time.** Every one goes in three
  places: `.env.local`, `wrangler.jsonc` `vars`, and the `env:` of the
  build step in both deploy workflows.
- **Server-side config is a plain env var, read inside a function,
  never at module scope.** Under OpenNext `process.env` binds per
  request; a module-load read can freeze `undefined` in. Give the
  fallback the PROD value.
- **An email links to the site that sent it.** One `appOrigin()` for
  every link a reader clicks; never a literal.
- **A Cloudflare dashboard "Variable" is wiped by the next deploy.**
  Server-side values are encrypted **Secrets** (`wrangler secret put`).
- **RLS is the floor, not the filter.** Permissive policies are ORed,
  and an ADMIN matches every row. Every admin-side or student-side read
  names its scope in the query (`.eq('user_id', …)`). Do not "fix" the
  SQL to narrow it.
- **The Supabase client is untyped.** A wrong table or column name
  never fails a build. `.eq()` before `.select()` typechecks and fails
  at runtime. When adding a value to a union, grep every list and
  `Record` that switches on it.
- **A `'use server'` module may export only async functions.** A
  constant or a type re-export from one breaks the build silently in
  dev. Constants live in a `types.ts` beside it.
- **`page.tsx` / `layout.tsx` export only the default and route
  config.** A stray named export fails the prod build; dev misses it.
- **Every overlay is portalled to `<body>`.** A `container-type` or
  transformed ancestor becomes the containing block for `position:
  fixed` with no error.
- **Deep-clone any rich-text doc before a Server Action boundary**
  (`JSON.parse(JSON.stringify(doc))`) — attrs with a null prototype are
  dropped by the serialiser.
- **A file sent through a Server Action is capped at 1 MB by Next** unless
  `experimental.serverActions.bodySizeLimit` in `next.config.ts` says
  otherwise; the refusal is a thrown 413, not a reply, so the page must
  catch it. Set to 3 MB (the product's 2 MB uploads plus the other
  fields); raise it if a bigger upload ever arrives.
- **`npm install` can drop `lightningcss`'s native binary** on Windows;
  `next dev` then 500s every page. Copy
  `node_modules/lightningcss-win32-x64-msvc/*.node` into
  `node_modules/lightningcss/`, delete `.next`, restart.
- **The React compiler's lint refuses a clock read or a ref write during
  render** (`react-hooks/purity`, `react-hooks/refs`): stamp `Date.now()`
  into state from a handler or an effect and compute from it; write a
  ref only in a handler.
- **A realtime subscription needs the table in the `supabase_realtime`
  publication** and the client's `schema: 'licensure_gh'` on the
  subscription — a table outside the publication fires nothing, with
  no error. Add it in the migration that creates the table (guarded).
- **A `<form action={fn}>` resets its fields after the action returns**
  (React 19). When the fields must survive — a submit that only opens a
  confirm step — use a plain `onSubmit` + `new FormData(form)`.
- **A Server Component cannot clear cookies.** A gate that must sign
  someone out redirects to `/logout?via=gate` (a Route Handler); a
  `signOut()` in the component is silently swallowed and the auth
  cookie bounces the browser straight back.
- **The middleware's "signed-in user leaves /login" bounce is GET-only.**
  A Server Action posted to /login (finishing a Google or magic-link
  return) arrives WITH a user and must reach the action.
- **A desktop-app worktree has no `node_modules`** — `npm ci` in it —
  and gets a COPY of `.env.local` when created; a key added to the
  main checkout's file later must be copied across by hand.
- **Migrations are applied by this repo's own runner**
  (`npm run db:migrate`, `scripts/db-migrate.mjs`), recorded in
  `licensure_gh.migrations`. Never `supabase db push`, never the MCP
  `apply_migration` — both stamp the project's shared tracker, which
  this repo does not own.

## Branching workflow

Two long-lived branches on the remote:

- **`main`** — stable. Session work merges here after Sam tests it
  locally and explicitly approves. A push to `main` deploys
  `licensure-dev` and applies migrations to the dev project.
- **`production`** — released. `main` merges into `production` as a
  GitHub pull request with a merge commit, only on Sam's explicit
  approval. A push to `production` applies migrations to the prod
  project, then deploys `licensure-prod`. The branch predates the
  rebuild; its older commits are the gamma-era site's release history
  and are kept as history.

Each session works on a short-lived branch named for the assistant and
the session (`codex/<slug>` or `claude/<slug>`), committing freely
there. **The session branch stays local and is never pushed**: work
reaches the remote by merging into `main` and pushing `main`, so the
remote carries `main` and `production` only. A branch pushed by
mistake is deleted from the remote after its merge (twelve had piled
up by 2026-09-15). Nobody merges to `main` or `production` without
Sam's yes in the session; a session may merge to `main` more than
once, from the same branch, and the branch lives until the session
ends.

**Per-session loop:**

1. **Start the dev server** as the first action, unless Sam says not to:
   `npm run dev` on `http://localhost:3000`. ⚠ Stopping a backgrounded
   `npm run dev` may kill the wrapper and orphan `next dev` on port
   3000; check the port holder before starting another.
2. Build the requested slice on the session branch. The pre-commit hook
   runs `npm run lint:staged`; it refuses a commit that adds a lint
   error. `npm run lint:check` covers the whole repo; run it once per
   session. Never re-baseline to make the check pass.
3. Sam tests at `localhost:3000`.
4. Wrap up per *At session end*.

## At session end

Sam says we are stopping. Do this, in this order.

1. **The log entry** in `sessions/<period>.md`, newest first, in the
   current month's file. It names the assistant that wrote it. It
   carries: what was built or changed, with slice numbers; what was
   decided and rejected, with reasons; what went wrong and what it
   taught; what is open. It records what was true when written; it does
   not claim merge or release status.
2. **Two lines in `SESSIONS.md`** under the period heading: the title
   line (under 160 characters) and the keyword line (under 250). Count.
3. **Ticks.** A closed slice gets its date in `BUILD_LIST.md` **and** in
   `rebuild.md` §14, in the same commit. Off-plan work gets an
   `(unplanned)` line. Found-and-not-done gets a ⬜ or ⏸ line with its
   reason.
4. **This file, only if a rule changed** or a workaround was learned.
5. **`npm run lint:check`** once; the log says what was checked.
6. **One docs commit** on the session branch.
7. **Ask Sam for the merge to `main`.** Merge only on an explicit yes:

   ```
   git checkout main
   git merge <session-branch> --ff-only
   git push origin main
   git checkout <session-branch>
   ```

   Never `git push origin <session-branch>`.
8. **Report:** what is committed, what is on `main`, what is open. Stop.

A session ends merged to `main`, or the log entry's first line says
why not. Prefer ending at a slice boundary over leaving a half-built
slice on the branch.

## Working With Sam

- Sam has no coding background. Explain rationale before code. No
  assumed code literacy.
- Discuss plans before building. No rewrites of a working slice without
  approval.
- One issue at a time, confirmed before moving on.
- Announce the files you are about to create or change, and wait for
  the go-ahead. Reading is always fine.
- Say who a defect reaches — a real user, or only dev — before
  proposing a fix; Sam prices the fix on that.
- Discussion is never authorisation. "What do you think?" gets a view;
  only "proceed" starts a build.

## Two assistants, one repo

Claude and Codex both build here, as equals. Both work in the same
clone, so both see the same branches and the same working tree. That
gives one hard rule and two habits:

- **One agent per session, one session at a time.** Two agents editing
  the same working tree at once sweep up each other's half-written
  changes. A session ends merged to `main`, or its log entry says why
  not; the next session, whichever agent runs it, starts from there.
- Start of session: `git fetch --prune` and `git branch -r` (a stray
  remote branch is a fact to report, never assumed away — a cloud or
  web session can push one), read `SESSIONS.md` and the head
  of the latest period file, `BUILD_LIST.md`, `git log --oneline -10`,
  and `git branch --no-merged main` — the other agent may have left a
  branch unmerged. Pick it up from its log entry, continue it or leave
  it; never overwrite it.
- The session log entry is the handoff. Write it so the other agent
  can pick up from it without this conversation, and name yourself in it.
- The plan (`rebuild.md`) is edited by whichever agent is in session,
  only on Sam's go-ahead, and the edit is logged. A disagreement with
  the plan goes in the session entry and to Sam; it is not resolved by
  quietly building something else.

## Files To Read at Session Start

- This file.
- `SESSIONS.md`, then the head of the latest `sessions/` period file.
- `BUILD_LIST.md`.
- `docs/product-plan/rebuild.md` §2, §3, §12 at least.
- `git fetch --prune`, `git log --oneline -10`, the tips of `origin/main`
  and `origin/production`, `git branch --no-merged main`.

## Environment variables

Local dev requires `.env.local` (git-ignored):

```
NEXT_PUBLIC_SUPABASE_URL=...            gamma DEV project (public)
NEXT_PUBLIC_SUPABASE_ANON_KEY=...       (public)
APP_ORIGIN=http://localhost:3000
PARENT_SITE_ORIGIN=...                  the DEV parent site; the landing page's "Back to Quademia" link (from slice 3)
EMAIL_FROM=MyNMCLicensure <noreply@quademia.com>
DB_URL=postgresql://...                 migration runner; Supabase → Connect → Session pooler
SUPABASE_SERVICE_ROLE_KEY=...           server only (from slice 2)
PAYSTACK_SECRET_KEY=sk_test_...         (from slice 9)
RESEND_API_KEY=...                      (from slice 10)
```

The two public values also live in `wrangler.jsonc` `vars` and in the
build step of both deploy workflows (three places, one truth).
`APP_ORIGIN` and `PARENT_SITE_ORIGIN` are server-side and per
environment: `.env.local` plus the two `vars` blocks of `wrangler.jsonc`.
Prod secrets are Cloudflare Worker secrets set with `wrangler secret put`.
The database connection strings for the migration runner are GitHub
repository secrets (`DB_URL_DEV`, `DB_URL_PROD`), never in the repo and
never in a chat.
