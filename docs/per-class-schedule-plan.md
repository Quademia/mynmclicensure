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

Tools: use `preview_start` → `preview_click` / `preview_fill` / `preview_snapshot` for UI flows; use the dev Supabase MCP (`mcp__30f7ad5f-...`) `execute_sql` (read-only) to verify row state between steps.

---

# Phase 2 — Per-class results release dashboard + two-column Classes tab

## Phase 2 context

Phase 1 shipped the per-class schedule and a link-level `results_released` flag. The Publish tab still had a single bulk "Release results to all classes" button — too coarse for a reusable quiz model. Teachers running a quiz across many cohorts need to see release state per class, release early for individual classes, and revoke a mistaken release.

Phase 1 also stacked every linked class vertically with an inline schedule picker under each card. With a release section added too, each card would become a tall block. So Phase 2 **restructures the Classes tab into two columns**: a narrow list of classes on the left, and a detail panel on the right that shows the selected class's schedule + results + stats.

### Phase 2 design decisions (confirmed)
1. **Two-column layout**. Left = list of classes (linked and unlinked). Right = detail panel for the currently-selected class.
2. **Release is a universal override.** `link.results_released = true` makes results visible regardless of `results_release_policy`. The policy still drives automatic release behaviour (IMMEDIATE / AFTER_CLOSE), but the flag is a teacher override on top.
3. **Revoke is allowed.** A "Revoke release" action sets `results_released = false` and clears the timestamp. Confirm dialog warns that students who already viewed results may have seen them.
4. **Publish tab release card shrinks** to a summary line + a "Manage per-class releases →" link that navigates to the Classes tab. Bulk "Release for all unreleased" button stays as a shortcut.
5. **IMMEDIATE quizzes** show "Auto-released on submit ✓" in the detail panel. No release button, no DB writes to the flag.
6. **Single Save button** at the bottom of the detail panel saves both schedule and release-flag edits for the selected class (release is actioned via direct Release / Revoke buttons, not the Save button).
7. **Per-policy release copy**:
   - IMMEDIATE → "Auto-released on submit" ✓ (no button)
   - AFTER_CLOSE before effective close → "Awaiting close · <date>" + [Release early] button
   - AFTER_CLOSE after effective close → "Auto-released on close <date>" ✓ (no button unless manually flagged, in which case [Revoke override])
   - MANUAL not released → "Not released yet" + [Release now] button
   - MANUAL released → "Released on <date>" ✓ + [Revoke release] button

## Implementation

### 1. Backend gate override — `js/myteacher-api.js`

`getAttemptResults` and `getAttemptReview` both add a short-circuit so `link?.results_released === true` satisfies the gate regardless of policy. This means MANUAL releases still work exactly as before, and AFTER_CLOSE releases can now be done early per class.

### 2. `unreleaseQuizResults(quizId, classId = null)` — `js/myteacher-api.js`

Mirror of `releaseQuizResults`. Sets `results_released = false` and clears `results_released_at` on the target link(s). If `classId` is omitted, revokes all active links for the quiz.

### 3. `getQuizClassStats(quizId)` — `js/myteacher-api.js`

Helper returning `{ [class_id]: { members, submitted, in_progress } }` for every class linked to the quiz:
- `members` from `teacher_class_members` where `status = 'ACTIVE'`
- `submitted` + `in_progress` from `teacher_quiz_attempts` filtered by the quiz + class

One call, grouped client-side. Used by the right-panel Stats section.

### 4. Classes tab — two-column layout — `myteacher/teacher/quizzes.html`

```
┌─ Classes tab ────────────────────────────────────────────┐
│  [search]                                  [ Save all ]  │
│  ┌───────────────┐  ┌─────────────────────────────────┐  │
│  │ Linked    (3) │  │  Class A  · Year 2 · Fall 2026  │  │
│  │ ▸ Class A ✓   │  │                     25 members  │  │
│  │   Class B ✓   │  │  ─ Schedule ─                   │  │
│  │   Class C ✓   │  │  Open:  [Apr 15, 08:00]         │  │
│  │ Not linked (5)│  │  Close: [Apr 22, 17:00]         │  │
│  │   Class D     │  │  Per-class override · [Clear]   │  │
│  │   Class E     │  │                                 │  │
│  │   ...         │  │  ─ Results release ─            │  │
│  │               │  │  Policy: After close            │  │
│  │               │  │  Awaiting close Apr 22 · Pending│  │
│  │               │  │  [Release early]                │  │
│  │               │  │                                 │  │
│  │               │  │  ─ Stats ─                      │  │
│  │               │  │  25 Members · 3 Submitted · 0 IP│  │
│  │               │  │                                 │  │
│  │               │  │  [Save changes]                 │  │
│  └───────────────┘  └─────────────────────────────────┘  │
│  [Release for all unreleased]              [ Save all ]  │
└───────────────────────────────────────────────────────────┘
```

**State additions:**
- `QUIZ_CLASS_STATS` — loaded by `getQuizClassStats` on `loadClassesTab`
- `SELECTED_LINK_CLASS_ID` — which class is in the right panel
- `CLS_DETAIL_DIRTY` — unsaved-changes flag

**Behaviour:**
- Auto-select the first linked class on load. Empty state if no linked classes.
- Click a **linked** class row → select it (right panel renders its detail)
- Click the ✓ check on a linked class → unlink it (`clsToggleLink`)
- Click an **unlinked** class row → auto-link it AND select it, ready for schedule edit
- Click the empty check on an unlinked class → link without changing selection
- Dirty check: switching classes with unsaved schedule edits fires a confirm dialog
- Per-class Release / Release early / Revoke buttons call `releaseQuizResults(quizId, classId)` / `unreleaseQuizResults` directly and reload the tab
- Footer `Save all` persists all schedule edits via `setQuizClasses` (the existing per-class schedule bundle)
- Footer `Release for all unreleased` iterates over classes where `results_released = false` and calls `releaseQuizResults(quizId, classId)` per class (policy-aware — IMMEDIATE classes are skipped implicitly since they're already visible)

### 5. Publish tab release card — `myteacher/teacher/quizzes.html`

`releaseCardHtml` shrinks:
- No linked classes → "No classes linked yet" banner
- IMMEDIATE → "Auto-release on submit — students see their results the moment they submit"
- Otherwise → "Released for X of Y classes" with:
  - "Manage per-class releases →" button (navigates to Classes tab via `goToClassesTab()`)
  - "Release for all unreleased" button (hidden once everything is released)

`goToClassesTab()` calls `setActiveTab('classes')` then `loadClassesTab()` to guarantee fresh state.

### 6. Dirty-check UX

The right panel tracks `CLS_DETAIL_DIRTY`. When the teacher clicks a different class on the left:
- If dirty → confirm "You have unsaved changes. Discard them and switch classes?"
- On confirm → discard, switch
- On cancel → stay

The Save button in the detail panel is disabled while `!CLS_DETAIL_DIRTY`. Once saved via `saveClassLinks()`, the dirty flag clears.

### 7. CSS additions / removals

- **Added**: `.cls-tab-grid`, `.cls-list-col`, `.cls-detail-col`, `.cls-row*`, `.cls-detail-section*`, `.cls-release-line`, `.cls-stats-row`, `.cls-list-section-head`, `.cls-detail-empty`
- **Removed**: `.cls-card-wrap`, `.cls-sched-block`, `.cls-has-sched`, `.cls-sched-row/field/label/input/hint/clear/released` (all superseded by the right-panel detail styles)

## Critical files modified

| File | What changes |
|---|---|
| `js/myteacher-api.js` | Gate override in `getAttemptResults` + `getAttemptReview`; new `unreleaseQuizResults`; new `getQuizClassStats` |
| `myteacher/teacher/quizzes.html` | Classes tab restructured into two columns; right-panel detail with schedule + results + stats; per-class Release / Revoke actions; dirty check; shrunk Publish release card with `goToClassesTab` shortcut; new/removed CSS |
| `docs/per-class-schedule-plan.md` | This Phase 2 section |

## Out of scope (follow-up)

- Per-class "scheduled release" (release at a future time) — teachers can use AFTER_CLOSE with per-class close_at instead
- Email/notification when results are released
- Release history / audit log per class
- Removing the now-unused quiz-level `results_released` / `results_released_at` columns (deferred)

## Verification

1. **Layout**: Open a published quiz with 2+ linked classes. Classes tab shows two columns. Click between classes on the left — right panel updates.
2. **Auto-select**: First linked class is selected on first load.
3. **Schedule edit**: Change a class's Close at → Save all → refetch confirms.
4. **Inherit button**: Clear override → hint reverts to "Inherits quiz template".
5. **MANUAL release**: Quiz with MANUAL policy. Right panel shows "Not released yet" + Release now button. Click → toast → row updates to show ✓ Released.
6. **Revoke**: After release, Revoke button appears. Click → confirm → row reverts.
7. **AFTER_CLOSE release early**: Quiz with AFTER_CLOSE and a future close. Right panel shows "Awaiting close" + Release early. Click → released before close.
8. **IMMEDIATE**: Policy IMMEDIATE → "Auto-released on submit ✓", no release button.
9. **Bulk release**: 2 unreleased classes + 1 released → footer button releases the 2, leaves the 1.
10. **Publish tab**: Release card shows X of Y released + Manage link + bulk button. Clicking Manage navigates to Classes tab.
11. **Dirty check**: Edit a class's schedule, click a different class → confirm dialog. Cancel → stays. Accept → discards.
12. **Regression**: Existing quizzes still open. No console errors. Removed Select all / Clear all buttons don't throw.

Tools: `preview_start` → `preview_click`/`preview_fill`/`preview_snapshot` for UI; dev Supabase MCP (`mcp__30f7ad5f-...`) `execute_sql` read-only to verify row state.
