-- 20260915120000_payments.sql — slice 9a
--
-- Payments: the table transcribed from legacy/db/schema.sql into the
-- `licensure_gh` schema with the same nineteen columns. No content copy:
-- rebuild.md D5 — payments do not move.
--
-- Shape change, under Sam's standing tick (rebuild.md §8 S4, "as each
-- table lands"): `product_id` references `products`, `user_id` and
-- `subscription_id` reference their tables (both nullable — a pay-first
-- row has no user until setup, and no subscription until activation).
-- The table is empty here, so nothing can violate them.
--
-- Policies (rebuild.md §6.4): legacy's one policy is kept — only an
-- ADMIN reads payment rows. There is no INSERT or UPDATE policy on
-- purpose: every write came from the payments Worker with the service
-- role, and now comes from the Server Actions in lib/payments/ with the
-- same key (the payer has no session yet; a student may not write a
-- payment). Students cannot read payment rows at all, as legacy.
--
-- The rate limit (rebuild.md §7.1): gamma used a Cloudflare rate-limit
-- binding — 5 requests per 60 seconds per IP on the four public payment
-- routes. Under OpenNext the plain answer is a small counter table
-- behind a SECURITY DEFINER function, the same shape as the login
-- limiter. One row per key (the caller's address), a fixed 60-second
-- window. The server calls it with the service role; the browser never
-- can (EXECUTE revoked from anon and authenticated). If the call itself
-- errors, the caller fails OPEN, as legacy did.

set search_path = licensure_gh;

-- ── payments ───────────────────────────────────────────────────────────
create table if not exists payments (
  reference             text primary key,                                   -- 'QAC_' + 12 upper hex
  status                text not null,                                      -- INIT | PAID | SETUP_REQUIRED | ACTIVATED | FAILED
  email                 text not null,
  user_id               text references users (user_id),                    -- S4; null until setup on a pay-first row
  product_id            text not null references products (product_id),    -- S4
  product_name          text,
  amount_minor_expected integer not null,
  currency              text not null,
  amount_minor_paid     integer,
  paid_utc              timestamptz,
  activated_utc         timestamptz,
  subscription_id       text references subscriptions (subscription_id),   -- S4; null until activation
  failure_note          text,
  raw                   jsonb,                                              -- { init, verify, setup_complete, flow, … }
  setup_token           text,                                              -- 32 hex; re-minted on every verify
  setup_created_utc     timestamptz,                                       -- the token's 48-hour clock starts here
  setup_completed_utc   timestamptz,
  program_id            text,
  phone_number          text
);

create index if not exists payments_status_idx   on payments (status);
create index if not exists payments_email_idx    on payments (email);
create index if not exists payments_user_id_idx  on payments (user_id);
create index if not exists payments_paid_utc_idx on payments (paid_utc desc nulls last);

alter table payments enable row level security;

drop policy if exists payments_select on payments;
create policy payments_select on payments for select
using (auth_user_role() = 'ADMIN');

-- ── rate_limits ────────────────────────────────────────────────────────
create table if not exists rate_limits (
  key          text primary key,                       -- 'payments:' + the caller's address
  window_start timestamptz not null default now(),
  count        integer not null default 0
);

alter table rate_limits enable row level security;
-- No policies: the function below is the only reader and writer.

-- true = allowed, false = over the limit. A key outside its window
-- starts a new one at 1; inside it, the count grows and is compared.
create or replace function check_payment_rate_limit(
  p_key            text,
  p_limit          integer default 5,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_count integer;
begin
  insert into rate_limits (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case
                  when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1
                  else rate_limits.count + 1
                end,
        window_start = case
                  when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now()
                  else rate_limits.window_start
                end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke execute on function check_payment_rate_limit(text, integer, integer) from public, anon, authenticated;
