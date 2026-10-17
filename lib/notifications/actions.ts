// lib/notifications/actions.ts — a device's yes, its quiet takeover, and
// the admin's switch off (08.5b; Sam, 2026-10-17). Server Actions; every
// write goes through the database's notify_* functions with the service
// role, naming the signed-in person and this device's sign-in (the
// session cookie), which the database checks is theirs and live:
//   saveDeviceAction — the device says yes to a kind (a student's
//     `reply` after the ask, an admin's `student_message` by the switch);
//   relinkDeviceAction — on each sitting, the same person's row moves to
//     this sign-in (the week ran out, they signed in again); returns the
//     kinds it is sent, none for a device that has not said yes — or that
//     another person on this phone said yes from;
//   dropKindAction — the admin's switch off.
// A refusal or a failed read answers plainly; the caller's page says so.

'use server';

import { cookies } from 'next/headers';
import { requireAdmin, requireStudent } from '@/lib/access';
import { SESSION_COOKIE } from '@/lib/auth/sessions';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { DeviceSubscription, NoticeKind, SaveDeviceResult } from './types';

function isKind(v: unknown): v is NoticeKind {
  return v === 'reply' || v === 'student_message';
}

async function gateFor(kind: NoticeKind) {
  return kind === 'student_message' ? requireAdmin() : requireStudent();
}

async function sessionId(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

async function kindsOf(userId: string, session: string, endpoint: string): Promise<NoticeKind[]> {
  const { data, error } = await createServiceRoleClient().rpc('notify_device_relink', {
    p_user_id: userId,
    p_session_id: session,
    p_endpoint: endpoint,
  });
  if (error) {
    console.error('notify_device_relink:', error);
    return [];
  }
  return ((data ?? []) as string[]).filter(isKind);
}

export async function saveDeviceAction(sub: DeviceSubscription, kind: NoticeKind): Promise<SaveDeviceResult> {
  if (!isKind(kind)) return { ok: false, error: 'Could not turn on notifications.' };
  const { profile } = await gateFor(kind);
  const session = await sessionId();
  const endpoint = String(sub?.endpoint ?? '');
  const p256dh = String(sub?.keys?.p256dh ?? '');
  const auth = String(sub?.keys?.auth ?? '');
  if (!session || !endpoint || !p256dh || !auth) return { ok: false, error: 'Could not turn on notifications on this device.' };
  const { data, error } = await createServiceRoleClient().rpc('notify_device_save', {
    p_user_id: profile.user_id,
    p_session_id: session,
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_kind: kind,
  });
  const r = (data ?? {}) as { ok?: boolean; code?: string };
  if (error || !r.ok) {
    if (error) console.error('notify_device_save:', error);
    return {
      ok: false,
      error: r.code === 'session' ? 'Please sign in again, then turn notifications on.' : 'Could not turn on notifications on this device.',
    };
  }
  return { ok: true, kinds: await kindsOf(profile.user_id, session, endpoint) };
}

export async function relinkDeviceAction(endpointIn: string): Promise<NoticeKind[]> {
  const { profile } = await requireStudent(); // an admin passes the student gate too
  const session = await sessionId();
  const endpoint = String(endpointIn ?? '');
  if (!session || !endpoint) return [];
  return kindsOf(profile.user_id, session, endpoint);
}

export async function dropKindAction(endpointIn: string, kind: NoticeKind): Promise<{ ok: boolean }> {
  if (!isKind(kind)) return { ok: false };
  const { profile } = await gateFor(kind);
  const endpoint = String(endpointIn ?? '');
  if (!endpoint) return { ok: false };
  const { error } = await createServiceRoleClient().rpc('notify_device_drop_kind', {
    p_user_id: profile.user_id,
    p_endpoint: endpoint,
    p_kind: kind,
  });
  if (error) console.error('notify_device_drop_kind:', error);
  return { ok: !error };
}
