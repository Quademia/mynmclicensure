# Mock Exams — How It Works Right Now

This document describes the current state of the Mock Exams feature as built. It covers what each setting does, how students interact with it, and known edge cases.

---

## Overview

Mock Exams are time-limited quiz sets published during exam periods (e.g. NMC licensure). They use a **separate table** (`mock_quizzes`) from fixed quizzes (`quizzes`), but share the same **attempts table**, **runners**, and **scoring system**.

Admin creates mock exams via `/admin/mock-exams.html`. Students access them via `/student/mock-exams.html` or preview cards on their course page.

---

## The `mock_quizzes` Table

Each row is one mock exam. Here's every column and what it means:

| Column | Type | What It Does |
|--------|------|-------------|
| `quiz_id` | TEXT (PK) | Unique ID, auto-generated as `MOCK_` + timestamp + random string |
| `course_id` | TEXT | Which course this mock belongs to (e.g. `GP`, `RN_MED`) |
| `title` | TEXT | Display name students see (e.g. "NMC Mock Exam Set 1") |
| `n` | INTEGER | Number of questions in the mock |
| `item_ids` | TEXT[] | Array of question IDs picked from the course's items table |
| `allowed_modes` | TEXT | Which modes students can use — see "Modes" section below |
| `shuffle` | BOOLEAN | If true, question order is randomised for each student |
| `time_limit_sec` | INTEGER | Time limit in seconds for timed mode. If blank, defaults to 1 minute per question |
| `status` | TEXT | Lifecycle state — see "Status" section below |
| `published` | BOOLEAN | Must be true for students to see it |
| `visibility` | TEXT | Who can see it — see "Visibility" section below |
| `publish_at` | TIMESTAMPTZ | When the mock becomes available to students (can be null) |
| `unpublish_at` | TIMESTAMPTZ | When the mock stops being available (can be null) |
| `notes` | TEXT | Admin-only internal notes, students never see this |
| `created_at` | TIMESTAMPTZ | When the row was created |
| `updated_at` | TIMESTAMPTZ | When the row was last modified |

---

## Settings Explained

### Status (`status`)

Controls the lifecycle of the mock exam.

| Value | Meaning |
|-------|---------|
| `draft` | Work in progress. **Hidden from students** regardless of other settings. |
| `active` | Ready for students. Whether they can actually see it depends on `published`, `publish_at`, and `unpublish_at`. |
| `archived` | Retired. **Hidden from students**. Admin can still see it in the admin list. |

### Published (`published`)

A simple on/off switch.

- `true` — the mock is eligible to be shown to students (still subject to status and date window)
- `false` — **hidden from students** even if status is active

### Publish Window (`publish_at` / `unpublish_at`)

Controls **when** the mock is available. Both are optional.

| publish_at | unpublish_at | What Happens |
|-----------|-------------|-------------|
| Not set | Not set | Available immediately and indefinitely (as long as status=active and published=true) |
| Set to future date | Not set | Shows as "Upcoming" until that date, then becomes "Active" with no end date |
| Set to past date | Not set | Active now, no end date |
| Set to past date | Set to future date | Active now, will auto-close on unpublish_at |
| Set to past date | Set to past date | Closed — the window has passed |
| Set to future date | Set to future date | Upcoming — will open on publish_at and close on unpublish_at |

### The Availability State Machine

The student-facing pages compute availability using this cascade:

```
1. status !== 'active'      → HIDDEN (not shown at all)
2. published !== true        → HIDDEN (not shown at all)
3. now < publish_at         → UPCOMING (shown but can't start)
4. now > unpublish_at       → CLOSED (shown but can't start new attempts)
5. all clear                → ACTIVE (can start/resume attempts)
```

**What students see for each state:**
- **HIDDEN** — mock does not appear anywhere
- **UPCOMING** — card appears with yellow badge, "Opens on [date]", Start buttons disabled
- **ACTIVE** — green badge, Start/Resume/Retake buttons enabled, "Closes in X days" countdown if unpublish_at is set
- **CLOSED** — grey badge, "Closed on [date]", Start buttons disabled, Review still available if they completed it

### Allowed Modes (`allowed_modes`)

Controls which quiz modes students can use.

| Value | Meaning |
|-------|---------|
| `BOTH` | Students can do Practice Mode (instant feedback) **and** Exam Mode (timed, deferred feedback) |
| `INSTANT_ONLY` | Only Practice Mode available |
| `TIMED_ONLY` | Only Exam Mode available |

Each mode shows as a separate section on the quiz card with its own Start/Resume/Retake buttons and attempt stats.

### Shuffle (`shuffle`)

- `true` — question order is randomised when a student starts a new attempt. Each student (and each attempt) gets a different order. The order is locked in once the attempt starts — resuming shows the same order.
- `false` — questions appear in the order they were picked by admin.

### Time Limit (`time_limit_sec`)

- Only applies to **timed/exam mode**.
- If set (e.g. `3600` = 60 minutes), the timer counts down from this value.
- If blank/null, defaults to `n * 60` seconds (1 minute per question).
- Practice/instant mode has no timer regardless of this setting.

### Visibility (`visibility`)

Controls which students can see the mock based on their subscription type.

| Value | Meaning |
|-------|---------|
| `ALL` | All enrolled students can see it |
| `PAID` | Only paid subscribers can see it |
| `TRIAL` | Only trial users can see it |

**Note:** Visibility filtering is not currently enforced on the student page — it's stored in the table but the student mock-exams page shows all published active mocks to enrolled students. This is a future enhancement.

---

## How Students Use Mock Exams

### Starting a Mock

1. Student goes to `/student/mock-exams.html` (or clicks a preview card on their course page)
2. Finds the mock exam, chooses Practice or Exam mode
3. Clicks "Start Practice" or "Start Exam"
4. System calls `spawnMockAttempt()` which:
   - Checks for existing in-progress attempt (same quiz + mode + student)
   - If found: returns it (student resumes)
   - If not found: creates a new row in the `attempts` table with `source: 'mock'`
5. Student is redirected to the runner (`/runner/instant.html` or `/runner/timed.html`)

### During the Quiz

- Answers auto-save periodically
- Student can flag questions, use the question grid, navigate with Prev/Next
- In timed mode: timer counts down, auto-submits when time runs out
- In practice mode: no timer, instant feedback after each question

### After Completing

- Score is calculated and saved to the attempt row (`score_pct`, `score_raw`, `score_total`)
- Student can review the attempt (see all questions with correct answers and rationale)
- Student can retake (creates a new attempt linked to the original via `origin_attempt_id`)

### Attempt States

Each attempt has a `status`:

| Status | Meaning |
|--------|---------|
| `in_progress` | Student has started but not finished |
| `completed` | Student submitted or time ran out |
| `abandoned` | Student chose to abandon the attempt |

---

## How Attempts Work

Mock exam attempts go to the **same `attempts` table** as fixed quizzes and quiz builder. They are distinguished by the `source` column:

| Source | Origin |
|--------|--------|
| `fixed` | Started from a fixed quiz |
| `builder` | Started from quiz builder |
| `mock` | Started from a mock exam |
| `retake` | Retake of any of the above (links back via `origin_attempt_id`) |

This means:
- Mock attempts appear in **Learning History** alongside all other attempts
- The same scoring, progress saving, and review system applies
- Runners don't know or care where the attempt came from

---

## Known Edge Cases / Current Behaviour

### 1. In-progress attempts when mock closes

If a student has an in-progress attempt and the mock's `unpublish_at` passes (or admin archives it):
- The mock shows as CLOSED on the listing page
- The in-progress attempt **still exists** in the attempts table
- But the student **cannot find it** to resume — the CLOSED state disables all Start/Resume buttons
- The attempt becomes orphaned (stays as `in_progress` forever)

**This is a known gap.** Possible fixes to consider:
- Auto-abandon orphaned attempts when the mock closes
- Still show a "Resume & Submit" button for in-progress attempts on closed mocks

### 2. Retakes of closed mocks

Once a mock is CLOSED, students **cannot retake** it. The Retake button is not shown for closed mocks. They can only **review** completed attempts.

### 3. Learning history doesn't distinguish mock vs fixed

All attempts show in learning history with the same display. The `source` column stores `'mock'` but the learning history page currently doesn't filter or label by source. A student's history shows all their attempts mixed together.

### 4. Visibility not enforced

The `visibility` column (`ALL`/`PAID`/`TRIAL`) is stored but not checked on the student page. All enrolled students see all published active mocks for their courses.

### 5. No notification when new mocks are published

Students are not notified when a new mock exam becomes available. They have to check the mock exams page or their course page manually. Could be combined with the announcements system in the future.

---

## Admin Workflow

### Creating a Mock Exam

1. Go to `/admin/mock-exams.html`
2. Click "+ New Mock Exam"
3. **Pane 1 (Details):** Select course, enter title, set modes, scheduling, time limit, shuffle, notes
4. **Pane 2 (Questions):** Pick questions from the course's item bank using filters (topic, subtopic, difficulty, question type)
5. **Pane 3 (Review):** Verify everything looks correct
6. Click "Save Mock Exam"

The mock starts as `status: draft`, `published: false`. Admin must set status to `active` and toggle published to `true` for students to see it.

### Managing Existing Mocks

- **Edit:** Click any mock in the list to edit its details, questions, or scheduling
- **Publish/Unpublish:** Toggle the published switch
- **Archive:** Change status to `archived` to retire a mock without deleting it
- **Schedule:** Set publish_at and unpublish_at for automatic open/close windows

### Admin Table View

The admin list shows:
- Title, Course, Questions count, Mode, Status, Published state
- **Schedule column:** Shows the publish window (e.g. "25 Mar — 10 Apr") or "Not scheduled"
- Filters: search, course, status, mode, published

---

## File Locations

| File | Purpose |
|------|---------|
| `admin/mock-exams.html` | Admin page — create/edit/manage mock exams |
| `student/mock-exams.html` | Student page — browse and launch mock exams |
| `student/course.html` | Course page — shows mock exam preview cards |
| `js/api.js` | API functions: getMockQuizzes, getAllMockQuizzes, getMockQuizById, spawnMockAttempt |
| `js/student-sidebar.js` | Student sidebar — Mock Exams nav link |
| `js/admin-sidebar.js` | Admin sidebar — Mock Exams nav link |
| `CLONING.md` | Schema definition for mock_quizzes table |
| `runner/instant.html` | Practice mode runner (shared, no changes needed) |
| `runner/timed.html` | Exam mode runner (shared, no changes needed) |
