# Design System — the tokens, the components, the shell

The living plan for this surface (Sam, 2026-09-19: the feature docs hold
what a feature does today, what the diagnosis found, Sam's rulings, and
the sliced plan). Opened 2026-09-22 by Claude, in session with Sam, on
his go-ahead: the item had lived as two lines under `00-overview`, and
the 2026-09-21 entry had already noted that section was overgrown at 20
lines and that the design system might deserve a doc of its own.

Sources: the Claude Design system built from this repo at `d5ee034` on
2026-09-19 and revised on 2026-09-20 and 2026-09-22 — its token file,
its brand book, and its A1 / A2 / A3 shell screens at desktop 1280 and
phone 375; the inventory of 2026-09-19 in `sessions/2026-09.md`; the
perf investigation of 2026-09-16; and the audit of `styles/` and the
React code done on 2026-09-22, which is where every number in §1 comes
from.

Slice ids here are **`DS1`, `DS2`, …** — two letters deliberately. A
bare `D` collides with two live series, `rebuild.md`'s D1–D10 and the
diagnosis's D-numbers, and that collision is already an open problem in
the record. `BUILD_LIST.md` uses these ids under this doc's section.

---

## 1. What it does today

### One token file, fifteen names

`styles/base.css` is 134 lines: a `:root` of **15 custom properties**,
the reset, `body`, `a`, and the toast. It is loaded once from
`app/layout.tsx`. The names are `--primary`, `--primary-dark`,
`--primary-light`, `--accent`, `--success`, `--danger`, `--warning`,
`--text`, `--text-muted`, `--border`, `--bg`, `--white`, `--radius`,
`--shadow`, `--shadow-md`.

Those names are used **1,862 times** across the stylesheets, so the
token habit is real. What has grown on top of it is the problem.

### Three vocabularies, not one

1. **The global set** above.
2. **`.qa-page`** (`auth.css`, `landing.css`) — the same colours under
   different names: `--navy` *is* `--primary` `#1e3a5f`, `--teal` *is*
   `--accent` `#2d7d72`. Identical values, so collapsing them changes
   nothing a reader sees. Carried from legacy's `login.html` `<style>`.
3. **`.subp`** (`payment-confirmation`, `premium-prep`,
   `student-upgrade`, `subscribe`) — a genuinely different language:
   `--brand` `#0b7a75`, `--ink` `#0f172a`, `--muted` `#64748b`, `--line`
   `#e2e8f0`, and inside its scope it **overrides** `--bg`, `--shadow`,
   `--danger` and `--radius` (**18px**, against the global 8px). This is
   the treatment ruled out by B1.

### The sprawl, measured

| | |
|---|---|
| Stylesheets in `styles/` | 33 |
| …that define their own `.btn` | **30** |
| Distinct `font-size` values | **54** |
| Distinct `border-radius` values | 24 |
| Distinct hex colour literals | **151**, in 684 uses |
| Status colours (green / red / amber) hardcoded | **173 times, in 28 of the 33 files** |

The 54 font sizes are less bad than they look: 13px, 12px, 14px and 11px
are about 700 of roughly 800 uses. **There is already a scale; it has no
name**, so each new surface guesses at it.

### The retired sales teal, where it actually is

B1 retires `#0b7a75`. It sits in **9 of the 33 stylesheets, 52
occurrences — and 46 of those are written `rgba(11, 122, 117, …)`**
rather than as the hex, which is why a hex-only search undercounts it.

| Stylesheet | hex | rgba |
|---|---|---|
| `premium-prep.css` | 1 | 13 |
| `student-offline-builder.css` | 0 | 7 |
| `student-quiz-builder.css` | 0 | 6 |
| `payment-confirmation.css` | 1 | 5 |
| `subscribe.css` | 1 | 4 |
| `student-portal-guide.css` | 0 | 4 |
| `offline-pack-renderer.css` | 1 | 3 |
| `student-upgrade.css` | 1 | 3 |
| `student-offline-packs.css` | 1 | 1 |

### There is no component layer

The whole shared layer is **two files**: `lib/overlays/shared/
body-portal.tsx` and `lib/toast/toast.tsx`. No shared dialog, no shared
dropdown, no shared button. `auth.css` holds the `.qa-btn` family and
`.qa-field` / `.qa-input` / `.qa-label`, the only other genuinely shared
primitives. Everything else that looks like a component is a CSS class
scoped to one surface.

The consequence, measured on 2026-09-22:

- **15 files** portal an overlay to `<body>`.
- **10 declare `role="dialog"` and `aria-modal="true"`** — including
  `login-card.tsx` and `register-form.tsx`, which every user passes
  through.
- **Only 2 files in the app handle the Escape key, and neither is one of
  those 10.** They are `student/messages/messages-client.tsx` and
  `components/shell/mobile/mobile-drawer.tsx`.
- **Nothing anywhere traps focus.** Not one file.

So ten dialogs promise assistive technology that nothing else is
reachable, and then let a keyboard user tab out into the page behind.
The newest shared thing, the phone drawer, does handle Escape, the
backdrop and link taps properly; the gap is the older per-surface
dialogs.

### The native boxes still in place

Six `window.confirm` call sites carrying **nine** messages, four
`window.prompt`, one `window.alert` — the last five all in Admin →
Announcements.

| Where | Words | Seen by |
|---|---|---|
| Config → delete a key | `Delete config key "…"?` + a ⚠️ warning that the platform may break silently + "Only proceed if you are certain nothing depends on this key." | admin |
| Question Bank → delete | `Delete question <id>? This cannot be undone.` | admin |
| Quizzes / Mock Exams | `Archive this quiz?` · `Restore this quiz?` · `Archive this mock exam?` · `Restore this mock exam?` | admin |
| Quiz list → abandon | `Are you sure you want to abandon this attempt? Your progress will be lost.` | student |
| Runner → submit, flagged | `You still have N flagged questions. Click Cancel to go back and review them, or OK to continue.` | student |
| Runner → submit, blanks | `You have N unanswered questions. Submit anyway?` | student |

The prompts are `Link URL:`, `Link text:`, `Button URL:`, `Button
label:`. The alert says *"Quiz link insertion will be available once the
quiz engine is built"* — **which is now false**; the engine was built in
slices 5 and 6 and 03 Q1–Q6.

### Four name circles, four treatments

`.avatar-initials` 80px flat navy (profile) · `.sidebar-account-initials`
24px translucent white (sidebar) · `.msg-avatar` 28px teal-or-navy
(student messages) · `.feed-avatar` 26px teal-or-navy (admin messages).
In the two message surfaces the teal/navy choice **carries meaning** —
teal is the student, navy is Quademia.

### The shell

`.sidebar` is 240px on `--primary-dark` `#142d4c`, `border-right` in
`--primary`, nav links at 70% white, **the active row `--accent`**.
`.main-content` is `margin-left: 240px; padding: 32px`. `shell.css` is
255 lines, of which **17 declarations assume white ink on a dark
ground**.

**One `<aside>` serves every width.** `MobileDrawer` pins it open above
768px and slides it in off-canvas below, closing on the backdrop, a link
tap, Escape, and on every route change. Nothing stores whether it is
open.

**There is no top bar and no footer.** What exists is `PageHeader`,
which renders a `.top-nav` row *inside* the content column — the page
title and subtitle on the left, the signed-in name and a **Sign out**
button on the right — **on 23 pages**.

Three facts that make the shell cheap to change: **no page stylesheet
knows the sidebar exists** (searched all 33; the only `240px` hits are a
grid column and a button minimum); every overlay and side panel is
full-viewport; and **only two elements anchor near the top of the
window** — the toast at `top: 24px` (`z-index: 20000`) and the hamburger
at `top: 12px`.

**Two surfaces have no chrome at all** and need none: `app/(app)/runner/`
and `app/(app)/offline-pack/`. `app/(app)/layout.tsx` is a bare auth
check returning `{children}`, and neither route sits under an audience
layout.

### Icons are emoji inside the label strings

`lib/nav/student.ts` and `lib/nav/admin.ts` carry them in the label
text — `'🏠 Dashboard'`, `'📝 Fixed Quizzes'`, `'💬 Messages'`. Replacing
them changes the navigation **data**, not only CSS. The product has no
icon assets. Only Messages carries a badge; Announcements has none.

---

## 2. What the diagnosis found

**Nothing.** `post-rebuild-diagnosis.md` is a register of storage and
convention problems — tables, grants, RLS, payments, auth — and it never
read a stylesheet. This is the one surface whose findings come from
elsewhere: the inventory of 2026-09-19, the perf investigation of
2026-09-16 (the avatar served at full size, 1.38 MB for a 24px circle),
and the audit of 2026-09-22 recorded in §1.

Two queued `BUILD_LIST` lines belong here rather than to a feature:
**item 5** — the sidebar's badge, My Courses and name/photo load once in
the layout, go stale across sidebar clicks, and the dropdown's open
state carries between pages; and the native-box line, now DS4.

---

## 3. Rulings

**Sam, 2026-09-19.** The foundation is the shared token file extended
with status tokens, landing here as `styles/tokens.css`; the shell stays
per product; per-page buttons collapse as each page is touched. Sam
asked to **see** it rather than read colour names, which is why the
Claude Design system exists.

**Sam, 2026-09-20** (cloud session). The component question is **Radix
primitives under our own CSS, or the current structure** — Sam to look
and decide. **Tailwind is never part of either repo.**

**Sam, 2026-09-21.** The native `confirm`, `alert` and `prompt` boxes
go; the app's own overlay carries legacy's words (`AGENTS.md` UI
convention 2). A native box also cannot be answered from the desktop
app's browser pane, so any flow behind one is unwalkable by an
assistant.

**Sam, 2026-09-22 — five rulings:**

1. **B1: the sales-page look is out.** The Upgrade, Premium Prep,
   Subscribe and payment-confirmation treatment — `#0b7a75`, slate ink,
   18px radius, the large soft shadow — is retired; the app's own teal
   at 8px stands. Its tokens are deleted from the design system.
2. **The gradient sidebar is rejected.** MyNclex's name-circle gradient
   (`135deg`, `--accent` → `--primary`) was tried live on `.sidebar` and
   looked at: at 26px the two colours blend into one mark, at ~900px
   they read as two with a soft seam, the teal active row dissolves into
   the teal end, and menu labels at 70% white fall from 7.6:1 to 3.3:1.
   Reverted the same session.
3. **The shell is A3.** A 56px white top bar — hamburger far left, the
   *Quademia* / *MyNMCLicensure* wordmark, then envelope, bell and
   avatar — over the existing navy sidebar, which **opens and closes**:
   open by default on desktop, closed on phone, pushing content rather
   than covering it, and remembering the student's choice between pages.
4. **Upgrade / Extend moves into the avatar menu**, and the dashboard
   gains its own upgrade route. The second half is page content and
   sits outside this doc; if the shell ships first there is a window
   where renewing is harder than today, so they belong in one slice.
5. **The design system gets this doc.**

**Still unruled, and each blocks a slice below:** Radix or hand-built
(DS4); how a message distinguishes student from admin if the name circle
becomes one component (DS7); and the new wording for the one confirm
message that names OK and Cancel, which cannot survive a dialog with
real button labels (DS4).

---

## 4. The plan

Each slice ends with Sam testing it at `localhost:3000`. **No slice here
touches storage**, so none needs a `rebuild.md` §8 row — this is CSS,
components and one cookie.

### DS1 — The foundation: `styles/tokens.css`

The design system's token file becomes ours: **23 colour tokens** (the
brand five, four inks, two surfaces, one border, three status signals,
nine badge tints), **10 named type styles** in three groups, **10
spacing steps**, **5 radii**, **3 shadows** — each with the usage note
and the contrast figure it was drawn with.

`base.css` keeps the reset, `body`, `a` and the toast; the tokens leave
it for `tokens.css`, loaded from `app/layout.tsx` ahead of it.

**The trap, and the whole shape of the slice.** The 1,862 existing
`var(--…)` uses name the *old* tokens. Renaming breaks every one of
them. So `tokens.css` declares **both**: the new canonical names, and
the old names as aliases onto them (`--primary: var(--brand-navy)`).
Nothing changes visually on the day it lands; surfaces migrate to the
new names as each is touched, and the aliases are deleted when the last
one goes. Verify by taking a before-and-after look at four surfaces —
dashboard, a runner question, admin Users, login.

The nine badge tints and the named scales are what make DS3 and DS4
possible, so this is first.

### DS2 — The retired teal out (B1)

The four `.subp` stylesheets lose their private vocabulary — `--brand`,
`--ink`, `--muted`, `--line`, `--radius: 18px`, the heavy shadow and the
gradient ground — and join the app's tokens. The five that use the
colour only in `rgba()` focus rings and shadows follow. **52
occurrences, 9 files**, per the table in §1.

The `.qa-page` aliases in `auth.css` and `landing.css` collapse into the
global names in the same pass: identical values, so nothing moves.

**Proof:** `grep -riE '#0b7a75|rgba\( *11, *122, *117' styles/` returns
nothing, and the four sales pages are walked at both widths.

### DS3 — One button

30 of 33 stylesheets define `.btn`. One `.btn` family on DS1's tokens —
primary, accent, danger, ghost, small — replaces them **as each surface
is touched, not in a sweep** (Sam, 2026-09-19). The slice delivers the
shared rules plus the first three surfaces converted, and each later
page drops its copy when work brings us there.

### DS4 — One dialog, and the native boxes out

The nine confirm messages, the four prompts and the alert move to one
shared overlay carrying legacy's words. It needs a **body**, not just a
question — the Config warning is a title plus two paragraphs — and
**type-to-confirm** for delete, revoke and deactivate.

Three things resolved inside it: the **OK / Cancel** message is
rewritten, because our buttons carry real labels (Sam's wording needed);
the four prompts become **two** "Insert link" dialogs with a URL and a
text field each, rather than four sequential boxes; and the stale
*"once the quiz engine is built"* alert goes.

**Escape, a focus trap and focus return come with it** — on Radix's
Dialog or hand-written, which is Sam's open call. Either way the ten
surfaces claiming `aria-modal` migrate onto it as each is touched, and
the promise stops being empty. This also makes those flows walkable by
an assistant for the first time.

### DS5 — The shell becomes A3

**New:** a top-bar component (hamburger, wordmark, envelope with the
unread count, bell, avatar and its menu — name, My Profile, Upgrade /
Extend, Sign out) and the three icons it needs, inline until DS6.

**Changed:** `shell.css` — the sidebar loses its brand block and its
account block, `.main-content` gains a top offset, and the 17
dark-ground declarations stay as they are because A3 keeps the navy
sidebar. `MobileDrawer` stops closing on route change above 768px and
reads a **cookie** for open-or-closed, so the server renders the right
state and the page does not jump. `PageHeader` loses its right half on
**23 pages**. `base.css` moves the toast to `top: 72px` desktop and
`68px` phone — at `z-index: 20000` it paints *over* a 56px bar, not
under it.

**Unchanged:** the runner and the pack renderer, which sit outside both
audience layouts and take no chrome. The runner keeps its own sticky
header and full screen.

Ships with the dashboard's upgrade route (ruling 4). Walked at 1280 and
375, both audiences, sidebar open and closed.

### DS6 — The icon set

A 16px outline set, one weight and one grid. The nav's emoji leave the
label strings and `NavItem` gains an icon field — **data, not CSS**, so
every list and `Record` that switches on a nav key is checked. Waits on
DS5 so the three top-bar icons prove the treatment first.

### DS7 — One name circle

One component replacing the four treatments, sized by prop. Needs Sam's
answer on how a message shows student versus Quademia once the circle
stops carrying it in its colour.

### Later, under this doc

- **Dark mode.** The product has not one `prefers-color-scheme` rule and
  the token file has one theme. A fourth axis, after the above.
- **A content max-width** above 1440px, where A3's closed sidebar leaves
  the cards and tables wider than a comfortable reading measure.
- **The avatar served at full size** (1.38 MB for a 24px circle, perf
  investigation 2026-09-16) — resize and cache it. It becomes more
  visible under A3, where the avatar is on every page in the top bar.
- **The light-shell tokens** (`brand-teal-pale` as an active-row ground)
  are in the set and unused now A3 keeps the dark sidebar. Kept, not
  pruned: they cost nothing and A2's reasoning may return.

---

## 5. Ladder

| Slice | Date |
|---|---|
| DS1 The foundation — `tokens.css` | ⬜ |
| DS2 The retired teal out (B1) | ⬜ |
| DS3 One button | ⬜ |
| DS4 One dialog, the native boxes out | ⬜ |
| DS5 The shell becomes A3 | ⬜ |
| DS6 The icon set | ⬜ |
| DS7 One name circle | ⬜ |
| Dark mode · content max-width · the avatar's size | ⬜ later |
