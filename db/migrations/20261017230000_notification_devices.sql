-- 20261017230000_notification_devices.sql — 08-help-and-news.md (08.5b),
-- phone notifications; ticked by Sam on 2026-10-17 (12-tables.md,
-- "notification_devices").
--
-- WHY. Most replies come later, with nobody in the app. A phone or a
-- computer that says yes gives us a delivery address at its maker's post
-- office (Google, Apple, Mozilla); the server keeps it with the two keys
-- that seal each envelope, and sends a notice there while the app is
-- closed: "Quademia replied" to a student, "<name> wrote" to Quademia's
-- devices — the label only, never the message's text (Sam).
--
-- WHAT.
--   1. notification_devices: one row per delivery address — whose, the
--      sign-in it was allowed under, the address and its two keys, the
--      kinds it is sent (`reply` for a student, `student_message` for an
--      admin; a later kind is added here, each Sam's call), when added
--      and when last sent. No browser access.
--   2. A sign-out, or a bump by the two-device limit, deletes the
--      device's row as the sign-in ends (a trigger on sessions). The week
--      running out does not: the next sign-in of the same person takes
--      the row over (notify_device_relink).
--   3. notify_device_save(person, sign-in, address, keys, kind): the
--      sign-in must be theirs and live; one person per address — a new
--      person's yes moves the row to them with only their kind. Server
--      only.
--   4. notify_device_relink(person, sign-in, address): the quiet
--      takeover — the same person's row moves to this sign-in; another
--      person's row is left alone (they must say yes themselves). Returns
--      the row's kinds, empty when there is none. Server only.
--   5. notify_device_drop_kind(person, address, kind): the admin's switch
--      off; a row with no kind left is deleted. Server only.
--   6. notify_targets(kind, person): the devices a notice goes to — a
--      student's own for `reply`, every admin's for `student_message` —
--      never a deactivated account's. Server only.
--
-- REACH. Dev only; prod at the next release Sam approves. A new table and
-- a trigger that only deletes from it: nothing the dev site (main's code)
-- reads or writes changes.

set search_path = licensure_gh;

-- ── 1. the table ──────────────────────────────────────────────────────
create table if not exists notification_devices (
  device_id    bigint generated always as identity primary key,
  user_id      text not null references users (user_id) on delete cascade,
  session_id   text not null references sessions (session_id) on delete cascade,
  endpoint     text not null,
  key_p256dh   text not null,
  key_auth     text not null,
  kinds        text[] not null,
  created_at   timestamptz not null default now(),
  last_sent_at timestamptz,
  constraint notification_devices_endpoint_key unique (endpoint),
  constraint notification_devices_endpoint_check
    check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  constraint notification_devices_keys_check
    check (char_length(key_p256dh) between 40 and 200 and char_length(key_auth) between 10 and 100),
  constraint notification_devices_kinds_check
    check (cardinality(kinds) >= 1 and kinds <@ array['reply', 'student_message']::text[])
);

create index if not exists notification_devices_user_idx on notification_devices (user_id);
create index if not exists notification_devices_session_idx on notification_devices (session_id);

-- No browser path (rule 9: a new table starts with grant all to the
-- browser roles, so all of it is taken back).
alter table notification_devices enable row level security;
revoke all on notification_devices from anon, authenticated;
revoke all on sequence notification_devices_device_id_seq from anon, authenticated;

-- ── 2. a sign-in ended takes its device with it ───────────────────────
create or replace function notification_devices_session_ended()
returns trigger
language plpgsql
security definer
set search_path = licensure_gh
as $$
begin
  if old.active and not new.active then
    delete from notification_devices where session_id = new.session_id;
  end if;
  return new;
end;
$$;
revoke execute on function notification_devices_session_ended() from public, anon, authenticated;
drop trigger if exists notification_devices_session_ended on sessions;
create trigger notification_devices_session_ended after update of active on sessions
  for each row execute function notification_devices_session_ended();

-- ── 3. a device says yes ──────────────────────────────────────────────
create or replace function notify_device_save(
  p_user_id    text,
  p_session_id text,
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_kind       text
)
returns jsonb
language plpgsql
security definer
set search_path = licensure_gh
as $$
begin
  if p_kind is null or p_kind not in ('reply', 'student_message') then
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
  values (p_user_id, p_session_id, p_endpoint, p_p256dh, p_auth, array[p_kind])
  on conflict (endpoint) do update set
    session_id = excluded.session_id,
    key_p256dh = excluded.key_p256dh,
    key_auth   = excluded.key_auth,
    -- one person per address: the same person adds the kind; a new
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
revoke execute on function notify_device_save(text, text, text, text, text, text) from public, anon, authenticated;

-- ── 4. the quiet takeover by the same person ──────────────────────────
create or replace function notify_device_relink(
  p_user_id    text,
  p_session_id text,
  p_endpoint   text
)
returns text[]
language plpgsql
security definer
set search_path = licensure_gh
as $$
declare
  v_kinds text[];
begin
  if not exists (
    select 1 from sessions s
    where s.session_id = p_session_id and s.user_id = p_user_id
      and s.active and s.expires_utc > now()
  ) then
    return '{}'::text[];
  end if;
  update notification_devices
     set session_id = p_session_id
   where endpoint = p_endpoint and user_id = p_user_id
  returning kinds into v_kinds;
  return coalesce(v_kinds, '{}'::text[]);
end;
$$;
revoke execute on function notify_device_relink(text, text, text) from public, anon, authenticated;

-- ── 5. the admin's switch off ─────────────────────────────────────────
create or replace function notify_device_drop_kind(
  p_user_id  text,
  p_endpoint text,
  p_kind     text
)
returns boolean
language plpgsql
security definer
set search_path = licensure_gh
as $$
begin
  delete from notification_devices
   where endpoint = p_endpoint and user_id = p_user_id and kinds = array[p_kind];
  update notification_devices
     set kinds = array_remove(kinds, p_kind)
   where endpoint = p_endpoint and user_id = p_user_id and p_kind = any (kinds);
  return true;
end;
$$;
revoke execute on function notify_device_drop_kind(text, text, text) from public, anon, authenticated;

-- ── 6. where a notice goes ────────────────────────────────────────────
create or replace function notify_targets(
  p_kind    text,
  p_user_id text default null
)
returns table (device_id bigint, endpoint text, key_p256dh text, key_auth text)
language sql
stable
security definer
set search_path = licensure_gh
as $$
  select d.device_id, d.endpoint, d.key_p256dh, d.key_auth
  from notification_devices d
  join users u on u.user_id = d.user_id
  where p_kind = any (d.kinds)
    and u.active
    and case p_kind
          when 'reply' then d.user_id = p_user_id
          when 'student_message' then upper(coalesce(u.role, '')) = 'ADMIN'
          else false
        end
  order by d.device_id;
$$;
revoke execute on function notify_targets(text, text) from public, anon, authenticated;
