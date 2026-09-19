-- 20260919235000_subscriptions_created_utc.sql — 02-subscriptions.md C3b,
-- the receipt's two jobs split (Sam, 2026-09-19: the created_utc column
-- ticked in the session; rebuild.md §8 S8)
--
-- Once a course row can start later than its receipt (C3a, the queued
-- start), the receipt's start and expiry stopped meaning access: the
-- admin list, the panel's days remaining, the "access assigned" email,
-- the student's profile panel and the Upgrade page all quote the
-- receipt, and all four would have told a date the rows do not hold.
-- Sam's reading: the subscription row used to be the entitlement and is
-- now the paper trail — so its dates must summarise its rows.
--
-- Two moves:
--   1. created_utc — when the receipt was made (a grant, a purchase, a
--      registration). The start no longer says this once it queues.
--      Backfilled from start_utc for every receipt already here.
--   2. The receipt's window follows its rows: start_utc = the earliest
--      row start, expires_utc = the latest row end, for every receipt
--      that has rows. From here on the row writer sets them the same
--      way after every write.
-- Dev: two receipts on the one test student, one of them queued.
-- Prod: test receipts only; launch day starts empty (D5).

set search_path = licensure_gh;

-- ── 1. when the receipt was made ──────────────────────────────────────
alter table subscriptions add column if not exists created_utc timestamptz not null default now();
update subscriptions set created_utc = start_utc;

-- ── 2. the window is the rows' ────────────────────────────────────────
update subscriptions s
set start_utc = w.min_start, expires_utc = w.max_end
from (
  select subscription_id, min(start_utc) as min_start, max(expires_utc) as max_end
  from course_access
  group by subscription_id
) w
where w.subscription_id = s.subscription_id
  and (s.start_utc <> w.min_start or s.expires_utc <> w.max_end);

notify pgrst, 'reload schema';
