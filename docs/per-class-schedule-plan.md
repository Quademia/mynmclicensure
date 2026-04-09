# Per-Class Schedule & Release for MyTeacher Quizzes

## Context

The recent restructure (programme → courses → classes) was designed around **trackable classes** and **reusable quizzes** — build a quiz once, run it with many classes over many terms, and keep all results tied to the same quiz for analytics.

The current schema does not support this. `open_at`, `close_at`, and `results_released` all live on `teacher_quizzes`, which means the schedule and release state are properties of the **quiz**, not the **assignment**. Consequence: if a teacher closes a quiz (or it passes its `close_at`) and later assigns it to a new class C, class C students see a phantom card they can never open — `startQuizAttempt` rejects with `CLOSED` because `quiz.close_at < now`.

Cloning the quiz is not a fix: `cloneTeacherQuiz` creates a separate `teacher_quiz_id` with separate attempts, fragmenting analytics. It also copies the source's class links into the clone, which is wrong for the reuse pattern.

### Goal
Treat `teacher_quizzes` as a **reusable template**. Treat each row in `teacher_quiz_classes` as an **assignment** that carries its own schedule and release state. Same quiz, many classes, each with its own window and gate.

### Confirmed design decisions
1. **open_at / close_at**: fallback pattern. `effective = link.* ?? quiz.* ?? null` (null = always/never). Quiz-level fields stay as optional template defaults.
2. **results_released / results_released_at**: **link-only**. No fallback. No existing data to migrate — fresh start. Quiz-level fields become unused for gating (left in the schema for now, removed in a follow-up).
3. **results_release_policy**: stays on the quiz. The *rule* is a property of the assessment; the *state* is per-cohort.
4. **`cloneTeacherQuiz`**: stop copying class links. Clone = "new quiz, no assignments".

---

## Implementation

### 1. Schema migration — `db/schema.sql`

Add to `teacher_quiz_classes` (after line 583, before the `CREATE INDEX` block):

```sql
ALTER TABLE teacher_quiz_classes
  ADD COLUMN open_at             TIMESTAMPTZ,
  ADD COLUMN close_at             TIMESTAMPTZ,
  ADD COLUMN results_released    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN results_released_at TIMESTAMPTZ;
```

Update the inline schema comment (`db/schema.sql:574`) to document the new columns:
- `open_at`, `close_at`: per-class override of quiz-level window (null = inherit template)
- `results_released`, `results_released_at`: per-class manual release state (not inherited)

Also update the comment block near `teacher_quizzes.open_at`/`close_at` (~lines 517-518) to note they now serve as template defaults, and note that `results_released`/`results_released_at` on `teacher_quizzes` are unused for gating (kept for one release, removed later).

### 2. Effective window helper — `js/myteacher-api.js`

Add a small shared helper near the top of the quiz runner section (around line 1670):

```js
// Resolve the effective open/close window for a student taking a quiz
// via a specific class link. Link values override quiz template defaults.
function _effectiveQuizWindow(quiz, link) {
  return {
    open_at : (link && link.open_at)  ?? quiz.open_at  ?? null,
    close_at: (link && link.close_at) ?? quiz.close_at ?? null
  };
}
```

### 3. `setQuizClasses` — accept per-class schedule — `js/myteacher-api.js:1318`

Current signature: `setQuizClasses(quizId, teacherId, classIds)`.
New signature: `setQuizClasses(quizId, teacherId, classAssignments)`.

`classAssignments` is an **array of objects**:
```js
[
  { class_id: 'CLS_...', open_at: '2026-04-15T08:00:00Z', close_at: '2026-04-22T17:00:00Z' },
  { class_id: 'CLS_...' }  // null schedule → inherits quiz template
]
```

Accept a plain array of strings as a fallback for backward compat (treat each as `{ class_id, open_at: null, close_at: null }`).

Behavior changes:
- `toInsert` rows include `open_at`, `close_at`, `results_released: false`, `results_released_at: null`.
- For reactivation (`toActivate`): also update `open_at`/`close_at` from the payload (teacher may be editing the window on re-activation).
- For already-active links in the desired set: if the payload carries a schedule, apply it via a new `toUpdate` bucket. This lets the Save Links button edit schedules on existing links without unlinking/relinking.

### 4. `getQuizClasses` — return schedule fields — `js/myteacher-api.js:1050`

Extend the select to include the new columns so the Classes tab can pre-fill pickers:

```js
.select(`
  tqc_id, teacher_quiz_id, class_id, status,
  open_at, close_at, results_released, results_released_at,
  teacher_classes ( class_id, title, status )
`)
```

### 5. `startQuizAttempt` — use effective window — `js/myteacher-api.js:1790`

Two changes:

**a.** Fetch the link row with its schedule (line 1797-1803). Extend the select:
```js
.select('tqc_id, open_at, close_at')
```

**b.** Replace the window check (lines 1813-1820):
```js
// 4. Check effective open/close window (link overrides quiz)
const { open_at, close_at } = _effectiveQuizWindow(quiz, link);
const now = new Date();
if (open_at && new Date(open_at) > now) {
  return { success: false, code: 'NOT_OPEN', message: 'This quiz is not open yet.', open_at };
}
if (close_at && new Date(close_at) < now) {
  return { success: false, code: 'CLOSED', message: 'This quiz has closed.' };
}
```

### 6. `getQuizzesForClass` — use effective window + badge — `js/myteacher-api.js:1685`

**a.** Fetch link rows with schedule fields in step 1:
```js
.select('teacher_quiz_id, open_at, close_at, results_released, results_released_at')
```

**b.** Build a `linkMap` keyed by `teacher_quiz_id`.

**c.** In the final `.map`, attach the effective window and a derived `state` flag on each quiz:
```js
return quizzes.map(q => {
  const link = linkMap.get(q.teacher_quiz_id);
  const { open_at, close_at } = _effectiveQuizWindow(q, link);
  const now = new Date();
  let state = 'AVAILABLE';
  if (open_at  && new Date(open_at)  > now) state = 'NOT_OPEN';
  if (close_at && new Date(close_at) < now) state = 'CLOSED';
  return {
    ...q,
    effective_open_at : open_at,
    effective_close_at: close_at,
    link_results_released   : link?.results_released ?? false,
    link_results_released_at: link?.results_released_at ?? null,
    state,
    item_count: countMap[q.teacher_quiz_id] || 0,
    attempts: attemptMap[q.teacher_quiz_id] || []
  };
});
```

The student-facing `my-classes.html` Quizzes tab uses `state` to render a "Closed" / "Not Open" badge and to disable the Start button when not `AVAILABLE`. **Do not** hide closed cards from students who have attempts — they still need to reach results.

### 7. `getAttemptResults` — use link-level gate — `js/myteacher-api.js:2330`

Fetch the link row for this attempt (new query near line 2360, using `attempt.teacher_quiz_id` and `attempt.class_id`). Update the gate calculation (lines 2378-2405):

```js
// Fetch link for effective window + release state
const { data: link } = await db
  .from('teacher_quiz_classes')
  .select('open_at, close_at, results_released, results_released_at')
  .eq('teacher_quiz_id', attempt.teacher_quiz_id)
  .eq('class_id', attempt.class_id)
  .maybeSingle();

const { open_at, close_at } = _effectiveQuizWindow(quiz, link);
const now = new Date();
const policy = quiz.results_release_policy || 'MANUAL';
let gateMet = false;
let gateReason = '';
let availableAt = null;

if (policy === 'IMMEDIATE') {
  gateMet = true;
} else if (policy === 'AFTER_CLOSE') {
  if (!close_at) {
    gateReason = 'MISSING_CLOSE_AT';
  } else if (new Date(close_at) > now) {
    gateReason = 'QUIZ_NOT_CLOSED';
    availableAt = close_at;
  } else {
    gateMet = true;
    availableAt = close_at;
  }
} else {
  // MANUAL — link-only state
  if (link?.results_released) {
    gateMet = true;
    availableAt = link.results_released_at;
  } else {
    gateReason = 'RESULTS_NOT_RELEASED';
  }
}
```

Also update `quiz_meta.close_at` in the return (line 2502) to emit the effective value, so the student UI shows the right date.

### 8. `getAttemptReview` — use link-level gate — `js/myteacher-api.js:2545`

Same change as §7: fetch the link, compute effective `close_at`, use `link.results_released` for MANUAL policy. Replace lines 2566-2572.

### 9. `releaseQuizResults` — release per class — `js/myteacher-api.js:1521`

Change semantics: release is now per link. Bulk release by default (all active links), or one specific class when `classId` given.

```js
async function releaseQuizResults(quizId, classId = null) {
  const now = new Date().toISOString();
  let q = db
    .from('teacher_quiz_classes')
    .update({ results_released: true, results_released_at: now, updated_at: now })
    .eq('teacher_quiz_id', quizId)
    .eq('status', 'ACTIVE');
  if (classId) q = q.eq('class_id', classId);
  const { error, count } = await q;
  if (error) { console.error('releaseQuizResults:', error); return { success: false, message: error.message }; }
  return { success: true, released_count: count || 0 };
}
```

### 10. `cloneTeacherQuiz` — stop copying class links — `js/myteacher-api.js:1550`

Delete the block at lines 1624-1634 (the `getQuizClasses(sourceQuizId)` call and the `linkRows.map(...)` insert). A clone is a fresh template with no assignments — the teacher explicitly re-assigns.

### 11. Teacher UI — Classes tab schedule pickers — `myteacher/teacher/quizzes.html:1811-1932`

Each linked class card gets an inline schedule block (two `<input type="datetime-local">` fields: Open / Close), pre-filled from the link row. An "Inherit from quiz" hint appears when both are empty.

Changes:
- `loadClassesTab` (line 1814): no change (already loads `getQuizClasses`, which now returns the schedule).
- `renderClassesList` (line 1824): when rendering a *linked* card, append a schedule panel with two datetime inputs, IDs keyed by `class_id` (e.g. `schedOpen_CLS_xxx`). Show effective fallback as placeholder text (from quiz template).
- New local state: a `LINKED_CLASS_SCHEDULES` map, keyed by `class_id`, holding `{ open_at, close_at }` strings. Seeded from `getQuizClasses` on load, updated by input events.
- `clsToggle` (line 1904): when un-linking, remove entry from the schedule map. When linking, add an empty entry (inherit).
- `saveClassLinks` (line 1914): build `classAssignments` array from `LINKED_CLASS_IDS` + `LINKED_CLASS_SCHEDULES`, pass to `setQuizClasses`.
- Schedule-only edits: if the linked set is unchanged but the schedule map has changed, still call `setQuizClasses` — the new `toUpdate` bucket in §3 handles this.
- Client-side validation before save: for each class, if both `open_at` and `close_at` are set, `close_at` must be after `open_at`. Reuse the existing `showToast('Error', ...)` pattern.

Keep the existing class search, linked/unlinked sections, and member-count badges.

### 12. Teacher UI — quiz-level fields relabel — `myteacher/teacher/quizzes.html`

Relabel `#fOpenAt` / `#fCloseAt` section to something like **"Default schedule (optional — used as template for new class assignments)"** with a one-line hint. No logic changes.

### 13. Publish-pane release card — `myteacher/teacher/quizzes.html:2641`

`releaseCardHtml` currently reads `q.results_released` from the quiz. That field is no longer authoritative. Minimum change for this PR:
- Show "Released in X of Y classes" using counts derived from `getQuizClasses`.
- Keep a single "Release results to all classes" button that calls `releaseQuizResults(SELECTED_ID)` (bulk).
- Update `releaseResults()` (line 2773) to refresh the Classes tab state after calling.

Per-class release buttons in the Classes tab come in a follow-up PR.

---

## Critical files to modify

| File | What changes |
|---|---|
| `db/schema.sql` | Add 4 columns to `teacher_quiz_classes`; update comments |
| `js/myteacher-api.js` | Add `_effectiveQuizWindow` helper; modify `getQuizClasses`, `setQuizClasses`, `startQuizAttempt`, `getQuizzesForClass`, `getAttemptResults`, `getAttemptReview`, `releaseQuizResults`, `cloneTeacherQuiz` |
| `myteacher/teacher/quizzes.html` | Classes tab: per-class schedule pickers + save flow; relabel quiz-level schedule as "default"; publish-pane release card shows per-class counts |
| `myteacher/student/my-classes.html` | Use new `state` field from `getQuizzesForClass` to render Closed/Not Open badges and disable Start button |

## Out of scope (follow-up)

- Per-class release buttons in the Classes tab.
- Deprecation/removal of quiz-level `results_released`/`results_released_at` columns.
- Backfill migration (not needed — no existing data per user).
- Auto-submitting stale `IN_PROGRESS` attempts when a class's `close_at` passes.

## Verification

1. **Schema applied**: run the migration on the dev Supabase branch. `\d teacher_quiz_classes` shows 4 new columns.
2. **Create a quiz, publish, link class A with window Mar 1 – Mar 8**. Fast-forward: student in A cannot start after Mar 8 → `CLOSED` response.
3. **Link class B with window Apr 15 – Apr 22** (same quiz). Student in A still blocked. Student in B can start during their window.
4. **Results**: with `AFTER_CLOSE` policy, student A sees results after Mar 8; student B does not until Apr 22.
5. **MANUAL policy**: call `releaseQuizResults(quizId, classAId)` — only A sees results. Call bulk `releaseQuizResults(quizId)` — both see.
6. **Inheritance**: link class C with no schedule; quiz template has Apr 1 – Apr 10. `startQuizAttempt` for C respects Apr 1 – Apr 10.
7. **Clone**: clone a quiz that has class links → new quiz has **zero** class links.
8. **Student Quizzes tab**: closed quiz shows Closed badge, Start button disabled. Quiz not yet open shows "Opens at ..." badge.
9. **Teacher Classes tab**: schedule pickers pre-fill from saved link data. Edit close_at only → Save Links → refetch shows update applied. Validation: `close_at ≤ open_at` → error toast, no save.
10. **Regression check**: existing quizzes with only quiz-level schedule still work — all link rows have null schedule fields, fallback resolves to quiz template.

Tools: use `preview_start` → `preview_click` / `preview_fill` / `preview_snapshot` for UI flows; use `mcp__supabase-prod__execute_sql` (read-only) to verify row state between steps.
