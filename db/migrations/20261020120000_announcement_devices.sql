-- 20261020120000_announcement_devices.sql — 08-help-and-news.md 08.15
-- (announcements on devices); ticked by Sam 2026-10-20 (12-tables.md,
-- "notification_devices": `kinds` gains `announcement`).
--
-- WHY. A notice published now with "Also send to devices" goes, once, to
-- the devices of the students it reaches (Sam, 2026-10-20). One yes brings
-- both: a student's yes on a device is to our replies and to important
-- news, and Profile's "Notifications on this device" holds the main switch
-- with each kind beneath it.
--
-- WHAT.
--   1. `kinds` may hold `announcement`.
--   2. Every device sent our replies gains `announcement` (one yes covers
--      both; on dev only Sam's test devices, on prod none yet).
--   3. notify_device_save() takes a list of kinds (a student's yes saves
--      both; a kind switched back on on Profile, one); the old one-kind
--      form goes.
--   4. notify_device_drop_kinds() in place of notify_device_drop_kind():
--      a list, so Profile's main switch off drops both of a student's kinds
--      in one step; the row goes with its last kind.
--   5. announcement_devices_preview(): how many devices the editor's
--      scopes would send to now — the switch's hint and Publish's question.
--   6. announcement_send_claim(): marks a notice sent (sent_at) — only a
--      live notice with the tick, never sent before — and says whether it
--      did; a second press finds it sent and sends nothing. Its devices are
--      then read by announcement_send_targets(), in batches (rule 10: the
--      API hands back at most 1,000 rows a request).
--
-- REACH. Dev now; prod at the next release Sam approves. The dev site runs
-- main's code until the merge, and main's code calls the two functions
-- this file replaces by their old shapes: on the dev site a student's
-- "Turn on" after a message and the admin's switch on Messages fail until
-- the merge (Sam told, 2026-10-20).

set search_path = licensure_gh;

-- ── 1. the kind ─────────────────────────────────────────────────────────
alter table notification_devices drop constraint if exists notification_devices_kinds_check;
alter table notification_devices add constraint notification_devices_kinds_check
  check (cardinality(kinds) >= 1 and kinds <@ array['reply', 'student_message', 'announcement']::text[]);

-- ── 2. one yes covers both ──────────────────────────────────────────────
update notification_devices
   set kinds = array(select distinct k from unnest(kinds || array['announcement']) as k order by k)
 where 'reply' = any (kinds) and not ('announcement' = any (kinds));

-- ── 3. a device says yes, to one kind or several ────────────────────────
drop function if exists notify_device_save(text, text, text, text, text, text);
create or replace function notify_device_save(
  p_user_id    text,
  p_session_id text,
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_kinds      text[]
)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_kinds text[];
begin
  v_kinds := array(select distinct k from unnest(coalesce(p_kinds, '{}')) as k where k is not null order by k);
  if cardinality(v_kinds) = 0
     or not (v_kinds <@ array['reply', 'student_message', 'announcement']::text[]) then
    return jsonb_build_object('ok', false, 'code', 'kind');
  end if;
  if p_endpoint is null or p_endpoint not like 'https://%' or char_length(p_endpoint) > 1000
     or char_length(coalesce(p_p256dh, '')) not between 40 and 200
     or char_length(coalesce(p_auth, '')) not between 10 and 100 then
    return jsonb_build_object('ok', false, 'code', 'device');
  end if;
  if not exists (
    select 1 from sessions s join users u on u.user_id = s.user_id
    where s.session_id = p_session_id and s.user_id = p_user_id
      and s.active and s.expires_utc > now() and u.active
  ) then
    return jsonb_build_object('ok', false, 'code', 'session');
  end if;

  insert into notification_devices (user_id, session_id, endpoint, key_p256dh, key_auth, kinds)
  values (p_user_id, p_session_id, p_endpoint, p_p256dh, p_auth, v_kinds)
  on conflict (endpoint) do update set
    session_id = excluded.session_id,
    key_p256dh = excluded.key_p256dh,
    key_auth   = excluded.key_auth,
    -- one person per address: the same person adds the kinds; a new
    -- person's yes takes the row with only theirs
    kinds = case when notification_devices.user_id = excluded.user_id
                 then array(select distinct k from unnest(notification_devices.kinds || excluded.kinds) as k order by k)
                 else excluded.kinds end,
    created_at = case when notification_devices.user_id = excluded.user_id
                      then notification_devices.created_at else now() end,
    last_sent_at = case when notification_devices.user_id = excluded.user_id
                        then notification_devices.last_sent_at end,
    user_id = excluded.user_id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function notify_device_save(text, text, text, text, text, text[]) from public, anon, authenticated;

-- ── 4. kinds switched off ───────────────────────────────────────────────
drop function if exists notify_device_drop_kind(text, text, text);
create or replace function notify_device_drop_kinds(
  p_user_id  text,
  p_endpoint text,
  p_kinds    text[]
)
returns boolean
language plpgsql
security definer
set search_path = licensure_gh
as $$
begin
  delete from notification_devices
   where endpoint = p_endpoint and user_id = p_user_id
     and kinds <@ coalesce(p_kinds, '{}');
  update notification_devices
     set kinds = array(select k from unnest(kinds) as k where not (k = any (p_kinds)) order by k)
   where endpoint = p_endpoint and user_id = p_user_id and kinds && coalesce(p_kinds, '{}');
  return true;
end;
$$;
revoke execute on function notify_device_drop_kinds(text, text, text[]) from public, anon, authenticated;

-- ── 5. how many devices the editor's scopes would send to now ───────────
create or replace function announcement_devices_preview(
  p_programs text[],
  p_levels   text[],
  p_cohort   text,
  p_kind     text,
  p_products text[],
  p_users    text[],
  p_courses  text[]
)
returns bigint
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select count(*)
  from notification_devices d
  join notice_people() p on p.user_id = d.user_id
  where 'announcement' = any (d.kinds)
    and p.role = 'STUDENT'
    and p.active
    and notice_scope_ok(p_programs, p_levels, p_cohort, p_kind, p_products, p_users, p_courses,
                        p.user_id, p.program_id, p.level, p.cohort, p.sub_kind, p.sub_product, p.held)
$$;
revoke execute on function announcement_devices_preview(text[], text[], text, text, text[], text[], text[]) from public, anon, authenticated;

-- ── 6. a notice's one send ──────────────────────────────────────────────
drop function if exists announcement_send_claim(text);
create function announcement_send_claim(p_announcement_id text)
returns boolean
language sql
security definer
set search_path = licensure_gh
as $$
  with claimed as (
    update announcements
       set sent_at = now()
     where announcement_id = p_announcement_id
       and sent_at is null
       and send_to_devices
       and status = 'active'
       and (start_at is null or start_at <= now())
       and (end_at is null or end_at >= now())
    returning 1
  )
  select exists (select 1 from claimed)
$$;
revoke execute on function announcement_send_claim(text) from public, anon, authenticated;

create or replace function announcement_send_targets(p_announcement_id text)
returns table (device_id bigint, endpoint text, key_p256dh text, key_auth text)
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select d.device_id, d.endpoint, d.key_p256dh, d.key_auth
  from announcements a
  cross join notice_people() p
  join notification_devices d on d.user_id = p.user_id
  where a.announcement_id = p_announcement_id
    and 'announcement' = any (d.kinds)
    and p.role = 'STUDENT'
    and p.active
    and notice_scope_ok(a.scope_programs, a.scope_level, a.scope_cohort,
                        a.scope_subscription_kind, a.scope_product_ids, a.scope_user_ids, a.scope_courses,
                        p.user_id, p.program_id, p.level, p.cohort,
                        p.sub_kind, p.sub_product, p.held)
  order by d.device_id
$$;
revoke execute on function announcement_send_targets(text) from public, anon, authenticated;

-- ── the table's grants, restated (rule 9): the browser holds nothing ────
revoke all on notification_devices from anon, authenticated;
