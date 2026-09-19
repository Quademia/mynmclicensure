-- 20260920010000_question_bank.sql — 08-question-bank.md B1 (rebuild.md
-- §8 S2, ticked by Sam 2026-09-19; D22 and the per-row gate)
--
-- The bank becomes one table. Until now it was eleven tables of one
-- shape, one per course (the spreadsheet era, where a course was a
-- tab): every bank change was eleven changes, a helper in code chose
-- the table by course from sixteen call sites, and a twelfth course
-- meant a migration, four policies, a code change and a deploy. S7 (the
-- attempts snapshot) and D8 (the answer columns off the browser roles)
-- would each have multiplied by eleven.
--
-- Four moves, in one file so the runner's transaction holds them
-- together — if the copy fails, nothing is dropped:
--   1. question_bank: the 25 columns as they were, plus course_id →
--      courses; item_id stays the key (the ids do not change, so every
--      id list in attempts, quizzes and packs stays valid). The six
--      per-table indexes once, course_id leading.
--   2. The eleven tables' rows copied in with their course id, and the
--      count checked against the sum of the eleven.
--   3. Four policies once. The read policy tests the caller's courses
--      as a set — `course_id in (select … from my_course_access())` —
--      which Postgres evaluates once per statement, not once per row
--      (the perf line of 2026-09-16: ~230 ms per Quiz Builder course
--      pick, ~2.2 s at a 10,000-row course, under the per-row call).
--   4. The eleven tables dropped, their forty-four policies with them.
-- Sam ruled the drop in the same file (2026-09-19). Prod carries the
-- same eleven tables with its own ids; this file runs there at the
-- next release, before cutover re-copies the bank into the one table.

set search_path = licensure_gh;

-- ── 1. the table ──────────────────────────────────────────────────────
create table if not exists question_bank (
  item_id         text primary key,
  course_id       text not null references courses (course_id),
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
  rationale_img   text,            -- public URL in licensure-gh-rationale-images
  subject         text,
  maintopic       text,
  subtopic        text,
  difficulty      text,
  marks           numeric not null default 1,
  batch_id        text,
  shuffle_options boolean not null default true   -- false for TF
);
create index if not exists question_bank_course_id_idx     on question_bank (course_id);
create index if not exists question_bank_maintopic_idx     on question_bank (course_id, maintopic);
create index if not exists question_bank_subtopic_idx      on question_bank (course_id, subtopic);
create index if not exists question_bank_subject_idx       on question_bank (course_id, subject);
create index if not exists question_bank_difficulty_idx    on question_bank (course_id, difficulty);
create index if not exists question_bank_question_type_idx on question_bank (course_id, question_type);
create index if not exists question_bank_batch_id_idx      on question_bank (course_id, batch_id);

-- ── 2. the eleven copied in, and counted ──────────────────────────────
do $$
declare
  pairs text[][] := array[
    ['items_gp', 'GP'],
    ['items_rn_med', 'RN_MED'],
    ['items_rn_surg', 'RN_SURG'],
    ['items_rm_ped_obs_hrn', 'RM_PED_OBS_HRN'],
    ['items_rm_mid', 'RM_MID'],
    ['items_rphn_pphn', 'RPHN_PPHN'],
    ['items_rphn_disease_ctrl', 'RPHN_DISEASE_CTRL'],
    ['items_rmhn_psych_nurs', 'RMHN_PSYCH_NURS'],
    ['items_rmhn_psych_ppharm', 'RMHN_PSYCH_PPHARM'],
    ['items_nac_basic_clin', 'NAC_BASIC_CLIN'],
    ['items_nac_basic_prev', 'NAC_BASIC_PREV']
  ];
  i int;
  expected bigint := 0;
  n bigint;
  actual bigint;
begin
  for i in 1 .. array_length(pairs, 1) loop
    execute format('select count(*) from %I', pairs[i][1]) into n;
    expected := expected + n;
    execute format($q$
      insert into question_bank (
        item_id, course_id, question_type, stem,
        option_a, fb_a, option_b, fb_b, option_c, fb_c,
        option_d, fb_d, option_e, fb_e, option_f, fb_f,
        correct, rationale, rationale_img, subject, maintopic, subtopic,
        difficulty, marks, batch_id, shuffle_options)
      select
        item_id, %L, question_type, stem,
        option_a, fb_a, option_b, fb_b, option_c, fb_c,
        option_d, fb_d, option_e, fb_e, option_f, fb_f,
        correct, rationale, rationale_img, subject, maintopic, subtopic,
        difficulty, marks, batch_id, shuffle_options
      from %I
      on conflict (item_id) do nothing$q$, pairs[i][2], pairs[i][1]);
  end loop;
  select count(*) into actual from question_bank;
  if actual <> expected then
    raise exception 'question_bank holds % rows but the eleven tables hold % — an item id repeats across courses; nothing dropped', actual, expected;
  end if;
end $$;

-- ── 3. four policies, the gate once per statement ─────────────────────
alter table question_bank enable row level security;
drop policy if exists question_bank_select on question_bank;
create policy question_bank_select on question_bank for select
using (
  auth_user_role() = 'ADMIN'
  or course_id in (select m.course_id from my_course_access() m)
);
drop policy if exists question_bank_insert on question_bank;
create policy question_bank_insert on question_bank for insert
with check (auth_user_role() = 'ADMIN');
drop policy if exists question_bank_update on question_bank;
create policy question_bank_update on question_bank for update
using (auth_user_role() = 'ADMIN');
drop policy if exists question_bank_delete on question_bank;
create policy question_bank_delete on question_bank for delete
using (auth_user_role() = 'ADMIN');

-- ── 4. the eleven go ──────────────────────────────────────────────────
drop table if exists items_gp, items_rn_med, items_rn_surg,
  items_rm_ped_obs_hrn, items_rm_mid,
  items_rphn_pphn, items_rphn_disease_ctrl,
  items_rmhn_psych_nurs, items_rmhn_psych_ppharm,
  items_nac_basic_clin, items_nac_basic_prev;

notify pgrst, 'reload schema';
