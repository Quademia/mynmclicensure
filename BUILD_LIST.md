# MyNMCLicensure Build List

The inventory of slices: everything built, everything queued, everything
parked, one line each, grouped by the plan doc that defines it. Rebuilt
to this shape on 2026-09-10 when the rebuild was planned; the gamma-era
list it replaces is in git history and in `qacademy-gamma`.

## Rules for this file

- **One line per slice:** `- <mark> <id> <name> — <date if built>`.
  Under 120 characters. No explanation, no commit hashes, no merge or
  release status (git holds that).
- **Marks:** ✅ built (with the date) · ⬜ queued · ⏸ parked, with a
  one-line reason · ✖ cancelled.
- **A section per plan doc.** Slice ids are the doc's own ids.
- **Built means ticked in two places in one commit:** here and in the
  plan doc's ladder.
- **There is no "next" marker.** Sam decides each session.
- **Unplanned work still gets a line** when done, marked `(unplanned)`.
- **Found mid-build and out of scope:** a ⬜ line in the right section,
  or a ⏸ line with its reason. Never a paragraph.

---

## The rebuild

### [rebuild.md](docs/product-plan/rebuild.md)

- ✅ 0 Repo reshape — old tree to `legacy/`, MyTeacher and residue deleted — 2026-09-10
- ✅ 1 Scaffold — Next app, Workers, deploy + migrate workflows, schema `licensure_gh`, runner — 2026-09-10
- ⬜ 1b First dev deploy — secrets set 2026-09-10; proven by the first green push to main
- ✅ 1c One Cloudflare account — both Workers on the workspace account, one plan fee — 2026-09-10
- ✅ (unplanned) Release branch named `production` — two prod workflows and the docs retargeted — 2026-09-10
- ⬜ 2a Auth — tables incl. `programs`, login (three doors), register, forgot, reset, router, logout, gates
- ⬜ 2b Shell — topbar, footer, both sidebars, phone drawer, two placeholder dashboards
- ⬜ 3 Catalogue and config — programmes, courses, levels, products, config; public pages
- ⬜ 4 Question bank — eleven item tables, CSV import, images, entitlement policy, content copy
- ⬜ 5 Fixed quizzes and mock exams — admin pages, availability state machine, student lists
- ⬜ 6 Runner, attempts, builder — shared core, instant + timed, resume, review, retake
- ⬜ 7 Student home — dashboard, course, history, profile, procedures, guide, upgrade
- ⬜ 8 Subscriptions — trial at registration, course access, admin grant/update/revoke/sync
- ⬜ 9 Payments — init-public, init-upgrade, verify, setup-complete, admin rescue, rate limit
- ⬜ 10 Email — four templates, Quademia sender, `appOrigin()`
- ⬜ 11 Announcements — eight scope dimensions, notice state, dashboard strip
- ⬜ 12 Messaging — three contexts, admin inbox, bulk send, badges
- ⬜ 13 Offline packs — builder, allowance, non-repeat picker, watermark, renderer
- ⬜ 14 Admin home — dashboard counts, users drawer, attempts analytics
- ⬜ 15 Phone pass — student at 375px, admin navigable at 768px
- ⬜ 16 Cutover — DNS, live keys, content re-copy, old logins deleted, `legacy/` removed

### Decisions still open in rebuild.md

- ✅ §8 S1 user primary key — keep `U_` ids, add the FK — 2026-09-11
- ⬜ §8 S3 attempts blobs → JSONB / arrays
- ✅ §8 S4 foreign keys on licensure tables — 2026-09-11, as each table lands
- ✅ §8 S6 populate `sessions.ip_hash` — 2026-09-11
- ✅ §9 #8 `must_change_password` — left as it is, no gate, column carried — 2026-09-11

## Carried from gamma

Items from the gamma-era list that still apply after the rebuild. Not
rebuild work; listed so they are not lost.

- ⬜ Content: `items_rphn_disease_ctrl` is empty while its course is active
- ⬜ Content: `items_rm_mid` short of its target set count (540 of 900)
- ⬜ Content: set-size targets for RMHN / NACNAP / RPHN
- ⬜ Remove MANUAL_TEST rows before cutover (moot if cutover deletes old data)
- ⏸ Email confirmation on signup — a product change; not in the like-for-like rebuild
- ⏸ Expiry-reminder email — `expiry_reminded` exists unused; a new feature, after the rebuild
- ⏸ Admin create user; sessions / auth-events / reset-request audits — new features, after
- ⏸ Student analytics, notifications, search, sequential runner mode — new features, after
- ⏸ Paystack LIVE key on prod — waits on the company / Paystack-account decision
