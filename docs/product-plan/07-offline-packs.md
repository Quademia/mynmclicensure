# 07 — Offline packs

A student with a package builds a set of questions from one course to
study without a connection, and prints it or saves it as a PDF through
the browser. Packs are for packages only: not in the trial, and a free
account cannot use the pack maker (Sam, 2026-10-04).

Detail and history: `archive/product-plan/06-offline-packs.md` (the old
app's description) and the built code in `lib/offline-packs/` and
`app/(app)/offline-pack/`.

## The redesign *(ruled by Sam, 2026-10-15; 07.1–07.4 and 07.6–07.8 built 2026-10-15; to build: 07.5)*

Designed fresh, not from the old pack (a print-to-PDF page). A pack is a
set of questions kept **on the student's phone, usable with no
connection**, and a printable PDF of the same pack.

- **Making a pack** uses one of the course's allowance (the package's,
  03 F4); the phone it was made on keeps it at once. **Save to this
  phone** on another device, and **Download PDF**, are free and repeat
  as often as wanted. *(07.3, 07.5)*
- **The builder is the Quiz Builder** (04) with a pack's extras: step 4
  is Count & name (no mode); the count from 5 to the admin's pack limit
  (Config); the status line shows the allowance ("3 of 5 packs left in
  Midwifery"); questions not in the student's earlier packs come first.
  *(07.2, built 2026-10-15: one builder in components/builder, the pack
  door in lib/offline-packs/door; a trial or free student gets the locked
  card; a made pack opens on its own page, kept on that phone (07.3))*
- **Offline, in the app** — the installable app (a PWA): installed once
  to the home screen, it opens the student's packs with no signal.
  *(07.3, built 2026-10-15)*
  - **How** (Sam, 2026-10-15): our own small service worker
    (`public/sw.js`, Next's own guide), not a library — it keeps only the
    offline screen (`/offline`, about 750 KB before compression, once a
    release, on phones holding packs), never every page's code. The packs
    sit in the phone's own database (IndexedDB). Any page that cannot be
    reached lands on `/offline`; a page that answers, even with an error,
    shows as it is. On a production build only.
  - **The icon opens the Dashboard** (Sam; `/router`); with no signal,
    the packs. **One quiet line on My packs** (Sam): "Keep the app on your
    home screen to open your packs with no signal. How?" — How? shows that
    phone's normal Add to Home screen steps (Android in Chrome, iPhone in
    Safari); nothing on a computer or once installed. No Install button
    (Sam, 2026-10-15): on Android it builds a small app through Google,
    which his phone blocked as unsafe; the home-screen shortcut opens
    offline just the same. Chrome's own install pop-up is held back.
  - **Only on devices where the account is signed in**, so within the
    two-device limit (01). When the phone next connects and finds the
    account signed out there — by the student, or bumped by a sign-in
    elsewhere — it clears the packs. **A check-in period**: a phone must
    connect at least every N days (Config, 30 to start, a hint by the
    field) or its packs lock — "Connect once to keep using your packs".
    Netflix's and Spotify's downloads work so. *Built:* every signed-in
    student page is the check-in (no request of its own); another
    account's packs leave when a different student checks in; a sign-in
    that only ran out its week (7 days, 01) keeps them — else every
    student would download their packs again weekly.
  - No limit on packs per phone; a pack stays after the package ends.
- **A small offline player of its own** (Sam: B), built from the
  runner's pieces, not the runner — real sittings stay untouched. It
  asks once: **Answer as you go** (the answer at once) or **Answers at
  the end** (the score, then each answer). Right or wrong and the
  correct answer; practised again from fresh; marked by the same rule as
  the database, from one copy in the code. **Nothing goes back to the
  server** (Sam: no sync) — the phone keeps only a practice in progress
  and its score. When the sitting is redesigned, this player takes its
  look in the same pass. *(07.4, built online 2026-10-15: components/
  offline-player at /pack-practice/[pack_id]; the ways offered as Practise
  again's are, each with Start; Leave part-way asks first; offline with
  07.3, the same player on `/offline`, the last score kept on the phone.
  Not built: a practice in progress kept to continue — not drawn)*
- **No explanations in a pack** (Sam, as the old app): the question,
  its options and the answer — never the rationale or the per-option
  feedback, on the phone, in the PDF or in the pack's stored rows.
  Explanations stay in the app's online sittings. *(07.6)* Parked: "See
  the explanation" on an offline question, fetched once back online.
- **The PDF**: the questions and options, the answer letters on the last
  page (or after each question, the student's choice; the last page by
  default), the watermark — its layout redesigned and drawn, not the old
  one's. *(07.5)*
- **Delete**: a student may delete a pack; the allowance is not given
  back (a deleted pack still counts). *(07.7)*
- **Locked for a trial or a free account**: "Offline packs come with a
  package", with Choose a package; packs made earlier under a package
  still open.
- **The watermark stays** — the owner's name, a masked email and their
  label. **The PDF's marks** (Sam, 2026-10-15): on every question and
  answer page a faint small pattern from top to bottom, like a page
  background — "QUADEMIA · MyNMCLicensure", the student's name, the date
  made and a short pack code, repeated on slanted rows — and the footer
  line with the same code; the student's account in the file's details.
  A pack's own set of questions already traces a leak to it. The cover
  stays clean (no pattern; it holds no questions). The file's **"no
  copying" setting** is set (Sam: stops the easy copy-paste; some apps
  ignore it, and a phone reads text from a photo anyway). Not done: a
  password or "no printing" (bypassed in seconds; printing is the
  point), pages as pictures (heavy on data). Parked: letters drawn as
  shapes so no app can copy them, if copying becomes a real problem; a
  record of each download, if leaks start. When built: print one page
  on an ordinary printer to set the pattern's strength.
- **My packs, one page that knows if it is online** (Sam, 2026-10-15,
  07.8; its offline half built with 07.3): online, every pack, each
  marked *On this phone* or not; offline, only the packs on this phone, with "You're offline. Your
  packs on this phone are ready." Any page opened offline lands here —
  one tap from the icon.
  - **By course**, each heading with its allowance and Build a pack
    ("Midwifery · 3 of 5 packs left · Build a pack"); newest first
    within; offline, no allowance and no Build.
  - **A row**: the name, its questions and date, *On this phone*, and on
    this phone only the last practice score ("Last: 14 of 20"). No ids,
    filters or summary counts.
  - **A tap opens the pack's own page**: Practise (Answer as you go /
    Answers at the end), Save to this phone or On this phone · Remove
    from this phone, Download PDF, Delete pack (the app's confirm: "You
    won't get this pack back in your allowance"). Two taps from the list
    into a practice.
  - **Check-in run out**: the packs listed but not opening — "Connect
    once to keep using your packs." A pack deleted elsewhere leaves this
    phone when it next connects (built: when My packs next opens there).
  - **The offline bar always says "You're offline"** (built 2026-10-15),
    with Try again when the phone counts itself connected: the screen
    shows only when a page could not be reached, and a phone whose data
    has run out still counts itself connected.
  - **Empty**: "Make a pack to practise offline", Build a pack per
    course. **Locked** (trial, free): "Offline packs come with a
    package", Choose a package; earlier packs still show and open.
  - **The menu**: one row, My packs (Build a pack is on the page, under
    each course); the phone bar's Offline tab opens it.
- Drawn at phone size at https://claude.ai/artifact/NrEnZUieGVsFmZkZEmjbFm
  (2026-10-15): My packs online A (sections) and B (course cards),
  offline, empty, locked; a pack's page; Practise's choice; the offline
  player both ways; the PDF's cover, a questions page, the answers page.
  **Picked (Sam, 2026-10-15): layout A**, each course heading carrying
  B's five-step bar of packs made ("2 made · 3 left"). **The PDF: two
  columns, about ten questions a page** (the old one printed four), a
  question never split across a column or page.

## How it works today

- **Building**: the student picks a course, then topics, subtopics,
  difficulty and type — or a concept keyword — and a count; a name and
  label are suggested; Build. The keyword search runs on the server
  ("Searching…"; Build waits for the result).
- **The server decides everything**: the allowance, the pick, and that
  every question belongs to the course (Sam, 2026-09-14) — a tampered
  request cannot make a pack.
- **What a pack draws**: published questions of the Practice and Free
  pools only (06.8) — never a paper's or a mock's.
- **No repeats until the pool runs out**: questions not in the student's
  earlier packs for the course (this subscription) come first, at
  random; repeats only fill a shortfall.
- **The allowance comes from the package** (03 F4): packs per course,
  copied onto the subscription and counted inside the database since
  the grant began (empty means unlimited, 0 means none); the trial's is
  0. Built in the database (F4a, 2026-10-04). The pack page still shows
  its count from the old Config setting, which agrees today (5); it
  reads the package instead, and the setting retires, with the page's
  redesign *(built 2026-10-15: pack_allowance(), the package's count)*. A pack holds at most the Config limit of
  questions.
- **A pack is a snapshot**: its questions are copied when it is made, so
  later bank edits never change it. A pack made earlier still opens
  after a trial or package ends.
- **A watermark** is stamped when it is made: the owner's name, a masked
  email and the owner's label.
- **The pack itself**: a cover ("Prepared for"), an overview, the
  questions with options and topic, a watermark strip with the pack id
  every tenth question, the answer key at the end, "For personal study
  use only. Do not share." No sidebar, so printing gives the pack
  alone.
- **My packs**: newest first, 24 at a time with Load more; search,
  course, status and sort; four summary counts; Open for an active
  pack; Build Similar opens the builder on that course.

## Open

- Settled 2026-10-15: the builder's minimum of 5 applies to packs (Sam).
