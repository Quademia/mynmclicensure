-- 20260923140000_subscriptions_one_per_payment.sql — rebuild.md §8 S15,
-- one subscription per Paystack payment (2026-09-23)
--
-- WHY. activatePaymentForUser() (lib/payments/activate.ts) checks for a
-- subscription carrying this payment's reference, then inserts one. That
-- is check-then-write with nothing behind it: two callers in the same
-- second both see "none" and both insert, and the buyer holds two
-- receipts — two years queued for one payment. Latent today (the
-- confirmation page open in two tabs); routine once the Paystack webhook
-- (D4) and the returning browser race each other, which is what they
-- will do on every payment. The index makes the database the gate; the
-- code treats its refusal as "the other door won".
--
-- Authorised as §8 S15 (Sam, 2026-09-23, as drafted, the rule-9 job
-- included).
--
-- PARTIAL, on PAYSTACK only. The other sources reuse `source_ref` for
-- things that are not unique by design: ADMIN writes 'admin_grant' on
-- every grant, SELF_TRIAL_SIGNUP the user's id.

set search_path = licensure_gh;

-- Refuse to run over a duplicate rather than fail half-applied: if two
-- PAYSTACK receipts already share a reference, a person decides which
-- one stands. Checked on dev before writing this: 1 row, 1 reference.
do $$
declare
  dupes int;
begin
  select count(*) into dupes
    from (
      select source_ref
        from subscriptions
       where source = 'PAYSTACK' and source_ref is not null
       group by source_ref
      having count(*) > 1
    ) d;
  if dupes > 0 then
    raise exception 'S15: % payment reference(s) already hold more than one PAYSTACK subscription — resolve by hand before this migration', dupes;
  end if;
end
$$;

create unique index if not exists subscriptions_paystack_ref_key
  on subscriptions (source_ref)
  where source = 'PAYSTACK';

comment on index subscriptions_paystack_ref_key is
  'One subscription per Paystack payment (§8 S15). activatePaymentForUser() reads a unique violation here as the other caller having won.';

-- ── Rule 9 / D43: this slice touches the table, so it takes the grants
-- back ───────────────────────────────────────────────────────────────
--
-- subscriptions carried the schema's vanilla-era default for both
-- browser roles: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE,
-- UPDATE. The policies let only an ADMIN write and had no delete policy,
-- so a student could never write — but RLS does not gate TRUNCATE, and
-- the admin page wrote through the admin's own cookie client, which made
-- the browser role's write privilege load-bearing.
--
-- authenticated keeps SELECT: the student's dashboard, upgrade page,
-- profile and announcements, and the admin's list and user pages, read
-- through the cookie client under subscriptions_select. anon gets
-- nothing: no signed-out page reads this table (the payment pages read
-- it with the service role), and subscriptions_select matches no row for
-- anon anyway.

revoke all on subscriptions from anon, authenticated;
grant select on subscriptions to authenticated;

-- The admin writes now go through the service role behind requireAdmin()
-- (lib/subscriptions/actions.ts), so these two policed a privilege no
-- role holds any more. service_role bypasses RLS, as for products (S14),
-- payments and course_access.
drop policy if exists subscriptions_insert on subscriptions;
drop policy if exists subscriptions_update on subscriptions;
