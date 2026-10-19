# 09 — Design system

The tokens, shared pieces and shell every page is drawn with. Built
2026-09-22 to 09-26 (DS1–DS21); the redesign draws every page with
them. A page joins fully when it is next touched.

Detail and history: `archive/product-plan/10-design-system.md`.

## How it works

### Tokens

- **`styles/tokens.css`** holds every colour, type style, space, radius
  and shadow, each with its use and contrast noted: the brand five,
  four inks, two surfaces, a border, three status signals, badge tints,
  nine categorical (`kind-*`) and nine scale (`scale-*`) colours. Ten
  type styles, ten spaces (named by their pixel value — `--space-16`,
  not `--space-5`), five radii, three shadows.
- The old names alias the new ones; a page moves to the new names when
  touched; the aliases go when no page uses them. *(to build)*
- **The sales-page look is retired** (Sam, 2026-09-22): the app's teal
  at 8px everywhere.
- A new hardcoded colour in a stylesheet is refused at commit (the CSS
  guard); use a token, or add one.

### Shared pieces

- **Buttons** — one family in `styles/components.css`: primary, accent,
  danger, ghost, outline, lite, link; small, medium, large. A student's
  forward action is large (44px); admin pages may be denser.
- **Dialog** — the browser's own `<dialog>`: Escape, focus trap, focus
  return, the page made inert. `useConfirm()` for a confirm, a link
  dialog for links. An irreversible delete is type-to-confirm; archive,
  restore and abandon get a plain confirm. **Never the browser's native
  confirm, alert or prompt** (Sam, 2026-09-21).
- **Badges** — a **state** is a 6px `.badge` (success, danger, warning,
  neutral, info) (Sam, 2026-09-22); a **kind** is a 4px `.label-chip`
  (sky, indigo, plum, neutral); **difficulty** is a `.scale-chip`, navy
  filling by weight in three bars (Sam: navy). Retake and the modes stay
  grey. Kind and scale colours are set in `components/shell/chips.tsx`.
- **Card** — one `.card`; one product card for both selling pages.
- **Page title** — (Sam, 2026-10-17; 09.11), `PageHeader`: navy, 28px
  on a computer and 22px on a phone, over one 2px line across the page,
  teal at the start turning grey over a fixed 240px — the same for every
  title, short or on two lines (drawn as 4b; 3b, a teal line as wide as
  the words on a grey line, was built first and replaced the same day: a
  two-line title's teal ran across the row). A subtitle, count or
  sentence, always below the line. Course tabs above a title
  (the course page, a course in Practice Papers) carry no line, the
  current course navy: one teal line a page. Not on it yet: the
  dashboard's greeting, the portal guide's hero, Packages, the offline
  pack, the admin's Messages (buttons beside its title).
- **Row menu** — three dots at a row's end opening what that row allows
  now; what is closed is told in grey, a locked line adds Choose a
  package (`components/shell/row-menu.tsx`; 09.10, Sam, 2026-10-17).
- **Rich-text editor** — Tiptap, MyNclex's engine at MyNclex's version:
  one shared editor (Sam, 2026-10-19: "we can use it for future other
  things such as the questions"). Each place picks its toolbar; the words
  are stored as the editor's document and drawn by one renderer, on the
  server, keeping only what that place allows; colours are the app's own.
  First the notices (08.14), then the questions. *(to build: 09.13, with
  08.14)*
- **Name circle** — the photo, else initials on the teal-navy blend;
  the logo where Quademia speaks.
- **Icons** — a 16px Lucide outline set in `components/shell/icons.tsx`;
  the menu carries its icons as data. No decorative emoji; working
  glyphs stay (→ ← ✓ ▶ ▼ ✕), and so do the four score emoji (Sam,
  2026-09-22).
- **Type** — Inter at 400–700; 700 is the heaviest it has (a heavier
  weight renders as 700). The home page is set in the device's own font,
  where 800 is real.
- **Toasts** for messages, top right, about 5 s, with ✕.

### The shell

- **The signed-in app (A3, Sam, 2026-09-22)**: a full-width 56px white
  top bar — hamburger, wordmark, envelope with the unread count, bell,
  avatar (its menu: name, My Profile, Upgrade / Extend, Sign out). A
  navy 240px sidebar that opens and closes — open on a computer, closed
  on a phone, pushing the content; the choice kept in a cookie. ADMIN or
  STUDENT above Dashboard.
- **On a phone** (Sam, 2026-09-26): hamburger, wordmark, avatar only;
  the envelope and bell move behind the menu; a teal dot on the
  hamburger when anything is unread. The drawer comes from the left
  today and moves to the right, like the public menu (Sam, later). *(to
  build: DS21)*
- **The student's bottom bar on a phone** (Sam, 2026-10-04): four fixed
  tabs, a row of sub-tabs at the top of a group's pages that fits
  without scrolling, the drawer still the full menu — MyNclex's pattern,
  copied, not shared (00, The menu). Built 2026-10-04 (09.6). The first tab is Home, its row Dashboard · Courses (Sam, 2026-10-12).
- **The wordmark** (Sam, 2026-09-26): the painted Q, QUADEMIA in small
  teal capitals over MyNMCLicensure in bold navy, on both bars.
- **The public bar**: Home · Premium Prep · Packages · Dashboard, one
  action (Sign in); on a phone a menu from the right; a footer with the
  year computed.
- The sitting and the offline pack take no chrome.
- **Two menus only**: the app's drawer and the public menu — plus, for
  students on a phone, the bottom bar and the sub-tab row, which are
  shortcuts into the drawer's own pages.
- Every surface works on a phone, breakpoint 768px; student pages first.

### Still to join the system *(to build, as each page is touched)*

- DS9 — about eight pages still on their own button classes.
- DS17 — about 15 name chips still on `.badge` (both builders, Premium
  Prep, upgrade).
- DS20 — about 20 stylesheets drawing their own white box, onto `.card`.
- One form field (three copies of one field today).
- One link style — a link inside a sentence always underlined (phones
  have no hover) (Sam, later). Recommended 2026-10-12 and logged at
  Sam's word: a link in running text underlined always; a link that is
  plainly a control (a row, a card, a button, a tab) not underlined, its
  hover shown by its ground; the global `a:hover { text-decoration:
  underline }` in `styles/base.css` (from the port's slice 2a, 2026-09-11)
  goes, because it out-ranks any class that says "no underline" — 59
  rules across the stylesheets set `none`, and many are undone on hover
  by it; the Practice Papers rows set it off on hover themselves. A new
  shared style, so each page is walked when it changes; not built.
- A content width limit above 1440px.
- Dark mode — after the above.
- Shell data (the unread badge, My Courses, name and photo) loaded once
  and kept fresh across pages.

## Open

- **DS18** — the colours for a package's kind (paid / free / trial),
  which today borrow the state colours.
- **The sign-in pages' lockup** — whether login, register, forgot and
  reset take the shared wordmark (found 2026-09-26).
- **Tailwind** — finishing in CSS was recommended, and Tailwind put to
  Sam for the next fresh product (MyTeacher); not ruled (2026-09-22).
