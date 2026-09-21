# Messaging

## What Messaging Is

QAcademy has a built-in messaging system that lets students communicate with admin. It is a support tool, not a general chat — it is designed for students to ask questions, report problems, and get help.

Messages are organised into threads. Each thread is a conversation between one student and admin on a specific topic.

## How a Student Sends a Message

There are several ways a student can start a conversation:

**From the Messages page:**
- Student goes to their Messages page
- Clicks "+ New" to start a new thread
- Types their message and sends it
- This creates a general support thread

**From inside a course:**
- Student can click "Message us" on a course page
- This creates a thread tagged with that specific course
- Admin can see the course context when replying

**From inside a quiz:**
- While taking a quiz, the student can click "Send feedback" on any question
- This creates a thread that includes the full question context: the question text, all the options as displayed, and the student's current answer
- The correct answer is deliberately **not** included — this prevents students from using the messaging system to find answers during an active quiz
- Admin can see exactly which question the student is asking about, making it easy to investigate and respond

## How Admin Handles Messages

Admin sees all message threads in a single feed:

- Threads are listed with the student's name, the subject or context, and the last message
- Admin can filter by: unread threads, context type (general, course, or question), and search by student name, email, or question text
- Admin can reply directly to any thread
- Admin can close a thread when the issue is resolved, and reopen it if needed

**Bulk messaging:** Admin can also send a message to many students at once. The bulk send tool lets admin target students by programme, level, cohort, subscription kind, or course entitlement. A preview shows how many students will receive the message before it is sent.

## Thread Types

Every thread has a context type:

- **General** — a general support question with no specific course or quiz context
- **Course** — about a specific course. The thread is tagged with the course ID so admin can see which course the student is asking about.
- **Question** — about a specific quiz question. The thread includes the question details (stem, options, student's answer) stored as reference text. This reference text is visible to both the student and admin for the life of the thread, making it easy to refer back to the exact question being discussed.

---

## Diagnosis findings for this surface

Grouped here on 2026-09-21 (Sam) so a surface can be worked in one pass.
The register is `post-rebuild-diagnosis.md`; the queue is
`BUILD_LIST.md`. **The text above this line still describes the legacy
product** — rewritten into the living-plan shape when this surface comes
up.

| Finding | What it says | Status |
|---|---|---|
| D10 | The browser's database credential is the stack, not this feature: the browser client does realtime replies and auth, and queries no table | ✔ **no action, recorded so nobody "fixes" it** by removing live replies |
| D37 | The policies say who may touch a row, not what they may write — a student can insert a message as the admin, edit the admin's replies and rewrite a thread's status (proven on dev) | ⬜ ruled (Sam, 2026-09-18), S11 ticked |
| D38 | Alpha's five protections were dropped by gamma and not restored by the port | ⬜ ruled, S11 |
| D39 | The admin inbox reads the whole table, and the failures are silent | ⬜ ruled, S11 — a paged inbox |
| D40 | A student's thread is built from whatever the browser says, and a link builds one on arrival | ⬜ ruled, S11 |
| D41 | Two unread rules on the student side, and the admin badge counts closed threads | ⬜ ruled, S11 — read stamps on the thread |
| D42 | Residue and drift in the two tables | ⬜ ruled, S11 — six columns dropped |

**§8 row:** S11 (messaging storage — the support desk shape) ✅ ticked by
Sam 2026-09-18, **not yet built**. It is one BUILD_LIST line covering
D37–D42; when this surface is opened, each finding above should get its
own slice id here so it can be traced.

Related, owned elsewhere: the **question reports** feature replaces the
"Send feedback" threads (BUILD_LIST); **Bulk Send** is parked.
`messages` and `messages_threads` still carry the default write grants
(D43).
