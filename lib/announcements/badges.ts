// lib/announcements/badges.ts
//
// The number of new notices (08.9; Sam, 2026-10-18): the signed-in
// student's notices with neither Seen nor Dismissed — counted by the
// database on announcements_for_me()'s answer (a count, no rows sent).
// Called by the student layout for its first drawing and by the shell's
// recount (badge-actions.ts). Null when the count could not be read: the
// layout draws 0, the recount keeps the number it has. Server only, kept
// apart from queries.ts as lib/messaging/badges.ts is.

import type { ServerSupabaseClient } from '@/lib/access';

export async function getNewNoticeCount(db: ServerSupabaseClient): Promise<number | null> {
  const { count, error } = await db
    .rpc('announcements_for_me', {}, { count: 'exact', head: true })
    .is('seen_at', null)
    .is('dismissed_at', null);
  if (error) {
    console.error('getNewNoticeCount:', error);
    return null;
  }
  return count ?? 0;
}
