# db/ — the `licensure_gh` schema

⚠ **Read this line first.** The product's tables live in a Postgres schema
named `licensure_gh`, inside gamma's shared Supabase project (dev
`zrakjibtxyzoqcdtvpmq`, prod `qizhyhjeqhaybyddsuni`). Supabase's API serves
only the schemas listed under **Settings → API → Exposed schemas**. If
`licensure_gh` is not listed there, every query from the app fails with
"relation does not exist", and nothing in this repo can fix it. Add it on
dev now and on prod before the first prod deploy. Add it to **Extra search
path** in the same settings block as well.

## What is here

| Path | Role |
|---|---|
| `migrations/` | The only thing that changes the database. `YYYYMMDDHHMMSS_name.sql`, applied in name order, each once, each in its own transaction. Immutable once applied anywhere. |
| `schema.sql` | The readable statement of the current tables — regenerated whenever a migration changes them. Never applied directly. |
| `rls.sql` | The readable statement of the current policies and the SECURITY DEFINER functions. Same discipline. |
| `seed/` | *(not yet needed)* The content copies live inside the migrations that create their tables (rule below); a `seed/` folder appears only if dev ever needs rows prod does not have. |
| `cutover/` | *(slice 16)* The one-day scripts: content copy, old-login deletion. Run by hand, output pasted into the session log. |

## How migrations are applied

**This repo's own runner, never the Supabase CLI.**

```
npm run db:status     what is applied, what is pending
npm run db:migrate    apply pending
```

`scripts/db-migrate.mjs` connects with `DB_URL`, bootstraps the schema and
the tracker table `licensure_gh.migrations` if absent, and applies each
pending file in a transaction that also records it. In CI,
`migrate-dev.yml` runs it on every push to `main` and `migrate-prod.yml` on
every push to `production`, with `DB_URL_DEV` / `DB_URL_PROD` as repository
secrets.

**Why not `supabase db push`.** The CLI records in the project's single
tracker and refuses to run when it disagrees with the files on disk. This
project is shared with the legacy site and MyTeacher; MyNclex's repo shows
what happens when a project's tracker is owned by one repo — a second repo
cannot push. Ours records only in `licensure_gh.migrations`, so any number of
repos can each own a schema in one project. ⚠ The MCP `apply_migration`
tool stamps the CLI tracker too; do not use it here. `execute_sql` for
*reading* is fine.

## Connection string

`DB_URL` is the Postgres URI from the Supabase dashboard → **Connect** →
**Session pooler** (the one on port 5432 with the `postgres.<ref>` user).
It carries the database password: locally it goes in `.env.local`
(git-ignored), in CI in the repository secrets, and never in this repo or
in a chat.

## Rules

- The content copy (rebuild.md §6.6) lives INSIDE the migration that
  creates the table, as a guarded `insert … select from public.<table>`
  (see `20260911010000_auth_tables.sql` for programs and schools), so
  each environment is filled by its own run.
  **Exception, the question bank (slice 4a):** the eleven `items_*`
  tables are created with no copy. Dev was loaded from Sam's CSV exports
  of prod (2026-09-13, a one-off loader outside the repo, verified by
  row count per table); prod is copied at cutover by the §6.6 SQL.
- Storage buckets are global to the project, so they carry the
  `licensure-gh-` prefix and are created by the migration that needs
  them (`insert into storage.buckets`). One so far:
  `licensure-gh-rationale-images`, public read, 2 MB limit, written
  only from the server.
- Everything in `licensure_gh`. A migration that names `public.*` or
  `teacher_*` is a plan violation (AGENTS.md rule #7), except the read-only
  content copy and the cutover scripts, which say so in their header.
- One migration, one intent, one file. Name it for the intent.
- After a migration that changes tables or policies, regenerate
  `schema.sql` / `rls.sql` in the same commit.
- The legacy schema this one is transcribed from is
  `legacy/db/schema.sql` and `legacy/db/rls.sql`.
