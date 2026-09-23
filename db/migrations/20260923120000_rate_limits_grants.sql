-- 20260923120000_rate_limits_grants.sql — D35, the payment limiter
-- (2026-09-23)
--
-- WHY. D35 (Sam, ruled 2026-09-18, built today) splits the payment
-- limiter into one tally per action — init and setup per address, verify
-- per payment — and makes it fail closed. All of that is code
-- (lib/payments/rate-limit.ts): check_payment_rate_limit() already takes
-- a limit and a window, so the function and the table's shape are
-- unchanged.
--
-- ── Rule 9 / D43: the slice that owns the table takes its grants back ──
--
-- rate_limits carried the schema's vanilla-era default for both browser
-- roles: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE.
-- RLS is on with no policies, so the row privileges were already
-- unusable — but TRUNCATE is not policed by RLS, and no browser has any
-- business with this table. Its only reader and writer is the SECURITY
-- DEFINER function above, called with the service role, whose EXECUTE
-- was revoked from the browser roles when it was made (20260915120000).
-- Nothing is granted back. Sam: under rule 9, 2026-09-23.

set search_path = licensure_gh;

revoke all on table rate_limits from anon, authenticated;
