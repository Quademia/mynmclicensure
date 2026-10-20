// lib/notifications/send.ts — sending a notice (08.5b; Sam, 2026-10-17;
// announcements 08.15, 2026-10-20). Server only. Called through
// next/server's after() by the Messages actions and the announcement save,
// so the button answers first and the notice follows (on Cloudflare the
// Worker is kept alive for it).
//
// A message's notice says who and the label only — "Quademia replied" /
// "Payment or package" to a student, "Ama Owusu wrote" / the label to
// Quademia's devices — never the message's text (Sam: phones are shared).
// An announcement's says its title and first line (Sam, 2026-10-20: a
// notice is not private, and on slow data the notice carries the news);
// it goes once, when published now, to the devices that said yes of the
// students it reaches (announcement_send_claim() marks it sent first).
// Each device's envelope is sealed and signed by
// @block65/webcrypto-web-push (pinned; Sam, 2026-10-17: a library others
// test against Google, Apple and Mozilla, over our own) and handed to its
// post office with fetch, a hundred at a time (Cloudflare allows a request
// 10,000 such calls on our plan, and keeps it alive about 30 seconds after
// the answer: a few hundred devices a send is well inside both). A post
// office that answers 404 or 410 has dropped the address: the row goes.
// A message's topic is the conversation, so a second reply waiting on a
// phone that is off replaces the first; an announcement's is the notice,
// so each notice stays. Held a day for a phone with no signal, then
// dropped — the badge still shows on the next open.

import { buildPushPayload } from '@block65/webcrypto-web-push';
import { firstLineOf } from '@/lib/editor/doc';
import type { RichDoc } from '@/lib/editor/types';
import { labelWords } from '@/lib/messaging/types';
import { readAll, slices } from '@/lib/supabase/read-all';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { vapidKeys } from './keys';
import type { Notice, NoticeKind } from './types';

type Target = { device_id: number; endpoint: string; key_p256dh: string; key_auth: string };

const HOLD_S = 86_400;
const AT_ONCE = 100;

/** The conversation's student and what it is about: the label, or the course's title. */
async function aboutThread(threadId: string): Promise<{ userId: string; about: string; name: string } | null> {
  const db = createServiceRoleClient();
  const { data: t } = await db.from('messages_threads').select('user_id, context_type, course_id').eq('thread_id', threadId).maybeSingle();
  if (!t) return null;
  const [course, user] = await Promise.all([
    t.context_type === 'course' && t.course_id
      ? db.from('courses').select('title').eq('course_id', t.course_id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from('users').select('forename, surname, name').eq('user_id', t.user_id).maybeSingle(),
  ]);
  const about = t.context_type === 'course' ? ((course.data?.title as string | undefined) || t.course_id || 'A course') : labelWords(t.context_type);
  const u = user.data as { forename: string | null; surname: string | null; name: string | null } | null;
  const name = [u?.forename, u?.surname].filter(Boolean).join(' ').trim() || u?.name || 'A student';
  return { userId: t.user_id as string, about, name };
}

/** Seals and hands the notice to each device's post office; drops the dead, stamps the sent. */
async function deliverTo(targets: Target[], notice: Notice, topic: string): Promise<void> {
  const vapid = vapidKeys();
  if (!vapid || !targets.length) return;
  const db = createServiceRoleClient();
  const sent: number[] = [];
  const dead: number[] = [];
  const topicOk = /^[A-Za-z0-9_-]{1,32}$/.test(topic);
  for (const batch of slices(targets, AT_ONCE)) {
    await Promise.all(
      batch.map(async (t) => {
        try {
          const req = await buildPushPayload(
            { data: notice, options: { ttl: HOLD_S, urgency: 'normal', ...(topicOk ? { topic } : {}) } },
            { endpoint: t.endpoint, expirationTime: null, keys: { p256dh: t.key_p256dh, auth: t.key_auth } },
            vapid,
          );
          // fetch sets the length itself
          const { 'content-length': _length, ...headers } = req.headers;
          void _length;
          const res = await fetch(t.endpoint, { method: 'POST', headers, body: req.body });
          if (res.ok) sent.push(t.device_id);
          else if (res.status === 404 || res.status === 410) dead.push(t.device_id);
          else console.error('notify deliver:', res.status, new URL(t.endpoint).host);
        } catch (e) {
          console.error('notify deliver failed:', e instanceof Error ? e.message : e);
        }
      }),
    );
  }
  const at = new Date().toISOString();
  for (const ids of slices(dead)) await db.from('notification_devices').delete().in('device_id', ids);
  for (const ids of slices(sent)) await db.from('notification_devices').update({ last_sent_at: at }).in('device_id', ids);
}

/** A message's notice: one student's devices (`reply`), or every admin's (`student_message`). */
async function deliver(kind: NoticeKind, userId: string | null, notice: Notice, topic: string): Promise<void> {
  if (!vapidKeys()) return;
  const { data, error } = await createServiceRoleClient().rpc('notify_targets', { p_kind: kind, p_user_id: userId });
  if (error) {
    console.error('notify_targets:', error);
    return;
  }
  await deliverTo((data ?? []) as Target[], notice, topic);
}

/** Quademia replied: to the student's own devices. */
export async function notifyReply(threadId: string): Promise<void> {
  try {
    const t = await aboutThread(threadId);
    if (!t) return;
    await deliver(
      'reply',
      t.userId,
      { title: 'Quademia replied', body: t.about, url: `/student/messages?thread=${encodeURIComponent(threadId)}`, tag: `thread-${threadId}` },
      threadId,
    );
  } catch (e) {
    console.error('notifyReply:', e instanceof Error ? e.message : e);
  }
}

/** A student wrote: to every admin device that switched it on. */
export async function notifyStudentMessage(threadId: string): Promise<void> {
  try {
    const t = await aboutThread(threadId);
    if (!t) return;
    await deliver(
      'student_message',
      null,
      {
        title: `${t.name} wrote`,
        body: t.about,
        url: `/admin/messages/${encodeURIComponent(t.userId)}?thread=${encodeURIComponent(threadId)}`,
        tag: `thread-${threadId}`,
      },
      threadId,
    );
  } catch (e) {
    console.error('notifyStudentMessage:', e instanceof Error ? e.message : e);
  }
}

/**
 * A notice published now with "Also send to devices": once. The database
 * marks it sent first, so a second press, or a notice already sent, sends
 * nothing; then its devices are read, a thousand at a time (AGENTS.md
 * rule 10).
 */
export async function notifyAnnouncement(announcementId: string, title: string, body: RichDoc): Promise<void> {
  try {
    if (!vapidKeys()) return;
    const db = createServiceRoleClient();
    const { data: claimed, error } = await db.rpc('announcement_send_claim', { p_announcement_id: announcementId });
    if (error) {
      console.error('announcement_send_claim:', error);
      return;
    }
    if (!claimed) return;
    const targets = await readAll<Target>((from, to) => db.rpc('announcement_send_targets', { p_announcement_id: announcementId }).range(from, to));
    if (targets.error) {
      console.error('announcement_send_targets:', targets.error);
      return;
    }
    const line = firstLineOf(body, 120);
    await deliverTo(
      targets.data,
      {
        title: title.length > 80 ? `${title.slice(0, 79)}…` : title,
        body: line || 'Open it in the app to read it.',
        url: `/student/announcements?id=${encodeURIComponent(announcementId)}`,
        tag: `notice-${announcementId}`,
      },
      announcementId,
    );
  } catch (e) {
    console.error('notifyAnnouncement:', e instanceof Error ? e.message : e);
  }
}
