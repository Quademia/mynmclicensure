# Teacher Assess (MyTeacher)

## What MyTeacher Is

MyTeacher is a class-based assessment tool that lives alongside the main NMC Licensure product on QAcademy. It lets teachers create classes, build their own quizzes, assign them to students, and review results — all within the same platform students already use for exam prep.

MyTeacher is separate from NMC Licensure in terms of content and administration, but shares the same login system and student accounts. A student using NMC Licensure can also join a teacher's class without creating a separate account.

## Who Uses It

**Teachers** — lecturers, tutors, or clinical instructors running nursing education programmes. They use MyTeacher to assess their students with quizzes tailored to their own teaching.

**Students** — the same students who use NMC Licensure for exam prep. They join a teacher's class using a code and take quizzes assigned by that teacher.

**Admin** — approves teacher access requests and has visibility across the platform.

## How a Teacher Sets Up

1. **Requests access** — a teacher signs up and requests teacher access. An admin reviews and approves the request.
2. **Creates a class** — the teacher creates a class with a title and a join code. They can optionally set a programme, course, academic year, semester, description, capacity limit, and colour.
3. **Students join** — students enter the join code on their My Classes page. If the teacher has enabled "require approval," students wait in a pending queue until the teacher approves them.
4. **Builds questions** — the teacher adds questions to their personal question bank. They can type questions manually, import them from CSV, or browse the QAcademy shared library and copy questions into their bank.
5. **Creates a quiz** — the teacher creates a quiz, picks questions from their bank (or the library), and sets the rules (duration, attempts, scoring policy, pass threshold). The schedule (open / close) and results-release policy set on the quiz act as **template defaults**.
6. **Assigns to classes** — the teacher links the quiz to one or more classes. Each class gets its own schedule and its own results release state, so the same quiz can be reused across cohorts over multiple terms without touching its questions.
7. **Publishes the quiz** — once published, students in the assigned classes can see and attempt the quiz. Questions are frozen at publish time so they cannot be changed while students are taking the quiz.
8. **Reviews results** — after students submit, the teacher reviews scores, item analysis, and individual attempts. They control when results are released to each class individually.

## Reusable Quizzes and Per-Class Assignments

A quiz in MyTeacher is a **reusable template**. The same quiz can be run with Class A this semester, Class B next semester, and a new cohort the year after — all tied to the same set of questions and the same analytics lineage.

Each class assignment (the link between a quiz and a class) carries three things that belong to *that cohort's run of the quiz*, not to the quiz itself:

- **Schedule** — when the quiz opens and closes for students in that class. If the teacher leaves the schedule blank on the assignment, it inherits the quiz-level template defaults; if both are blank, the quiz is always open for that class.
- **Results release state** — whether results are visible to students in that class, and when they became visible.
- **Per-class results policy effect** — the quiz still carries a release policy (Immediate, After Close, Manual), but the *state* (released or not) is tracked per class.

This means a teacher can close the quiz for Class A, wait a semester, then link it to Class C with a fresh window — and students in Class C will be able to start, while Class A stays locked. No cloning required, and results for both classes sit under the same quiz for analytics.

**Cloning** is still available when a teacher wants a separate copy of the questions they can edit independently (e.g., a revised version of a quiz for a new academic year). A clone is a brand-new template with no class assignments — the teacher explicitly re-assigns it.

## How a Student Takes a Teacher Quiz

1. Student goes to **My Classes** and sees the classes they have joined
2. Opens a class and sees the quizzes assigned to it
3. Clicks on a quiz to start an attempt
4. The quiz runner works the same as for NMC Licensure — questions appear in pages, the student picks answers, progress is auto-saved, and a timer counts down if the quiz is timed
5. After submitting, the student sees a completion screen
6. Results are only visible to the student when the teacher releases them for **their class**. The release can be immediate (visible on submit), tied to the class's own close date, or released manually by the teacher. Because release is per-class, a teacher can have released results for one class while another class is still pending.

## How a Teacher Sees Results

The teacher results page has two main views:

**Marksheet** — a table showing every student who attempted the quiz, with their score, percentage, grade, time taken, and submission date. The teacher can sort, search, and paginate this list. Results can be exported to CSV for use in spreadsheets or official records.

**Item Analysis** — a per-question breakdown showing how many students got each question right, the most commonly chosen wrong answer (distractor analysis), and the overall difficulty of each question. This helps teachers spot questions that are too easy, too hard, or poorly worded.

Teachers can drill into any individual attempt to see exactly how a student answered each question.

## Managing Release Per Class

Because a single quiz can be assigned to many classes, releasing results is a per-class action. The Classes tab inside the quiz editor uses a two-column layout:

- **Left column** — list of every class (linked and not linked) with a search box. Linked classes show a green check; the currently-selected class is highlighted.
- **Right column** — detail panel for the selected class, showing its schedule (open / close), its results release state, and its stats (members, submitted, in-progress attempts).

For the selected class, the teacher sees a status line that adapts to the quiz's release policy:

- **Immediate** — "Auto-released on submit". Nothing to do; students already see their results as they submit.
- **After Close, before close date** — "Awaiting close". A **Release early** button lets the teacher release that class's results ahead of time.
- **After Close, after close date** — "Auto-released on close". Already visible to students.
- **Manual, not released** — "Not released yet" + a **Release now** button.
- **Manual, released** — "Released on …" + a **Revoke release** button.

The teacher can revoke a release if they released by mistake; a confirmation dialog warns that students who already viewed their results may have seen them.

A footer button, **Release for all unreleased**, bulk-releases every linked class that is still pending, as a shortcut for teachers running the same quiz across many classes with a manual release policy.

The Publish tab shows a compact summary ("Released for 2 of 5 classes") with a link that jumps straight to the Classes tab.

## The Library

QAcademy maintains a shared library of questions that teachers can use:

- Teachers browse the library by course and can filter by topic, difficulty, and question type
- When a teacher adds a library question to their quiz, a copy is made in their personal bank
- The original library question is never changed — the teacher works with their own copy
- Teachers can freely edit their copy (change the wording, adjust options, update the rationale) without affecting the library or other teachers
- The copy keeps a record of where it came from (source course and item ID) for traceability

## Question Types Supported

MyTeacher supports the same three question types as NMC Licensure:

- **MCQ** — one correct answer from multiple options
- **True/False** — two options, one is correct
- **SATA (Select All That Apply)** — multiple correct answers. The teacher can choose from three scoring policies: all-or-nothing (full marks only if every correct option is selected), partial credit (proportional marks for partially correct answers), or per-option (each option scored independently)
