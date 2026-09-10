# MyNMCLicensure

NMC Ghana licensure exam prep for nursing students, a **Quademia**
product. Five programmes (RN, RM, RPHN, RMHN, NACNAP), per-course
question banks, fixed quizzes and mock exams, a quiz builder, instant
and timed runners, subscriptions with Paystack checkout, announcements,
support messaging, and offline question packs.

## Status

**Being rebuilt onto the Quademia web stack, like for like.** The live
product is still the vanilla-JS site served from `qacademy-gamma`; its
code sits in this repo under `legacy/` as the reference until cutover.

- **Rules for working here:** [`AGENTS.md`](AGENTS.md) — for people and
  for assistants (Claude reads it through `CLAUDE.md`; Codex reads it
  directly).
- **The plan:** [`docs/product-plan/rebuild.md`](docs/product-plan/rebuild.md)
  — decisions, the stack-versus-product boundary, the database, the
  slice ladder.
- **The inventory:** [`BUILD_LIST.md`](BUILD_LIST.md) — one line per
  slice, ticked with a date when built.
- **The log:** [`SESSIONS.md`](SESSIONS.md) (index) and
  [`sessions/`](sessions/) (detail).
- **The feature specs:** [`docs/product-plan/`](docs/product-plan/)
  `00–07`, beside the plan.
- **How this repo came to be:** [`SPLIT.md`](SPLIT.md).

## Stack

| Layer | Technology |
|---|---|
| App | Next.js 16 + TypeScript + React 19, App Router |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare` |
| Database + Auth + Storage | Supabase — gamma's project pair, this product in the `licensure` schema |
| Payments | Paystack, from Server Actions |
| Email | Resend, from Server Actions |

## Environments

| | dev | prod |
|---|---|---|
| Branch | `main` | `prod` |
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
