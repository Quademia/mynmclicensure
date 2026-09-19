-- 20260919150000_payments_raw_scrub.sql — D32 (Sam, 2026-09-18)
--
-- The port saved Paystack's whole initialize and verify replies in
-- payments.raw: card bin, expiry, bank, brand, a reusable
-- authorization_code, the payer's IP, none of it read by the app,
-- all of it shown by the admin's raw toggle and kept forever. From
-- this build the app trims a reply before writing it
-- (lib/payments/trim.ts); this is the one-time scrub of the rows
-- already stored, to the same allow-list:
--   init   → status, message, data.reference
--   verify → status, message, data.{id, reference, status, amount,
--            currency, channel, paid_at, gateway_response,
--            customer.email, authorization.{channel, card_type, last4}}
-- Other keys in raw (flow, init_error, setup_complete — the app's own
-- notes) are left as they are. A row without init or verify is
-- untouched. Idempotent: a trimmed row trims to itself.
--
-- The helper lives in pg_temp so it exists for this transaction only
-- and never picks up this schema's default EXECUTE grant.

set search_path = licensure_gh;

create function pg_temp.trim_paystack_raw(r jsonb) returns jsonb
language plpgsql
as $$
declare
  v jsonb := r;
  d jsonb;
  a jsonb;
  c jsonb;
begin
  if v is null or jsonb_typeof(v) <> 'object' then
    return v;
  end if;

  if v ? 'init' and jsonb_typeof(v->'init') = 'object' then
    v := jsonb_set(v, '{init}', jsonb_strip_nulls(jsonb_build_object(
      'status',  v->'init'->'status',
      'message', v->'init'->'message',
      'data',    case when jsonb_typeof(v->'init'->'data') = 'object'
                      then jsonb_build_object('reference', v->'init'->'data'->'reference')
                 end
    )));
  end if;

  if v ? 'verify' and jsonb_typeof(v->'verify') = 'object' then
    d := case when jsonb_typeof(v->'verify'->'data') = 'object' then v->'verify'->'data' end;
    a := case when d is not null and jsonb_typeof(d->'authorization') = 'object'
              then jsonb_build_object(
                'channel',   d->'authorization'->'channel',
                'card_type', d->'authorization'->'card_type',
                'last4',     d->'authorization'->'last4')
         end;
    c := case when d is not null and jsonb_typeof(d->'customer') = 'object'
              then jsonb_build_object('email', d->'customer'->'email')
         end;
    v := jsonb_set(v, '{verify}', jsonb_strip_nulls(jsonb_build_object(
      'status',  v->'verify'->'status',
      'message', v->'verify'->'message',
      'data',    case when d is not null then jsonb_build_object(
                   'id',               d->'id',
                   'reference',        d->'reference',
                   'status',           d->'status',
                   'amount',           d->'amount',
                   'currency',         d->'currency',
                   'channel',          d->'channel',
                   'paid_at',          d->'paid_at',
                   'gateway_response', d->'gateway_response',
                   'customer',         c,
                   'authorization',    a)
                 end
    )));
  end if;

  return v;
end;
$$;

update payments
set raw = pg_temp.trim_paystack_raw(raw)
where raw is not null and (raw ? 'init' or raw ? 'verify');

drop function pg_temp.trim_paystack_raw(jsonb);
