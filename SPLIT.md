# The Split — how gamma became three repos

**Read this first if you have just landed in one of the three repos and
don't know how it got here.**

This file has two halves, and they have different lifetimes:

- **Part 1 is frozen.** It records what was true at the moment of the
  split. It is byte-identical in all three repos and **must not be
  edited** in any of them. Three contradictory accounts of the same
  history is exactly the failure this file exists to prevent.
- **Part 2 is this repo's own.** It records what *this* repo has done
  since. Every copy edits only its own Part 2. They are *supposed* to
  diverge.

If something changes that is true for all three, it does not belong in
Part 1 — Part 1 is history, and history doesn't change. Put it in each
repo's Part 2, three times, on purpose.

---

# PART 1 — FROZEN (do not edit, in any copy)

## What happened

On **2026-08-23**, the `qacademy-gamma` repo was duplicated twice. It
had held two products in one repo since the beginning; from this date
each product gets its own.

| Repo | Holds | Status at the split |
|---|---|---|
| `mybackpacc-byte/qacademy-gamma` | both products, unchanged | **the one that is live.** Keeps running, keeps serving users, still wired to Cloudflare Pages |
| `Quademia/mynmclicensure` | MyNMCLicensure | exact copy, private, nothing deleted yet |
| `Quademia/myteacher` | MyTeacher | exact copy, private, nothing deleted yet |

Both copies were cut as a **full mirror** — all history, all branches —
from gamma `main` @ `d35fdfe`, with `production` @ `ab2a380`. The two
branches were level at that moment: nothing was unreleased.

**To find the exact cut point from inside any copy**, don't trust the
SHAs above — ask git:

```bash
git merge-base HEAD <gamma-main>
```

The last commit a copy shares with gamma *is* the cut point, and it
stays correct no matter what anybody edits.

## Why duplicate instead of extracting each product's history

The alternative was `git filter-repo` — surgically pulling one
product's commits out into a clean repo. It was rejected:

- It destroys the history of the shared root files, which is where a
  lot of the "why is this like this" answers live.
- Wrong path rules produce a plausible-looking repo whose history is
  quietly incomplete, and you find out months later.
- The whole repo is 31 MB. Carrying the other product's dead history
  costs nothing and buys the ability to `git log` anything.

A **mirror push**, not a GitHub fork. A fork stays network-linked to
its parent — shared PR graph, a "forked from" banner, and it is
possible to open a pull request back into gamma by accident. The point
of this exercise is that these repos have nothing to do with each other.

## ⚠ What the split does NOT split

This is the most important section in the file. Splitting the repos
splits the **code**. It does not split any of the following, and
nothing about having your own repo should be read as having your own
version of these.

**1. The database. One Supabase project serves both products.**

| | Project ref |
|---|---|
| prod | `qizhyhjeqhaybyddsuni` |
| dev | `zrakjibtxyzoqcdtvpmq` |

Both products' `js/config.js` point at these, in both repos, after the
split exactly as before it.

**2. `auth.users` is shared.** One login identity backs both products.
This was a deliberate decision, not an accident — see the April 2026
sprint below, which states it in as many words.

**3. The two products coexist in that one database by table-name
prefix**, and that convention is now load-bearing across two repos
instead of two folders:

| Owner | Tables |
|---|---|
| **MyNMCLicensure** | the bare names — `users`, `sessions`, `attempts`, `quizzes`, `mock_quizzes`, `items_gp`, `subscriptions`, `payments`, `products`, `courses`, `programs`, `levels`, `messages`, `messages_threads`, `announcements`, `offline_packs`, `config`, `auth_events`, `reset_requests`, `user_notice_state` |
| **MyTeacher** | everything prefixed `teacher_*` |

(This is the ancestor of the `nclex_` prefix rule in the MyNclex repo.
That rule exists *because* of this arrangement.)

**4. One hostname decides prod-vs-dev for both products.** Every
`config.js` reads:

```js
const IS_PROD = window.location.hostname === 'qacademynurseshub.pages.dev';
```

Cloudflare Pages today: `qacademy-gamma.pages.dev` ← `main` (dev), and
`qacademynurseshub.pages.dev` ← `production` (prod). **One Pages
project, one domain, two subfolders.** A repo that gets its own Pages
project and its own hostname must have that line rewritten, or its
pages will silently talk to the dev database. See *Standing hazards*.

**5. `EMAIL_SECRET` is the same value in both products** — and it is
hardcoded in `js/config.js`, which is client-side, so it ships to every
visitor's browser. (The dev value is the prod value with its two halves
swapped.) After the split, two separate repos still ship one shared
secret to the public. Not a task for today; recorded so that nobody
discovers it and assumes it is only their repo's problem.

## The precedent — this has already been done once, one layer down

`docs/sprints/myteacher-clean-split.md` — **Status: COMPLETE, April
2026.** MyTeacher was separated from MyNMCLicensure at the **auth
layer**: its own user table, session table, auth-audit table, password-
reset table, its own `myteacher-guard.js` and `myteacher-auth.js`, and
its own login / forgot-password / reset-password / router pages.

That sprint is why the two product folders are so nearly self-contained
today — each already has its own `js/`, `css/`, `admin/`, `student/`
and `workers/`, and there is no shared JavaScript or CSS between them
(`archive/` holds the old shared ones; they are dead).

It also drew the line this split stops at, in its own words:

> Supabase Auth (`auth.users`) remains shared — it is the login
> identity for both products.

**The April split went as far as it could without splitting the
Supabase project. This one does too.** Same boundary, one layer up.

## Standing hazards — known, deliberately not solved on 2026-08-23

**⚠ `db/` describes one database from two repos.** Both copies carry
`db/schema.sql`, `db/rls.sql` and `db/migrations/`. Left alone, two
repos will write independently-numbered migrations against a single
live database. This is the one place where "just duplicate it and let
it diverge" produces a genuine mess.

The recommended fix, **not yet decided**: split `db/` by the prefix
table above — bare names stay with `mynmclicensure`, `teacher_*` goes
to `myteacher` — and each repo's `db/README.md` opens with a line
saying the database is shared and naming the other repo. The prefix
convention already partitions the schema cleanly, which is why this is
cheap now and expensive later.

**⚠ The `IS_PROD` hostname rewrite is not a deletion, so it gets
forgotten.** Almost all of the per-repo cleanup is deleting the other
product. The hostname line is the exception: it is an *edit*, and it is
the line that decides which database a page talks to. Do it first and
test it hardest.

ⓘ While testing locally this is harmless — no local hostname matches
`qacademynurseshub.pages.dev`, so a copy running on your machine falls
through to **dev**, which is where you want it.

**⏳ The re-sync window has a hard edge.** Until a copy makes its first
deletion commit it is still identical to gamma and can plainly pull
gamma's newer commits. **After the first deletion, it cannot** — a pull
starts fighting the deletions. So: if anything lands in gamma between
the split and the day you start cleaning up a copy, pull it *before*
you delete anything, not after.

## What each copy still has to do

Per-repo cleanup, none of it done on 2026-08-23:

| | → `mynmclicensure` | → `myteacher` |
|---|---|---|
| `mynmclicensure/` | keep | delete |
| `myteacher/` | delete | keep |
| `archive/` (dead shared css/js) | delete | delete |
| `workers/`, `payments-worker/` (empty residue) | delete | delete |
| `images/` | keep a copy | keep a copy |
| `docs/product/00–07` | keep | delete |
| `docs/product/08–09` (teacher assess, teacher academic structure) | delete | keep |
| `docs/sprints/myteacher-clean-split.md` | delete | keep |
| `index.html`, `product-select.html` (the shared front door) | obsolete once each product has its own domain and login — no chooser left to choose | same |
| `CLAUDE.md`, `BUILD_LIST.md`, `SESSIONS.md` | rewrite for one product | rewrite for one product |
| `db/` | see *Standing hazards* | see *Standing hazards* |
| `js/config.js` → `IS_PROD` | **rewrite**, not delete | **rewrite**, not delete |
| its own Cloudflare Pages project + hostname | to create | to create |

---

# PART 2 — THIS REPO (edit freely; expected to diverge)

**This repo is:** `mybackpacc-byte/qacademy-gamma` — the original.

**Role:** the live one. Serves both products at
`qacademynurseshub.pages.dev` and keeps doing so until each product's
own deployment is standing. Nothing here was changed by the split
except the addition of this file.

**Done since the split:**

| Date | What |
|---|---|
| 2026-08-23 | this file added; the two copies mirrored to `Quademia/mynmclicensure` and `Quademia/myteacher` |

**Open for this repo:**

- Decide how long gamma stays the thing that deploys. While it does,
  every fix has three plausible homes and two of them reach nobody —
  so whatever the answer, it should be written here rather than decided
  fresh under pressure each time.
- gamma's 24 stale `claude/*` session branches were left in place here.
  They were deleted from the two copies, where they mean nothing.
