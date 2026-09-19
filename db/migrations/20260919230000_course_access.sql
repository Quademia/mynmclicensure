-- 20260919230000_course_access.sql — 02-subscriptions.md C2 (rebuild.md §8
-- S8, the entitlement side; D13, D14, D15, D17, D20; Sam, 2026-09-18 the
-- ruling and the six shape rulings, 2026-09-19 the go — built before S2,
-- reversing the 2026-09-19 order: the gate is one function the eleven
-- bank policies call by name, so its body changes once either way)
--
-- The expiry moves from the product to the course. Until now "which
-- courses does this student hold" was answered twice from the receipt
-- and the product's list — TypeScript summing remaining days per course
-- (a sum nothing grants, drifting earlier every morning — D14), SQL
-- checking each receipt's own date — plus two more readers with their
-- own rules (D17). Sam's framing: "GP for 365 days, RN_MED for 365
-- days", not "RN Full for 365 days".
--
-- Three moves:
--   1. course_access — one row per course per receipt: who, which
--      course, the receipt that granted it, a start, an end, and
--      revoked_utc (empty = live; a date, not a status — D20). Several
--      rows per course per student are intended (trial, paid, later a
--      queued renewal), so no uniqueness. Students read their own rows;
--      there is NO browser write path — the schema's default privileges
--      granted all, so insert / update / delete are taken back from the
--      two browser roles and every write is a Server Action with the
--      service role (the trial grant's shape).
--   2. One definition of "live": my_course_access() returns the
--      caller's courses with the latest end among live rows (a row whose
--      window contains now makes the course held; a later row extends
--      the end — the queued-renewal case C3 turns on). user_has_course()
--      keeps its name, signature and every caller and becomes one lookup
--      in it. The pages read the same function, so the days-left number
--      is a stored date's distance.
--   3. Backfill: one row per course per existing receipt from
--      product_courses with the receipt's dates; a receipt not ACTIVE
--      gets revoked_utc = now so the rows say what the status said.
--      Dev's rows only matter; launch day starts empty (D5).
--
-- Parity notes. Today's gate ignores start_utc (a future-dated grant
-- gave access at once); a row is live only inside its window, so a
-- future-dated grant now waits for its day. Stacking is OFF (ruling 3):
-- every row carries its receipt's dates; queuing behind a course's
-- current end is C3. subscriptions.product_id stays NOT NULL until C3
-- brings the hand-picked grant that needs it (deferred from this slice
-- to keep the type change beside its writer).

set search_path = licensure_gh;

-- ── 1. the entitlement table ──────────────────────────────────────────
create table if not exists course_access (
  access_id       bigint generated always as identity primary key,
  user_id         text not null references users (user_id),
  course_id       text not null references courses (course_id),
  subscription_id text not null references subscriptions (subscription_id),
  start_utc       timestamptz not null,
  expires_utc     timestamptz not null,
  revoked_utc     timestamptz,
  created_utc     timestamptz not null default now(),
  constraint course_access_window_check check (expires_utc > start_utc)
);
create index if not exists course_access_user_course_live_idx
  on course_access (user_id, course_id) where revoked_utc is null;
create index if not exists course_access_subscription_idx
  on course_access (subscription_id);

alter table course_access enable row level security;
drop policy if exists course_access_select on course_access;
create policy course_access_select on course_access for select
using (user_id = auth_user_id() or auth_user_role() = 'ADMIN');

revoke insert, update, delete on course_access from anon, authenticated;
revoke all on sequence course_access_access_id_seq from anon, authenticated;

-- ── 2. one definition of "live" ───────────────────────────────────────
create or replace function my_course_access()
returns table (course_id text, expires_utc timestamptz)
language sql
security definer
stable
set search_path = licensure_gh
as $$
  select a.course_id, max(a.expires_utc)
  from course_access a
  where a.user_id = auth_user_id()
    and a.revoked_utc is null
    and a.expires_utc > now()
  group by a.course_id
  having bool_or(a.start_utc <= now())
$$;
revoke execute on function my_course_access() from public, anon;

create or replace function user_has_course(p_course_id text)
returns boolean
language sql
security definer
stable
set search_path = licensure_gh
as $$
  select auth.uid() is not null and (
    auth_user_role() = 'ADMIN'
    or exists (select 1 from my_course_access() m where m.course_id = p_course_id)
  )
$$;

-- ── 3. the rows for every receipt already here ────────────────────────
insert into course_access (user_id, course_id, subscription_id, start_utc, expires_utc, revoked_utc)
select s.user_id, pc.course_id, s.subscription_id, s.start_utc, s.expires_utc,
       case when s.status = 'ACTIVE' then null else now() end
from subscriptions s
join product_courses pc on pc.product_id = s.product_id
where s.expires_utc > s.start_utc
  and not exists (select 1 from course_access a where a.subscription_id = s.subscription_id);

notify pgrst, 'reload schema';
