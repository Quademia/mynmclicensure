# 07 — Offline packs

A student with a package builds a set of questions from one course to
study without a connection, and prints it or saves it as a PDF through
the browser. Packs are for packages only: not in the trial, and a free
account cannot use the pack maker (Sam, 2026-10-04).

Detail and history: `archive/product-plan/06-offline-packs.md` (the old
app's description) and the built code in `lib/offline-packs/` and
`app/(app)/offline-pack/`.

## The redesign *(ruled by Sam, 2026-10-15; to build: 07.2–07.7)*

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
  *(07.2)*
- **Offline, in the app** — the installable app (a PWA): installed once
  to the home screen, it opens the student's packs with no signal.
  *(07.3)*
  - **Only on devices where the account is signed in**, so within the
    two-device limit (01). When the phone next connects and finds the
    account signed out there — by the student, or bumped by a sign-in
    elsewhere — it clears the packs. **A check-in period**: a phone must
    connect at least every N days (Config, 30 to start, a hint by the
    field) or its packs lock — "Connect once to keep using your packs".
    Netflix's and Spotify's downloads work so.
  - No limit on packs per phone; a pack stays after the package ends.
- **A small offline player of its own** (Sam: B), built from the
  runner's pieces, not the runner — real sittings stay untouched. It
  asks once: **Answer as you go** (the answer at once) or **Answers at
  the end** (the score, then each answer). Right or wrong and the
  correct answer; practised again from fresh; marked by the same rule as
  the database, from one copy in the code. **Nothing goes back to the
  server** (Sam: no sync) — the phone keeps only a practice in progress
  and its score. When the sitting is redesigned, this player takes its
  look in the same pass. *(07.4)*
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
  label — explored in the PDF's drawings.
- To decide next: what My packs and the offline screen show, and what
  each tap opens; then the drawings.

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
  redesign *(to build: 07.1)*. A pack holds at most the Config limit of
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
