-- 20260926170000_bank_subject_topic_lists.sql — 08-question-bank.md B5,
-- rebuild.md §8 S18 (Sam, 2026-09-26: ticked, amended and scoped the same
-- day; the rulings are 08 §3, the B5 block)
--
-- WHY. A question's subject and topic are free text, so they drift: RN_MED
-- has 78 topics, NACNAP Clinical 148 for 180 questions, the RMHN courses
-- none, and eight courses carry the course's own name as the subject. The
-- builders' topic chips and 03 Q10's report are built from these words.
-- This file makes each a list per course that the database holds a
-- question to. The clean-up of the words themselves is done afterwards,
-- in the Subjects & topics panel (B5's second session), at Sam's pace.
--
-- WHAT.
--   1. bank_subjects and bank_topics: id, course, name, retired, created.
--      A name is unique per course (the key the questions point at) and
--      unique per course ignoring case, so "Pain" and "pain" cannot both
--      be on a list.
--   2. The words tidied so they can be keys — spaces trimmed and runs of
--      spaces made one, an empty string made Not set (null), and two
--      spellings of one word in a course made the commoner one. None of
--      this finds anything on dev (checked 2026-09-26); it is here for
--      the prod bank, whose words were never read by the importer.
--   3. The eight course-name subjects cleared to Not set, pair by pair:
--      they name the course, not a module (S18: "count as unlabelled").
--   4. Both lists seeded from the words as they stand (§3 item 2).
--   5. The keys: question_bank (course_id, subject) → bank_subjects and
--      (course_id, maintopic) → bank_topics, on update cascade. A null is
--      not checked — that is Not set. A rename of a list entry reaches
--      every question inside the database; a delete of an entry in use is
--      refused. Subtopic stays free text.
--   6. Rule 9: both tables born with `grant all` to the browser roles;
--      revoked, RLS on, no policy. The admin reads and writes them through
--      the service role. No student read uses them.
--
-- Steps 2 and 3 change words on the bank's rows: label changes, so the
-- history trigger writes nothing and no version moves; updated_at moves
-- on the rows changed, and only those (each UPDATE names the rows that
-- differ).
--
-- REACH. Dev until the merge: main's admin page writes free text, which
-- the keys now refuse when the word is not on the course's list — a save
-- or an import batch fails with Postgres's message. Only Sam. No student
-- read changes. At cutover the bank's re-copy must seed the lists first.

set search_path = licensure_gh;

-- ── 1. the two lists ───────────────────────────────────────────────────
create table bank_subjects (
  id         bigint generated always as identity primary key,
  course_id  text        not null references courses (course_id),
  name       text        not null,
  retired    boolean     not null default false,
  created_at timestamptz not null default now(),
  constraint bank_subjects_name_shape check (name = btrim(name) and name <> ''),
  constraint bank_subjects_course_name_key unique (course_id, name)
);
create unique index bank_subjects_course_lower_name_idx on bank_subjects (course_id, lower(name));

create table bank_topics (
  id         bigint generated always as identity primary key,
  course_id  text        not null references courses (course_id),
  name       text        not null,
  retired    boolean     not null default false,
  created_at timestamptz not null default now(),
  constraint bank_topics_name_shape check (name = btrim(name) and name <> ''),
  constraint bank_topics_course_name_key unique (course_id, name)
);
create unique index bank_topics_course_lower_name_idx on bank_topics (course_id, lower(name));

-- ── 2. the words tidied so they can be keys ────────────────────────────
update question_bank
   set subject = nullif(btrim(regexp_replace(subject, '\s+', ' ', 'g')), '')
 where subject is distinct from nullif(btrim(regexp_replace(subject, '\s+', ' ', 'g')), '');
update question_bank
   set maintopic = nullif(btrim(regexp_replace(maintopic, '\s+', ' ', 'g')), '')
 where maintopic is distinct from nullif(btrim(regexp_replace(maintopic, '\s+', ' ', 'g')), '');

-- two spellings of one word in a course → the commoner (ties: the first
-- in sort order)
with spellings as (
  select course_id, lower(subject) as k, subject as w, count(*) as n
  from question_bank where subject is not null group by 1, 2, 3
), chosen as (
  select distinct on (course_id, k) course_id, k, w
  from spellings order by course_id, k, n desc, w
)
update question_bank q set subject = c.w
  from chosen c
 where q.course_id = c.course_id and lower(q.subject) = c.k and q.subject <> c.w;

with spellings as (
  select course_id, lower(maintopic) as k, maintopic as w, count(*) as n
  from question_bank where maintopic is not null group by 1, 2, 3
), chosen as (
  select distinct on (course_id, k) course_id, k, w
  from spellings order by course_id, k, n desc, w
)
update question_bank q set maintopic = c.w
  from chosen c
 where q.course_id = c.course_id and lower(q.maintopic) = c.k and q.maintopic <> c.w;

-- ── 3. the eight course-name subjects → Not set ────────────────────────
update question_bank set subject = null
 where (course_id, subject) in (
   ('NAC_BASIC_CLIN',    'NAC'),
   ('NAC_BASIC_PREV',    'NAP'),
   ('RM_MID',            'Midwifery'),
   ('RMHN_PSYCH_NURS',   'RMHN'),
   ('RMHN_PSYCH_PPHARM', 'MHN'),
   ('RN_MED',            'Medical Nursing'),
   ('RN_SURG',           'Surgical Nursing'),
   ('RPHN_PPHN',         'Principles of Public Health Nursing')
 );

-- ── 4. the lists seeded from the words as they stand ───────────────────
insert into bank_subjects (course_id, name)
select distinct course_id, subject from question_bank where subject is not null
order by 1, 2;

insert into bank_topics (course_id, name)
select distinct course_id, maintopic from question_bank where maintopic is not null
order by 1, 2;

-- ── 5. the keys ────────────────────────────────────────────────────────
-- (course_id, subject) and (course_id, maintopic) are already indexed on
-- question_bank (B1), which a cascade and a delete check both use.
alter table question_bank
  add constraint question_bank_subject_fkey
    foreign key (course_id, subject) references bank_subjects (course_id, name)
    on update cascade;
alter table question_bank
  add constraint question_bank_maintopic_fkey
    foreign key (course_id, maintopic) references bank_topics (course_id, name)
    on update cascade;

-- ── 6. rule 9: nothing for the browser ─────────────────────────────────
revoke all on bank_subjects from anon, authenticated;
revoke all on bank_topics   from anon, authenticated;
revoke all on sequence bank_subjects_id_seq from anon, authenticated;
revoke all on sequence bank_topics_id_seq   from anon, authenticated;
alter table bank_subjects enable row level security;
alter table bank_topics   enable row level security;
