# Offline Packs

## What an Offline Pack Is

An offline pack is a downloadable set of questions that a student can study without an internet connection. The questions come from the same question bank used for online quizzes, so the quality and format are identical.

This feature exists because many nursing students in Ghana study in areas where internet connectivity is unreliable or expensive. An offline pack lets them download questions while they have a connection (at school, at a library, or on public WiFi) and then study those questions anywhere, anytime.

## How a Student Builds One

1. Go to the **Offline Pack Builder** page
2. Choose a course (e.g. General Nursing, Medical-Surgical Nursing)
3. Optionally filter by topic, subtopic, or difficulty to focus on specific areas
4. Choose how many questions to include
5. The system suggests a name for the pack based on the selections
6. Click **Build** — the system picks questions and saves the pack

The process is similar to the Quiz Builder, but instead of starting a timed quiz session, the result is a saved pack the student can open at any time.

## Smart Question Selection

The system tries to avoid giving the student the same questions they have already seen in previous offline packs:

- It checks which questions appeared in the student's earlier packs for the same course
- It prioritises questions the student has not seen before
- If all available questions have already been used (the student has built many packs), it recycles older questions

This keeps each new pack feeling fresh and maximises the study value.

## Viewing an Offline Pack

1. Go to **My Offline Packs**
2. See a list of all saved packs with their course, question count, and build date
3. Click **Open** on any pack
4. The pack opens in a clean, readable format showing each question with its options
5. The student can work through the questions at their own pace
6. No internet connection is needed once the pack is open

---

## Diagnosis findings for this surface

Grouped here on 2026-09-21 (Sam) so a surface can be worked in one pass.
The register is `post-rebuild-diagnosis.md`. **The text above this line
still describes the legacy product** — rewritten into the living-plan
shape when this surface comes up.

| Finding | What it says | Status |
|---|---|---|
| D12 | A saved offline pack is a pointer list, not a snapshot — the renderer follows the ids back to the live bank on every open, so an edited or deleted question changes a pack a student already downloaded | ✅ 2026-09-20 — closed by `03-quiz-system.md` Q4: `offline_pack_items` holds one snapshotted row per question and `offline_packs.item_ids` is gone |
| D17 | Announcements and offline packs each pick "the" subscription by their own rule | ✅ 2026-09-19 — closed by 02 C2, one `course_access` lookup |

This surface has no open diagnosis findings of its own: both were closed
by slices in other docs, which is why it was never opened. What remains
for it is on `BUILD_LIST.md` — the renderer printing "Prepared for" twice,
the course code shown instead of the title once a course is inactive, the
builder's sticky status line, and the allowance rules. `offline_packs`
still carries the default write grants (D43).
