# MyNMCLicensure

NMC Ghana licensure exam prep for nursing students, a **Quademia**
product. Seven programmes decided (RN, RM, RMHN, RPHN, RCN, NAC, NAP),
per-course question banks, practice papers and mock exams, a quiz
builder, instant and timed runners, subscriptions with Paystack
checkout, announcements, support messaging, and offline question packs.

## Status

**Ported onto the Quademia web stack; now being built out and
redesigned.** The live product is still the vanilla-JS site served from
`qacademy-gamma`; its code is kept under `archive/legacy/` to look
things up until going live.

- **Rules for working here:** [`AGENTS.md`](AGENTS.md) — for people and
  for assistants (Claude reads it through `CLAUDE.md`; Codex reads it
  directly).
- **The plan:** [`docs/product-plan/`](docs/product-plan/) — start with
  [`00-the-map.md`](docs/product-plan/00-the-map.md): every page, the
  build order, how it is built; then one file per feature and
  `11-pages.md`.
- **The build list:** [`BUILD_LIST.md`](BUILD_LIST.md) — one line per
  piece, ticked with a date when built.
- **The log:** [`SESSIONS.md`](SESSIONS.md) (index) and
  [`sessions/`](sessions/) (detail).
- **The archive:** [`archive/`](archive/) — the old app, the old plan
  docs and the old build list, kept to look things up.
- **How this repo came to be:** [`SPLIT.md`](SPLIT.md).

## Stack

| Layer | Technology |
|---|---|
| App | Next.js 16 + TypeScript + React 19, App Router |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare` |
| Database + Auth + Storage | Supabase — gamma's project pair, this product in the `licensure_gh` schema |
| Payments | Paystack, from Server Actions |
| Email | Resend, from Server Actions |

## Environments

| | dev | prod |
|---|---|---|
| Branch | `main` | `production` |
| Worker | `licensure-dev` | `licensure-prod` → `licensure.quademia.com` |
| Supabase | `zrakjibtxyzoqcdtvpmq` | `qizhyhjeqhaybyddsuni` |

## Local development

```
npm install
npm run dev          # http://localhost:3000
npm run db:migrate   # apply db/migrations to the project in .env.local
npm run lint:check   # whole-repo lint against the baseline
```

`.env.local` is git-ignored; the variables it needs are listed at the
end of `AGENTS.md`.
