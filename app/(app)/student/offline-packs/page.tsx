// app/(app)/student/offline-packs/page.tsx — My packs (07.8; Sam,
// 2026-10-15: layout A, drawn at
// https://claude.ai/artifact/NrEnZUieGVsFmZkZEmjbFm).
//
// One section per course the student can make packs from (the pack door):
// its name, the package's allowance as a five-step bar ("2 made · 3 left";
// no bar with no limit or past ten), Build a pack, and its packs as rows,
// newest first — a row opens the pack's own page. Packs of a course no
// longer open to packs (an ended package) sit under "Made earlier" and
// still open. A trial or free student gets the locked card; a student with
// no pack yet, the one-line way in. No filters, counts or ids (Sam).
// Offline — the packs on this phone, the last score — comes with 07.3.
//
// A Server Component: two reads (the door, the packs) and the course
// titles the catalogue already holds; nothing waits on the browser.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getCourses } from '@/lib/catalogue/queries';
import { getPackDoor } from '@/lib/offline-packs/door';
import { listMyPacks } from '@/lib/offline-packs/queries';
import type { MyPackRow } from '@/lib/offline-packs/types';
import { PageHeader } from '@/components/shell/page-header';
import { AppLink } from '@/components/shell/link-pending';
import '@/styles/practice-papers.css';
import '@/styles/student-offline-packs.css';

export const metadata: Metadata = {
  title: 'My packs | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

const BUILD = '/student/offline-packs/build';
const PACKAGES_HREF = '/student/upgrade';
/** Past this many packs a bar would be a fence; the words alone say it. */
const BAR_MAX = 10;

function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function questions(n: number): string {
  return `${n} ${n === 1 ? 'question' : 'questions'}`;
}

function PackRows({ packs, titles }: { packs: MyPackRow[]; titles?: Record<string, string> }) {
  return (
    <ul className="pp-list card opk-list">
      {packs.map((p) => (
        <li key={p.pack_id}>
          <AppLink href={`/student/offline-packs/${encodeURIComponent(p.pack_id)}`} className="pp-row">
            <span className="pp-row-main">
              <span className="pp-name">{p.pack_name || 'Offline pack'}</span>
              <span className="pp-line">
                {titles ? `${titles[p.course_id] ?? p.course_id} · ` : ''}
                {questions(p.question_count)} · {shortDay(p.created_utc)}
              </span>
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
function Allowance({ allowed, left }: { allowed: number | null | undefined; left: number | null | undefined }) {
  if (allowed === null || allowed === undefined || left === null || left === undefined) {
    return <span className="pp-line">No limit</span>;
  }
  const made = Math.max(0, allowed - left);
  const words = made ? `${made} made · ${left} left` : `${left} left`;
  return (
    <span className="opk-allowance">
      {allowed > 0 && allowed <= BAR_MAX ? (
        <span className="opk-bar" aria-hidden="true">
          {Array.from({ length: allowed }, (_, i) => (
            <span key={i} className={i < made ? 'opk-seg opk-seg-made' : 'opk-seg'} />
          ))}
        </span>
      ) : null}
      <span className="pp-line">{words}</span>
    </span>
  );
}

export default async function MyPacksPage() {
  const gate = await requireStudent();
  const [door, packs, courses] = await Promise.all([
    getPackDoor(gate),
    listMyPacks(gate.supabase, gate.profile.user_id),
    getCourses(gate.supabase),
  ]);
  const titles: Record<string, string> = Object.fromEntries(courses.map((c) => [c.course_id, c.title]));
  const mine = packs ?? [];
  const open = new Set(door.map((c) => c.course_id));
  const earlier = mine.filter((p) => !open.has(p.course_id));

  return (
    <div className="pp-page opk">
      <PageHeader title="My packs" subtitle="Packs of questions to practise anywhere, even with no signal." />

      {packs === null ? <p className="pp-note">Your packs could not be loaded. Please refresh the page.</p> : null}

      {!door.length ? (
        <div className="card pp-card">
          <span className="pp-big">Offline packs come with a package</span>
          <span className="pp-line">With a package you can make packs of questions, practise them on your phone with no signal, and print them.</span>
          <AppLink href={PACKAGES_HREF} className="btn btn-primary btn-lg pp-package">
            Choose a package
          </AppLink>
        </div>
      ) : !mine.length ? (
        <div className="card pp-card">
          <span className="pp-big">Make a pack to practise offline</span>
          <span className="pp-line">
            Pick questions from a course. The pack stays on your phone, so you can practise with no signal, and you can print it.
          </span>
        </div>
      ) : null}

      {door.map((c) => {
        const here = mine.filter((p) => p.course_id === c.course_id);
        return (
          <section key={c.course_id} className="opk-course" aria-labelledby={`opk-${c.course_id}`}>
            <div className="opk-head">
              <div className="opk-head-main">
                <h2 id={`opk-${c.course_id}`} className="opk-title">
                  {c.title}
                </h2>
                <Allowance allowed={c.packsAllowed} left={c.packsLeft} />
              </div>
              {c.packsLeft === 0 ? null : (
                <AppLink href={`${BUILD}?course=${encodeURIComponent(c.course_id)}`} className="btn btn-ghost opk-build">
                  Build a pack
                </AppLink>
              )}
            </div>
            {here.length ? <PackRows packs={here} /> : <p className="pp-line">No packs in this course yet.</p>}
          </section>
        );
      })}

      {earlier.length ? (
        <section className="opk-course" aria-labelledby="opk-earlier">
          <div className="opk-head-main">
            <h2 id="opk-earlier" className="opk-title">
              Made earlier
            </h2>
            <span className="pp-line">Packs you made with a package still open.</span>
          </div>
          <PackRows packs={earlier} titles={titles} />
        </section>
      ) : null}
    </div>
  );
}
