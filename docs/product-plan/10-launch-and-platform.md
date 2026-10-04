# 10 — Launch and platform

What must be true to go live, and the platform pieces no feature owns:
security headers, email, speed and scale, settings and reference data,
the limiter, storage hygiene, and the error and offline pages. Going
live is one step in the build order, not a wall the rest waits behind
(Sam, 2026-09-18).

Detail and history: `archive/product-plan/rebuild.md` §6, §11, and
`archive/product-plan/00-overview.md`.

## How it works

### Going live *(to build: 16)*

1. **Before the day**: security headers; Resend's paid plan; the
   Supabase sign-in settings recorded (redirect list, sender, its
   QAcademy-branded templates) and the live address added; a check that
   sharing the project does not slow prod; whether prod opens with the
   paid packages paused (on prod they are archived today); Sam tests
   prod with a throwaway account.
2. **The domain**: `licensure.quademia.com` pointed at prod, the
   workers.dev address switched off in the same commit, prod's own
   address set; every email link checked.
3. **Paystack live**: the live key on prod, the live webhook URL in
   Paystack — waiting on the company / Paystack account decision.
4. **Content copied fresh on prod**: the catalogue, then the subject and
   topic lists before the questions (06), then the questions, then the
   papers and mocks as rows after the questions (04); the rationale
   images into the product's bucket; checked by count. The copy script
   in the old plan predates the one bank table and must be rewritten.
5. **The old logins deleted** — only those belonging to this product
   alone, never MyTeacher's — counted, deleted in one transaction,
   counted again, from a script, the output in the session log.
6. **The old site's pages** on gamma taken down (a redirect is enough);
   MyTeacher untouched.
7. **Clean-up**: `archive/legacy/` removed; the old `public` licensure
   tables dropped once MyTeacher's rebuild confirms it never reads them;
   test rows removed.
8. **Recorded** in the session log and `SPLIT.md`.

No student data from the old site moves; sittings, packs, messages and
announcements start empty.

### Security

- **Security headers** — HSTS, framing, nosniff, referrer, a content
  policy — before going live. *(to build)*
- **Each table gives the browser only what it needs** — usually reading
  named columns, often nothing — table by table as each is touched
  (AGENTS.md rule 9). Payments, devices, the sign-in log, reset
  requests, packs and messages still hold the old defaults.
- **One limiter for the app**: one counter table, a rule per door in
  settings; first doors register, messages, both builders, photo upload
  (Sam, 2026-09-18). *(to build)*
- Old devices and sign-in log rows purged nightly after a window set in
  settings (D29). *(to build)*

### Email

- Built: the app sends its own emails through Resend from the action
  that causes them, four templates, the Quademia sender, every link from
  the sending site's address; a failed send is logged and never blocks.
- **An outbox** — every email queued with a fingerprint, sent at the
  end of the request, retried by a scheduled job, an admin Emails page
  with Retry; MyNclex's shape (Sam, 2026-09-18). Before the expiry
  reminders. *(to build)*
- **The sign-in emails taken over from Supabase** — email link, reset,
  confirm (once on), invite — in Quademia's templates through the outbox
  (the project's templates are shared with MyTeacher). Supabase's own
  sender set to Resend as the fallback, its templates in neutral
  Quademia words. *(to build)*
- Resend's free plan, shared with MyNclex, stops at 100 emails a day —
  the paid plan before going live.
- One daily scheduled job runs the reminders (02), the payment sweep
  (02) and the purges.

### Settings and reference data

- **Settings are admin-only, read through a typed registry** (Sam,
  2026-09-18): every known key with its type, bounds and default; the
  Config page edits typed fields and refuses out-of-range values; the
  dead key dropped. Levels kept and wired to the pickers; a cohort is a
  year. *(to build: 10.7)*
- **Every table is described in `12-tables.md`**, which every database
  change updates in the same commit. `db/schema.sql` and `db/rls.sql`
  are older snapshots that miss three tables; the migrations are the
  record.

### Speed and scale

Built: a tap is never silent (2026-09-28) — the pressed link, the
loading placeholder, the student's links staying inside the app; every
read that can grow past 1,000 rows reads in batches (AGENTS.md rule 10).

*(to build)*

- The photo served at full size (1.38 MB for a 24px circle) and fetched
  on every page — resized and kept.
- The admin and public pages' links reload the whole page.
- The student layout's three reads hold up every student page.
- Two lists read every column of a student's sittings — name the
  columns.
- No index on sittings by date, or by student and date.
- The admin Attempts page reads at most 5,000 sittings — numbers past
  that are the newest 5,000's (05 moves it to database queries).

### Error and offline

- A "couldn't load, try again" page — the app has none. *(to build)*
- The app's own offline page, by a service worker; a "You're offline"
  banner (Sam: later, 2026-09-29). *(to build, later)*

### Storage hygiene

- About 14 columns and one settings row with no reader or writer —
  reviewed one at a time (Sam, 2026-09-18). *(to build)*
- The mock's `visibility` — stored, never checked; the package's mock
  yes / no is the gate (03 F4). *(to build)*

## Storage

Written on the tables in `12-tables.md`: `config` admin-only with a
registry; `users.level` keyed to `levels`; `users.cohort` a year — all
ticked 2026-09-18.

## Open

- **The old-logins delete would reach the new app's own prod accounts**
  — as written it keeps only MyTeacher's logins, so Sam's admin and the
  test accounts would go too (or the delete would fail on their
  sittings and receipts). The filter must spare this product's own
  users. Sam's call before going live.
- Whether prod opens with the paid packages paused.
- **Schools** — a regulator's list with no way to change it (D50,
  unruled since 2026-09-18).
- **The Telegram group's keys** — free text holding junk, no list (D3),
  tied to the group (08).
- Five old-app bugs the port fixed without a record — keep (Sam to
  confirm).
- About 40 small differences from the old app — likely moot with the
  redesign.
- The page-by-page sweep the diagnosis left unrun outside the bank.
- Later, new features: notifications, search.
- A fact to fix: a push to `production` starts the migration and the
  deploy as two separate jobs with nothing making the deploy wait for
  the migration.
