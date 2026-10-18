// lib/announcements/display.ts
//
// What a notice shows besides its words (08.7, 08.10, 08.13; Sam,
// 2026-10-18): when it went out, in a list's short form ("2h", "3d",
// "14 Sep") and the opened notice's long one ("18 Oct 2026"); its first
// line for a row; the kind's icon — one the app's set draws, else the
// megaphone (the kinds' own grid comes with 08.13); and its picture's two
// sizes in the bucket. The clock is read here, never in a component's
// render (AGENTS.md: react-hooks/purity). No database, no React.

import type { IconName } from '@/lib/nav/types';
import type { StudentAnnouncement } from './types';

export const PICTURE_BUCKET = 'licensure-gh-announcement-images';

/** When a notice went out: its start, else when it was made. */
export function noticeTime(a: Pick<StudentAnnouncement, 'start_at' | 'created_at'>): string | null {
  return a.start_at || a.created_at;
}

/** "now", "5m", "2h", "3d", "2w", then "14 Sep" (this year) or "14 Sep 2025". */
export function shortWhen(iso: string | null, now: number = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.max(0, Math.floor((now - t) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  if (days < 28) return `${Math.floor(days / 7)}w`;
  const d = new Date(t);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** "18 Oct 2026" */
export function longWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The notice's first line for a row: its plain text, one line, trimmed. */
export function firstLine(a: Pick<StudentAnnouncement, 'body_text' | 'body_html'>): string {
  const text = (a.body_text || (a.body_html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  return text.length > 140 ? `${text.slice(0, 139)}…` : text;
}

// The icons a kind may wear today — names the app's set draws. A kind
// whose icon is not here (the five's calendar and tag until 08.13 adds
// them) shows the megaphone.
const KIND_ICONS = new Set<IconName>([
  'megaphone', 'book', 'book-open', 'alert', 'flag', 'zap', 'timer', 'hourglass', 'graduation',
  'clipboard', 'target', 'chart', 'stethoscope', 'ticket', 'card', 'package', 'download', 'help',
]);

export function kindIcon(icon: string | null | undefined): IconName {
  return icon && KIND_ICONS.has(icon as IconName) ? (icon as IconName) : 'megaphone';
}

/** The picture's address: `list` the row's square, `full` the opened notice's (08.10). */
export function pictureUrl(path: string | null | undefined, size: 'list' | 'full'): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${PICTURE_BUCKET}/${path.replace(/^\/+|\/+$/g, '')}/${size}.webp`;
}

/** New: neither seen nor dismissed. */
export function isNew(a: Pick<StudentAnnouncement, 'seen_at' | 'dismissed_at'>): boolean {
  return !a.seen_at && !a.dismissed_at;
}
