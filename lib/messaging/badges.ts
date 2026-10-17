// lib/messaging/badges.ts
//
// The two Messages badges (08.2), each one count in the database: the
// student's open threads whose last message is an unread reply
// (msg_unread_count), and the open threads whose last message is a
// student's, unread by Quademia (msg_admin_unread_count). Server only —
// the service role — and called by the two layouts after their gates,
// and by the shell's recount (badge-actions.ts, 08.5a). Null when the
// count could not be read: the layout draws 0, the recount keeps the
// number it has. Kept apart from queries.ts, which the pages'
// browser halves import for their types: a server-only import there
// breaks the browser's build.

import { createServiceRoleClient } from '@/lib/supabase/server';

export async function getUnreadCountForUser(userId: string): Promise<number | null> {
  const { data, error } = await createServiceRoleClient().rpc('msg_unread_count', { p_user_id: userId });
  if (error) {
    console.error('getUnreadCountForUser:', error);
    return null;
  }
  return Number(data) || 0;
}

export async function getUnreadCountForAdmin(): Promise<number | null> {
  const { data, error } = await createServiceRoleClient().rpc('msg_admin_unread_count');
  if (error) {
    console.error('getUnreadCountForAdmin:', error);
    return null;
  }
  return Number(data) || 0;
}
