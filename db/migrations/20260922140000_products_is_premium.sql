-- 20260922140000_products_is_premium.sql — rebuild.md §8 S14, the premium
-- marker on products (2026-09-22)
--
-- WHY. Premium was never stored. /premium-prep found its products by
-- parsing the id for the suffix `_2026_PREP` and taking the cheapest per
-- programme (premium-prep-client.tsx, PREP_SUFFIX). Two things are wrong
-- with that. The suffix carries a YEAR, so the convention expires in 2027
-- — every premium product would need renaming, or the code a second
-- suffix. And it is weaker than the rule the other two doors use: it has
-- no price gate at all, so a zero-price `_2026_PREP` product is
-- selectable and payable, where paidProductsOf() would have refused it.
--
-- Ruled by Sam as D23 item 4 (2026-09-18); authorised as §8 S14
-- (2026-09-22, option A).
--
-- NO TIER COLUMN. `products.kind` already carries TRIAL / FREE / PAID
-- (6 / 5 / 21 active rows on dev). Premium is a subset of PAID, so a
-- boolean is the whole of what is missing; a `tier` column would
-- duplicate `kind`.

set search_path = licensure_gh;

alter table products
  add column if not exists is_premium boolean not null default false;

comment on column products.is_premium is
  'Premium Prep marker (§8 S14). Replaces the _2026_PREP id suffix, which carried a year and had no price gate. A subset of kind = PAID.';

-- The five rows the suffix identified on dev: RN / RM / RMHN / RPHN /
-- NACNAP _2026_PREP. `right(...)` rather than LIKE so no escape rules
-- are involved in reading this later.
update products
   set is_premium = true
 where right(product_id, 10) = '_2026_PREP';

-- ── Rule 9 / D43: this slice touches the table, so it takes the grants
-- back ───────────────────────────────────────────────────────────────
--
-- products carried the schema's vanilla-era default for both browser
-- roles: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE.
-- The policies were already right (insert and update both required
-- ADMIN, and there was no delete policy at all), so nothing was
-- exploitable through the API — but RLS does not gate TRUNCATE, and a
-- privilege no role needs is one nothing has to keep being right about.
--
-- anon KEEPS SELECT, unlike course_access: /subscribe, /premium-prep and
-- the landing page read the catalogue through the cookie client, so a
-- logged-out visitor reads products as anon (app/subscribe/page.tsx:25).

revoke all on products from anon, authenticated;
grant select on products to anon, authenticated;

-- The admin Products page now writes through the service role behind
-- requireAdmin() (lib/catalogue/actions.ts), so these two policed a
-- privilege no role holds any more. Rule 9 says drop them rather than
-- leave a rule that reads as protection and is not. service_role has
-- rolbypassrls = true (checked on dev), so the admin writes go through
-- with no policy needed — the same shape as payments and course_access.
drop policy if exists products_insert on products;
drop policy if exists products_update on products;

-- products_select (qual `true`) stays: the catalogue is public by design
-- and D23 item 1 rules that anyone may buy any product — the page adapts,
-- it does not filter.
