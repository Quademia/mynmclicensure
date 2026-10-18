// lib/announcements/badge-actions.ts
//
// The shell's recount of new notices (08.9), behind the student gate:
// asked when the app comes back to the screen, so a notice published
// while the student was away shows on the bell and the menu row.

'use server';

import { requireStudent } from '@/lib/access';
import { getNewNoticeCount } from './badges';

export async function recountNewNotices(): Promise<number | null> {
  const { supabase } = await requireStudent();
  return getNewNoticeCount(supabase);
}
