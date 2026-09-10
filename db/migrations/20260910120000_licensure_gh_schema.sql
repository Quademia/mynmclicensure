-- 20260910120000_licensure_gh_schema.sql
--
-- The one-time foundation: the `licensure_gh` schema and the grants that let
-- Supabase's API roles reach it. Every table, RPC and policy this product
-- owns lives in this schema and nowhere else (AGENTS.md rule #1).
--
-- ⚠ THIS FILE IS NOT ENOUGH ON ITS OWN. PostgREST serves only schemas
-- listed under Settings → API → Exposed schemas on the Supabase project.
-- Add `licensure_gh` there (dev and prod, once each, by hand) or every query
-- from the app fails with "relation does not exist". See db/README.md.
--
-- Idempotent: safe to run on a project where the runner's bootstrap has
-- already created the schema and the tracker.

create schema if not exists licensure_gh;

-- The runner's own tracker (scripts/db-migrate.mjs). Created here too so
-- db/ describes everything that exists in the schema.
create table if not exists licensure_gh.migrations (
  version    text primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);

-- Access for the API roles. Without these, PostgREST can see the schema
-- once exposed but every table in it answers "permission denied". RLS
-- (per table, later migrations) is what actually limits rows; these grants
-- are the door, not the lock.
grant usage on schema licensure_gh to anon, authenticated, service_role;

grant all on all tables    in schema licensure_gh to anon, authenticated, service_role;
grant all on all routines  in schema licensure_gh to anon, authenticated, service_role;
grant all on all sequences in schema licensure_gh to anon, authenticated, service_role;

-- And for everything created in the schema from now on (by the role the
-- migrations run as).
alter default privileges in schema licensure_gh grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema licensure_gh grant all on routines  to anon, authenticated, service_role;
alter default privileges in schema licensure_gh grant all on sequences to anon, authenticated, service_role;

-- The tracker itself is not for the API: only the runner reads it.
revoke all on licensure_gh.migrations from anon, authenticated;
