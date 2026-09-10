# Quiz System

## Two Quiz Types

QAcademy has two ways for students to take quizzes:

**Fixed quizzes** — created by admin, with a pre-set list of questions. Every student who takes a fixed quiz gets the same questions. These are used for structured exam practice: "Week 3 Anatomy Quiz" or "Mock Exam — General Nursing Paper 1."

**Custom quizzes (Quiz Builder)** — built by the student on the spot. The student chooses a course, picks topics and difficulty, sets the number of questions, and the system randomly selects questions from the bank. Every build produces a different quiz. This is for flexible, self-directed study.

## Two Quiz Modes

Each quiz can be taken in one of two modes:

**Instant (Practice) mode** — the student sees feedback immediately after answering each question. The correct answer is shown, along with an explanation (rationale) and per-option feedback. This mode is for learning — the student can understand their mistakes as they go.

**Timed (Exam) mode** — the student gets a countdown timer and no feedback during the quiz. They answer all questions, then submit at the end (or the timer auto-submits when time runs out). This mode simulates the real NMC exam experience. The student reviews their answers and sees feedback only after submission.

## How a Student Starts a Quiz

### Fixed Quiz
1. Student goes to their course page
2. Sees a list of fixed quizzes available for that course
3. Each quiz card shows its title, number of questions, available modes, and whether the student has attempted it before
4. Student clicks a quiz and chooses their mode (instant or timed)
5. The system creates an attempt and opens the quiz runner

### Custom Quiz
1. Student goes to the Quiz Builder page
2. Picks a course
3. Optionally filters by topic, subtopic, and difficulty
4. Sets the number of questions (up to a configurable maximum)
5. Chooses instant or timed mode
6. Clicks Build — the system picks questions from the bank and opens the runner immediately

## The Quiz Runner

The quiz runner is the page where the student actually takes the quiz. It works the same for both fixed and custom quizzes:

- Questions appear in pages (the number per page is configurable by admin)
- The student picks their answer by clicking an option
- A question grid shows progress — which questions are answered, unanswered, or flagged
- Students can flag questions to come back to later
- In **instant mode**: after answering, the correct answer and rationale are shown immediately
- In **timed mode**: the answer is recorded silently and the student moves on
- Progress is auto-saved at regular intervals, so if the student loses their internet connection or closes the browser, they can resume where they left off
- At the end, a pre-submit screen shows a summary of answered and unanswered questions
- After submission, a completion screen shows the score

## Question Types

Three question types are supported:

- **MCQ (Multiple Choice Question)** — one correct answer from up to six options (A through F). The most common type.
- **True/False** — two options, one is correct. Options are not shuffled (True always appears first).
- **SATA (Select All That Apply)** — multiple options can be correct. The student must select every correct option and no incorrect ones. This is the hardest type and mirrors a format used in nursing licensure exams.

Each question can have per-option feedback (explaining why each option is right or wrong) and a general rationale (an overall explanation of the correct answer). Questions can also have a rationale image — a diagram or chart that helps explain the answer.

## Attempts and History

Every time a student takes a quiz, an attempt is saved with:
- The questions they received
- Their answers
- Their score
- How long they took
- Whether the attempt is complete or still in progress

Students can:
- **Resume** an in-progress attempt if they were interrupted
- **Review** a completed attempt to see the questions, their answers, and the correct answers with feedback
- **Retake** a quiz to try again with the same questions

The **Learning History** page shows all past attempts across all courses, with filters for course, mode, source, and status. Students can sort by date or score to track their progress over time.

## Offline Packs

Students can also build offline study packs from a course's question bank. These are downloaded sets of questions that can be viewed without an internet connection. See the [Offline Packs](06-offline-packs.md) section for details.
