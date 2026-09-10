// scripts/db-migrate.mjs
//
// This repo's own migration runner for the `licensure_gh` schema.
//
// WHY NOT THE SUPABASE CLI. `supabase db push` records what it applied in
// the project's single tracker (supabase_migrations.schema_migrations) and
// refuses to run when that tracker disagrees with the files on disk. Our
// Supabase project is shared: the legacy site, MyTeacher and (later) the
// MyTeacher rebuild all live in it. Two repos cannot share one tracker, so
// this repo keeps its own — licensure_gh.migrations — and never touches the
// CLI's. See rebuild.md §6.5. ⚠ Never run `supabase db push` or the MCP
// `apply_migration` against this project from this repo; both stamp the
// shared tracker (AGENTS.md, Known Workarounds).
//
// WHAT IT DOES.
//   - Reads db/migrations/*.sql in filename order. Names are
//     YYYYMMDDHHMMSS_name.sql; the 14-digit stamp is the version.
//   - Connects with DB_URL (env, or .env.local when unset — never both
//     halves of a secret in the repo).
//   - Bootstraps the schema and the tracker if absent (idempotent).
//   - Applies each file not yet in licensure_gh.migrations, EACH IN ITS OWN
//     TRANSACTION, and records it in the same transaction. A failing file
//     leaves the database as it was before that file and stops the run.
//   - Never re-applies a recorded version; never edits a file's record.
//
// Usage:
//   npm run db:migrate            apply pending
//   npm run db:status             list applied and pending, apply nothing
//   node scripts/db-migrate.mjs --dry-run   same as --status
//
// ⚠ A migration file is IMMUTABLE once applied anywhere. To change what
// it did, write a new file. The tracker records the version, not the text.

import postgres from 'postgres';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(repoRoot, 'db', 'migrations');
const SCHEMA = 'licensure_gh';
const statusOnly = process.argv.includes('--status') || process.argv.includes('--dry-run');

function loadDotEnvLocal() {
  const p = join(repoRoot, '.env.local');
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function listMigrationFiles() {
  if (!existsSync(migrationsDir)) return [];
  return readdirSync(migrationsDir)
    .filter((f) => /^\d{14}_[A-Za-z0-9_-]+\.sql$/.test(f))
    .sort();
}

async function main() {
  loadDotEnvLocal();
  const url = process.env.DB_URL;
  if (!url) {
    console.error(
      'db-migrate: DB_URL is not set.\n' +
        '  Locally: put the Postgres connection string in .env.local as DB_URL=...\n' +
        '  (Supabase dashboard → Connect → Session pooler URI).\n' +
        '  In CI: the DB_URL_DEV / DB_URL_PROD repository secrets.'
    );
    process.exit(2);
  }

  const files = listMigrationFiles();
  // onnotice: the first migration repeats the bootstrap's CREATE ... IF NOT
  // EXISTS on purpose (so db/ describes everything in the schema), and
  // Postgres answers each with a NOTICE "already exists, skipping". Those
  // are not failures; keep the output to what changed.
  const sql = postgres(url, { max: 1, prepare: false, ssl: 'require', onnotice: () => {} });

  try {
    // Bootstrap: the schema and the tracker must exist before we can ask
    // what has been applied. Both statements are idempotent.
    await sql.unsafe(`create schema if not exists ${SCHEMA}`);
    await sql.unsafe(
      `create table if not exists ${SCHEMA}.migrations (
         version    text primary key,
         name       text not null,
         applied_at timestamptz not null default now()
       )`
    );

    const rows = await sql.unsafe(`select version from ${SCHEMA}.migrations order by version`);
    const applied = new Set(rows.map((r) => r.version));
    const pending = files.filter((f) => !applied.has(f.slice(0, 14)));

    console.log(`db-migrate: ${applied.size} applied, ${pending.length} pending (${files.length} on disk)`);
    for (const f of files) {
      console.log(`  ${applied.has(f.slice(0, 14)) ? '✓' : '·'} ${f}`);
    }

    if (statusOnly) return;

    for (const file of pending) {
      const version = file.slice(0, 14);
      const body = readFileSync(join(migrationsDir, file), 'utf8');
      process.stdout.write(`applying ${file} … `);
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx.unsafe(
          `insert into ${SCHEMA}.migrations (version, name) values ($1, $2)`,
          [version, file]
        );
      });
      console.log('done');
    }

    if (pending.length === 0) console.log('nothing to apply');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('\ndb-migrate: FAILED —', err.message ?? err);
  process.exit(1);
});
