# QAcademy Nurses Hub — Overview

## What It Is

QAcademy Nurses Hub is a web-based learning platform for nursing students in Ghana. Its purpose is to help students prepare for the NMC (Nursing and Midwifery Council) licensure exams — the national exams every nursing graduate must pass before they can practice professionally in Ghana.

The platform gives students access to structured question banks, practice quizzes, timed exam simulations, and study tools built specifically around the NMC exam format and syllabus.

## The Two Products

QAcademy contains two separate products under one roof:

**MyNMC Licensure** — the main exam prep product. Students subscribe, get access to course-specific question banks, take practice quizzes and timed mock exams, track their progress, and study offline. An admin manages all the content, users, and subscriptions.

**MyTeacher (Teacher Assess)** — a class-based assessment tool. Teachers create their own classes, build quizzes from their personal question bank or the QAcademy shared library, assign quizzes to students, and review results with marksheets and item analysis. Students join a teacher's class using a code and take assigned quizzes.

Both products share the same login, the same student accounts, and the same platform infrastructure. A student using MyNMC Licensure can also join a teacher's class in MyTeacher without creating a separate account.

## The Five Programmes

QAcademy serves all five NMC nursing programmes in Ghana:

- **RN** — Registered Nurse (General Nursing)
- **RM** — Registered Midwife
- **RPHN** — Registered Public Health Nurse
- **RMHN** — Registered Mental Health Nurse
- **NACNAP** — Nursing Assistant Clinical / Nursing Assistant Preventive

Each programme has its own set of courses, question banks, and products. When a student registers, they select their programme, and the platform tailors their experience accordingly.

NMC licensure is a legal requirement in Ghana. A nursing graduate cannot work in any healthcare facility without passing the NMC exam. The exam covers multiple subjects specific to each programme. QAcademy exists to give students the best possible preparation for that exam.

## How a Student Moves Through the Platform

A typical student journey looks like this:

1. **Hears about QAcademy** — usually through word of mouth, a teacher, or social media
2. **Visits the subscribe page** — sees the available products and prices
3. **Pays via Paystack** — mobile money or card payment
4. **Creates an account** — fills in name, password, and programme on the payment confirmation page
5. **Lands on the dashboard** — sees their courses, announcements, and quick links
6. **Opens a course** — browses available quizzes and study material
7. **Takes a quiz** — either a fixed quiz set by admin or a custom quiz they build themselves
8. **Reviews results** — sees their score, correct answers, and explanations
9. **Tracks progress** — checks learning history, retakes weak areas, builds offline packs for studying without internet

Students who register without paying get a free trial subscription that gives limited access, enough to explore the platform before committing to a paid plan.

## How an Admin Manages the Platform

Day-to-day admin work includes:

- **Managing users** — viewing student accounts, activating or deactivating users, assigning subscriptions
- **Managing subscriptions** — granting manual subscriptions (for cash payments), syncing expired ones, troubleshooting stuck payments
- **Managing content** — adding questions to the question bank, creating fixed quizzes, publishing mock exams
- **Managing products** — setting up subscription products with prices, durations, and course access lists
- **Sending announcements** — posting notices targeted to specific groups of students
- **Handling support messages** — replying to student questions, reviewing flagged quiz items
- **Reviewing payments** — checking payment statuses, retrying stuck activations, copying setup links for students who need help

## Documentation Sections

- [01 — Payments](01-payments.md) — how students pay and how the payment system works
- [02 — Subscriptions](02-subscriptions.md) — how access is granted, extended, and managed
- [03 — Quiz System](03-quiz-system.md) — how quizzes, runners, and attempts work
- [04 — Access Control](04-access-control.md) — who can see what, how security works, and device session limits
- [05 — Announcements](05-announcements.md) — how admin sends targeted notices to students
- [06 — Offline Packs](06-offline-packs.md) — how students study without internet
- [07 — Messaging](07-messaging.md) — how the built-in support chat works
- [08 — Teacher Assess](08-teacher-assess.md) — how the MyTeacher product works
- [09 — Teacher Academic Structure](09-teacher-academic-structure.md) — programmes, cohorts, courses, and how quizzes are reused across classes

---

## Diagnosis findings with no surface of their own

Grouped here on 2026-09-21 (Sam's ruling: fold them into the overview
rather than open a doc for them). The register is
`post-rebuild-diagnosis.md`; the queue is `BUILD_LIST.md`. **The text
above this line still describes the legacy product.**

### Reference data — config, schools, levels, telegram keys

The tables nobody owns: they belong to no feature, so no feature doc
would ever claim them.

| Finding | What it says | Status |
|---|---|---|
| D49 | The config table accepts anything, and the readers trust it in two different ways | ⬜ ruled (Sam, 2026-09-18) — S13, the registry; queued |
| D50 | `schools` is a regulator's list with no way to change it, in a vocabulary the product does not speak | ⬜ **unruled** — the 2026-09-18/19 session left it "queue or park" |
| D51 | `levels` has never been read, and level and cohort are free text in three places | ⬜ ruled (Sam, 2026-09-18) — S13; levels kept, cohort becomes a year |
| D3 | `telegram_group_keys` is free text and already holds junk — no list, no validation, no table behind it | ⬜ **unruled**; related to the Telegram gate (BUILD_LIST 17) |

**§8 row:** S13 (config, levels and cohort — the reference shape) ✅
ticked by Sam 2026-09-18, not yet built.

### The one finding that belongs to every surface

| Finding | What it says | How it is resolved |
|---|---|---|
| D43 | Every table grants the browser roles everything — SELECT, INSERT, UPDATE, DELETE, TRUNCATE — and RLS is the only gate. Schema-wide: the vanilla era needed it, because the browser *was* the application | **surface by surface**, not as one sweep (Sam, 2026-09-21): every table will be touched eventually, and the slice that touches a table takes its grants back to the one thing that table needs. The rule is in AGENTS.md |

It cannot live in a feature doc because it belongs to all of them, and
that is exactly how it went quiet: it was found on 2026-09-18, recorded
as "last of the migrations", and never reached `BUILD_LIST.md`.

**Where it stands (dev, 2026-09-21):** of 27 tables, 6 are clean —
`question_bank` (08 B2), `attempt_items` and `offline_pack_items` (03
Q4), `attempts` (03 Q5), `course_access` (02 C2), and `migrations`. The
other 21 still hand the browser roles TRUNCATE. The pattern to watch:
the clean ones are almost all tables a slice **created**; where a slice
touched a table that already existed it fixed the reads and left the
writes — 02 C1 left `subscriptions` and `product_courses` open, 03 Q1
left `quizzes` and `mock_quizzes` open, S10 left `users` with TRUNCATE.
That is what the rule is for.
