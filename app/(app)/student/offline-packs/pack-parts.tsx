// app/(app)/student/offline-packs/pack-parts.tsx — the pieces My packs and
// a course's packs share (07.8, redrawn as C; Sam, 2026-10-15: like Practice
// Papers, https://claude.ai/artifact/NrEnZUieGVsFmZkZEmjbFm). The course
// card is Practice Papers' own (courses.css .cp-card, practice-papers.css
// .pp-bar) with the packs' navy bar: one tap, the whole card, opening the
// course's packs; its foot line only tells ("2 packs · newest: …"). The
// rows are Practice Papers' rows with a pack's On this phone mark.

import { AppLink } from '@/components/shell/link-pending';
import type { MyPackRow } from '@/lib/offline-packs/types';
import { PhoneLine } from './phone-pack';

export const BUILD_HREF = '/student/offline-packs/build';
/** Past this many packs a bar would be a fence; the words alone say it. */
const BAR_MAX = 10;

export function courseHref(courseId: string): string {
  return `/student/offline-packs/course/${encodeURIComponent(courseId)}`;
}

function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function questions(n: number): string {
  return `${n} ${n === 1 ? 'question' : 'questions'}`;
}

/** A course's packs, newest first; a row opens the pack's own page. */
export function PackRows({ packs }: { packs: MyPackRow[] }) {
  return (
    <ul className="pp-list card opk-list">
      {packs.map((p) => (
        <li key={p.pack_id}>
          <AppLink href={`/student/offline-packs/${encodeURIComponent(p.pack_id)}`} className="pp-row">
            <span className="pp-row-main">
              <span className="pp-name">{p.pack_name || 'Offline pack'}</span>
              <span className="pp-line">
                {questions(p.question_count)} · {shortDay(p.created_utc)}
              </span>
              <PhoneLine packId={p.pack_id} />
            </span>
            <span className="pp-chev" aria-hidden="true">
              ›
            </span>
          </AppLink>
        </li>
      ))}
    </ul>
  );
}

/** The package's allowance: a bar of its packs (made filled) and the words. */
export function Allowance({ allowed, left }: { allowed: number | null | undefined; left: number | null | undefined }) {
  if (allowed === null || allowed === undefined || left === null || left === undefined) {
    return <span className="cp-line">No limit</span>;
  }
  const made = Math.max(0, allowed - left);
  const words = made ? `${made} made · ${left} left` : `No packs yet · ${left} to make`;
  return (
    <>
      {allowed > 0 && allowed <= BAR_MAX ? (
        <span className="pp-bar" aria-hidden="true">
          {Array.from({ length: allowed }, (_, i) => (
            <i key={i} className={i < made ? 'pp-seg opk-seg opk-seg-made' : 'pp-seg opk-seg'} />
          ))}
        </span>
      ) : null}
      <span className="cp-line">{words}</span>
    </>
  );
}

/** What a course card's foot line says: its packs, or the way in. */
function footLine(packs: MyPackRow[], canBuild: boolean): string {
  if (!packs.length) return canBuild ? 'Build a pack' : 'No packs';
  const newest = packs[0].pack_name || 'Offline pack';
  return packs.length === 1 ? `1 pack · ${newest}` : `${packs.length} packs · newest: ${newest}`;
}

/** One course on My packs: the whole card opens its packs (as Practice Papers' does). */
export function CourseCard({
  courseId,
  title,
  packs,
  allowance,
}: {
  courseId: string;
  title: string;
  /** This course's packs, newest first. */
  packs: MyPackRow[];
  /** The package's allowance; null for a course whose package has ended. */
  allowance: { allowed: number | null | undefined; left: number | null | undefined } | null;
}) {
  return (
    <AppLink href={courseHref(courseId)} className="card cp-card">
      <span className="cp-name">{title}</span>
      {allowance ? <Allowance allowed={allowance.allowed} left={allowance.left} /> : <span className="cp-line">Made with an earlier package</span>}
      <span className="cp-next">
        <span className="cp-next-text">{footLine(packs, Boolean(allowance) && allowance?.left !== 0)}</span>
        <span className="cp-chev" aria-hidden="true">
          ›
        </span>
      </span>
    </AppLink>
  );
}
