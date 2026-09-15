-- 20260913220000_subscriptions.sql — slice 8
--
-- Subscriptions: the table transcribed from legacy/db/schema.sql into the
-- `licensure_gh` schema with the same nine columns and defaults
-- (`expiry_reminded` included — written false by every creator, read by
-- nothing; the Sheets-era reminder scan that used it was never rebuilt
-- and is parked in BUILD_LIST.md). No content copy: rebuild.md D5 —
-- subscriptions do not move, every gamma user is a free user.
--
-- Shape change, under Sam's standing tick (rebuild.md §8 S4, "as each
-- table lands"): `user_id` references `users`, `product_id` references
-- `products`. The table is empty here, so nothing can violate them.
--
-- Policies (rebuild.md §6.4): the legacy SELECT (own rows, or ADMIN)
-- and the ADMIN UPDATE are kept. The legacy INSERT let a student insert
-- their own row from the browser — §9 defect 2, dropped: the trial
-- grant now runs in the registration Server Action with the service
-- role, and every other insert is an ADMIN's. No DELETE, as legacy.
--
-- The entitlement gate (§9 defect 3): `user_has_course()` from slice 4a
-- gets its real body — an ADMIN (the Question Bank page reads every
-- course; legacy let any signed-in user read), or a student with an
-- ACTIVE, unexpired subscription whose product includes the course. The
-- signature and SECURITY DEFINER do not change; the eleven item
-- policies keep calling it.

set search_path = licensure_gh;

-- ── subscriptions ──────────────────────────────────────────────────────
create table if not exists subscriptions (
  subscription_id text primary key,                                    -- 'SUB_' + hex
  user_id         text not null references users (user_id),           -- S4
  product_id      text not null references products (product_id),     -- S4
  start_utc       timestamptz not null default now(),
  expires_utc     timestamptz not null,
  status          text not null default 'ACTIVE',    -- ACTIVE | EXPIRED | REVOKED
  expiry_reminded boolean not null default false,    -- carried, unused (see header)
  source          text not null default 'PAYMENT',   -- PAYMENT | PAYSTACK | ADMIN | SELF_TRIAL_SIGNUP
  source_ref      text
);

create index if not exists subscriptions_user_id_idx on subscriptions (user_id);
create index if not exists subscriptions_user_product_status_idx on subscriptions (user_id, product_id, status);
create index if not exists subscriptions_status_expires_idx on subscriptions (status, expires_utc);

-- ── row-level security ─────────────────────────────────────────────────
alter table subscriptions enable row level security;

drop policy if exists subscriptions_select on subscriptions;
create policy subscriptions_select on subscriptions for select
using (subscriptions.user_id = auth_user_id() or auth_user_role() = 'ADMIN');

-- INSERT: ADMIN only. The legacy student self-insert is gone (§9 #2).
drop policy if exists subscriptions_insert on subscriptions;
create policy subscriptions_insert on subscriptions for insert
with check (auth_user_role() = 'ADMIN');

drop policy if exists subscriptions_update on subscriptions;
create policy subscriptions_update on subscriptions for update
using (auth_user_role() = 'ADMIN');

-- ── the entitlement gate, filled in ────────────────────────────────────
-- Legacy getStudentCourseAccess() counted a subscription while its
-- remaining days rounded up to at least 1, i.e. while expires_utc is in
-- the future — the same test as here.
create or replace function user_has_course(p_course_id text)
returns boolean
language sql
security definer
stable
set search_path = licensure_gh
as $$
  select auth.uid() is not null and (
    auth_user_role() = 'ADMIN'
    or exists (
      select 1
      from subscriptions s
      join products p on p.product_id = s.product_id
      where s.user_id = auth_user_id()
        and s.status = 'ACTIVE'
        and s.expires_utc > now()
        and p_course_id = any (p.courses_included)
    )
  )
$$;
