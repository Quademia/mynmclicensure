-- 20260913120000_question_bank_tables.sql — slice 4a
--
-- The question bank: the eleven item tables, transcribed from
-- legacy/db/schema.sql and rls.sql into the `licensure_gh` schema, one
-- table per course with an identical shape (rebuild.md §8 S2 — kept as
-- eleven). Plus the rationale-image bucket and the entitlement gate.
--
-- No content copy in this migration (unlike slice 3). Dev's eleven tables
-- are loaded from Sam's CSV exports of prod (2026-09-13); prod is copied
-- at cutover by the §6.6 SQL. A `select from public.items_*` here would
-- have pulled dev's sample rows in first and collided with the export.
--
-- Entitlement (rebuild.md §9 defect 3): legacy let any signed-in user read
-- every question in every course, checking the subscription only in the
-- browser. Each table's SELECT policy now goes through one function,
-- user_has_course(course_id). Until slice 8 lands `subscriptions` the
-- function allows any signed-in user — legacy's behaviour — so slices 5–7
-- can be tested; slice 8 replaces its body with the subscription check and
-- carries the "no subscription cannot read" test (Sam, 2026-09-13).
--
-- The bucket is global to the project, so it carries the `licensure-gh-`
-- prefix (AGENTS.md rule #1). Public read, as legacy's `rationale-images`
-- was: the public URL is stored in `rationale_img` and rendered by the
-- runner. Uploads come from the server only (service role), never from
-- the browser. The 2 MB limit legacy enforced in the browser is set on
-- the bucket as well.

set search_path = licensure_gh;

-- ── the entitlement gate ───────────────────────────────────────────────
-- Slice 8 replaces the body. The signature and the SECURITY DEFINER are
-- what the eleven policies depend on and do not change.
create or replace function user_has_course(p_course_id text)
returns boolean
language sql
security definer
stable
set search_path = licensure_gh
as $$
  select auth.uid() is not null
$$;

-- ── the eleven item tables ─────────────────────────────────────────────
-- items_<course_id lower-cased>; the course ids are the legacy ones.
do $$
declare
  t text;   -- table suffix, e.g. rn_med
  c text;   -- course id,     e.g. RN_MED
begin
  foreach t in array array[
    'gp',
    'rn_med', 'rn_surg',
    'rm_ped_obs_hrn', 'rm_mid',
    'rphn_pphn', 'rphn_disease_ctrl',
    'rmhn_psych_nurs', 'rmhn_psych_ppharm',
    'nac_basic_clin', 'nac_basic_prev'
  ] loop
    c := upper(t);

    execute format($f$
      create table if not exists items_%1$s (
        item_id         text primary key,
        question_type   text not null default 'MCQ',   -- MCQ | TF | SATA
        stem            text not null,
        option_a        text, fb_a text,
        option_b        text, fb_b text,
        option_c        text, fb_c text,
        option_d        text, fb_d text,
        option_e        text, fb_e text,
        option_f        text, fb_f text,
        correct         text not null,   -- "b" for MCQ / TF; "a,c,e" for SATA
        rationale       text,
        rationale_img   text,            -- public URL in the rationale-images bucket
        subject         text,
        maintopic       text,
        subtopic        text,
        difficulty      text,
        marks           numeric not null default 1,
        batch_id        text,
        shuffle_options boolean not null default true   -- false for TF
      )$f$, t);

    execute format('create index if not exists items_%1$s_maintopic_idx     on items_%1$s (maintopic)', t);
    execute format('create index if not exists items_%1$s_subtopic_idx      on items_%1$s (subtopic)', t);
    execute format('create index if not exists items_%1$s_subject_idx       on items_%1$s (subject)', t);
    execute format('create index if not exists items_%1$s_difficulty_idx    on items_%1$s (difficulty)', t);
    execute format('create index if not exists items_%1$s_question_type_idx on items_%1$s (question_type)', t);
    execute format('create index if not exists items_%1$s_batch_id_idx      on items_%1$s (batch_id)', t);

    execute format('alter table items_%1$s enable row level security', t);

    -- read: through the gate; write: ADMIN, as legacy.
    execute format('drop policy if exists items_%1$s_select on items_%1$s', t);
    execute format('create policy items_%1$s_select on items_%1$s for select using (user_has_course(%2$L))', t, c);

    execute format('drop policy if exists items_%1$s_insert on items_%1$s', t);
    execute format('create policy items_%1$s_insert on items_%1$s for insert with check (auth_user_role() = ''ADMIN'')', t);

    execute format('drop policy if exists items_%1$s_update on items_%1$s', t);
    execute format('create policy items_%1$s_update on items_%1$s for update using (auth_user_role() = ''ADMIN'')', t);

    execute format('drop policy if exists items_%1$s_delete on items_%1$s', t);
    execute format('create policy items_%1$s_delete on items_%1$s for delete using (auth_user_role() = ''ADMIN'')', t);
  end loop;
end $$;

-- ── the rationale-image bucket ─────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('licensure-gh-rationale-images', 'licensure-gh-rationale-images', true, 2097152)
on conflict (id) do nothing;
