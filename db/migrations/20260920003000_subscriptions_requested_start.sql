-- 20260920003000_subscriptions_requested_start.sql — 02-subscriptions.md
-- C3b, the chain (Sam, 2026-09-19: option 2 and the requested_start_utc
-- column ticked in the session; rebuild.md §8 S8)
--
-- Sam's walk revoked the LIVE receipt while a paid one was queued behind
-- it, and ruling 4 as written left the student with a paid receipt and
-- no access for three weeks: the queue was a courtesy so days were not
-- wasted, not a penalty. Ruled: for one student and one course, the
-- paid and free receipts form a chain in order of their earliest
-- allowed start; each link starts at the later of that floor and the
-- previous link's end, and keeps its length. Every write re-packs the
-- chain, so what a student holds never depends on the order an admin
-- did things in. Trials stay outside the chain.
--
-- The floor needs a home. A purchase or a registration starts from the
-- moment it was made (created_utc). An admin Grant may name a start
-- date — backdating a cash payment, or a future start — and that date
-- is this column; null means the created moment. The row writer reads
-- it; nothing else does.

set search_path = licensure_gh;

alter table subscriptions add column if not exists requested_start_utc timestamptz;

notify pgrst, 'reload schema';
