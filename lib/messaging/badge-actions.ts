// lib/messaging/badge-actions.ts
//
// The badge's recount (08.5a; Sam, 2026-10-17): the shell's live number
// (components/shell/unread-live.tsx) asks again when its live line says
// one of the caller's conversations changed, when the app comes back to
// the screen, and when the line reconnects after a drop. The same one
// count in the database the layouts draw first (badges.ts), behind the
// server's own gate: a student counts their unread replies, an admin the
// students waiting. Null when it could not be read.

'use server';

import { requireAdmin, requireStudent } from '@/lib/access';
import { getUnreadCountForAdmin, getUnreadCountForUser } from './badges';

export async function recountUnread(side: 'student' | 'admin'): Promise<number | null> {
  if (side === 'admin') {
    await requireAdmin();
    return getUnreadCountForAdmin();
  }
  const { profile } = await requireStudent();
  return getUnreadCountForUser(profile.user_id);
}
