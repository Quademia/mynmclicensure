-- ============================================================
-- Fix: admin cannot create message threads (bulk send + new thread)
-- ============================================================
--
-- Bug:
--   The messages_threads INSERT policy only allowed a row whose
--   user_id equalled the caller's own id:
--       WITH CHECK ( messages_threads.user_id = auth_user_id() )
--   This was written for students opening their own threads. It
--   has NO admin exception, so when an admin initiates a thread
--   FOR a student (the "New Thread" button, and every recipient
--   in a "Bulk Send"), the thread's user_id is the student's id,
--   not the admin's — and the INSERT is rejected by RLS.
--
-- Symptom:
--   Bulk Send resolved recipients fine (a SELECT), but every
--   thread insert silently failed, so the run reported
--   "sent to 0". messages_threads / messages were empty in prod
--   because admin-initiated messaging had never once succeeded.
--
-- Why the other ops worked:
--   messages_threads SELECT + UPDATE and messages INSERT all
--   already carry the `auth_user_role() = 'ADMIN'` bypass. Only
--   the thread INSERT was missing it — a day-one oversight.
--
-- Fix:
--   Add the same ADMIN bypass to the INSERT policy, making it
--   consistent with its three sibling policies.
-- ============================================================

DROP POLICY IF EXISTS "messages_threads_insert" ON messages_threads;

CREATE POLICY "messages_threads_insert"
ON messages_threads FOR INSERT
WITH CHECK (
  auth_user_role() = 'ADMIN'
  OR messages_threads.user_id = auth_user_id()
);
