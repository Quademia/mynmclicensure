# 07 — Offline packs

A student with a package builds a set of questions from one course to
study without a connection, and prints it or saves it as a PDF through
the browser. Packs are for packages only: not free, not in the trial.

Detail and history: `archive/product-plan/06-offline-packs.md` (the old
app's description) and the built code in `lib/offline-packs/` and
`app/(app)/offline-pack/`.

## How it works

- **Building**: the student picks a course, then topics, subtopics,
  difficulty and type — or a concept keyword — and a count; a name and
  label are suggested; Build. The keyword search runs on the server
  ("Searching…"; Build waits for the result).
- **The server decides everything**: the allowance, the pick, and that
  every question belongs to the course (Sam, 2026-09-14) — a tampered
  request cannot make a pack.
- **What a pack draws**: published questions only; questions held back
  by a mock are not offered (06).
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

- **Can a free account make a pack?** The decisions disagree: 03 F1
  lists the pack maker among the places that let an all-free set
  through, while packs are for packages only (2026-09-20, 2026-10-02).
- Whether the builder's minimum of 5 questions applies to packs too
  (04).
