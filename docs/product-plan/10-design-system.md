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
and decide. ~~**Tailwind is never part of either repo.**~~ Corrected by
Sam on 2026-09-22: what he meant during the port was *do not port the
wrong things in*; it was not a ruling against Tailwind for ever. The
question is reopened below as an open ruling.

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

**Sam, 2026-09-22, the second session — five more, after seeing DS5 on
both sides:**

6. **One wordmark on both bars, the audience in the sidebar.** The
   admin bar had read *Quademia | Admin Panel*; it reads *Quademia |
   MyNMCLicensure* like the student's, and which side you are on is a
   small uppercase label above Dashboard — *Admin Panel* (legacy's
   words) and *Student Panel*. Sam is not sure about the label and left
   it as built; settled as ruling 12 below.
7. **The wordmark's weight is on the product.** Order stays brand first
   (the lockup says whose product it is); Quademia is the small muted
   word, MyNMCLicensure the bold navy one.
8. **The full-width bar stays.** Sam asked to see the open sidebar run
   to the top with the bar starting at its edge and the wordmark in the
   navy. Built, looked at in both states, reverted the same hour: the
   hamburger jumped 240px on every toggle and the wordmark lived in two
   colours. A3 as Claude Design drew it stands.
9. **The sweep is CSS-only; a surface whose markup must change joins the
   system when it is next touched.** Narrows ruling 7 of the morning
   ("sweep everything in one pass") for DS9: the eight surfaces with
   standalone button classes wait, because DS4, DS10 and DS11 may still
   change what a button is, and converting sixty buttons twice is worse
   than eight pages reading off-system for a while. The two looks those
   surfaces use that the family lacked — the pale teal tint
   (`.btn-lite`) and the text-link button (`.btn-link`) — join
   `components.css` now, so a touched surface has somewhere to land.

**Sam, 2026-09-22, DS4 — five rulings, the assistant's recommendations
accepted:** the dialog is built on the **browser's own `<dialog>`
element**, not Radix and not a hand-written focus trap (the earlier
claim that this repo carried MyNclex's confirm primitive was wrong — it
carries only the body portal, and MyNclex writes each box by hand with
no Escape and no focus handling); the flagged-questions confirm reads
*"You still have N flagged questions"* with **Go back and review** /
**Submit anyway**, the blanks one *"You have N unanswered questions"*
with **Go back** / **Submit anyway**; **type-to-confirm on the two
deletes that cannot be undone** (config key, question), plain confirms
for archive, restore and abandon; the **Quiz Link tool is removed** with
its false alert and a real picker is queued under `05-announcements`
(A4); and the runner's **false leave-page warning is fixed in the same
slice** — Save & Resume Later and Submit & Exit left by a full load,
which tripped the tab-close guard, so a student who had just saved was
told their changes may not be saved (legacy did the same).

**Sam, 2026-09-22, the third session — three rulings, the assistant's
recommendations accepted, after the page emoji and the weights were
counted rather than recalled:**

10. **DS15: the decoration goes, the working glyphs stay.** The 225
    glyphs outside the two menus are not one thing. About **137 are
    decoration** — an emoji beside a word that already says it
    (`💾 Save`, `📌 Pinned`, `✅ Programme created successfully.`, the
    eight admin dashboard tiles) — and those go: to a drawn icon where
    the glyph is doing visual work, and to nothing where the sentence
    and the colour already carry it. About **88 are doing a job** —
    `→` inside a date range, `←` / `→` on pagination, `✓` as a
    multi-select tick, `▶` / `▼` as a disclosure triangle, `✕` as a
    close — and those stay untouched, because deleting them removes
    meaning rather than decoration.
11. **DS16: 700 wherever Inter is the font; the landing page keeps
    800.** See the DS16 section below for the measurement. The 40
    declarations on Inter surfaces are now 700; `landing.css`'s 12 are
    left at 800 because the landing page is the one surface not set in
    Inter, so its 800 is a real heavier face, not a fallback. Sam saw
    the hero at both weights and kept 800.
12. **The audience label loses the word "Panel".** Both sidebars keep
    the label (settling ruling 6); it reads *ADMIN* and *STUDENT*, not
    *ADMIN PANEL* / *STUDENT PANEL*. The shorter word says the same
    thing with less furniture.

**Not ruled, and deliberately so:** the landing page being the only
surface not set in Inter was put to Sam as a candidate slice and
declined — *"we are going to improve every page again"* (Sam,
2026-09-22), so it is carried by that pass rather than sliced here.

**Still unruled, and each blocks a slice below:** nothing in the ladder
above DS11. DS7, DS10, DS14, DS15 and DS16 are settled; DS11 and DS12
wait on Claude Design's palettes, which Sam is prompting for himself.

**Open ruling — Tailwind (raised 2026-09-22).** Sam asked what Tailwind
does and whether the app should use it, and set the frame for the
answer: he decides only from what the assistant offers, so an option
left out is a decision made for him. The position, in the three parts
he asked every such choice to carry:

- *What the world does.* For a new Next.js app today Tailwind is the
  most common choice; plain CSS as this app is written is the older,
  still respectable one. Neither is wrong.
- *What fits Quademia.* Code here is written only by assistants across
  many sessions, and Sam cannot read it to check, so the material that
  drifts least is the one that fits. Tailwind has a real edge there:
  the styling sits in the same file as the page, so an assistant
  editing a page sees all of it and there is no separate stylesheet to
  forget. The 173 hardcoded badge colours DS8 measured are exactly the
  drift plain CSS invites. With Tailwind the design system is not added
  on top: the tokens live in its config, the components are React with
  Tailwind's words inside, and the 33 stylesheets go away.
- *What it costs from here.* A rewrite of every page's styling — weeks
  of sessions with nothing new for students until it is done — not a
  plugin. MyNclex has Tailwind installed and, in the files read, unused;
  its chrome is plain CSS with named classes.

The assistant's recommendation: starting today, Tailwind with a
component layer; from where the app is, finish this design system in
CSS, which removes most of the drift for a fraction of the cost, and
put Tailwind to Sam as a ruling for the next product that starts fresh
(MyTeacher's rebuild), since the stack is shared. Sam has not ruled.

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

`auth.css` and `landing.css` were named here for the same pass, on the
grounds that their `.qa-page` and `.landing` blocks only rename the
global tokens. **Checked at build on 2026-09-22: they do not.** Both
carry values with no global equivalent (`--navy-deep`, `--teal-light`,
`--teal-mid`) and two that are near-misses rather than matches —
`--teal-dark` `#245f56` against `--brand-teal-hover` `#235f56`, and
`--teal-soft` `#e7f3f1` against `--brand-teal-pale` `#edf6f5` — plus
navy-tinted shadows of their own. Collapsing them is therefore not
value-neutral, and neither file carries the retired teal. **They move
to DS3**, where the button and badge work reaches them anyway.

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

**Escape, a focus trap and focus return come with it** — from the
browser's own `<dialog>` element opened with `showModal()` (Sam,
2026-09-22; §3), which traps focus, closes on Escape, makes the page
inert, paints in the top layer and hands focus back, with no package
and no focus code of ours. The ten surfaces claiming `aria-modal`
migrate onto it as each is touched (ruling 9), and the promise stops
being empty. This also makes those flows walkable by an assistant for
the first time.

*Built 2026-09-22:* `lib/overlays/shared/dialog.tsx` (the element;
Escape caught on keydown because Chrome fires the element's `cancel`
only with user activation), `confirm-dialog.tsx` (`useConfirm()` — a
promise, so a call site keeps its `if (!(await confirm(…))) return`
shape), `link-dialog.tsx`; the look in `components.css` as `.dlg*`, 420px
as drawn. Six surfaces converted; the runner's Leave-this-quiz panel
moved onto it too.

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

### DS8 — One badge (added 2026-09-22)

**This slice was missing from the ladder** and Sam found it by asking
whether badge corners were now round. Badges are the *larger* of the two
duplications: the status colours are hardcoded **173 times across 28 of
the 33 stylesheets**, against the buttons' 30.

**Sam's ruling, 2026-09-22: a status badge is 6px, not a pill.** The
design system said the opposite — its `--radius-pill` note named status
badges as a use — so the token's note is corrected here and in the
Claude Design artifact. **Label chips keep 4px**: a course code, a
programme tag or a payment source reports a *name*, not a state, and the
shape is what tells them apart.

One correction made while building it: DS2 did not make anything newly
round. Those seven places were already `999px` and DS2 only replaced the
number with the token. Of the seven, exactly one — `.upg .badge` — is a
status badge and takes 6px; the rest are a circular control, an identity
pill and marketing chips, none of them states.

**Two token families were missing and are added here**, flagged in
`tokens.css` as not from the Claude Design file and owed back to it: the
app uses **five** badge families and that file names three. `neutral`
(grey — draft, archived, FREE) and `info` (blue — pinned, scheduled).
Adding them also fixed a real defect: `.ann .pill-archived` set
`#9ca3af` on grey, which measures 2.3:1 and cannot be read.

The base covers the four class names the markup already uses — `.badge`,
`.chip`, `.pill`, `.status-chip` — so a surface converts with no change
to its TSX. Standardising on one name is a later tidy.

Converted with the slice: `.cat` and `.ann`. Their state→colour mapping
stays on the surface, because a domain word like PAID or TRIAL is that
page's vocabulary, not the design system's; only the shape and the
triples are shared.

### DS6 — The icon set

A 16px outline set, one weight and one grid. The nav's emoji leave the
label strings and `NavItem` gains an icon field — **data, not CSS**, so
every list and `Record` that switches on a nav key is checked. Waits on
DS5 so the three top-bar icons prove the treatment first.

### DS7 — One name circle

One component replacing the four treatments, sized by prop. Needs Sam's
answer on how a message shows student versus Quademia once the circle
stops carrying it in its colour.

### DS9 — The surfaces the shared button cannot reach (added 2026-09-22)

About eight surfaces do not use the `.btn` convention at all. Admin
Users and Messages, and the student quizzes, messages, learning
history, offline packs and both builders use **standalone** classes —
`.btn-action`, `.btn-send`, `.btn-start`, `.btn-resume`, `.btn-lite`,
`.btn-back`, `.btn-ghost-sm`, `.btn-new-msg` — rather than `.btn` plus
a variant. No CSS can fold those in: the markup has to change. Found
by the DS3 sweep, which is where the sweep stopped.

### DS10 — The button size scale (added 2026-09-22)

Eight distinct button sizes survive DS3, because that slice shared the
*skin* and left the size to each surface. A real scale is small /
medium / large, with the design system's own rule that a student action
is **44px** for touch while admin surfaces may be dense. Needs Sam, and
is better drawn than argued.

### DS11 / DS12 — built 2026-09-22

✅ Both, from Claude Design's `KindPalette` and `ScalePalette`, after Sam
confirmed the artifact was finished and ruled **navy over the stone
alternative** for the scale.

**19 tokens** into `styles/tokens.css` — nine `kind-*`, nine `scale-*`
and `--scale-bar-off` — at the artifact's exact values. Checked first:
of the 48 colour tokens in that file, **29 were already in the repo and
all 29 matched to the digit**, so the two are genuinely in step and this
was an addition rather than a reconciliation.

**Two class families** in `components.css`: `.label-chip` gained the
border it needed plus `-sky`, `-indigo`, `-plum`, `-neutral`; and
`.scale-chip` with `-1/-2/-3` and the `.scale-bars` glyph. **Twenty call
sites** through `components/shell/chips.tsx`, which holds the four maps
(question type, attempt source, difficulty step, mode icon) and the two
components, so a hue is decided in one file rather than at each site.

**Thirteen borrowed-signal rules deleted** — `.att .badge.mock`,
`.qm .badge.INSTANT_ONLY`, `.slh .badge.source-retake` and the rest.
Every `.badge.X` rule left in the app is a genuine state.

Two things that fell out in our favour: the mode chips want Lucide `zap`
and `timer`, which the artifact expected to be "the set's 20th and 21st"
— DS15 pass B had already added both that afternoon; and the artifact's
rule that *a state is a 6px badge, a kind is a 4px label chip* is
exactly the sort DS13 had just left ready, on a base with one name.

**Left alone, and flagged rather than decided:** product kind
(`PAID` / `FREE` / `TRIAL` in `admin-catalogue.css`, and `TRIAL` in
`admin-subscriptions.css`) is a *kind* by the same reasoning and still
borrows the state colours — a `PAID` product draws as ACTIVE green, a
`FREE` one as archived grey. The artifact's mapping does not cover it,
so extending the palette there is a ruling nobody has made. **⬜ Sam.**

### DS11 — A categorical palette (added 2026-09-22)

The token set has three signal colours and no vocabulary for a colour
that means a **kind** rather than a **state**: MCQ / TF / SATA, mock /
fixed / builder, BOTH / INSTANT_ONLY / TIMED_ONLY, instant / timed. The
DS8 sweep left every one of them on its own hue rather than forcing it
onto success / danger / warning, because a green `TF` would read as
"passed" and a red `TIMED_ONLY` as a failure. Owed back to the design
system.

### DS12 — A scale palette (added 2026-09-22)

`easy / moderate / hard` borrows the green-amber-red signal ramp to
mean a **gradient**. It reads well and it is the one place the signal
hues are used for something that is not a signal. The design system has
no gradient vocabulary; until it does, this stays as it is.

### DS13 — One badge class name (added 2026-09-22)

✅ **2026-09-22.** `.badge`, `.chip`, `.pill` and `.status-chip` were one
component under four names. DS8's shared rule covered all four precisely
so no markup had to change; this collapsed them to `.badge` — **153
renames across 61 places**, 50 markup sites and 73 surface selectors, and
nothing moved a pixel, because all four already drew the same thing.

`.badge` won the name because it already owned the five variants
(`badge-success`, `badge-danger`, `badge-warning`, `badge-neutral`,
`badge-info`); the alternatives would have meant renaming those too
(Sam, 2026-09-22).

Token-exact throughout. The compounds that merely *contain* the word —
`.context-chip`, `.topic-chip`, `.filter-chip-bar`, `.exam-chip-body`,
`.hero-pill-dot`, `.selected-pill .pill-clear`, `.course-badge` — belong
to other components and were left alone. Seventeen modifiers that
genuinely hang off this base took the `badge-` prefix.

**One collision, in `premium-prep.css`:** the surface defined both
`.prep .badge` (the *"NMC 2026 Premium Prep"* line) and `.prep .chip`
(the feature chips) with different looks, so renaming the second onto the
first would have destroyed one. The first is a marketing eyebrow, not a
badge at all, so it left the family as `.prep-eyebrow`.

**Two breaks the rename itself caused, caught by a checker rather than by
eye** — and this is the lesson worth keeping. A class assembled at
runtime is invisible to a rename:

- `` className={`pill pill-${ds}`} `` — the base was renamed, the prefix
  was not, so the announcement status badges pointed at `.pill-draft`
  while the CSS had become `.badge-draft`.
- `TYPE_CHIP` / `DIFF_CHIP`, two `Record<string, string>` maps holding
  `'chip-mcq'`, `'chip-easy'` and so on. The CSS was renamed; the map
  values are strings in a `.ts` file and matched no className pattern.

Neither would have thrown, and both would have shown only as a badge
quietly losing its colour on an admin page. The check that found them
is the one to repeat after any class rename: for every element carrying
the base class, confirm each of its *other* classes still resolves to a
rule, and separately list any modifier in the CSS that no markup uses —
the second list is where a runtime-assembled name hides.

**Not done here, and deliberately:** sorting the 50 into states and
names. DS8 also built `.label-chip` for a name rather than a state — and
it is used **zero times**, which is DS14's lesson one level up: *a class
is not a change until markup uses it*. About 29 of the 50 are names
rather than states (`mock`, `fixed`, `builder`, `instant`, `timed`, a
topic, a course code), and moving them would change their shape on 29
sites. That sort is the DS11 question — deciding a thing is a *kind* is
deciding it needs a categorical colour — so it waits for the palette
rather than being done twice.

### DS14 — The price weight (added 2026-09-22)

The design system's `price` style is weight **800**; `app/layout.tsx`
loads Inter at 400–700, so it falls back today. Either 800 joins that
list — more font bytes for students on paid data, against the doc's own
first principle — or the style drops to 700. Sam's call, and the
smallest open question here.

### DS15 — The page emoji (added 2026-09-22)

DS6 took the emoji out of the two menus. Counted rather than estimated
on 2026-09-22: **225 glyphs in 34 files** of page copy and buttons, of
which **137 are decoration** and **88 are working glyphs** (the split,
and Sam's ruling on it, is ruling 10 above). The earlier figure of
"about 160 in 35 files" was an estimate from a grep that did not
separate the two kinds.

Built in two passes, because they need different work:

- **Pass A — the deletions.** ✅ 2026-09-22: **52 glyphs off 50 lines in
  18 files**. Emoji inside a sentence, a toast, a chip or a badge, where
  the words and the colour already say it:
  `✅ Programme created successfully.` on an already-green toast,
  `⚠️ Expiring`, `🟢 Active`, `📝 12 questions`, `Almost done! 👏`.
  Subtractive; no new icons. Every class the glyph left behind was
  checked for a background and a colour first, so nothing lost its only
  signal — `.chip.expiring`, `.csv-report-row.ok` / `.err`,
  `.config-warning`, `.sata-hint`, `.preflight-warning`,
  `.timeup-banner`, `.pill-pinned`, `.pin-badge`, `.read-badge`, and
  the two `Expires in N days` strings, which are rendered inside a
  `.warning` class on both call sites.
- **The score emoji stay** (`lib/attempts/scoring.ts`: `🎉 Excellent!`,
  `👍 Good effort!`, `📖 Needs more practice`, `📚 Keep practising!`).
  Sam, 2026-09-22: that is a student reading their own result, and
  there the emoji is doing emotional work, not decoration.
- **Pass B — the icon swaps.** ✅ 2026-09-22: **65 glyphs in 25 files**,
  on **27 new shapes** in `components/shell/icons.tsx` (44 in the file
  now), from the same Lucide source and by the same method as DS6's 19.
  The eight admin dashboard tiles needed no new shapes at all —
  `users`, `card`, `banknote`, `package`, `book`, `megaphone`,
  `clipboard` and `settings` were already there, so the tiles now draw
  what the sidebar draws.

  The union is **`IconName`** now, not `NavIcon`: it is the app's set,
  not the navigation's. `NavIcon` survives as an alias so `NavItem.icon`
  still reads well, and the sidebar's file-private `Icon` helper became
  `RowIcon` so the name `Icon` means one thing.
  `<Icon name="…" size={16}>` is the component; `<NavIcon>` is it
  wearing the sidebar's class.

  **CSS was the quiet half.** The shared `.btn` was already
  `inline-flex` with a gap, so every button using it needed nothing.
  Twenty-one other rules did: a class holding a glyph was sized with
  `font-size`, which means nothing to an SVG, so each became a flex box
  with a colour — the empty states (`.qb`, `.sann`, `.slh`, `.sqz`), the
  section and card titles, `.tab-btn`, `.btn-action`, `.q-edit-btn`,
  `.act-btn`, `.tg-tag`, `.edit-btn`, `.btn-message-course`, the
  announcement editor's toolbar, and the runner's `.hbtn`,
  `.timer-icon`, `.q-flag-indicator` and `.error-icon`.

**Four things inside pass B that went past a straight swap**, recorded
because each was a judgement rather than the ruling:

1. **`▶` went where it sat beside a drawn icon.** It was in the keep
   list as a disclosure triangle, and stays one on *Show raw payload*.
   But on `▶ Start Quiz`, `▶ Start Practice` and `▶ Resume` it is a
   play icon doing the job `🎯` does beside it, and one button with a
   triangle next to one with a drawn icon reads as broken. Those three
   take a `play` shape; `↩ Retake` took `refresh` for the same reason.
2. **`✕` became an `x` icon in one place only** — the announcement
   engagement counters, where it is the third of three and the other
   two are icons. Everywhere else `✕` is still `✕`.
3. **"Review Answers" in practice mode gained an icon** it never had,
   matching its exam-mode twin; the same for `Edit ✏️` in the question
   bank, whose glyph moved from after the word to before it, like every
   other Edit button in the app.
4. **The question grid's flag is a 7px amber dot, not a flag.**
   `styles/runner.css` drew it with CSS `content: '🚩'` at 10px, which
   cannot hold a drawn icon and was barely legible. The dot has a white
   ring so it reads on every cell state.

**What stays, and why** — five glyphs, all deliberate: the four score
emoji above, and `app/page.tsx`'s `⏱ 22:14`, which sits **inside the
landing page's drawn illustration** — a picture of the app, not app
chrome.

### DS16 — The synthesised weights (added 2026-09-22)

**What was assumed, and what measurement showed.** The slice was opened
believing a weight the font does not carry is *synthesised* — the
browser smearing the 700 glyphs wider, muddier on a phone. Measured in
the running app instead, at 40px in the app's own Inter:

| 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|
| 405.6px | 408.5px | 411.4px | **414.2px** | **414.2px** | **414.2px** |

700, 800 and 900 render **identically**. Chrome synthesises a bold only
when no bold face exists at all; with Inter's 700 loaded it simply uses
it. So the 40 declarations on Inter surfaces were never a visual
defect, and changing them to 700 changes no pixel. They were changed
anyway, as hygiene (Sam, ruling 11): the stylesheets stop claiming a
weight the app does not load, and nothing jumps a step if a real 800 is
ever added.

**`landing.css` is the exception, and the reason is a separate
finding.** The landing page is the only surface in the app not set in
Inter — `styles/landing.css:19` puts it on the device's own font
(`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto`). Those
families **do** carry a heavy face, so its 800 is real: measured on the
same string, 700 = 395.8px against 800 = 416.3px. Sam saw the hero at
both and kept 800 — at 700 the headline also re-wraps from four lines
to two, which is a layout change, not only a weight one. The twelve
declarations in `landing.css` stay as they are.

### DS20 — One card (added 2026-09-23)

The number skips DS19: that id was used on the stylesheet guard's
commit (2026-09-22), which Sam ruled is not a slice of this doc.

**What was there.** The app had one shared card, `.card` — the white
box, border, `--radius`, `--shadow`, 24px — carried from legacy's
`style.css` and used by eight signed-in pages. It was never a design
system piece: it sat in `shell.css`, which loads only behind the
sign-in. So when `/premium-prep` and `/subscribe` were rebuilt as cards
(2026-09-22) neither could reach it, and each drew its own box and its
own product layout under `.prep-*` and `.subp-*` — line for line the
same apart from the heading level. The checkout would have been a third
copy. Beyond those, some twenty stylesheets draw a white box of their
own under another name, the position buttons and badges were in before
DS3 and DS8.

**What was built (Sam, 2026-09-23).**

- `.card` moved **unchanged** into `components.css`, so every page loads
  it, signed in or not.
- **The product card** — one package for sale: name, price and days,
  "Unlocks N courses" with the drawn ticks, Continue — as
  `components/catalogue/product-card.tsx` on `.card` + `.product-card-*`.
  A Server Component, like both pages; the heading level is a prop (h2
  under /premium-prep's title, h3 under /subscribe's band headings). The
  grid each page lays the cards in stays the page's own.
- `/premium-prep` and `/subscribe` render it; their ~100 lines of card
  rules are deleted.
- **One consequence of going global:** `/payment-confirmation` has its
  own `.pcf .card`, which never set a padding because the shared rule
  never loaded there. It now says `padding: 0`, so its tinted band still
  runs edge to edge. Found before the change, not after. **Superseded
  the same day:** the page was redesigned on the shared `.card` (Sam),
  and `.pcf .card` went with its old stylesheet.

**Proven unchanged by measurement, not by eye.** Every element of every
card — size, and the computed type, colour, spacing, border, shadow and
tick — fingerprinted before and after: both selling pages and the
confirmation box at 889px and 375px, and the dashboard, learning history
and upgrade at 1200px. All nine identical. For the three signed-in pages
the "before" was recreated by putting the old rule back in `shell.css`
for one measurement, since they were out of reach until Sam signed the
pane in.

**Not in this slice.** The twenty own-name boxes move onto `.card` as
each surface is touched (ruling 9's pattern). `/student/upgrade` keeps
its own list of what is for sale and its own `.upg .card`; that is
D23 item 3, a separate line.

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
| DS1 The foundation — `tokens.css` | ✅ 2026-09-22 |
| DS2 The retired teal out (B1) | ✅ 2026-09-22 |
| DS3 One button | ✅ 2026-09-22 — the family; surfaces as touched |
| DS4 One dialog, the native boxes out | ✅ 2026-09-22 |
| DS5 The shell becomes A3 | ✅ 2026-09-22 |
| DS6 The icon set | ✅ 2026-09-22 — sidebar; page emoji are DS15 |
| DS7 One name circle | ✅ 2026-09-22 |
| DS8 One badge | ✅ 2026-09-22 — 13 surfaces; the rest as touched |
| DS9 The surfaces the shared button cannot reach | ⏸ as each is touched (ruling 9) |
| DS10 The button size scale | ✅ 2026-09-22 — the scale; surfaces as touched |
| DS11 A categorical palette | ✅ 2026-09-22 — sky / indigo / plum; retake and modes stay grey |
| DS12 A scale palette | ✅ 2026-09-22 — navy filling by weight, three bars (Sam kept navy) |
| DS13 One badge class name | ✅ 2026-09-22 — 153 renames onto `.badge`; DS11 then sorted 20 of the kind sites |
| DS14 The price weight | ✅ 2026-09-22 |
| DS15 The page emoji | ✅ 2026-09-22 — 52 deleted, 65 to icons, 5 kept |
| DS16 The synthesised weights | ✅ 2026-09-22 — 40 to 700; landing's 12 kept at 800 |
| The audience label loses "Panel" | ✅ 2026-09-22 (ruling 12) |
| DS17 The ~15 name chips still on `.badge` | ⬜ most sit on DS9 surfaces |
| DS18 Product kind borrows the state colours | ⬜ Sam to rule |
| DS20 One card | ✅ 2026-09-23 — `.card` global, the product card shared by both selling pages; own-name boxes as touched |
| Dark mode · content max-width · the avatar's size | ⬜ later |
