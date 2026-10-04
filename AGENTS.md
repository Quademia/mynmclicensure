# AGENTS.md — MyNMCLicensure

Last updated: 2026-10-04. Rules for **any** assistant working in this
repo — Codex and Claude both. This file holds **rules only**: what to
do and what to avoid. What happened, and why a rule exists, lives in
`SESSIONS.md` (the index) and `sessions/` (the log). What the app is
and what is decided lives in `docs/product-plan/` (`00-the-map.md`
first, which also holds the build order). What is built and what is
queued lives in `BUILD_LIST.md`. Do not write session history into this
file; if a RULE changes, change the rule.

Claude Code reads `CLAUDE.md`, which points here. Codex reads this
file directly. There is one rules file.

## What This Is

MyNMCLicensure is the NMC Ghana licensure exam-prep product under the
**Quademia** brand: five programmes open today (RN, RM, RPHN, RMHN,
NACNAP), seven decided (NAC and NAP split from NACNAP, RCN added — 02
C5), per-course question banks, practice papers and mock exams, a quiz builder,
instant and timed runners, subscriptions and Paystack checkout,
announcements, support messaging, and offline question packs for
students with unreliable connectivity. Audience: nursing students in
Ghana.

## Current Status

**The port is finished (Sam, 2026-09-16), and the plan was written
fresh on 2026-10-04 (Sam); the work now is building the app it
describes.** The product was moved, like for like, from the vanilla-JS
site onto the MyNclex stack (slices 0–14, "the rebuild"), then improved
— security and storage shape first, so the database is the gate. Sam
plans to redesign every page. On 2026-10-04 Sam found the planning
"going in circles" because it was written on top of the old app, so
the old plan docs, the old build list and the old app's code moved to
`archive/`, and `docs/product-plan/` was rewritten to describe only the
app as it will be:

- `00-the-map.md` — who uses the app, the ways in, every page in one
  line, the menu, **the build order**, and how it is built.
- `01`–`10` — one file per feature: how it works (built and decided
  together; unbuilt parts marked *to build* with their id), storage
  changes with Sam's tick, and the Open list (what is still Sam's).
- `11-pages.md` — per page, what it shows to a free, trial, paid and
  ended student, completed when that page's redesign starts.
- `12-tables.md` — every table in plain words: each column, who can
  read or change it, and every decided change on the column it changes,
  with Sam's tick and date. Written from the dev database (Sam,
  2026-10-04, in place of referring to changes by S-number).

`BUILD_LIST.md` holds each piece's status, one section per plan file.
A decision is written once, in its file; its status once, in the list.
The live product is still the vanilla-JS site served from the
`qacademy-gamma` repo. `archive/` — the old app, the old plan docs (the
rebuild plan, the diagnosis's findings D1–D52, the feature docs), the
old build list — is looked up, never the spec: it says what the old app
did or why something was decided; the plan files say what to build.

⭐ **Nothing is built without Sam's go-ahead in the session.** A change
to storage is written on its table and column in `12-tables.md` — what
changes and why — and needs Sam's tick with a date there before it is
built. **Every migration updates `12-tables.md` in the same commit**:
the change's line becomes plain description, and a column added,
dropped or renamed is added, removed or renamed there. The changes
ticked before 2026-10-04 were numbered S1–S24; that history is in
`archive/product-plan/rebuild.md` §8, and new changes take no number.
A finding is not a decision; a decision is a ruling in a plan file or a
`BUILD_LIST.md` line. New features are each Sam's call, one at a time.
If something looks wrong, log it and ask; do not fix it silently.

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
- `docs/product-plan/` — flat: the map (`00`), the feature files
  (`01`–`10`) and the pages (`11`).
- `sessions/` — period logs.
- `archive/` — read-only: `archive/legacy/` (the old product),
  `archive/product-plan/` (the old plan docs), `archive/BUILD_LIST.md`.
  Never linted, never type-checked.

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
   `NavItem[]`; the menu follows the map (`00-the-map.md`) — today's
   order until the redesign changes it.
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
10. **A page is built from the plan, not from the old app.** Before
    writing a page, read its entry in `11-pages.md` and the feature
    files it names; that entry is completed with Sam when the page's
    redesign starts. `archive/legacy/` is looked up only to see what the
    old page did — never the spec (Sam, 2026-10-04, retiring the port's
    "legacy is the spec").

## UI Conventions

1. **Toasts for messages, not inline banners.** Server errors,
   validation, "done" confirmations: fixed top-right toast, auto-dismiss
   ~5 s with a click-× escape.
2. **Confirmation dialogs for destructive or irreversible actions.**
   Centred dialog, dimmed backdrop, backdrop click maps to the safe
   option. Type-to-confirm for the dangerous ones (revoke, delete).
   **Never `window.confirm`, `window.alert` or `window.prompt`** — the
   app's own overlay, carrying legacy's words (Sam, 2026-09-21). This
   replaces the 2026-09-11 "dialogs stay as legacy has them" for the
   native boxes only: the wording stays legacy's, the box becomes ours.
   A native box also cannot be answered from the desktop app's browser
   pane, so any flow behind one is unwalkable by an assistant.
3. **Every surface works on a phone; student surfaces are the
   priority.** Breakpoint **768px**. The signed-in app's navigation
   comes from the shared drawer in `components/shell/mobile/` (from the
   left). The public top bar has its own phone menu
   (`components/shell/public-menu.tsx`), opening from the right beside
   its hamburger, with the same look from the design system and the
   same closing behaviour — backdrop, link tap, Escape, route change
   (Sam, 2026-09-23). No other surface builds one. The two opening from
   opposite sides is temporary: the app's drawer moves to the right
   later (Sam). Content reflows and stacks below 768px in the surface's
   own stylesheet. **Since 2026-09-28 the app's drawer differs on one
   point:** a tap that changes the page keeps it open, the tapped row
   spinning, until the address changes — the drawer closes then, as the
   loading placeholder takes the page; a tap on the current page's own
   row or an outside link still closes it at once (Sam: b).
4. **One money voice: `GHS 350`, never `₵350`.** Amounts are stored as
   integer minor units and rendered through `formatMinor()`.
5. **One brand name: `Quademia`. `QAcademy` never reaches a reader.**
   Copy, titles, emails, `aria-label`s say Quademia. Comments, `archive/`,
   and identifiers may keep the old name; a string that renders may not.
   MyNMCLicensure is a product name under the brand and has no logo of
   its own.
6. **A tap is never silent** (Sam, 2026-09-28: most students are on slow
   connections). A link to a page of the app is `AppLink`
   (`components/shell/link-pending.tsx`) — `next/link` with the pressed
   mark inside — or a `<Link>` holding `<LinkPending />`; never a plain
   `<a>`, which reloads the whole page and skips the loading
   placeholder. A button that only opens a page is that link too. A
   plain `<a>` stays only for outside sites, downloads, `mailto:` and
   jumps within the page. Every signed-in area shows the one placeholder
   (`components/shell/page-loading.tsx`) through its `loading.tsx` (see
   *Known Workarounds* for where one is needed). The admin and public
   pages' plain links are queued, not yet converted.

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
   `qacademy-mynclex`, `myteacher`, or `archive/`. Copy-paste a helper if
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
   MyTeacher read them live. The one exception is going live's content
   copy and old-logins delete (`10-launch-and-platform.md`).
8. **Do not edit `archive/`.** It is kept to look things up. The old
   app (`archive/legacy/`) is deleted at going live.
9. **A slice that touches a table takes that table's grants back.** Not
   just a table it creates — one it changes at all. `revoke all` from
   `anon` and `authenticated`, then grant back the one thing that table
   actually needs from the browser (usually SELECT, often on a column
   list; frequently nothing, because the writes go through the service
   role behind a gate). Drop the policies that policed a privilege no
   role holds any more. This is diagnosis finding **D43**, which is
   schema-wide because the vanilla era needed it — the browser *was*
   the application — and which is closed surface by surface rather than
   in one sweep (Sam, 2026-09-21). Check
   `information_schema.role_table_grants` after the apply. The trap to
   avoid is the one the record shows: a slice fixes the table's *reads*
   and leaves its *writes* (02 C1 on `subscriptions`, 03 Q1 on
   `quizzes`, S10 leaving `users` with TRUNCATE).
10. **A read that can grow past 1,000 rows reads in batches or is
   paged.** The API hands back at most 1,000 rows a request and gives
   no error when it stops: a `.limit()` above 1,000 is cut to 1,000,
   and so is a database function that returns a set. A read of a whole
   table, a whole course, or every row of a kind across students goes
   through `readAll()` (`lib/supabase/read-all.ts`), 1,000 at a time
   until a short batch comes back, ordered on a unique column; an id
   list it lengthens goes to `.in()` in `slices()`. That is the floor.
   New code does better where it can: a page that shows a list pages
   it for the screen (`.range()`, the database doing the filtering),
   and a number is a count (`{ count: 'exact', head: true }`) rather
   than rows counted in the app. Exempt: one row, one student's own
   rows, one attempt's, pack's or subscription's rows, and the small
   reference tables. This is diagnosis finding **D52**; unlike rule 9
   its known places were put on the floor in one pass rather than
   surface by surface (Sam, 2026-09-26) — each takes the better shape
   when its surface is next worked on — so a new read that breaks it
   is a new defect.

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
  fixed` with no error. The flip side: a portalled dialog sits outside
  the surface's wrapper, so the surface's scoped rules (`.runner …`) do
  not reach it — its own rules are written unscoped (03 Q18's results
  pop-up, 2026-09-27).
- **What a Server Component hands a client component is in the page**,
  rendered or not: the props are serialised into the HTML the browser
  receives. A screen that must not show something — a sitting's
  questions before Start — does not receive it; hiding it in the client
  is not enough. MyNclex's start screen gets this wrong (its session
  page passes the sealed questions under the card); ours sends the
  card's data only and the questions after Start (03 Q17, 2026-09-27).
  Check by searching the page's own HTML for the text.
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
  render, and a synchronous `setState` inside an effect**
  (`react-hooks/purity`, `react-hooks/refs`,
  `react-hooks/set-state-in-effect`): read the clock through a
  module-level helper, never in render; write a ref only in a handler;
  stamp `Date.now()` into state from a **handler**, not an effect body.
- **Browser storage is read through `useSyncExternalStore`**, never in
  render and never through an effect that calls `setState`. Reading
  `sessionStorage` / `localStorage` during render splits the server's
  paint from the browser's (a hydration mismatch), and the effect that
  would fix it trips the lint above. Give the hook a module-level
  subscribe, a getSnapshot that reads storage in a try/catch, and a
  server snapshot of whatever the first paint should show.
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
- **Never pipe a long-running server's output into a command that
  exits.** `npm run dev | head -40` looks harmless and is not: once
  `head` has its forty lines it exits, and the next write blocks
  forever. The server keeps port 3000 but serves nothing, and the
  symptom is a `curl` that hangs rather than an error (2026-09-22).
  Start it bare and read the captured output file.
- **A shared component's rules are unprefixed so a surface can keep its
  own and win on specificity** — that is what makes converting one
  surface at a time safe (`styles/components.css`). The trap: a surface
  that keeps a **background** on its base defeats the shared variants,
  because `.spf .btn` out-ranks `.btn-primary`. A converted surface may
  keep its **size**; if it keeps a colour, the filled variants must be
  restated there (2026-09-22, caught by walking the page).
- **The shared dialog is the browser's own `<dialog>` opened with
  `showModal()`** (`lib/overlays/shared/dialog.tsx`, DS4): focus trap,
  Escape, inert page, top layer and focus return come from the element.
  Catch Escape on `keydown`, not on the element's `cancel` event —
  Chrome fires `cancel` only with user activation, so a synthesised key
  press (the pane's) closes the box without telling React. A confirm
  at a call site is `if (!(await confirm({…}))) return;` from
  `useConfirm()`; never `window.confirm`.
- **A token is not a change until a rule reads it.** `tokens.css` DS1
  aliased the old names; it did not make the new ones used. The price
  weight was changed at the token and three price rules had literals
  (2026-09-22). Grep the readers before calling a token change done.
- **A desktop-app worktree has no `node_modules`** — `npm ci` in it —
  and gets a COPY of `.env.local` when created; a key added to the
  main checkout's file later must be copied across by hand.
- **A reused worktree can carry a stale `.next`, and then every route
  but `/` is a 404** — `/login` included, with no error in the log
  (2026-09-23: a worktree with a `.next` from 2026-09-13). Stop the
  server, delete `.next`, start it again. Check one inner page answers
  200 before trusting the dev server. **`npm run build` leaves the same
  trap:** a dev server started after a production build, on the build's
  `.next`, answered 404 on every inner page (2026-10-01) — delete `.next`
  before starting the dev server after a build. And check what holds
  port 3000 before trusting it: after the desktop app lost the session's
  server, the port was answered by another worktree's (`135d16`), older
  code with no new route; the holder's command line names its worktree.
- **Under a `loading.tsx`, `redirect()` and `notFound()` answer 200.**
  The placeholder has already started the response, so the redirect or
  the 404 travels in the page body (a meta refresh, Next's not-found
  marker), not in the status: a probe by status alone reads a refusal as
  a page served (the report's gates, 2026-10-01). Check the body — that
  the page's own content is absent and the redirect's target is present.
- **The dev server serves its scripts to `localhost` only.** Opened as
  `127.0.0.1:3000` the page renders but nothing hydrates (Next's
  `allowedDevOrigins` refusal, in the server log), so a second address
  is no way to test a signed-out page while the pane is signed in —
  Sam signs the pane out. It did show one real defect: **a form whose
  submit a script handles still needs `method="post"`.** With no
  method, a page whose JavaScript never loaded sends a GET, and every
  field — an email, a phone number — lands in the address bar, the
  history and the server's logs.
- **Pin the pane's size before a before/after measurement.** The
  pane's width follows the desktop app's window, which can change
  between two measurements; set `resize_window` to a fixed size for
  both, or a changed width reads as a changed layout (2026-09-23).
- **A new table in `licensure_gh` starts with `grant all` to the browser
  roles** (the schema's default privileges): `revoke insert, update,
  delete` still leaves TRUNCATE, REFERENCES and TRIGGER with `anon` and
  `authenticated`. A table with no browser write path gets `revoke all`
  then the one grant it needs; check `information_schema.role_table_grants`
  after the apply.
- **Migrate before the readers hot-reload.** `next dev` picks up an
  edited reader within seconds; a migration applied minutes later leaves
  every open page erroring in between. Run `npm run db:migrate` the
  moment the readers are written, or migrate first.
- **A migration run from the session branch also reaches the deployed
  dev site**, which shares the dev database but runs `main`'s code. A
  migration that takes a table's writes back from the browser (rule 9)
  breaks the old code's writes there until the merge — S15 left the dev
  site's admin Grant / Edit / Revoke / Sync refused for the length of the
  session (2026-09-23). Say so when proposing the migration; it reaches
  only Sam, on dev.
- **A webhook cannot reach `localhost`, but its handler can be walked
  there**: sign a body the way the sender does (for Paystack, HMAC-SHA512
  of the raw body under the test secret key) with a scratchpad script
  that reads `.env.local` and never prints the key, and post it. With
  Sam holding a real test payment at a chosen step, that walks the race
  the webhook exists for (2026-09-23).
- **Next memoises an identical fetch within one render.** A Server
  Component that reads a row, writes through a function, then reads the
  same row again with the same client gets the FIRST read back (03 Q5:
  the expired exam's page still showed the preflight). Re-read through a
  different client (the service role) or return what the write returned.
- **A weight the loaded font does not carry is NOT synthesised — the
  browser uses the nearest weight it does have.** Chrome synthesises a
  bold only when the family has no bold face at all; Inter loads 400–700
  here, so `font-weight: 800` and `900` render as pixel-identical to
  700. Measured, 2026-09-22: the same string at 40px is 405.6 / 408.5 /
  411.4 / 414.2 / 414.2 / 414.2px at 400 / 500 / 600 / 700 / 800 / 900.
  DS16 was opened calling those declarations a visual defect; they were
  not. Measure the rendered width before calling a weight a defect —
  and note the landing page is the one surface **not** on Inter
  (`styles/landing.css:19` puts it on the device's own font), where 800
  *is* a real heavier face.
- **A class name assembled at runtime is invisible to a rename.** DS13
  renamed `` `pill pill-${ds}` `` only half — the base, not the prefix —
  and missed two `Record<string, string>` maps holding `'chip-mcq'` and
  friends as plain strings in a `.ts` file. Neither throws; both show
  only as a badge quietly losing its colour. After any class rename,
  run both halves of the check: for every element carrying the base
  class, confirm its **other** classes still resolve to a rule; then
  list any modifier in the CSS that no markup uses. **The second list
  is where a runtime-assembled name hides.**
- **Most surfaces cannot be verified by eye from here.** The desktop
  app's browser pane is signed in as whoever Sam last signed in — a
  student, or on 2026-09-26 his admin account, which also renders the
  student pages — and signs itself out between sessions; every
  authenticated page needs Sam to sign the pane in. The admin holds no
  course access, so the Quiz Builder and the pack builder need a
  student's sign-in (2026-09-26). For a change
  across many such pages, `npm run build` (webpack, all 50 routes) is
  the check that actually exercises them; for CSS, render a proof sheet
  from the repo's own stylesheets and screenshot it, rather than
  trusting the markup to be right. Never a temp file left in `public/`.
  The pane cannot open a `file://` page, so serve the sheet from the
  scratchpad with a throwaway static server on another port (a dozen
  lines of Node on `localhost:8766`, 2026-09-26) — never from `public/`.
  Measure a lockup's **natural** width with `scrollWidth`, not the box:
  a flex box with `min-width: 0` shrinks to fit and the box lies.
- **A new hardcoded colour in a stylesheet is refused by a pre-commit
  guard** (`scripts/css-baseline.mjs`, `.css-baseline.json`, 2026-09-22).
  It is `lint-baseline.mjs`'s shape for CSS: the literals already there
  are frozen, and `npm run css:check` fails only when a count goes UP. A
  count going DOWN is a surface converted under ruling 9 — bank it with
  `npm run css:baseline`. Use a token from `tokens.css`, or add one
  there and use it from there. ⚠ **The guard checks colours only. It
  does NOT check that a token resolves**, and an unresolved token is
  silently dropped by the browser: `--space-5` and `--space-7` do not
  exist — the space tokens are named by their **pixel value**
  (`--space-16`, `--space-24`) — so `padding: 0 var(--space-7)` became no
  padding at all, and a button sat flush against the edge of a 375px
  screen. After writing CSS, check every `var(--…)` against `tokens.css`.
- **`courses_select` is `auth.uid() is not null`**, so a signed-out
  visitor reads NOTHING from `courses` — no titles and no
  `program_scope`. A public page that needs either reads them with the
  service role; the failure is silent otherwise, because a missing title
  falls through to the id and a missing scope makes every product look
  like everyone's. Opening the policy is the cleaner fix and needs its
  own storage tick (`02-packages-and-payments.md`, Open; unruled since 2026-09-22).
- **A row of chips that scrolls sideways hides the chosen one** when the
  choice is a link: the page reloads scrolled to the left, so the chip
  just tapped is off-screen. Wrap the row and shorten the labels
  instead — the one thing the row must show is which one is on
  (2026-09-22, caught only at 375px).
- **Migrations are applied by this repo's own runner**
  (`npm run db:migrate`, `scripts/db-migrate.mjs`), recorded in
  `licensure_gh.migrations`. Never `supabase db push`, never the MCP
  `apply_migration` — both stamp the project's shared tracker, which
  this repo does not own.
- **Prove a migration before applying it, without touching dev's
  data:** a scratchpad script that reads `DB_URL` from `.env.local`
  (never printing it) and runs `begin; <the file>; <tests>; rollback;`
  through `postgres.js` (`sql.unsafe`, which returns every statement's
  rows, so SELECTs placed before the rollback report back). First the
  file alone with a summary SELECT, then a second run exercising the
  rules on a scratch row — triggers, refusals, grants — with `do`
  blocks catching `sqlerrm` into a temp table. Both runs leave nothing
  behind. `set local role authenticated` inside a transaction proves
  what the student's role can read (2026-09-26, 08 B4). **The runner
  prints no notices** (`onnotice` is silenced in `db-migrate.mjs`), so a
  count a migration raises — what a tidy step left out — is seen only in
  the proof run, never in the release job's log; a number that matters
  on prod goes into the data itself (03 Q14 set `n` to the rows copied,
  2026-09-27).
- **A `select('*')` under a cookie client breaks the moment a table's
  grant becomes a column list.** PostgREST hands `*` to Postgres as a
  literal `*`, which needs SELECT on every column it expands to, so a
  column added later, or a table-level grant narrowed to columns
  (rule 9), turns the read into "permission denied" with no build
  error. Every student-side read names its columns; `select('*')`
  survives only under the service role (2026-09-26: the pack renderer,
  caught by a reviewer after B4's migration was written and before it
  was applied — and still applied first, so `main`'s dev-site pack
  page was down until the merge).
- **A bulk insert or upsert writes the union of its rows' keys to every
  row.** supabase-js sends one column list for the batch; a row missing
  a key gets it as null or the default. A column only some rows should
  write — the importer's publish and free choices, for the rows a file
  creates — goes in a batch of its own, or it reaches the other rows too
  (2026-09-26, 08 B4: caught before a re-import could unpublish a live
  question).
- **A column that must come from a list is keyed on the word** (08 B5):
  `foreign key (course_id, maintopic) references bank_topics
  (course_id, name) on update cascade`. The row keeps its word, so no
  reader changes; renaming the list entry reaches every row inside the
  database; a delete of an entry in use is refused; a null is not
  checked (Not set). A cascade fires the table's row triggers, so they
  must treat it as the label change it is.
- **A `loading.tsx` shows only when the page changes directly inside its
  own folder.** The student area's file covers a move from the dashboard
  to the history; it does NOT cover a move between two pages inside a
  sub-folder — one course to another (`course/[id]`), My Packs to the
  builder (`offline-packs/`) — which showed nothing until those folders
  got their own (walked 2026-09-28). A new nested route gets its own
  `loading.tsx` rendering `<PageLoading />`; check the move between two
  of its pages, not only the way in.
- **Prefetching runs only on a production build.** On the dev server no
  link is fetched ahead, so every tap is the slow case (the pressed mark,
  then the placeholder at the server's first reply). To see a prefetched
  placeholder, `npm run build` and the `prod-local` entry in
  `.claude/launch.json` (`next start` on :3001) — the pane's sign-in
  carries across ports (cookies are per host). Each prefetch is one
  request through the middleware's `getUser()` and no page reads
  (Supabase's logs, 2026-09-28: 23 `/auth/v1/user` for 25 links, the
  layout's reads 3 times) — the number to watch as students grow.
- **The pane never hides a background tab**: `document.visibilityState`
  stays `visible` when another pane tab is fronted, so "the student
  switched app" cannot be walked by switching tabs. Walk it by defining
  `visibilityState` / `hidden` on `document` in the page and dispatching
  `visibilitychange` — the app's own handler then runs as a browser would
  make it — and ask Sam for one real phone check on the dev site
  (2026-09-29, 03 Q11).
- **A migration that adds a rule to prod's data tidies that data
  first.** Prod cannot be read from here, and a constraint prod's rows
  fail stops the release's migrate job and so the deploy. Normalise what
  the rule depends on — spaces, empty strings, case twins — in the same
  file even when dev needs none, and leave out a rule nothing needs
  (2026-09-26, 08 B5: the tidy step found nothing on dev; a comma rule
  was dropped).

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
3. **Ticks.** A closed piece turns ✅ with its date in `BUILD_LIST.md`,
   and its plan file loses the "(to build)" tag, in the same commit.
   Off-plan work gets an `(unplanned)` line. Found-and-not-done gets a ⬜
   or ⏸ line with its reason; a question for Sam goes to the plan
   file's Open list.
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
- **Dev's content is sample data; size nothing from its counts** (Sam,
  2026-09-30 and again 2026-10-02). Its empty columns, its 10-question
  quizzes and its bank's size are not the product's shape. The target
  Sam gave: a course holds at least 180 × 5 questions for its fixed
  quizzes and perhaps 180 × 5 more for the builder; a fixed quiz is 100
  (General Paper) or 180. Say what dev shows as a fact about today, and
  ask Sam the real size before a rule or a limit rests on it.
- Discussion is never authorisation. "What do you think?" gets a view;
  only "proceed" starts a build.
- **Build more, plan less** (Sam, 2026-10-04: "we need to stop this
  ongoing planning and planning that is not really helping"). Plan only
  what the next build needs; write a ruling into its plan file in a few
  lines, not pages; park an idea for later in one line instead of
  working it through; steer each session toward building something.
- **Sam decides only from what is offered** (his words, 2026-09-22), so
  an option left out is a decision made for him. Every choice of tool,
  library or approach comes in three parts: what the world does, what
  fits Quademia (code written only by assistants across sessions, which
  he cannot read to check), and what it costs from here — then a
  recommendation, and a note when the recommendation defends what is
  already built. Look at how MyNclex does it first.
- **An asset in an artifact is a proposal until Sam adopts it.** The
  vector Q of 2026-08-12 was used as the logo and taken back the same
  day; the symbol is the painted Q MyNclex carries as `app/icon.png`.
  A logo, a palette, a drawing: ask before it reaches a reader.

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
- The plan (`docs/product-plan/`) is edited by whichever agent is in
  session, only on Sam's go-ahead, and the edit is logged. A disagreement with
  the plan goes in the session entry and to Sam; it is not resolved by
  quietly building something else.

## Files To Read at Session Start

- This file.
- `SESSIONS.md`, then the head of the latest `sessions/` period file.
- `docs/product-plan/00-the-map.md` (the build order is there), then
  the plan file of the piece Sam picks.
- `BUILD_LIST.md`.
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
