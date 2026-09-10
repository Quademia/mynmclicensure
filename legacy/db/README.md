# db/

Database source of truth for the QAcademy Nurses Hub Supabase project (Postgres).

## What each file is

- **`schema.sql`** — every `CREATE TABLE` + indexes + foreign key constraints. Describes the full shape of the database.
- **`rls.sql`** — every RLS policy, every helper function (`auth_user_role`, `myteacher_user_id`, auth-logging RPCs, rate-limit RPCs, reset-password RPCs), plus the small number of non-RLS functions and triggers that need a home (e.g. `offline_packs` updated-timestamp trigger). Includes `ALTER TABLE … ENABLE ROW LEVEL SECURITY` for every table with a policy block, so running this file alone is enough to secure the DB.
- **`seed_data.sql`** — reference / catalogue rows only (programs, courses, levels, products, config, teacher_library_courses). Never users, never test data.
- **`migrations/`** — historical one-shot SQL files, one per change that was applied to the live databases after their initial bootstrap. Each file ran exactly once per environment (dev and prod). **Not re-run during bootstrap** — their cumulative effect is already baked into `schema.sql` and `rls.sql`.
- **`setup/`** — markdown runbooks for the non-SQL parts of a prod setup (Cloudflare worker deploys, Supabase Auth + Storage dashboard settings).

## Fresh bootstrap sequence

To bring up an empty Supabase project to match the current live state:

1. Run `db/schema.sql` in the Supabase SQL Editor.
2. Run `db/rls.sql`.
3. Run `db/seed_data.sql`.
4. Follow `db/setup/workers_deploy.md` and `db/setup/supabase_auth_storage.md` for the Cloudflare and dashboard steps.

That's it. Three SQL pastes + two markdown checklists.

## Mental model

`schema.sql` + `rls.sql` + `seed_data.sql` together represent **the cumulative current state** of the database — what every live environment should look like. `migrations/` is **audit history** — a record of how we got from the blank slate to today.

## Convention for new schema changes

Every new schema change happens in **two places**:

1. A new file in `migrations/` (dated or slice-numbered name) — this is what gets pasted into the Supabase SQL Editor on dev, then prod.
2. Back-ported into `schema.sql` / `rls.sql` / `seed_data.sql` as appropriate, so the bootstrap files stay current.

If you only do step 1, the bootstrap files silently rot and the next fresh environment will be broken — a bug class we've been bitten by twice.
